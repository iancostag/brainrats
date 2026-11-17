"use client";

import {
  BookMarked,
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  Compass,
  Copy,
  Flame,
  GitMerge,
  Info,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AutoSyncGroupCard } from "@/components/auto-sync-group-card";
import { ChallengesTab } from "@/components/challenges-tab";
import { CheckinCard } from "@/components/checkin-card";
import { CheckinForm } from "@/components/checkin-form";
import { DiaryTab } from "@/components/diary-tab";
import { IntegrationsTab } from "@/components/integrations-tab";
import {
  clearStoredToken,
  fetchChallengeDetail,
  fetchChallengeFeed,
  fetchChallenges,
  registerRestDay,
  syncIntegrations,
  type ChallengeDetail,
  type ChallengeListItem,
  type CheckIn,
  type User,
} from "@/lib/api";
import { CATEGORY_META, formatTimezoneLabel } from "@/lib/categories";

type TabId = "active" | "explore" | "diary" | "integrations";

interface DashboardProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
}

const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getChallengeWeekDays(
  timezone: string,
): Array<{ iso: string; label: string; isToday: boolean }> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value ?? 2026);
  const m = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  const d = Number(parts.find((p) => p.type === "day")?.value ?? 1);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const todayIso = todayUtc.toISOString().slice(0, 10);
  const mondayOffset = (todayUtc.getUTCDay() + 6) % 7;
  const monday = new Date(todayUtc.getTime() - mondayOffset * 86_400_000);

  return WEEKDAY_SHORT.map((label, idx) => {
    const dt = new Date(monday.getTime() + idx * 86_400_000);
    const iso = dt.toISOString().slice(0, 10);
    return { iso, label, isToday: iso === todayIso };
  });
}

