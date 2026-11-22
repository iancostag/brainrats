"use client";

import { Coffee, Compass, Swords } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { AppShell, type StreakSnapshot, type TabId } from "@/components/app-shell";
import { ChallengeHero, ChallengeHeroSkeleton } from "@/components/challenge-hero";
import { ChallengesTab } from "@/components/challenges-tab";
import { CheckinForm } from "@/components/checkin-form";
import { DiaryTab } from "@/components/diary-tab";
import { GroupFeed } from "@/components/group-feed";
import { IntegrationsTab } from "@/components/integrations-tab";
import { Milestones } from "@/components/milestones";
import { RankingTab } from "@/components/ranking-tab";
import { RulesPanel } from "@/components/rules-panel";
import { Scoreboard } from "@/components/scoreboard";
import { SettingsTab } from "@/components/settings-tab";
import { EmptyState, ErrorState, Notice } from "@/components/ui";
import {
  clearStoredToken,
  fetchChallengeDetail,
  fetchChallengeFeed,
  fetchChallenges,
  joinChallenge,
  registerRestDay,
  syncIntegrations,
  type ChallengeDetail,
  type ChallengeListItem,
  type CheckIn,
  type User,
} from "@/lib/api";
import { formatPointsLabel } from "@/lib/categories";
import { buildChallengeInviteUrl, clearPendingInvite, getPendingInvite } from "@/lib/invite";
import { sortLeaderboard, type LeaderboardSort } from "@/lib/leaderboard";
import { getChallengeWeekDays, summarizeWeek } from "@/lib/week";

interface DashboardProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
}

const FEED_PAGE_SIZE = 30;
/** Linhas do placar no Início; o ranking completo fica na aba Ranking. */
const HOME_SCOREBOARD_LIMIT = 5;

