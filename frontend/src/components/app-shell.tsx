"use client";

import {
  BarChart3,
  ChevronDown,
  Flame,
  Home,
  LogOut,
  Plug,
  RefreshCw,
  Settings,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { ActionMenu } from "@/components/action-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui";
import { WeekStrip } from "@/components/week-calendar";
import type { User } from "@/lib/api";
import { pluralDays } from "@/lib/leaderboard";
import type { WeekDay, WeekSummary } from "@/lib/week";

export type TabId = "home" | "progress" | "ranking" | "challenges" | "integrations" | "settings";

interface NavItem {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Aparece na barra inferior do celular (Configurações fica no menu do perfil). */
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Início", shortLabel: "Início", icon: Home, mobile: true },
  { id: "progress", label: "Meu Progresso", shortLabel: "Progresso", icon: BarChart3, mobile: true },
  { id: "ranking", label: "Ranking", shortLabel: "Ranking", icon: Trophy, mobile: true },
  { id: "challenges", label: "Desafios", shortLabel: "Desafios", icon: Swords, mobile: true },
  { id: "integrations", label: "Integrações", shortLabel: "Sync", icon: Plug, mobile: true },
  { id: "settings", label: "Configurações", shortLabel: "Ajustes", icon: Settings, mobile: false },
];

export interface StreakSnapshot {
  streak: number;
  days: WeekDay[];
  summary: WeekSummary;
  todayProgress: number;
}

interface AppShellProps {
  tab: TabId;
  onNavigate: (tab: TabId) => void;
  user: User;
  onLogout: () => void;
  /** Resumo da ofensiva no desafio ativo; ausente quando o usuário não participa. */
  streak: StreakSnapshot | null;
  busy: boolean;
  children: ReactNode;
}

function streakMessage(snapshot: StreakSnapshot): string {
  const { todayStatus } = snapshot.summary;
  if (todayStatus === "studied") return "Meta de hoje cumprida.";
  if (todayStatus === "rest") return "Descanso registrado hoje.";
  if (snapshot.summary.checkedInToday) return "Estudo de hoje registrado.";
  return snapshot.streak > 0 ? "Falta o estudo de hoje." : "Comece hoje uma nova ofensiva.";
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-icon.jpg"
        alt=""
        className={`${compact ? "h-9 w-9" : "h-11 w-11"} shrink-0 rounded-xl object-cover ring-1 ring-white/10`}
      />
      <span
        className={`font-extrabold tracking-tight ${compact ? "text-base" : "text-lg"} ${
          compact ? "text-ink-strong" : "text-white"
        }`}
      >
        Brain<span className={compact ? "text-accent-text" : "text-accent-bright"}>Rats</span>
      </span>
    </span>
  );
}

