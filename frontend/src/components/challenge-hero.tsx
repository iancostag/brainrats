"use client";

import {
  Check,
  ChevronDown,
  Clock,
  Coffee,
  Copy,
  Flame,
  Info,
  Link2,
  Plug,
  Radio,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { ChallengeSwitcher } from "@/components/challenge-switcher";
import { WeekCalendar } from "@/components/week-calendar";
import type { ChallengeDetail, ChallengeListItem } from "@/lib/api";
import { CATEGORY_META, formatTimezoneLabel } from "@/lib/categories";
import { pluralDays } from "@/lib/leaderboard";
import type { WeekDay, WeekSummary } from "@/lib/week";

interface ChallengeHeroProps {
  challenges: ChallengeListItem[];
  activeChallengeId: string;
  onChangeChallenge: (id: string) => void;
  detail: ChallengeDetail;
  days: WeekDay[];
  summary: WeekSummary;
  todayProgress: number;
  userPointsToday: number;
  streak: number;
  lastGain: { label: string; key: number } | null;

  copiedInvite: boolean;
  onCopyInvite: () => void;
  copiedLink?: boolean;
  onCopyInviteLink?: () => void;
  restOpen: boolean;
  onToggleRest: () => void;
  hasIntegrations: boolean;
  syncing: boolean;
  onSync: () => void;
  onConnectIntegrations: () => void;
  rulesOpen: boolean;
  onToggleRules: () => void;

  isAdmin?: boolean;
  moderationOpen?: boolean;
  onToggleModeration?: () => void;
  manageOpen?: boolean;
  onToggleManage?: () => void;
  wrappedOpen?: boolean;
  onToggleWrapped?: () => void;
}

function getTimeLeftInDay(timezone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    const totalLeft = Math.max(0, 24 * 60 - (h * 60 + m));
    const hrs = Math.floor(totalLeft / 60);
    const mins = totalLeft % 60;
    return hrs > 0 ? `${hrs}h ${String(mins).padStart(2, "0")}m` : `${mins}m`;
  } catch {
    return null;
  }
}

function heroMessage(isMember: boolean, summary: WeekSummary, streak: number): string {
  if (!isMember) return "Você está vendo um desafio aberto. Participe para registrar estudos.";
  if (summary.todayStatus === "studied") return "Meta de hoje cumprida. Amanhã tem mais.";
  if (summary.todayStatus === "rest")
    return "Dia de descanso registrado. Sua ofensiva está protegida.";
  if (summary.checkedInToday) return "Estudo de hoje registrado. Sua ofensiva segue viva.";
  if (streak > 0) return `Registre um estudo hoje para manter ${pluralDays(streak)} de ofensiva.`;
  return "Registre um estudo hoje e comece sua ofensiva.";
}