export function Dashboard({ user, onUserUpdated, onLogout }: DashboardProps) {
  const [tab, setTab] = useState<TabId>("home");
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string>("");
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [feed, setFeed] = useState<CheckIn[]>([]);

  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [challengesError, setChallengesError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [confirmRestDay, setConfirmRestDay] = useState(false);
  const [restingBusy, setRestingBusy] = useState(false);
  const [restFeedback, setRestFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [quickSyncing, setQuickSyncing] = useState(false);
  const [quickSyncMsg, setQuickSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Ganho do último check-in publicado: dispara o momento de feedback na meta e na ofensiva.
  const [lastGain, setLastGain] = useState<{ label: string; key: number } | null>(null);

  const [feedFilter, setFeedFilter] = useState<string>("all");
  const [hasMoreFeed, setHasMoreFeed] = useState(false);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);
  const [leaderboardSort, setLeaderboardSort] = useState<LeaderboardSort>("points");

  function switchTab(next: TabId) {
    setTab(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const paramTab = new URLSearchParams(window.location.search).get("tab");
    const mappedTab: TabId | null =
      paramTab === "home" || paramTab === "active"
        ? "home"
        : paramTab === "progress" || paramTab === "diary"
          ? "progress"
          : paramTab === "ranking"
            ? "ranking"
            : paramTab === "challenges" || paramTab === "explore"
              ? "challenges"
              : paramTab === "integrations"
                ? "integrations"
                : paramTab === "settings"
                  ? "settings"
                  : null;
    if (mappedTab) {
      setTab(mappedTab);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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
    const pendingInvite = getPendingInvite();
    if (!pendingInvite) {
      void loadChallenges();
      return;
    }

    clearPendingInvite();
    setTab("home");
    void (async () => {
      try {
        const joined = await joinChallenge({ invite_code: pendingInvite });
        setInviteNotice({
          ok: true,
          text: `Desafio "${joined.title}" aberto via link de convite.`,
        });
        await loadChallenges(joined.id);
      } catch (err) {
        setInviteNotice({
          ok: false,
          text:
            err instanceof Error
              ? `Convite ${pendingInvite}: ${err.message}`
              : `Não foi possível abrir o convite ${pendingInvite}.`,
        });
        await loadChallenges();
      }
    })();
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
      await loadActiveChallengeData(activeChallengeId);
      setRestFeedback({
        ok: true,
        text: `Descanso registrado para ${res.rest_date}. Restam ${res.rest_days_remaining_this_week} nesta semana.`,
      });
    } catch (err) {
      setRestFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Não foi possível registrar descanso.",
      });
    } finally {
      setConfirmRestDay(false);
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
      await loadActiveChallengeData(activeChallengeId);
      setQuickSyncMsg({
        ok: true,
        text:
          res.created_count > 0
            ? `${res.created_count} check-in(s) importado(s)!`
            : "Nenhum novo commit ou submissão encontrado.",
      });
    } catch (err) {
      setQuickSyncMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao sincronizar.",
      });
    } finally {
      setQuickSyncing(false);
    }
  }

  function handleCopyInvite(code: string) {
    void navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  }

  function handleCopyInviteLink(code: string) {
    void navigator.clipboard?.writeText(buildChallengeInviteUrl(code));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
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

  function handleLogout() {
    clearStoredToken();
    onLogout();
  }

  const activeChallenge = detail?.challenge;
  const isMember = activeChallenge?.is_member === true;
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

  const myLeaderboardIndex = detail?.leaderboard.findIndex((e) => e.user_id === user.id) ?? -1;
  const myLeaderboardEntry =
    myLeaderboardIndex >= 0 ? detail?.leaderboard[myLeaderboardIndex] : undefined;
  const currentStreak = myLeaderboardEntry?.current_streak ?? 0;
  const isCheckinMode = activeChallenge?.scoring_mode === "checkin";
  const dailyCap = Math.max(1, activeChallenge?.daily_points_cap ?? 100);
  const todayProgress = isCheckinMode
    ? userPointsToday > 0
      ? 1
      : 0
    : Math.min(1, userPointsToday / dailyCap);

  const weekSummary = useMemo(
    () => summarizeWeek(weekDays, userActiveDates, userRestSet, todayProgress),
    [weekDays, userActiveDates, userRestSet, todayProgress],
  );

  const sortedLeaderboard = useMemo(
    () => sortLeaderboard(detail?.leaderboard ?? [], leaderboardSort),
    [detail?.leaderboard, leaderboardSort],
  );

  const streakSnapshot: StreakSnapshot | null =
    detail && isMember
      ? { streak: currentStreak, days: weekDays, summary: weekSummary, todayProgress }
      : null;

  const hasLinkedIntegrations = user.integrations.length > 0;
  const noChallenges = !loadingChallenges && !challengesError && challenges.length === 0;

  /** Estado do desafio ativo para as abas que dependem dele (Início e Ranking). */
  function renderChallengeGate(): ReactNode | null {
    if (detailError) {
      return (
        <ErrorState
          message={detailError}
          onRetry={() => void loadActiveChallengeData(activeChallengeId)}
        />
      );
    }
    if (noChallenges) {
      return (
        <EmptyState
          icon={Swords}
          title="Você ainda não participa de nenhum desafio"
          action={
            <button
              type="button"
              onClick={() => switchTab("challenges")}
              className="btn btn-primary"
            >
              <Compass className="h-4 w-4" aria-hidden="true" /> Explorar e criar desafios
            </button>
          }
          className="py-12"
        >
          Crie um desafio para o seu grupo ou entre em um com código de convite.
        </EmptyState>
      );
    }
    if (!detail) return <ChallengeHeroSkeleton />;
    return null;
  }

  const gate = renderChallengeGate();

  return (
    <AppShell
      tab={tab}
      onNavigate={switchTab}
      user={user}
      onLogout={handleLogout}
      streak={streakSnapshot}
      busy={loadingDetail || loadingChallenges}
    >
      {inviteNotice && (
        <div className="mb-5">
          <Notice
            tone={inviteNotice.ok ? "success" : "error"}
            onDismiss={() => setInviteNotice(null)}
          >
            {inviteNotice.text}
          </Notice>
        </div>
      )}

      {challengesError && (
        <div className="mb-5">
          <ErrorState message={challengesError} onRetry={() => void loadChallenges()} />
        </div>
      )}

      <div hidden={tab !== "home"}>
        {gate ?? (
          detail && (
            <div
              className={`flex flex-col gap-5 transition-opacity lg:gap-6 ${
                loadingDetail ? "opacity-70" : "opacity-100"
              }`}
            >
              <ChallengeHero
                challenges={challenges}
                activeChallengeId={activeChallengeId}
                onChangeChallenge={setActiveChallengeId}
                detail={detail}
                days={weekDays}
                summary={weekSummary}
                todayProgress={todayProgress}
                userPointsToday={userPointsToday}
                streak={currentStreak}
                lastGain={lastGain}
                copiedInvite={copiedCode}
                onCopyInvite={() => handleCopyInvite(detail.challenge.invite_code)}
                copiedLink={copiedLink}
                onCopyInviteLink={() => handleCopyInviteLink(detail.challenge.invite_code)}
                restOpen={confirmRestDay}
                onToggleRest={() => setConfirmRestDay((prev) => !prev)}
                hasIntegrations={hasLinkedIntegrations}
                syncing={quickSyncing}
                onSync={() => void handleQuickSync()}
                onConnectIntegrations={() => switchTab("integrations")}
                rulesOpen={showRules}
                onToggleRules={() => setShowRules((prev) => !prev)}
              />

              {(confirmRestDay || restFeedback || quickSyncMsg || showRules) && (
                <div className="flex flex-col gap-3">
                  {confirmRestDay && (
                    <Notice
                      tone="rest"
                      action={
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            disabled={restingBusy}
                            onClick={() => void handleConfirmRestDay()}
                            className="btn btn-sm btn-dark"
                          >
                            <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
                            {restingBusy ? "Registrando..." : "Confirmar descanso"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRestDay(false)}
                            className="btn btn-sm btn-secondary"
                          >
                            Cancelar
                          </button>
                        </div>
                      }
                      className="flex-wrap"
                    >
                      Confirmar <strong>dia de descanso</strong> para hoje? Ele preserva sua
                      ofensiva sem somar pontos (restam{" "}
                      <strong className="font-mono">
                        {detail.rest_days_remaining_this_week}
                      </strong>{" "}
                      na semana).
                    </Notice>
                  )}
                  {restFeedback && (
                    <Notice
                      tone={restFeedback.ok ? "success" : "error"}
                      onDismiss={() => setRestFeedback(null)}
                    >
                      {restFeedback.text}
                    </Notice>
                  )}
                  {quickSyncMsg && (
                    <Notice
                      tone={quickSyncMsg.ok ? "success" : "error"}
                      onDismiss={() => setQuickSyncMsg(null)}
                    >
                      {quickSyncMsg.text}
                    </Notice>
                  )}
                  {showRules && (
                    <section aria-label="Regras e pesos" className="card animate-reveal p-4">
                      <RulesPanel detail={detail} />
                    </section>
                  )}
                </div>
              )}

              {/* Celular: registrar, placar e marcos, feed. Desktop: placar e marcos na coluna direita. */}
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="min-w-0">
                  {isMember ? (
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
                    <EmptyState icon={Compass} title="Você está vendo um desafio aberto">
                      Para postar check-ins, participe dele em{" "}
                      <button
                        type="button"
                        onClick={() => switchTab("challenges")}
                        className="font-bold text-accent-text underline"
                      >
                        Desafios
                      </button>
                      .
                    </EmptyState>
                  )}
                </div>

                <aside className="flex min-w-0 flex-col gap-5 self-start lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:gap-6">
                  <Scoreboard
                    entries={sortedLeaderboard}
                    sort={leaderboardSort}
                    onSortChange={setLeaderboardSort}
                    currentUserId={user.id}
                    scoringMode={detail.challenge.scoring_mode}
                    limit={HOME_SCOREBOARD_LIMIT}
                    onSeeAll={() => switchTab("ranking")}
                    inviteCode={detail.challenge.invite_code}
                    copiedInvite={copiedCode}
                    onCopyInvite={() => handleCopyInvite(detail.challenge.invite_code)}
                  />
                  {isMember && (
                    <Milestones
                      entry={myLeaderboardEntry}
                      position={myLeaderboardIndex + 1}
                      total={detail.leaderboard.length}
                      summary={weekSummary}
                      restRemaining={detail.rest_days_remaining_this_week}
                      restPerWeek={detail.challenge.rest_days_per_week}
                    />
                  )}
                </aside>

                <div className="min-w-0 lg:col-start-1 lg:row-start-2">
                  <GroupFeed
                    feed={feed}
                    filter={feedFilter}
                    onFilterChange={setFeedFilter}
                    categoryConfigs={detail.category_configs}
                    currentUserId={user.id}
                    isAdmin={isAdmin}
                    isMember={isMember}
                    scoringMode={detail.challenge.scoring_mode}
                    onUpdated={handleCheckinUpdated}
                    hasMore={hasMoreFeed}
                    loadingMore={loadingMoreFeed}
                    onLoadMore={() => void handleLoadMoreFeed()}
                  />
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {tab === "progress" && <DiaryTab challenges={challenges} />}

      {tab === "ranking" &&
        (gate ??
          (detail && (
            <RankingTab
              detail={detail}
              challenges={challenges}
              activeChallengeId={activeChallengeId}
              onChangeChallenge={setActiveChallengeId}
              sort={leaderboardSort}
              onSortChange={setLeaderboardSort}
              currentUserId={user.id}
              copiedInvite={copiedCode}
              onCopyInvite={() => handleCopyInvite(detail.challenge.invite_code)}
            />
          )))}

      <div hidden={tab !== "challenges"}>
        <ChallengesTab
          challenges={challenges}
          activeChallengeId={activeChallengeId}
          onSelectChallenge={(id) => {
            setActiveChallengeId(id);
            switchTab("home");
          }}
          onRefreshChallenges={async (selectId) => {
            await loadChallenges(selectId);
            if (selectId) {
              switchTab("home");
            }
          }}
        />
      </div>

      <div hidden={tab !== "integrations"}>
        <IntegrationsTab
          user={user}
          challenges={challenges}
          onUserUpdated={onUserUpdated}
          onSynced={async () => {
            if (activeChallengeId) {
              await loadActiveChallengeData(activeChallengeId);
            }
          }}
          onGoToActive={() => switchTab("home")}
        />
      </div>

      <div hidden={tab !== "settings"}>
        <SettingsTab user={user} onUserUpdated={onUserUpdated} onLogout={handleLogout} />
      </div>
    </AppShell>
  );
}