export function AppShell({
  tab,
  onNavigate,
  user,
  onLogout,
  streak,
  busy,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-shell focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Pular para o conteúdo
      </a>

      {/* Sidebar: trilho de ícones em lg, completa em xl. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[5.5rem] flex-col bg-shell px-3 py-5 text-white lg:flex xl:w-64 xl:px-4">
        <div className="flex justify-center xl:justify-start xl:px-2">
          <span className="xl:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.jpg" alt="BrainRats" className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10" />
          </span>
          <span className="hidden xl:block">
            <BrandMark />
          </span>
        </div>

        <nav aria-label="Navegação principal" className="mt-8 flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                title={item.label}
                onClick={() => onNavigate(item.id)}
                className={`group flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors xl:flex-row xl:justify-start xl:gap-3 xl:px-3.5 xl:text-sm ${
                  active
                    ? "bg-accent text-white shadow-[0_10px_24px_-10px_rgb(244_81_30/0.8)]"
                    : "text-slate-300 hover:bg-shell-raised hover:text-white"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${active ? "" : "text-slate-400 group-hover:text-white"}`}
                  aria-hidden="true"
                />
                <span className="xl:hidden">{item.shortLabel}</span>
                <span className="hidden xl:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {streak && (
          <>
            {/* Trilho: só o número da ofensiva. */}
            <div
              className="mt-auto flex flex-col items-center gap-0.5 rounded-xl bg-shell-raised py-3 xl:hidden"
              title={`${pluralDays(streak.streak)} de ofensiva`}
            >
              <Flame
                className={`h-5 w-5 text-accent-bright ${streak.streak > 0 ? "animate-flicker" : ""}`}
                aria-hidden="true"
              />
              <span className="font-score text-lg leading-none">{streak.streak}</span>
              <span className="sr-only">{pluralDays(streak.streak)} de ofensiva</span>
            </div>

            {/* Sidebar completa: card de ofensiva com a semana. */}
            <section
              aria-label="Sua ofensiva"
              className="relative mt-auto hidden overflow-hidden rounded-2xl bg-linear-to-b from-shell-raised to-shell-active p-4 ring-1 ring-white/5 xl:block"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-accent-bright/25 blur-2xl"
              />
              <div className="relative flex items-center gap-2">
                <Flame
                  className={`h-7 w-7 text-accent-bright ${streak.streak > 0 ? "animate-flicker" : ""}`}
                  aria-hidden="true"
                />
                <p>
                  <span className="font-score text-3xl leading-none">{streak.streak}</span>{" "}
                  <span className="text-sm font-bold">{streak.streak === 1 ? "dia" : "dias"}</span>
                  <span className="block text-xs text-slate-400">de ofensiva</span>
                </p>
              </div>
              <div className="relative mt-3">
                <WeekStrip
                  days={streak.days}
                  summary={streak.summary}
                  todayProgress={streak.todayProgress}
                />
              </div>
              <p className="relative mt-2 text-xs font-semibold text-slate-200">
                {streakMessage(streak)}
              </p>
            </section>
          </>
        )}
      </aside>

      <div className="lg:pl-[5.5rem] xl:pl-64">
        <header className="sticky top-0 z-20 border-b border-lane-soft/80 bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[76rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="lg:hidden">
                <BrandMark compact />
              </span>
              {busy && (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-text"
                >
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span className="hidden sm:inline">Atualizando...</span>
                  <span className="sr-only sm:hidden">Atualizando</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <ActionMenu
                label="Menu do perfil"
                triggerClassName="inline-flex min-h-10 items-center gap-2 rounded-xl border border-lane bg-card py-1 pr-2.5 pl-1 text-sm font-semibold text-ink-strong transition-colors hover:border-lane-strong"
                trigger={
                  <>
                    <Avatar name={user.display_name} src={user.avatar_url} size="sm" />
                    <span className="hidden max-w-36 truncate sm:inline">{user.display_name}</span>
                    <ChevronDown className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                  </>
                }
                header={
                  <div className="border-b border-lane-soft px-3 pt-2 pb-2.5">
                    <p className="truncate text-sm font-bold text-ink-strong">{user.display_name}</p>
                    <p className="truncate font-mono text-xs text-ink-muted">@{user.username}</p>
                  </div>
                }
                items={[
                  {
                    label: "Configurações",
                    icon: Settings,
                    onSelect: () => onNavigate("settings"),
                  },
                  { label: "Sair", icon: LogOut, tone: "danger", onSelect: onLogout },
                ]}
              />
            </div>
          </div>
        </header>

        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto max-w-[76rem] px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none sm:px-6 sm:pt-6 lg:px-8 lg:pb-12"
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Navegação móvel"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/5 bg-shell pb-[env(safe-area-inset-bottom)] text-white lg:hidden"
      >
        {NAV_ITEMS.filter((item) => item.mobile).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors ${
                active ? "text-accent-soft" : "text-slate-300 hover:text-white"
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-1 w-8 rounded-b-full bg-accent-bright"
                />
              )}
              <span
                className={`inline-flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-accent/25" : ""
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
