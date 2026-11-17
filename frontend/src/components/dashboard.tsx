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
import {
  CATEGORY_META,
  formatTimezoneLabel,
} from "@/lib/categories";

type TabId = "active" | "explore" | "diary" | "integrations";

interface DashboardProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
}

const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getChallengeWeekDays(timezone: string): Array<{ iso: string; label: string; isToday: boolean }> {
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
  // getUTCDay(): 0 = Sun -> offset 6, 1 = Mon -> offset 0
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
        fetchChallengeFeed(challengeId),
      ]);
      setDetail(chDetail);
      setFeed(chFeed);
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

  function handleCheckinUpdated(updated: CheckIn) {
    setFeed((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    if (activeChallengeId) {
      void fetchChallengeDetail(activeChallengeId)
        .then(setDetail)
        .catch(() => {
          // Keep current view stable if background leaderboard refresh fails.
        });
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

  const userActiveDates = useMemo(() => {
    const dates = new Set<string>();
    for (const item of feed) {
      if (item.user_id === user.id && item.status === "valid") {
        dates.add(item.study_date);
      }
    }
    return dates;
  }, [feed, user.id]);

  const userRestSet = useMemo(
    () => new Set(detail?.user_rest_dates ?? []),
    [detail?.user_rest_dates],
  );

  const reportedCount = useMemo(
    () => feed.filter((c) => c.reports_count > 0).length,
    [feed],
  );

  const filteredFeed = useMemo(() => {
    if (feedFilter === "all") return feed;
    if (feedFilter === "reported") return feed.filter((c) => c.reports_count > 0);
    return feed.filter((c) => c.category_slug === feedFilter);
  }, [feed, feedFilter]);

  const navItems: Array<{ id: TabId; label: string; shortLabel: string; icon: typeof Flame }> = [
    { id: "active", label: "Desafio Ativo", shortLabel: "Desafio", icon: Flame },
    { id: "explore", label: "Explorar & Criar", shortLabel: "Explorar", icon: Compass },
    { id: "diary", label: "Meu Diário", shortLabel: "Diário", icon: BookMarked },
    { id: "integrations", label: "Integrações", shortLabel: "Sync", icon: GitMerge },
  ];

  const hasLinkedIntegrations = user.integrations.length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 md:py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-zinc-50 sm:text-base">
                BrainRats
              </span>
              <span className="block font-mono text-[11px] text-zinc-400">@{user.username}</span>
            </div>
          </div>

          <nav
            role="tablist"
            aria-label="Navegação principal"
            className="hidden items-center gap-1.5 md:flex"
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
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
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
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 md:pb-10 md:pt-8">
        {challengesError && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
          >
            <span>{challengesError}</span>
            <button
              type="button"
              onClick={() => void loadChallenges()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-100"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
          </div>
        )}

        <div className={tab === "active" ? "block" : "hidden"}>
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <label htmlFor="challenge-switcher" className="text-xs text-zinc-400">
                      Desafio ativo
                    </label>
                    {(loadingDetail || loadingChallenges) && (
                      <span className="text-[11px] text-emerald-400">Atualizando...</span>
                    )}
                  </div>
                  <select
                    id="challenge-switcher"
                    value={activeChallengeId}
                    onChange={(e) => setActiveChallengeId(e.target.value)}
                    className="min-h-11 max-w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100"
                  >
                    {challenges.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.title} {ch.is_member ? "" : "(Aberto · não inscrito)"}
                      </option>
                    ))}
                  </select>
                </div>

                {activeChallenge && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-300">
                      {activeChallenge.scoring_mode === "checkin"
                        ? "Modo Check-in (1/dia)"
                        : `Modo Pontuação (teto ${activeChallenge.daily_points_cap}/dia)`}
                    </span>
                    <span className="whitespace-nowrap rounded-full border border-zinc-700 px-3 py-1 text-zinc-300">
                      {formatTimezoneLabel(activeChallenge.timezone)}
                    </span>
                  </div>
                )}
              </div>

              {activeChallenge?.description && (
                <p className="text-sm text-zinc-400">{activeChallenge.description}</p>
              )}

              {activeChallenge && (
                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-3 text-xs">
                  <button
                    type="button"
                    onClick={() => handleCopyInvite(activeChallenge.invite_code)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-zinc-200 hover:border-emerald-500/50"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" /> Código copiado
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
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
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
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-medium text-zinc-200 hover:border-emerald-500/50 disabled:opacity-50"
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
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                      >
                        <GitMerge className="h-3.5 w-3.5" /> Conectar GitHub/LeetCode
                      </button>
                    ))}

                  {detail && (
                    <button
                      type="button"
                      aria-expanded={showRules}
                      onClick={() => setShowRules((prev) => !prev)}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800"
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
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-100">
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
                      className="min-h-9 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-zinc-950 hover:bg-amber-400"
                    >
                      {restingBusy ? "Registrando..." : "Confirmar descanso"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRestDay(false)}
                      className="min-h-9 rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {restFeedback && (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-xs text-amber-300"
                >
                  {restFeedback}
                </p>
              )}

              {quickSyncMsg && (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-xs text-emerald-300"
                >
                  {quickSyncMsg}
                </p>
              )}

              {showRules && detail && (
                <div className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  {detail.category_configs
                    .filter((c) => c.is_enabled)
                    .map((cfg) => {
                      const meta = CATEGORY_META[cfg.slug];
                      return (
                        <div
                          key={cfg.category_id}
                          className="flex items-center justify-between gap-2 rounded-md border border-zinc-800/80 px-2.5 py-1.5"
                        >
                          <span className="font-medium text-zinc-200">
                            {meta?.shortLabel ?? cfg.name}
                          </span>
                          <span className="font-mono text-zinc-400 tabular-nums">
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
              >
                <span>{detailError}</span>
                <button
                  type="button"
                  onClick={() => void loadActiveChallengeData(activeChallengeId)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
                </button>
              </div>
            ) : loadingDetail && !detail ? (
              <p className="text-sm text-zinc-400">Carregando desafio...</p>
            ) : detail ? (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-6 lg:col-span-2">
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
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-300">
                      Você está visualizando um desafio aberto. Vá em{" "}
                      <button
                        type="button"
                        onClick={() => switchTab("explore")}
                        className="font-semibold text-emerald-400 underline"
                      >
                        Explorar & Criar
                      </button>{" "}
                      para participar e postar check-ins.
                    </div>
                  )}

                  <section className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-zinc-100">
                        Feed do Grupo ({filteredFeed.length})
                      </h3>
                      <div
                        className="flex flex-wrap gap-1.5"
                        role="group"
                        aria-label="Filtrar feed"
                      >
                        <button
                          type="button"
                          onClick={() => setFeedFilter("all")}
                          className={`min-h-8 rounded-lg border px-2.5 py-1 text-xs ${
                            feedFilter === "all"
                              ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                              : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
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
                                className={`min-h-8 rounded-lg border px-2.5 py-1 text-xs ${
                                  active
                                    ? meta.activeButtonClass
                                    : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
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
                            className={`inline-flex min-h-8 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs ${
                              feedFilter === "reported"
                                ? "border-amber-500 bg-amber-500/15 text-amber-200"
                                : "border-amber-500/30 bg-zinc-950 text-amber-300"
                            }`}
                          >
                            <ShieldAlert className="h-3 w-3" /> Denunciados ({reportedCount})
                          </button>
                        )}
                      </div>
                    </div>

                    {filteredFeed.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-400">
                        Nenhum check-in encontrado para este filtro.
                      </div>
                    ) : (
                      filteredFeed.map((item) => (
                        <CheckinCard
                          key={item.id}
                          checkin={item}
                          currentUserId={user.id}
                          isChallengeAdmin={isAdmin}
                          isMember={detail.challenge.is_member}
                          scoringMode={detail.challenge.scoring_mode}
                          onUpdated={handleCheckinUpdated}
                        />
                      ))
                    )}
                  </section>
                </div>

                <aside className="flex flex-col gap-4">
                  {detail.challenge.is_member && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                      <h3 className="text-sm font-semibold text-zinc-100">
                        Sua Semana de Constância
                      </h3>
                      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
                        {weekDays.map((day) => {
                          const studied = userActiveDates.has(day.iso);
                          const rested = userRestSet.has(day.iso);
                          let boxStyle = "border-zinc-800 bg-zinc-950 text-zinc-500";
                          let statusTitle = "Sem registro";
                          if (studied) {
                            boxStyle =
                              "border-emerald-500/50 bg-emerald-500/15 text-emerald-300";
                            statusTitle = "Estudado";
                          } else if (rested) {
                            boxStyle = "border-amber-500/50 bg-amber-500/15 text-amber-200";
                            statusTitle = "Dia de descanso";
                          }
                          return (
                            <div
                              key={day.iso}
                              title={`${day.label} (${day.iso}): ${statusTitle}`}
                              className={`flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] ${boxStyle} ${
                                day.isToday ? "ring-1 ring-zinc-400" : ""
                              }`}
                            >
                              <span className="font-medium">{day.label}</span>
                              <span className="font-mono text-[10px]">
                                {studied ? "OK" : rested ? "Zzz" : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
                    <h3 className="flex items-center gap-2 font-semibold text-zinc-100">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      Ranking do Desafio
                    </h3>
                    <div className="mt-4 space-y-2.5">
                      {detail.leaderboard.map((entry, idx) => (
                        <div
                          key={entry.user_id}
                          className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${
                            entry.user_id === user.id
                              ? "border-emerald-500/40 bg-emerald-500/10"
                              : "border-zinc-800 bg-zinc-950"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-zinc-400 tabular-nums">
                                #{idx + 1}
                              </span>
                              <span className="truncate text-sm font-medium text-zinc-100">
                                {entry.display_name}
                              </span>
                              {entry.role === "admin" && (
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                                  admin
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400 tabular-nums">
                              <span className="inline-flex items-center gap-1">
                                <Flame className="h-3 w-3 text-amber-400" />
                                {entry.current_streak}d ofensiva
                              </span>
                              <span>· {entry.active_days}d ativos</span>
                              <span>· {entry.rest_days_used_this_week} descanso(s)</span>
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-sm font-bold text-emerald-400 tabular-nums">
                            {entry.total_points}{" "}
                            {detail.challenge.scoring_mode === "checkin"
                              ? "chk"
                              : "pts"}
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

        {tab === "diary" && <DiaryTab />}

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
        className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden"
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
              className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition ${
                active ? "text-emerald-400" : "text-zinc-400 hover:text-zinc-200"
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