export function ChallengeHero({
  challenges,
  activeChallengeId,
  onChangeChallenge,
  detail,
  days,
  summary,
  todayProgress,
  userPointsToday,
  streak,
  lastGain,
  copiedInvite,
  onCopyInvite,
  copiedLink = false,
  onCopyInviteLink,
  restOpen,
  onToggleRest,
  hasIntegrations,
  syncing,
  onSync,
  onConnectIntegrations,
  rulesOpen,
  onToggleRules,
  isAdmin = false,
  moderationOpen = false,
  onToggleModeration,
  manageOpen = false,
  onToggleManage,
  wrappedOpen = false,
  onToggleWrapped,
}: ChallengeHeroProps) {
  const { challenge } = detail;
  const isMember = challenge.is_member;
  const isCheckinMode = challenge.scoring_mode === "checkin";
  const dailyCap = Math.max(1, challenge.daily_points_cap);
  const goalDone = summary.todayStatus === "studied";
  const resting = summary.todayStatus === "rest";
  const timeLeft = !goalDone && !resting && isMember ? getTimeLeftInDay(challenge.timezone) : null;

  const collectiveGoal = challenge.collective_weekly_goal ?? null;
  const collectiveProgress = detail.collective_week_checkins ?? 0;
  const activeStudiers = detail.active_studiers ?? [];
  const pendingReports = detail.pending_reports_count ?? 0;

  const goalValue = isCheckinMode
    ? goalDone
      ? "Concluída"
      : resting
        ? "Descanso"
        : "Pendente"
    : `${userPointsToday}/${dailyCap} pts`;

  const shellBtn = "btn btn-sm btn-shell shrink-0 disabled:opacity-40";

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden rounded-[1.5rem] bg-shell text-white shadow-raised"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 right-[18%] h-72 w-72 rounded-full bg-accent-bright/35 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-grape/20 blur-3xl" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,transparent_0_22px,rgb(255_255_255/0.025)_22px_24px)]" />
      </div>

      <div className="grid gap-4 p-4 sm:gap-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-center xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_auto_20rem]">
        <div className="relative flex min-w-0 flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascot.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -top-1 right-0 w-16 select-none sm:w-24 lg:hidden"
          />

          <div className="flex flex-wrap items-center gap-2 pr-20 sm:pr-28 lg:pr-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/25 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-accent-soft uppercase ring-1 ring-accent-bright/40">
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
              {isMember ? "Desafio ativo" : "Desafio aberto"}
            </span>
            <ChallengeSwitcher
              challenges={challenges}
              value={activeChallengeId}
              onChange={onChangeChallenge}
              tone="dark"
            />
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">
                {isCheckinMode ? "Modo Check-in" : "Modo Pontuação"}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatTimezoneLabel(challenge.timezone)}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {challenge.members_count}
                <span className="sr-only"> participantes</span>
              </span>
              {timeLeft && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-mono text-amber-200">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    fecha em {timeLeft}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="pr-20 sm:pr-28 lg:pr-0">
            <h1
              id="hero-title"
              className="text-[1.375rem] leading-tight font-extrabold tracking-tight text-balance sm:text-[2rem]"
            >
              {challenge.title}
            </h1>
            <p className="mt-1.5 text-sm text-slate-300 sm:text-base">
              {heroMessage(isMember, summary, streak)}
            </p>
          </div>

          {isMember && (
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10 sm:gap-3 sm:p-3">
                <span
                  className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors min-[400px]:inline-flex ${
                    goalDone
                      ? "bg-success text-shell"
                      : resting
                        ? "bg-slate-600 text-white"
                        : "bg-white/10 text-accent-soft ring-1 ring-accent-bright/50"
                  }`}
                >
                  {goalDone ? (
                    <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
                  ) : resting ? (
                    <Coffee className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Target className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="text-xs font-semibold text-slate-300">Meta de hoje</span>
                    {lastGain && (
                      <span
                        key={lastGain.key}
                        className="animate-rise-in rounded-full bg-success px-2 py-px font-score text-xs text-shell"
                      >
                        {lastGain.label}
                      </span>
                    )}
                  </div>
                  <p
                    key={`goal-${userPointsToday}-${summary.todayStatus}`}
                    className={`font-score text-lg leading-tight ${goalDone ? "text-emerald-300" : "text-white"} ${
                      lastGain ? "animate-stamp" : ""
                    }`}
                  >
                    {goalValue}
                  </p>
                  <div
                    role="progressbar"
                    aria-label="Meta de hoje"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(todayProgress * 100)}
                    aria-valuetext={
                      isCheckinMode
                        ? goalDone
                          ? "Check-in de hoje concluído"
                          : "Check-in de hoje pendente"
                        : `${userPointsToday} de ${dailyCap} pontos`
                    }
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                        goalDone ? "bg-success" : "bg-accent-bright"
                      }`}
                      style={{ width: `${todayProgress * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10 sm:gap-3 sm:p-3">
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/40 min-[400px]:inline-flex">
                  <Flame
                    className={`h-5 w-5 ${streak > 0 ? "animate-flicker" : ""}`}
                    aria-hidden="true"
                  />
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-300">Ofensiva atual</span>
                  <p
                    key={`streak-${streak}`}
                    className={`font-score text-lg leading-tight ${lastGain ? "animate-stamp" : ""}`}
                  >
                    {pluralDays(streak)}
                  </p>
                  <p className="hidden text-[11px] text-slate-400 sm:block">
                    {detail.rest_days_remaining_this_week > 0
                      ? `${detail.rest_days_remaining_this_week} descanso(s) livre(s) nesta semana`
                      : "Sem descansos livres nesta semana"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {(collectiveGoal || activeStudiers.length > 0) && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {collectiveGoal && (
                <div className="flex min-w-52 flex-1 items-center gap-2.5 rounded-xl bg-white/[0.06] px-3 py-2 ring-1 ring-white/10">
                  <span className="font-mono text-[11px] font-bold text-slate-300 uppercase">
                    Meta coletiva
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gold transition-[width] duration-500"
                      style={{
                        width: `${Math.min(100, (collectiveProgress / collectiveGoal) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-score text-sm text-gold">
                    {collectiveProgress}/{collectiveGoal}
                  </span>
                </div>
              )}

              {activeStudiers.length > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200 ring-1 ring-emerald-400/30">
                  <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-300" aria-hidden="true" />
                  <span>
                    <strong className="font-bold">{activeStudiers.length}</strong> estudando agora:{" "}
                    {activeStudiers
                      .slice(0, 2)
                      .map(
                        (s) =>
                          `${s.display_name} (${CATEGORY_META[s.category_slug]?.shortLabel ?? s.category_slug})`,
                      )
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none hidden w-44 -rotate-3 select-none drop-shadow-[0_18px_30px_rgb(244_81_30/0.35)] 2xl:block"
        />

        {isMember && <WeekCalendar days={days} summary={summary} todayProgress={todayProgress} />}
      </div>

      <div className="border-t border-white/10 bg-black/15 px-4 py-3 sm:px-6">
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          <button
            type="button"
            onClick={onCopyInvite}
            aria-label={
              copiedInvite
                ? "Código de convite copiado"
                : `Copiar código de convite ${challenge.invite_code}`
            }
            className={`${shellBtn} font-mono`}
          >
            {copiedInvite ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Convite: {challenge.invite_code}
              </>
            )}
          </button>

          {onCopyInviteLink && (
            <button
              type="button"
              onClick={onCopyInviteLink}
              aria-label={
                copiedLink
                  ? "Link do desafio copiado"
                  : `Copiar link de convite do desafio ${challenge.title}`
              }
              className={shellBtn}
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" /> Link copiado
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> Copiar link
                </>
              )}
            </button>
          )}

          {isMember && (
            <button
              type="button"
              aria-expanded={restOpen}
              onClick={onToggleRest}
              disabled={detail.rest_days_remaining_this_week <= 0}
              className={shellBtn}
            >
              <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
              Descansar hoje ({detail.rest_days_remaining_this_week}/sem)
            </button>
          )}

          {isMember &&
            (hasIntegrations ? (
              <button type="button" disabled={syncing} onClick={onSync} className={shellBtn}>
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {syncing ? "Sincronizando..." : "Sincronizar GitHub/LeetCode"}
              </button>
            ) : (
              <button type="button" onClick={onConnectIntegrations} className={shellBtn}>
                <Plug className="h-3.5 w-3.5" aria-hidden="true" /> Conectar GitHub/LeetCode
              </button>
            ))}

          <button
            type="button"
            aria-expanded={rulesOpen}
            onClick={onToggleRules}
            className={shellBtn}
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Regras e pesos
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${rulesOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {onToggleWrapped && (
            <button
              type="button"
              aria-expanded={wrappedOpen}
              onClick={onToggleWrapped}
              className={shellBtn}
            >
              <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              Retrospectiva
            </button>
          )}

          {isAdmin && onToggleModeration && (
            <button
              type="button"
              aria-expanded={moderationOpen}
              onClick={onToggleModeration}
              className={shellBtn}
            >
              <ShieldAlert className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              Moderação
              {pendingReports > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 py-px font-score text-xs text-shell">
                  {pendingReports}
                </span>
              )}
            </button>
          )}

          {isMember && onToggleManage && (
            <button
              type="button"
              aria-expanded={manageOpen}
              onClick={onToggleManage}
              className={shellBtn}
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
              Gerenciar
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function ChallengeHeroSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-4 rounded-[1.5rem] bg-shell p-6 lg:flex-row lg:items-center"
    >
      <span className="sr-only">Carregando desafio...</span>
      <div className="flex flex-1 flex-col gap-3">
        <div className="h-6 w-32 animate-pulse rounded-full bg-white/10" />
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-white/10" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          <div className="h-16 animate-pulse rounded-2xl bg-white/[0.06]" />
          <div className="h-16 animate-pulse rounded-2xl bg-white/[0.06]" />
        </div>
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-white/[0.06] lg:w-72" />
    </div>
  );
}
