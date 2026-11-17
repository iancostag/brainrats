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
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AutoSyncGroupCard } from "@/components/auto-sync-group-card";
import { ChallengesTab } from "@/components/challenges-tab";
import { CheckinCard } from "@/components/checkin-card";
import { CheckinForm } from "@/components/checkin-form";
import { DiaryTab } from "@/components/diary-tab";
import { IntegrationsTab } from "@/components/integrations-tab";
import { LaneNumber } from "@/components/lane-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { WeeklySplits } from "@/components/weekly-splits";
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
import { CATEGORY_META, formatPointsLabel, formatTimezoneLabel } from "@/lib/categories";

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
  // Ganho do último check-in publicado: dispara o momento de feedback na meta e na ofensiva.
  const [lastGain, setLastGain] = useState<{ label: string; key: number } | null>(null);

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
    if (!lastGain) return;
    const timer = setTimeout(() => setLastGain(null), 2600);
    return () => clearTimeout(timer);
  }, [lastGain]);

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
  const currentStreak = myLeaderboardEntry?.current_streak ?? 0;
  const isCheckinMode = activeChallenge?.scoring_mode === "checkin";
  const dailyCap = Math.max(1, activeChallenge?.daily_points_cap ?? 100);
  const todayProgress = isCheckinMode
    ? userPointsToday > 0
      ? 1
      : 0
    : Math.min(1, userPointsToday / dailyCap);

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
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b-[3px] border-accent bg-shell text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 md:py-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-icon.jpg"
              alt="Ícone BrainRats"
              className="h-11 w-11 rounded-xl border border-slate-700 object-cover sm:h-12 sm:w-12"
            />
            <div>
              <span className="text-base font-extrabold tracking-tight text-white sm:text-lg">
                BrainRats
              </span>
              <span className="block font-mono text-[11px] text-slate-300">
                @{user.username}
              </span>
            </div>
          </div>

          <nav
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
                  aria-current={active ? "page" : undefined}
                  onClick={() => switchTab(item.id)}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                    active
                      ? "border-b-2 border-accent bg-shell-raised text-white"
                      : "text-slate-300 hover:bg-shell-raised/70 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => {
                clearStoredToken();
                onLogout();
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-slate-700 bg-shell-raised px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden /> Sair
            </button>
          </div>
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
            <section className="flex flex-col gap-4 rounded-xl border border-lane bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="challenge-switcher"
                      className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-2"
                    >
                      Desafio ativo
                    </label>
                    {(loadingDetail || loadingChallenges) && (
                      <span className="font-mono text-[11px] font-semibold text-accent-text">
                        Atualizando...
                      </span>
                    )}
                  </div>
                  <select
                    id="challenge-switcher"
                    value={activeChallengeId}
                    disabled={challenges.length === 0}
                    onChange={(e) => setActiveChallengeId(e.target.value)}
                    className="min-h-11 max-w-full rounded-lg border border-lane bg-well px-3 py-2 text-base font-bold text-ink-strong transition-colors focus:border-ink-strong disabled:opacity-60"
                  >
                    {challenges.length === 0 ? (
                      <option value="">Nenhum desafio disponível</option>
                    ) : (
                      challenges.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.title} {ch.is_member ? "" : "(Aberto · não inscrito)"}
                        </option>
                      ))
                    )}
                  </select>
                  {activeChallenge && (
                    <div className="mt-1 flex flex-col gap-2">
                      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-ink-2">
                            Meta de hoje
                          </span>
                          <span
                            key={`pts-${userPointsToday}`}
                            className={`font-score text-xl leading-none text-ink-strong ${
                              lastGain ? "animate-stamp" : ""
                            }`}
                          >
                            {isCheckinMode
                              ? userPointsToday > 0
                                ? "Concluída"
                                : "Pendente"
                              : `${userPointsToday}/${dailyCap}`}
                          </span>
                          {!isCheckinMode && <span className="text-xs text-ink-2">pts</span>}
                          {lastGain && (
                            <span
                              key={lastGain.key}
                              className="animate-rise-in rounded-full bg-accent px-2 py-0.5 font-score text-sm text-white"
                            >
                              {lastGain.label}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
                          <span className="inline-flex items-center gap-1">
                            <Flame className="h-4 w-4 text-accent-text" aria-hidden="true" />
                            <span
                              key={`streak-${currentStreak}`}
                              className={`font-score text-base leading-none text-ink-strong ${
                                lastGain ? "animate-stamp" : ""
                              }`}
                            >
                              {currentStreak}
                            </span>
                            {currentStreak === 1 ? "dia" : "dias"} de ofensiva
                          </span>
                          <span>{formatTimezoneLabel(activeChallenge.timezone)}</span>
                        </div>
                      </div>
                      <div
                        role="progressbar"
                        aria-label="Meta de hoje"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(todayProgress * 100)}
                        aria-valuetext={
                          isCheckinMode
                            ? userPointsToday > 0
                              ? "Check-in de hoje concluído"
                              : "Check-in de hoje pendente"
                            : `${userPointsToday} de ${dailyCap} pontos`
                        }
                        className="h-2 overflow-hidden rounded-full bg-lane-soft"
                      >
                        <div
                          className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out motion-reduce:transition-none"
                          style={{ width: `${todayProgress * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {detail?.challenge.is_member && (
                  <WeeklySplits
                    days={weekDays}
                    studiedDates={userActiveDates}
                    restDates={userRestSet}
                    todayProgress={todayProgress}
                  />
                )}
              </div>

              {activeChallenge && (
                <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto border-t border-lane-soft px-4 pt-3 text-xs sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                  <button
                    type="button"
                    onClick={() => handleCopyInvite(activeChallenge.invite_code)}
                    className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-lg border border-lane bg-well px-3 py-1.5 font-mono font-semibold text-ink-strong hover:border-ink-strong"
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
                      className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-lg border border-amber-700/35 bg-amber-50 px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-40"
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
                        className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-lg border border-lane bg-well px-3 py-1.5 font-semibold text-ink-strong hover:border-ink-strong disabled:opacity-50"
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
                        className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-lg border border-lane bg-well px-3 py-1.5 font-medium text-ink-2 hover:border-ink-strong hover:text-ink-strong"
                      >
                        <GitMerge className="h-3.5 w-3.5" /> Conectar GitHub/LeetCode
                      </button>
                    ))}

                  {detail && (
                    <button
                      type="button"
                      aria-expanded={showRules}
                      onClick={() => setShowRules((prev) => !prev)}
                      className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap gap-1 rounded-lg px-2.5 py-1.5 font-medium text-ink-2 hover:bg-well hover:text-ink-strong"
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
                      className="min-h-9 rounded-lg bg-action px-3 py-1.5 font-semibold text-white"
                    >
                      {restingBusy ? "Registrando..." : "Confirmar descanso"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRestDay(false)}
                      className="min-h-9 rounded-lg border border-lane bg-card px-3 py-1.5 font-medium text-ink-3"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {restFeedback && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center justify-between gap-2 rounded-lg border border-amber-700/30 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950"
                >
                  <span>{restFeedback}</span>
                  <button
                    type="button"
                    onClick={() => setRestFeedback(null)}
                    aria-label="Fechar aviso"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-amber-900 hover:bg-amber-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {quickSyncMsg && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent-strong"
                >
                  <span>{quickSyncMsg}</span>
                  <button
                    type="button"
                    onClick={() => setQuickSyncMsg(null)}
                    aria-label="Fechar aviso"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-accent-strong hover:bg-accent/15"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {showRules && detail && (
                <div className="grid gap-2 rounded-lg border border-lane bg-well p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  {detail.category_configs
                    .filter((c) => c.is_enabled)
                    .map((cfg) => {
                      const meta = CATEGORY_META[cfg.slug];
                      return (
                        <div
                          key={cfg.category_id}
                          className="flex items-center justify-between gap-2 rounded-md border border-lane bg-card px-2.5 py-1.5"
                        >
                          <span className="inline-flex items-center gap-2 font-semibold text-ink-strong">
                            <LaneNumber slug={cfg.slug} />
                            {meta?.shortLabel ?? cfg.name}
                          </span>
                          <span className="font-mono text-ink-2 tabular-nums">
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
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-3 rounded-xl border border-lane bg-card p-6 text-sm text-ink-2"
              >
                <RefreshCw className="h-4 w-4 animate-spin text-accent-text" />
                <span>Carregando desafio...</span>
              </div>
            ) : !loadingChallenges && challenges.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-lane-strong bg-card/70 p-6 text-sm text-ink-2">
                <p>Você ainda não participa de nenhum desafio.</p>
                <button
                  type="button"
                  onClick={() => switchTab("explore")}
                  className="min-h-10 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-hover"
                >
                  Explorar & Criar Desafio
                </button>
              </div>
            ) : detail ? (
              <div
                className={`grid gap-6 transition-opacity lg:grid-cols-3 lg:grid-rows-[auto_1fr] ${
                  loadingDetail ? "opacity-70" : "opacity-100"
                }`}
              >
                {/* Ordem no celular: registrar, placar, feed. No desktop o placar ocupa a coluna direita. */}
                <div className="lg:col-span-2">
                  {detail.challenge.is_member ? (
                    <CheckinForm
                      challengeId={detail.challenge.id}
                      scoringMode={detail.challenge.scoring_mode}
                      categoryConfigs={detail.category_configs}
                      otherChallengesCount={
                        challenges.filter((c) => c.is_member && c.id !== detail.challenge.id)
                          .length
                      }
                      onCreated={(created) => {
                        setFeed((prev) => [created, ...prev]);
                        if (created.status === "valid" && created.points_awarded > 0) {
                          setLastGain({
                            label: formatPointsLabel(
                              created.points_awarded,
                              detail.challenge.scoring_mode,
                              created.status,
                            ),
                            key: Date.now(),
                          });
                        }
                        void fetchChallengeDetail(detail.challenge.id)
                          .then(setDetail)
                          .catch(() => {});
                      }}
                    />
                  ) : (
                    <div className="rounded-xl border border-lane bg-card p-5 text-sm text-ink-3">
                      Você está visualizando um desafio aberto. Vá em{" "}
                      <button
                        type="button"
                        onClick={() => switchTab("explore")}
                        className="font-bold text-accent-text underline"
                      >
                        Explorar & Criar
                      </button>{" "}
                      para participar e postar check-ins.
                    </div>
                  )}
                </div>

                <section className="flex flex-col gap-4 lg:col-span-2 lg:row-start-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-ink-strong">
                        Entregas do Grupo ({filteredFeed.length})
                      </h3>
                      <div
                        className="flex flex-wrap gap-1.5"
                        role="group"
                        aria-label="Filtrar feed"
                      >
                        <button
                          type="button"
                          aria-pressed={feedFilter === "all"}
                          onClick={() => setFeedFilter("all")}
                          className={`min-h-8 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                            feedFilter === "all"
                              ? "border-action bg-action text-white"
                              : "border-lane bg-card text-ink-2 hover:text-ink-strong"
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
                                aria-pressed={active}
                                onClick={() => setFeedFilter(cfg.slug)}
                                className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border py-1 pl-1 pr-2.5 text-xs font-semibold ${
                                  active
                                    ? meta.activeButtonClass
                                    : "border-lane bg-card text-ink-2 hover:text-ink-strong"
                                }`}
                              >
                                <LaneNumber slug={cfg.slug} />
                                {meta.shortLabel}
                              </button>
                            );
                          })}
                        {isAdmin && reportedCount > 0 && (
                          <button
                            type="button"
                            aria-pressed={feedFilter === "reported"}
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
                      <div className="rounded-xl border border-dashed border-lane-strong bg-card/60 p-8 text-center text-sm text-ink-2">
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
                            className="min-h-10 rounded-lg border border-lane bg-card px-4 py-2 text-xs font-semibold text-ink-strong hover:border-ink-strong disabled:opacity-50"
                          >
                            {loadingMoreFeed
                              ? "Carregando anteriores..."
                              : "Carregar entregas anteriores"}
                          </button>
                        )}
                      </>
                    )}
                </section>

                {/* Placar Oficial: entre o formulário e o feed no celular, coluna direita no desktop. */}
                <aside className="flex flex-col gap-4 self-start lg:col-start-3 lg:row-span-2 lg:row-start-1">
                  <div className="rounded-xl bg-shell p-5 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
                        <Trophy className="h-4 w-4 text-accent-text" />
                        Placar Oficial
                      </h3>
                      <span className="font-mono text-[11px] text-slate-400">
                        {sortedLeaderboard.length} atletas
                      </span>
                    </div>

                    <div
                      className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-shell-raised p-1 text-[11px] font-semibold"
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
                          aria-pressed={leaderboardSort === opt.id}
                          onClick={() => setLeaderboardSort(opt.id)}
                          className={`min-h-7 rounded-md transition ${
                            leaderboardSort === opt.id
                              ? "bg-accent text-white"
                              : "text-slate-300 hover:text-white"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 space-y-2.5">
                      {sortedLeaderboard.length === 0 ? (
                        <p className="rounded-lg border border-slate-800 bg-shell-raised p-3 text-center text-xs text-slate-400">
                          Nenhum participante ainda.
                        </p>
                      ) : (
                        sortedLeaderboard.map((entry, idx) => (
                          <div
                            key={entry.user_id}
                            className={`flex items-center justify-between gap-2 rounded-lg border p-3 transition-colors ${
                              entry.user_id === user.id
                                ? "border-accent bg-shell-active"
                                : "border-slate-800 bg-shell-raised"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-score text-base ${
                                    idx === 0
                                      ? "text-accent-soft"
                                      : idx < 3
                                        ? "text-amber-300"
                                        : "text-slate-400"
                                  }`}
                                >
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
                                  <Flame className="h-3 w-3 text-accent-soft" />
                                  {entry.current_streak}d
                                </span>
                                <span>· {entry.active_days}d ativos</span>
                                <span>· {entry.rest_days_used_this_week} rest</span>
                              </p>
                            </div>
                            <span className="shrink-0 font-score text-2xl leading-none text-white">
                              {entry.total_points}{" "}
                              <span className="font-sans text-xs font-normal text-slate-300">
                                {detail.challenge.scoring_mode === "checkin" ? "chk" : "pts"}
                              </span>
                            </span>
                          </div>
                        ))
                      )}
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
        aria-label="Navegação móvel"
        className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-slate-800 bg-shell pb-[env(safe-area-inset-bottom)] text-white md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => switchTab(item.id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition ${
                active
                  ? "border-t-2 border-accent text-accent-soft"
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