export function Dashboard({ user, onUserUpdated, onLogout }: DashboardProps) {
  const [tab, setTab] = useState<TabId>("active");
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string>("");
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [feed, setFeed] = useState<CheckIn[]>([]);

  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [challengesError, setChallengesError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [confirmRestDay, setConfirmRestDay] = useState(false);
  const [restingBusy, setRestingBusy] = useState(false);
  const [restFeedback, setRestFeedback] = useState<string | null>(null);
  const [quickSyncing, setQuickSyncing] = useState(false);
  const [quickSyncMsg, setQuickSyncMsg] = useState<string | null>(null);

  const [feedFilter, setFeedFilter] = useState<string>("all");
  const [hasMoreFeed, setHasMoreFeed] = useState(false);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);
  const [leaderboardSort, setLeaderboardSort] = useState<"points" | "streak" | "active_days">(
    "points",
  );

  const FEED_PAGE_SIZE = 30;

  function switchTab(next: TabId) {
    setTab(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  const loadChallenges = useCallback(async (preferredId?: string) => {
    setLoadingChallenges(true);
    setChallengesError(null);
    try {
      const list = await fetchChallenges();
      setChallenges(list);
      setActiveChallengeId((prev) => {
        if (preferredId && list.some((c) => c.id === preferredId)) return preferredId;
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list.find((c) => c.is_member)?.id ?? list[0]?.id ?? "";
      });
    } catch (err) {
      setChallengesError(
        err instanceof Error ? err.message : "Não foi possível carregar os desafios.",
      );
    } finally {
      setLoadingChallenges(false);
    }
  }, []);

  const loadActiveChallengeData = useCallback(async (challengeId: string) => {
    if (!challengeId) return;
    setLoadingDetail(true);
    setDetailError(null);
    setConfirmRestDay(false);
    setRestFeedback(null);
    setQuickSyncMsg(null);
    try {
      const [chDetail, chFeed] = await Promise.all([
        fetchChallengeDetail(challengeId),
        fetchChallengeFeed(challengeId, { limit: FEED_PAGE_SIZE }),
      ]);
      setDetail(chDetail);
      setFeed(chFeed);
      setHasMoreFeed(chFeed.length === FEED_PAGE_SIZE);
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Não foi possível carregar este desafio.",
      );
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadChallenges();
  }, [loadChallenges]);

  useEffect(() => {
    if (activeChallengeId) {
      void loadActiveChallengeData(activeChallengeId);
    }
  }, [activeChallengeId, loadActiveChallengeData]);

  async function handleConfirmRestDay() {
    if (!activeChallengeId) return;
    setRestFeedback(null);
    setRestingBusy(true);
    try {
      const res = await registerRestDay(activeChallengeId);
      setConfirmRestDay(false);
      setRestFeedback(
        `Descanso registrado para ${res.rest_date}. Restam ${res.rest_days_remaining_this_week} nesta semana.`,
      );
      await loadActiveChallengeData(activeChallengeId);
    } catch (err) {
      setRestFeedback(
        err instanceof Error ? err.message : "Não foi possível registrar descanso.",
      );
    } finally {
      setRestingBusy(false);
    }
  }

  async function handleQuickSync() {
    if (!activeChallengeId) return;
    setQuickSyncing(true);
    setQuickSyncMsg(null);
    try {
      const res = await syncIntegrations({
        simulate: false,
        challenge_id: activeChallengeId,
      });
      setQuickSyncMsg(
        res.created_count > 0
          ? `${res.created_count} check-in(s) importado(s)!`
          : "Nenhum novo commit ou submissão encontrado.",
      );
      await loadActiveChallengeData(activeChallengeId);
    } catch (err) {
      setQuickSyncMsg(err instanceof Error ? err.message : "Erro ao sincronizar.");
    } finally {
      setQuickSyncing(false);
    }
  }

  function handleCopyInvite(code: string) {
    void navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  }

  async function handleLoadMoreFeed() {
    if (!activeChallengeId || feed.length === 0) return;
    setLoadingMoreFeed(true);
    try {
      const last = feed[feed.length - 1];
      const older = await fetchChallengeFeed(activeChallengeId, {
        before: last.created_at,
        limit: FEED_PAGE_SIZE,
      });
      setFeed((prev) => [...prev, ...older]);
      setHasMoreFeed(older.length === FEED_PAGE_SIZE);
    } finally {
      setLoadingMoreFeed(false);
    }
  }

  function handleCheckinUpdated(updated: CheckIn) {
    setFeed((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    if (activeChallengeId) {
      void fetchChallengeDetail(activeChallengeId)
        .then(setDetail)
        .catch(() => {});
    }
  }

  const activeChallenge = detail?.challenge;
  const isAdmin =
    activeChallenge?.member_role === "admin" ||
    detail?.leaderboard.some((e) => e.user_id === user.id && e.role === "admin") === true;

  const weekDays = useMemo(() => {
    const tz = activeChallenge?.timezone ?? "America/Sao_Paulo";
    return getChallengeWeekDays(tz);
  }, [activeChallenge?.timezone]);

  const todayIso = weekDays.find((w) => w.isToday)?.iso ?? "";

  const userActiveDates = useMemo(() => {
    const dates = new Set<string>();
    for (const item of feed) {
      if (item.user_id === user.id && item.status === "valid") {
        dates.add(item.study_date);
      }
    }
    return dates;
  }, [feed, user.id]);

  const userPointsToday = useMemo(() => {
    return feed
      .filter(
        (item) =>
          item.user_id === user.id &&
          item.status === "valid" &&
          item.study_date === todayIso,
      )
      .reduce((sum, item) => sum + item.points_awarded, 0);
  }, [feed, todayIso, user.id]);

  const userRestSet = useMemo(
    () => new Set(detail?.user_rest_dates ?? []),
    [detail?.user_rest_dates],
  );

  const myLeaderboardEntry = detail?.leaderboard.find((e) => e.user_id === user.id);

  const sortedLeaderboard = useMemo(() => {
    const entries = [...(detail?.leaderboard ?? [])];
    if (leaderboardSort === "streak") {
      entries.sort(
        (a, b) =>
          b.current_streak - a.current_streak ||
          b.total_points - a.total_points ||
          b.active_days - a.active_days,
      );
    } else if (leaderboardSort === "active_days") {
      entries.sort(
        (a, b) =>
          b.active_days - a.active_days ||
          b.total_points - a.total_points ||
          b.current_streak - a.current_streak,
      );
    }
    return entries;
  }, [detail?.leaderboard, leaderboardSort]);

  const reportedCount = useMemo(
    () => feed.filter((c) => c.reports_count > 0).length,
    [feed],
  );

  const filteredFeed = useMemo(() => {
    if (feedFilter === "all") return feed;
    if (feedFilter === "reported") return feed.filter((c) => c.reports_count > 0);
    return feed.filter((c) => c.category_slug === feedFilter);
  }, [feed, feedFilter]);

  // Group auto-synced check-ins (GitHub / LeetCode) by (user_id, source, study_date)
  // when there are 2+ items so bulk syncs don't flood the feed.
  const groupedFeedEntries = useMemo(() => {
    const autoBuckets = new Map<string, CheckIn[]>();
    for (const item of filteredFeed) {
      if (item.source === "github" || item.source === "leetcode") {
        const key = `${item.user_id}:${item.source}:${item.study_date}`;
        const bucket = autoBuckets.get(key) ?? [];
        bucket.push(item);
        autoBuckets.set(key, bucket);
      }
    }

    const emittedKeys = new Set<string>();
    const entries: Array<
      | { type: "single"; checkin: CheckIn }
      | { type: "group"; key: string; items: CheckIn[] }
    > = [];

    for (const item of filteredFeed) {
      if (item.source === "github" || item.source === "leetcode") {
        const key = `${item.user_id}:${item.source}:${item.study_date}`;
        const bucket = autoBuckets.get(key) ?? [];
        if (bucket.length >= 2) {
          if (!emittedKeys.has(key)) {
            emittedKeys.add(key);
            entries.push({ type: "group", key, items: bucket });
          }
          continue;
        }
      }
      entries.push({ type: "single", checkin: item });
    }
    return entries;
  }, [filteredFeed]);

  const navItems: Array<{ id: TabId; label: string; shortLabel: string; icon: typeof Flame }> = [
    { id: "active", label: "Desafio Ativo", shortLabel: "Desafio", icon: Flame },
    { id: "explore", label: "Explorar & Criar", shortLabel: "Explorar", icon: Compass },
    { id: "diary", label: "Meu Diário", shortLabel: "Diário", icon: BookMarked },
    { id: "integrations", label: "Integrações", shortLabel: "Sync", icon: GitMerge },
  ];

  const hasLinkedIntegrations = user.integrations.length > 0;

  return (
    <div className="min-h-screen bg-[#F3F1EC] text-[#111827]">
      <header className="sticky top-0 z-20 border-b-[3px] border-[#D94E28] bg-[#0F1722] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 md:py-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-icon.jpg"
              alt="Ícone BrainRats"
              className="h-9 w-9 rounded-lg border border-slate-700 object-cover"
            />
            <div>
              <span className="text-sm font-extrabold tracking-tight text-white sm:text-base">
                BrainRats
              </span>
              <span className="block font-mono text-[11px] text-slate-300">
                @{user.username}
              </span>
            </div>
          </div>

          <nav
            role="tablist"
            aria-label="Navegação principal"
            className="hidden items-center gap-1 md:flex"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => switchTab(item.id)}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                    active
                      ? "border-b-2 border-[#D94E28] bg-[#182232] text-white"
                      : "text-slate-300 hover:bg-[#182232]/70 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => {
              clearStoredToken();
              onLogout();
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-[#182232] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-10 md:pt-8">
        {challengesError && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-600/35 bg-red-50 p-4 text-sm text-red-900"
          >
            <span>{challengesError}</span>
            <button
              type="button"
              onClick={() => void loadChallenges()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
          </div>
        )}

        <div className={tab === "active" ? "block" : "hidden"}>
          <div className="flex flex-col gap-6">
            {/* Signature Move: Faixa de Splits Semanais & Painel do Desafio */}
            <section className="flex flex-col gap-4 rounded-xl border border-[#DDD8CE] bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="challenge-switcher"
                      className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#475569]"
                    >
                      Desafio ativo
                    </label>
                    {(loadingDetail || loadingChallenges) && (
                      <span className="font-mono text-[11px] font-semibold text-[#D94E28]">
                        Atualizando...
                      </span>
                    )}
                  </div>
                  <select
                    id="challenge-switcher"
                    value={activeChallengeId}
                    onChange={(e) => setActiveChallengeId(e.target.value)}
                    className="min-h-11 max-w-full rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-base font-bold text-[#0F1722]"
                  >
                    {challenges.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.title} {ch.is_member ? "" : "(Aberto · não inscrito)"}
                      </option>
                    ))}
                  </select>
                  {activeChallenge && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-[#475569] tabular-nums">
                      <span className="font-bold text-[#D94E28]">
                        {activeChallenge.scoring_mode === "checkin"
                          ? `HOJE ${userPointsToday > 0 ? "CONCLUÍDO (1/1)" : "PENDENTE (0/1)"}`
                          : `HOJE ${userPointsToday}/${activeChallenge.daily_points_cap} PTS`}
                      </span>
                      <span>·</span>
                      <span>
                        OFENSIVA {myLeaderboardEntry?.current_streak ?? 0}D
                      </span>
                      <span>·</span>
                      <span>{formatTimezoneLabel(activeChallenge.timezone)}</span>
                    </div>
                  )}
                </div>

                {detail?.challenge.is_member && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Splits da Semana
                    </span>
                    <div className="grid grid-cols-7 gap-1.5 text-center">
                      {weekDays.map((day) => {
                        const studied = userActiveDates.has(day.iso);
                        const rested = userRestSet.has(day.iso);
                        let boxStyle = "border-[#DDD8CE] bg-[#FAF9F6] text-[#64748B]";
                        let statusTitle = "Sem registro";
                        if (studied) {
                          boxStyle = "border-[#D94E28] bg-[#D94E28] text-white";
                          statusTitle = "Estudado";
                        } else if (rested) {
                          boxStyle = "border-[#94A3B8] bg-[#E2E8F0] text-[#0F1722]";
                          statusTitle = "Dia de descanso";
                        }
                        return (
                          <div
                            key={day.iso}
                            title={`${day.label} (${day.iso}): ${statusTitle}`}
                            className={`flex min-w-10 flex-col items-center gap-0.5 rounded-md border px-1.5 py-1.5 text-[11px] ${boxStyle} ${
                              day.isToday ? "ring-2 ring-[#0F1722] ring-offset-1" : ""
                            }`}
                          >
                            <span className="font-bold">{day.label}</span>
                            <span className="font-mono text-[10px]">
                              {studied ? "OK" : rested ? "REST" : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {activeChallenge && (
                <div className="flex flex-wrap items-center gap-2 border-t border-[#EBE7DF] pt-3 text-xs">
                  <button
                    type="button"
                    onClick={() => handleCopyInvite(activeChallenge.invite_code)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 font-mono font-semibold text-[#0F1722] hover:border-[#0F1722]"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" /> Código copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Convite: {activeChallenge.invite_code}
                      </>
                    )}
                  </button>

                  {activeChallenge.is_member && detail && (
                    <button
                      type="button"
                      onClick={() => setConfirmRestDay((prev) => !prev)}
                      disabled={detail.rest_days_remaining_this_week <= 0}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-700/35 bg-amber-50 px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-40"
                    >
                      <Coffee className="h-3.5 w-3.5" />
                      Descansar hoje ({detail.rest_days_remaining_this_week}/sem)
                    </button>
                  )}

                  {activeChallenge.is_member &&
                    (hasLinkedIntegrations ? (
                      <button
                        type="button"
                        disabled={quickSyncing}
                        onClick={() => void handleQuickSync()}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 font-semibold text-[#0F1722] hover:border-[#0F1722] disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${quickSyncing ? "animate-spin" : ""}`}
                        />
                        Sincronizar GitHub/LeetCode
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => switchTab("integrations")}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 font-medium text-[#475569] hover:border-[#0F1722] hover:text-[#0F1722]"
                      >
                        <GitMerge className="h-3.5 w-3.5" /> Conectar GitHub/LeetCode
                      </button>
                    ))}

                  {detail && (
                    <button
                      type="button"
                      aria-expanded={showRules}
                      onClick={() => setShowRules((prev) => !prev)}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium text-[#475569] hover:bg-[#FAF9F6] hover:text-[#0F1722]"
                    >
                      <Info className="h-3.5 w-3.5" />
                      Regras e pesos
                      {showRules ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              )}

              {confirmRestDay && detail && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-700/35 bg-amber-50 p-3 text-xs text-amber-950">
                  <span>
                    Confirmar <strong>dia de descanso</strong> para hoje? Ele preserva sua
                    ofensiva sem somar pontos (restam{" "}
                    <strong className="font-mono">{detail.rest_days_remaining_this_week}</strong>{" "}
                    na semana).
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={restingBusy}
                      onClick={() => void handleConfirmRestDay()}
                      className="min-h-9 rounded-lg bg-[#0F1722] px-3 py-1.5 font-semibold text-white"
                    >
                      {restingBusy ? "Registrando..." : "Confirmar descanso"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRestDay(false)}
                      className="min-h-9 rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 font-medium text-[#334155]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {restFeedback && (
                <p role="status" aria-live="polite" className="text-xs font-semibold text-amber-900">
                  {restFeedback}
                </p>
              )}

              {quickSyncMsg && (
                <p role="status" aria-live="polite" className="text-xs font-semibold text-[#D94E28]">
                  {quickSyncMsg}
                </p>
              )}

              {showRules && detail && (
                <div className="grid gap-2 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  {detail.category_configs
                    .filter((c) => c.is_enabled)
                    .map((cfg) => {
                      const meta = CATEGORY_META[cfg.slug];
                      return (
                        <div
                          key={cfg.category_id}
                          className="flex items-center justify-between gap-2 rounded-md border border-[#DDD8CE] bg-white px-2.5 py-1.5"
                        >
                          <span className="font-semibold text-[#0F1722]">
                            {meta?.shortLabel ?? cfg.name}
                          </span>
                          <span className="font-mono text-[#475569] tabular-nums">
                            {detail.challenge.scoring_mode === "checkin"
                              ? "1 pt/dia"
                              : `${cfg.base_points} base · máx ${cfg.daily_cap}/dia`}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </section>

            {detailError ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-600/35 bg-red-50 p-4 text-sm text-red-900"
              >
                <span>{detailError}</span>
                <button
                  type="button"
                  onClick={() => void loadActiveChallengeData(activeChallengeId)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
                </button>
              </div>
            ) : loadingDetail && !detail ? (
              <p className="text-sm text-[#475569]">Carregando desafio...</p>
            ) : detail ? (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-2">
                  {detail.challenge.is_member ? (
                    <CheckinForm
                      challengeId={detail.challenge.id}
                      scoringMode={detail.challenge.scoring_mode}
                      categoryConfigs={detail.category_configs}
                      onCreated={(created) => {
                        setFeed((prev) => [created, ...prev]);
                        void fetchChallengeDetail(detail.challenge.id)
                          .then(setDetail)
                          .catch(() => {});
                      }}
                    />
                  ) : (
                    <div className="rounded-xl border border-[#DDD8CE] bg-white p-5 text-sm text-[#334155]">
                      Você está visualizando um desafio aberto. Vá em{" "}
                      <button
                        type="button"
                        onClick={() => switchTab("explore")}
                        className="font-bold text-[#D94E28] underline"
                      >
                        Explorar & Criar
                      </button>{" "}
                      para participar e postar check-ins.
                    </div>
                  )}

                  <section className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-[#0F1722]">
                        Entregas do Grupo ({filteredFeed.length})
                      </h3>
                      <div
                        className="flex flex-wrap gap-1.5"
                        role="group"
                        aria-label="Filtrar feed"
                      >
                        <button
                          type="button"
                          onClick={() => setFeedFilter("all")}
                          className={`min-h-8 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                            feedFilter === "all"
                              ? "border-[#0F1722] bg-[#0F1722] text-white"
                              : "border-[#DDD8CE] bg-white text-[#475569] hover:text-[#0F1722]"
                          }`}
                        >
                          Todas
                        </button>
                        {detail.category_configs
                          .filter((c) => c.is_enabled)
                          .map((cfg) => {
                            const meta = CATEGORY_META[cfg.slug];
                            const active = feedFilter === cfg.slug;
                            return (
                              <button
                                key={cfg.slug}
                                type="button"
                                onClick={() => setFeedFilter(cfg.slug)}
                                className={`min-h-8 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                                  active
                                    ? meta.activeButtonClass
                                    : "border-[#DDD8CE] bg-white text-[#475569] hover:text-[#0F1722]"
                                }`}
                              >
                                {meta.shortLabel}
                              </button>
                            );
                          })}
                        {isAdmin && reportedCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setFeedFilter("reported")}
                            className={`inline-flex min-h-8 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                              feedFilter === "reported"
                                ? "border-amber-700 bg-amber-100 text-amber-950"
                                : "border-amber-600/35 bg-amber-50 text-amber-900"
                            }`}
                          >
                            <ShieldAlert className="h-3 w-3" /> Denunciados ({reportedCount})
                          </button>
                        )}
                      </div>
                    </div>

                    {groupedFeedEntries.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#C7C0B3] bg-white/60 p-8 text-center text-sm text-[#475569]">
                        Nenhum check-in encontrado para este filtro.
                      </div>
                    ) : (
                      <>
                        {groupedFeedEntries.map((entry) =>
                          entry.type === "group" ? (
                            <AutoSyncGroupCard
                              key={entry.key}
                              items={entry.items}
                              currentUserId={user.id}
                              isChallengeAdmin={isAdmin}
                              isMember={detail.challenge.is_member}
                              scoringMode={detail.challenge.scoring_mode}
                              onUpdated={handleCheckinUpdated}
                            />
                          ) : (
                            <CheckinCard
                              key={entry.checkin.id}
                              checkin={entry.checkin}
                              currentUserId={user.id}
                              isChallengeAdmin={isAdmin}
                              isMember={detail.challenge.is_member}
                              scoringMode={detail.challenge.scoring_mode}
                              onUpdated={handleCheckinUpdated}
                            />
                          ),
                        )}
                        {hasMoreFeed && (
                          <button
                            type="button"
                            disabled={loadingMoreFeed}
                            onClick={() => void handleLoadMoreFeed()}
                            className="min-h-10 rounded-lg border border-[#DDD8CE] bg-white px-4 py-2 text-xs font-semibold text-[#0F1722] hover:border-[#0F1722] disabled:opacity-50"
                          >
                            {loadingMoreFeed
                              ? "Carregando anteriores..."
                              : "Carregar entregas anteriores"}
                          </button>
                        )}
                      </>
                    )}
                  </section>
                </div>

                {/* Official Timing Board (Placar Oficial) — first on mobile, right column on desktop */}
                <aside className="order-1 flex flex-col gap-4 lg:order-2">
                  <div className="rounded-xl bg-[#0F1722] p-5 text-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
                        <Trophy className="h-4 w-4 text-[#D94E28]" />
                        Placar Oficial
                      </h3>
                      <span className="font-mono text-[11px] text-slate-400">
                        {sortedLeaderboard.length} atletas
                      </span>
                    </div>

                    <div
                      className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-[#182232] p-1 text-[11px] font-semibold"
                      role="group"
                      aria-label="Ordenar placar"
                    >
                      {[
                        { id: "points" as const, label: "Pontos" },
                        { id: "streak" as const, label: "Ofensiva" },
                        { id: "active_days" as const, label: "Dias" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setLeaderboardSort(opt.id)}
                          className={`min-h-7 rounded-md transition ${
                            leaderboardSort === opt.id
                              ? "bg-[#D94E28] text-white"
                              : "text-slate-300 hover:text-white"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 space-y-2.5">
                      {sortedLeaderboard.map((entry, idx) => (
                        <div
                          key={entry.user_id}
                          className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${
                            entry.user_id === user.id
                              ? "border-[#D94E28] bg-[#1F2633]"
                              : "border-slate-800 bg-[#182232]"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#FF8A65] tabular-nums">
                                #{idx + 1}
                              </span>
                              <span className="truncate text-sm font-semibold text-white">
                                {entry.display_name}
                              </span>
                              {entry.role === "admin" && (
                                <span className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">
                                  admin
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-300 tabular-nums">
                              <span className="inline-flex items-center gap-1">
                                <Flame className="h-3 w-3 text-[#FF8A65]" />
                                {entry.current_streak}d
                              </span>
                              <span>· {entry.active_days}d ativos</span>
                              <span>· {entry.rest_days_used_this_week} rest</span>
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-sm font-bold text-white tabular-nums">
                            {entry.total_points}{" "}
                            <span className="text-xs font-normal text-slate-300">
                              {detail.challenge.scoring_mode === "checkin" ? "chk" : "pts"}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            ) : null}
          </div>
        </div>

        <div className={tab === "explore" ? "block" : "hidden"}>
          <ChallengesTab
            challenges={challenges}
            onSelectChallenge={(id) => {
              setActiveChallengeId(id);
              switchTab("active");
            }}
            onRefreshChallenges={async (selectId) => {
              await loadChallenges(selectId);
              if (selectId) {
                switchTab("active");
              }
            }}
          />
        </div>

        {tab === "diary" && <DiaryTab challenges={challenges} />}

        <div className={tab === "integrations" ? "block" : "hidden"}>
          <IntegrationsTab
            user={user}
            challenges={challenges}
            onUserUpdated={onUserUpdated}
            onSynced={async () => {
              if (activeChallengeId) {
                await loadActiveChallengeData(activeChallengeId);
              }
            }}
            onGoToActive={() => switchTab("active")}
          />
        </div>
      </main>

      <nav
        role="tablist"
        aria-label="Navegação móvel"
        className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-slate-800 bg-[#0F1722] pb-[env(safe-area-inset-bottom)] text-white md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(item.id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition ${
                active
                  ? "border-t-2 border-[#D94E28] text-[#FF8A65]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
