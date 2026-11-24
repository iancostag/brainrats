"use client";

import {
  Award,
  BookOpen,
  CalendarCheck,
  Code2,
  Coffee,
  Flame,
  Layers,
  ListChecks,
  Medal,
  Moon,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { fetchMyBadges, type LeaderboardEntry, type UserBadge } from "@/lib/api";
import type { WeekSummary } from "@/lib/week";

interface Tile {
  icon: LucideIcon;
  value: string;
  label: string;
  tone: string;
}

const BADGE_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  flame: Flame,
  trophy: Trophy,
  layers: Layers,
  code: Code2,
  book: BookOpen,
  moon: Moon,
  calendar: CalendarCheck,
  medal: Award,
};

export function Milestones({
  entry,
  position,
  total,
  summary,
  restRemaining,
  restPerWeek,
  refreshKey = 0,
}: {
  entry: LeaderboardEntry | undefined;
  position: number;
  total: number;
  summary: WeekSummary;
  restRemaining: number;
  restPerWeek: number;
  refreshKey?: number;
}) {
  const [badges, setBadges] = useState<UserBadge[]>([]);

  useEffect(() => {
    let active = true;
    fetchMyBadges()
      .then((list) => {
        if (active) setBadges(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (!entry) return null;

  const tiles: Tile[] = [
    {
      icon: Flame,
      value: `${entry.current_streak}`,
      label: entry.current_streak === 1 ? "dia de ofensiva" : "dias de ofensiva",
      tone: "bg-accent/12 text-accent-text ring-accent/25",
    },
    {
      icon: CalendarCheck,
      value: `${summary.completed}/${summary.elapsed}`,
      label: "dias nesta semana",
      tone: "bg-card text-ink-2 ring-lane-soft",
    },
    {
      icon: ListChecks,
      value: `${entry.checkins_count}`,
      label: entry.checkins_count === 1 ? "estudo válido" : "estudos válidos",
      tone: "bg-card text-ink-2 ring-lane-soft",
    },
    {
      icon: Medal,
      value: position > 0 ? `${position}º` : "—",
      label: `de ${total} em pontos`,
      tone: "bg-card text-ink-2 ring-lane-soft",
    },
  ];

  return (
    <section aria-labelledby="milestones-title" className="card p-5">
      <h2 id="milestones-title" className="section-title">
        <Medal className="h-5 w-5 text-gold" aria-hidden="true" />
        Seus marcos
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <li
              key={tile.label}
              className="flex items-center gap-2.5 rounded-xl border border-lane bg-well p-2.5"
            >
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tile.tone}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-score text-xl leading-none text-ink-strong">
                  {tile.value}
                </span>
                <span className="block text-[11px] leading-tight text-ink-2">{tile.label}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {badges.length > 0 && (
        <div className="mt-4 border-t border-lane-soft pt-3.5">
          <p className="eyebrow mb-2">Conquistas desbloqueadas ({badges.length})</p>
          <ul className="flex flex-wrap gap-1.5">
            {badges.map((badge) => {
              const Icon = BADGE_ICONS[badge.icon] ?? Award;
              return (
                <li
                  key={badge.badge_key}
                  title={badge.description}
                  className="inline-flex items-center gap-1.5 rounded-full bg-grape/12 px-2.5 py-1 text-[11px] font-bold text-grape ring-1 ring-grape/25"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {badge.title}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {restPerWeek > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-lane bg-card px-3 py-2.5 text-xs text-ink-3">
          <Coffee className="mt-px h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <span>
            Descansar também conta: você tem{" "}
            <strong className="font-semibold text-ink-strong">
              {restRemaining} de {restPerWeek}
            </strong>{" "}
            descanso(s) livre(s) nesta semana, e eles mantêm a ofensiva.
          </span>
        </p>
      )}
    </section>
  );
}
