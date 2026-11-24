"use client";

import { Bell, Coffee, Compass, Plus, Swords } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AppShell, type StreakSnapshot, type TabId } from "@/components/app-shell";
import { ChallengeHero, ChallengeHeroSkeleton } from "@/components/challenge-hero";
import { ChallengeManageModal } from "@/components/challenge-manage-modal";
import { ChallengeWrappedModal } from "@/components/challenge-wrapped-modal";
import { ChallengesTab } from "@/components/challenges-tab";
import { CheckinForm } from "@/components/checkin-form";
import { DiaryTab } from "@/components/diary-tab";
import { GroupFeed } from "@/components/group-feed";
import { IntegrationsTab } from "@/components/integrations-tab";
import { Milestones } from "@/components/milestones";
import { ModerationPanel } from "@/components/moderation-panel";
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
  nudgeMember,
  registerRestDay,
  syncIntegrations,
  updateProfile,
  type ChallengeDetail,
  type ChallengeListItem,
  type CheckIn,
  type User,
} from "@/lib/api";
import { formatPointsLabel } from "@/lib/categories";
import {
  buildChallengeInviteUrl,
  clearPendingInvite,
  getPendingInvite,
  getStoredLastChallengeId,
  setStoredLastChallengeId,
} from "@/lib/invite";
import { sortLeaderboard, type LeaderboardSort } from "@/lib/leaderboard";
import { getChallengeWeekDays, summarizeWeek } from "@/lib/week";

interface DashboardProps {
  user: User;
  initialNotice?: { ok: boolean; text: string } | null;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
}

const FEED_PAGE_SIZE = 30;
const HOME_SCOREBOARD_LIMIT = 5;

function mapTabParam(paramTab: string | null): TabId | null {
  if (paramTab === "home" || paramTab === "active") return "home";
  if (paramTab === "progress" || paramTab === "diary") return "progress";
  if (paramTab === "ranking") return "ranking";
  if (paramTab === "challenges" || paramTab === "explore") return "challenges";
  if (paramTab === "integrations") return "integrations";
  if (paramTab === "settings") return "settings";
  return null;
}

