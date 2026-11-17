"use client";

import {
  BookMarked,
  Check,
  Coffee,
  Compass,
  Copy,
  Flame,
  GitMerge,
  LogOut,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  type ChallengeDetail,
  type ChallengeListItem,
  type CheckIn,
  type User,
} from "@/lib/api";

type TabId = "active" | "explore" | "diary" | "integrations";

interface DashboardProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
}

export function Dashboard({ user, onUserUpdated, onLogout }: DashboardProps) {
  const [tab, setTab] = useState<TabId>("active");
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string>("");
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [feed, setFeed] = useState<CheckIn[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [restFeedback, setRestFeedback] = useState<string | null>(null);

  const loadChallenges = useCallback(async (preferredId?: string) => {
    const list = await fetchChallenges();
    setChallenges(list);
    setActiveChallengeId((prev) => {
      if (preferredId && list.some((c) => c.id === preferredId)) return preferredId;
      if (prev && list.some((c) => c.id === prev)) return prev;
      return list.find((c) => c.is_member)?.id ?? list[0]?.id ?? "";
    });
  }, []);

  const loadActiveChallengeData = useCallback(async (challengeId: string) => {
    if (!challengeId) return;
    setLoadingDetail(true);
    setRestFeedback(null);
    try {
      const [chDetail, chFeed] = await Promise.all([
        fetchChallengeDetail(challengeId),
        fetchChallengeFeed(challengeId),
      ]);
      setDetail(chDetail);
      setFeed(chFeed);
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

  async function handleRestDay() {
    if (!activeChallengeId) return;
    setRestFeedback(null);
    try {
      const res = await registerRestDay(activeChallengeId);
      setRestFeedback(
        `Rest Day registrado para ${res.rest_date}. Restam ${res.rest_days_remaining_this_week} na semana.`,
      );
      await loadActiveChallengeData(activeChallengeId);
    } catch (err) {
      setRestFeedback(err instanceof Error ? err.message : "Não foi possível registrar Rest Day.");
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
      void fetchChallengeDetail(activeChallengeId).then(setDetail);
    }
  }

  const activeChallenge = detail?.challenge;
  const isAdmin =
    activeChallenge?.member_role === "admin" ||
    detail?.leaderboard.some((e) => e.user_id === user.id && e.role === "admin") === true;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-zinc-50">BrainRats</span>
              <span className="block text-xs text-zinc-400">@{user.username}</span>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "active" as const, label: "Desafio Ativo", icon: Flame },
              { id: "explore" as const, label: "Explorar & Criar", icon: Compass },
              { id: "diary" as const, label: "Meu Diário", icon: BookMarked },
              { id: "integrations" as const, label: "Integrações", icon: GitMerge },
            ].map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {tab === "active" && (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-400">Desafio selecionado</label>
                  <select
                    value={activeChallengeId}
                    onChange={(e) => setActiveChallengeId(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 outline-none focus:border-emerald-500"
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
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-300">
                      {activeChallenge.scoring_mode === "checkin"
                        ? "Modo Check-in (1/dia)"
                        : `Modo Pontuação (teto ${activeChallenge.daily_points_cap} pts/dia)`}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-300">
                      Fuso: {activeChallenge.timezone}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyInvite(activeChallenge.invite_code)}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-zinc-200 hover:border-emerald-500/50"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" /> Copiado
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
                        onClick={() => void handleRestDay()}
                        disabled={detail.rest_days_remaining_this_week <= 0}
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
                      >
                        <Coffee className="h-3.5 w-3.5" />
                        Rest Day ({detail.rest_days_remaining_this_week}/sem)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {activeChallenge?.description && (
                <p className="text-sm text-zinc-400">{activeChallenge.description}</p>
              )}
              {restFeedback && <p className="text-xs text-amber-300">{restFeedback}</p>}
            </section>

            {loadingDetail && !detail ? (
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
                        void fetchChallengeDetail(detail.challenge.id).then(setDetail);
                      }}
                    />
                  ) : (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-300">
                      Você está visualizando um desafio aberto. Vá em{" "}
                      <button
                        type="button"
                        onClick={() => setTab("explore")}
                        className="font-semibold text-emerald-400 underline"
                      >
                        Explorar & Criar
                      </button>{" "}
                      para participar e postar check-ins.
                    </div>
                  )}

                  <section className="flex flex-col gap-4">
                    <h3 className="font-semibold text-zinc-100">Feed do Grupo ({feed.length})</h3>
                    {feed.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-400">
                        Ainda não há check-ins neste desafio. Seja o primeiro a registrar!
                      </div>
                    ) : (
                      feed.map((item) => (
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
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
                    <h3 className="flex items-center gap-2 font-semibold text-zinc-100">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      Ranking do Desafio
                    </h3>
                    <div className="mt-4 space-y-3">
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
                              <span className="text-xs font-bold text-zinc-400">#{idx + 1}</span>
                              <span className="truncate text-sm font-medium text-zinc-100">
                                {entry.display_name}
                              </span>
                              {entry.role === "admin" && (
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                                  admin
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-zinc-400">
                              🔥 {entry.current_streak}d streak · {entry.active_days}d ativos ·{" "}
                              {entry.rest_days_used_this_week} rest
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-emerald-400">
                            {entry.total_points}{" "}
                            {detail.challenge.scoring_mode === "checkin" ? "chk" : "pts"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            ) : null}
          </div>
        )}

        {tab === "explore" && (
          <ChallengesTab
            challenges={challenges}
            onSelectChallenge={(id) => {
              setActiveChallengeId(id);
              setTab("active");
            }}
            onRefreshChallenges={async (selectId) => {
              await loadChallenges(selectId);
              if (selectId) {
                setTab("active");
              }
            }}
          />
        )}

        {tab === "diary" && <DiaryTab />}

        {tab === "integrations" && (
          <IntegrationsTab
            user={user}
            challenges={challenges}
            onUserUpdated={onUserUpdated}
            onSynced={async () => {
              if (activeChallengeId) {
                await loadActiveChallengeData(activeChallengeId);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