export function Dashboard({ user, initialNotice = null, onUserUpdated, onLogout }: DashboardProps) {
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
  const [inviteNotice, setInviteNotice] = useState<{ ok: boolean; text: string } | null>(
    initialNotice,
  );
  const [showRules, setShowRules] = useState(false);
  const [showModeration, setShowModeration] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showWrapped, setShowWrapped] = useState(false);
  const [confirmRestDay, setConfirmRestDay] = useState(false);
  const [restingBusy, setRestingBusy] = useState(false);
  const [restFeedback, setRestFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [quickSyncing, setQuickSyncing] = useState(false);
  const [quickSyncMsg, setQuickSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [nudgeFeedback, setNudgeFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastGain, setLastGain] = useState<{ label: string; key: number } | null>(null);
  const [badgeRefreshKey, setBadgeRefreshKey] = useState(0);

  const [feedFilter, setFeedFilter] = useState<string>("all");
  const [hasMoreFeed, setHasMoreFeed] = useState(false);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);
  const [leaderboardSort, setLeaderboardSort] = useState<LeaderboardSort>("points");

  const activeReqSeq = useRef(0);

  function switchTab(next: TabId) {
    setTab(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
      const params = new URLSearchParams(window.location.search);
      if (next === "home") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const qs = params.toString();
      window.history.replaceState({}, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const mappedTab = mapTabParam(params.get("tab"));
    if (mappedTab) {
      setTab(mappedTab);
    }
  }, []);

  // Atalhos de teclado: N foca o check-in, / foca a busca do diário.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setTab("home");
        setTimeout(() => {
          document.getElementById("checkin-title-input")?.focus();
        }, 40);
      } else if (event.key === "/") {
        event.preventDefault();
        setTab("progress");
        setTimeout(() => {
          document.querySelector<HTMLInputElement>('input[aria-label="Buscar no diário"]')?.focus();
        }, 60);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const userLastChallengeRef = useRef(user.last_challenge_id);
  userLastChallengeRef.current = user.last_challenge_id;

  const selectActiveChallenge = useCallback(
    (challengeId: string, persist = true) => {
      if (!challengeId) return;
      setActiveChallengeId(challengeId);
      setStoredLastChallengeId(user.id, challengeId);
      if (persist && challengeId !== userLastChallengeRef.current) {
        void updateProfile({ last_challenge_id: challengeId })
          .then(onUserUpdated)
          .catch(() => {});
      }
    },
    [onUserUpdated, user.id],
  );

  const loadChallenges = useCallback(
    async (preferredId?: string) => {
      setLoadingChallenges(true);
      setChallengesError(null);
      try {
        const list = await fetchChallenges();
        setChallenges(list);
        const storedId = getStoredLastChallengeId(user.id);
        const serverLastId = userLastChallengeRef.current;
        setActiveChallengeId((prev) => {
          if (preferredId && list.some((c) => c.id === preferredId)) {
            setStoredLastChallengeId(user.id, preferredId);
            return preferredId;
          }
          if (prev && list.some((c) => c.id === prev)) return prev;
          if (serverLastId && list.some((c) => c.id === serverLastId)) {
            setStoredLastChallengeId(user.id, serverLastId);
            return serverLastId;
          }
          if (storedId && list.some((c) => c.id === storedId)) return storedId;
          return list.find((c) => c.is_member)?.id ?? list[0]?.id ?? "";
        });
      } catch (err) {
        setChallengesError(
          err instanceof Error ? err.message : "Não foi possível carregar os desafios.",
        );
      } finally {
        setLoadingChallenges(false);
      }
    },
    [user.id],
  );

  const loadActiveChallengeData = useCallback(async (challengeId: string) => {
    if (!challengeId) return;
    const reqSeq = ++activeReqSeq.current;
    setLoadingDetail(true);
    setDetailError(null);
    setConfirmRestDay(false);
    setRestFeedback(null);
    setQuickSyncMsg(null);
    setShowModeration(false);
    setShowManage(false);
    setShowWrapped(false);
    try {
      const [chDetail, chFeed] = await Promise.all([
        fetchChallengeDetail(challengeId),
        fetchChallengeFeed(challengeId, { limit: FEED_PAGE_SIZE }),
      ]);
      if (reqSeq !== activeReqSeq.current) return;
      setDetail(chDetail);
      setFeed(chFeed);
      setHasMoreFeed(chFeed.length === FEED_PAGE_SIZE);
    } catch (err) {
      if (reqSeq !== activeReqSeq.current) return;
      setDetailError(
        err instanceof Error ? err.message : "Não foi possível carregar este desafio.",
      );
    } finally {
      if (reqSeq === activeReqSeq.current) {
        setLoadingDetail(false);
      }
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
      setBadgeRefreshKey((k) => k + 1);
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

  async function handleNudge(targetUserId: string, targetName: string) {
    if (!activeChallengeId) return;
    setNudgeFeedback(null);
    try {
      await nudgeMember(activeChallengeId, targetUserId);
      setNudgeFeedback({
        ok: true,
        text: `Lembrete amigável enviado para ${targetName}!`,
      });
    } catch (err) {
      setNudgeFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Não foi possível enviar lembrete.",
      });
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

  function handleCheckinDeleted(checkinId: string) {
    setFeed((prev) => prev.filter((item) => item.id !== checkinId));
    if (activeChallengeId) {
      void loadActiveChallengeData(activeChallengeId);
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

  // Usa os dados exatos calculados pelo backend (evitando quebra quando o feed tem >30 itens).
  const userActiveDates = useMemo(() => {
    const dates = new Set<string>(detail?.user_active_dates_this_week ?? []);
    for (const item of feed) {
      if (item.user_id === user.id && item.status === "valid") {
        dates.add(item.study_date);
      }
    }
    return dates;
  }, [detail?.user_active_dates_this_week, feed, user.id]);

  const userPointsToday = useMemo(() => {
    if (typeof detail?.user_points_today === "number") {
      return detail.user_points_today;
    }
    return feed
      .filter(
        (item) =>
          item.user_id === user.id &&
          item.status === "valid" &&
          item.study_date === todayIso,
      )
      .reduce((sum, item) => sum + item.points_awarded, 0);
  }, [detail?.user_points_today, feed, todayIso, user.id]);

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
  const receivedNudges = detail?.received_nudges_today ?? [];

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
              {receivedNudges.length > 0 && !weekSummary.checkedInToday && (
                <Notice tone="rest">
                  <span className="inline-flex items-center gap-1.5">
                    <Bell className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                    <strong>{receivedNudges[0].sender_display_name}</strong> te mandou um lembrete
                    hoje para manter sua ofensiva viva!
                  </span>
                </Notice>
              )}

              <ChallengeHero
                challenges={challenges}
                activeChallengeId={activeChallengeId}
                onChangeChallenge={selectActiveChallenge}
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
                isAdmin={isAdmin}
                moderationOpen={showModeration}
                onToggleModeration={() => setShowModeration((prev) => !prev)}
                manageOpen={showManage}
                onToggleManage={() => setShowManage((prev) => !prev)}
                wrappedOpen={showWrapped}
                onToggleWrapped={() => setShowWrapped((prev) => !prev)}
              />

              {(confirmRestDay ||
                restFeedback ||
                quickSyncMsg ||
                nudgeFeedback ||
                showRules ||
                showModeration ||
                showManage ||
                showWrapped) && (
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
                  {nudgeFeedback && (
                    <Notice
                      tone={nudgeFeedback.ok ? "success" : "error"}
                      onDismiss={() => setNudgeFeedback(null)}
                    >
                      {nudgeFeedback.text}
                    </Notice>
                  )}
                  {showRules && (
                    <section aria-label="Regras e pesos" className="card animate-reveal p-4">
                      <RulesPanel detail={detail} />
                    </section>
                  )}
                  {showWrapped && (
                    <ChallengeWrappedModal
                      challengeId={detail.challenge.id}
                      onClose={() => setShowWrapped(false)}
                    />
                  )}
                  {showModeration && isAdmin && (
                    <ModerationPanel
                      challengeId={detail.challenge.id}
                      currentUserId={user.id}
                      scoringMode={detail.challenge.scoring_mode}
                      onClose={() => setShowModeration(false)}
                      onModerated={handleCheckinUpdated}
                    />
                  )}
                  {showManage && isMember && (
                    <ChallengeManageModal
                      detail={detail}
                      currentUserId={user.id}
                      isAdmin={isAdmin}
                      onClose={() => setShowManage(false)}
                      onUpdated={async () => {
                        await loadChallenges(detail.challenge.id);
                        await loadActiveChallengeData(detail.challenge.id);
                      }}
                      onLeftChallenge={async () => {
                        setActiveChallengeId("");
                        setDetail(null);
                        await loadChallenges();
                      }}
                    />
                  )}
                </div>
              )}

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
                      onPresenceChanged={() => {
                        void fetchChallengeDetail(detail.challenge.id)
                          .then(setDetail)
                          .catch(() => {});
                      }}
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
                        if (created.newly_unlocked_badges?.length) {
                          setBadgeRefreshKey((k) => k + 1);
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
                    onNudge={isMember ? (uid, name) => void handleNudge(uid, name) : undefined}
                  />
                  {isMember && (
                    <Milestones
                      entry={myLeaderboardEntry}
                      position={myLeaderboardIndex + 1}
                      total={detail.leaderboard.length}
                      summary={weekSummary}
                      restRemaining={detail.rest_days_remaining_this_week}
                      restPerWeek={detail.challenge.rest_days_per_week}
                      refreshKey={badgeRefreshKey}
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
                    onDeleted={handleCheckinDeleted}
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
              onChangeChallenge={selectActiveChallenge}
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
            selectActiveChallenge(id);
            switchTab("home");
          }}
          onRefreshChallenges={async (selectId) => {
            await loadChallenges(selectId);
            if (selectId) {
              setStoredLastChallengeId(user.id, selectId);
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
              setBadgeRefreshKey((k) => k + 1);
            }
          }}
          onGoToActive={() => switchTab("home")}
        />
      </div>

      <div hidden={tab !== "settings"}>
        <SettingsTab
          user={user}
          onUserUpdated={onUserUpdated}
          onOpenIntegrations={() => switchTab("integrations")}
          onLogout={handleLogout}
        />
      </div>

      {isMember && tab !== "home" && (
        <button
          type="button"
          onClick={() => {
            switchTab("home");
            setTimeout(() => document.getElementById("checkin-title-input")?.focus(), 60);
          }}
          aria-label="Registrar novo estudo"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-raised transition-transform hover:bg-accent-hover active:scale-95 lg:hidden"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </button>
      )}
    </AppShell>
  );
}
