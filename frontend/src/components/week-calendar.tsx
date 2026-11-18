import { CalendarDays, Check, Coffee, Minus } from "lucide-react";

import {
  DAY_STATUS_TEXT,
  formatDayMonth,
  type DayStatus,
  type WeekDay,
  type WeekSummary,
} from "@/lib/week";

interface WeekProps {
  days: WeekDay[];
  summary: WeekSummary;
  /** Progresso da meta de hoje, de 0 a 1. */
  todayProgress: number;
}

function srLabel(day: WeekDay, status: DayStatus, progress: number): string {
  const base = `${day.label} ${formatDayMonth(day.iso)}${day.isToday ? " (hoje)" : ""}: ${
    DAY_STATUS_TEXT[status]
  }`;
  return status === "today" && progress > 0
    ? `${base}, ${Math.round(progress * 100)}% da meta`
    : base;
}

const CELL_STYLES: Record<DayStatus, string> = {
  studied: "border-emerald-700/25 bg-emerald-50 text-emerald-900",
  rest: "border-transparent bg-rest text-ink-strong",
  today: "border-accent bg-accent text-white shadow-[0_8px_18px_-8px_rgb(210_63_16/0.7)]",
  missed: "border-transparent bg-well text-ink-muted",
  upcoming: "border-lane-soft bg-transparent text-ink-2",
};

/** Calendário da semana no hero: Seg–Dom com data, estado do dia e contagem de dias cumpridos. */
export function WeekCalendar({ days, summary, todayProgress }: WeekProps) {
  const progress = Math.max(0, Math.min(1, todayProgress));
  return (
    <div className="rounded-2xl bg-card p-3.5 text-ink shadow-raised sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-strong">
          <CalendarDays className="h-4 w-4 text-accent-text" aria-hidden="true" />
          Sua semana
        </span>
        <span className="text-xs font-medium text-ink-2">
          <span className="font-score text-base text-ink-strong">
            {summary.completed}/{summary.elapsed}
          </span>{" "}
          dias cumpridos
        </span>
      </div>

      <ol aria-label="Dias da semana" className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5">
        {days.map((day, idx) => {
          const status = summary.statuses[idx];
          const todayDone = day.isToday && status === "studied";
          return (
            <li
              key={day.iso}
              aria-current={day.isToday ? "date" : undefined}
              className={`relative flex flex-col items-center gap-0.5 overflow-hidden rounded-xl border px-0.5 pt-1.5 pb-1 transition-colors ${
                CELL_STYLES[status]
              } ${todayDone ? "ring-2 ring-accent-bright ring-offset-1 ring-offset-card" : ""}`}
            >
              <span className="sr-only">{srLabel(day, status, progress)}</span>
              <span
                aria-hidden="true"
                className={`text-[11px] font-semibold ${status === "today" ? "" : "opacity-80"}`}
              >
                {day.label}
              </span>
              <span aria-hidden="true" className="font-score text-lg leading-none">
                {day.iso.slice(8, 10)}
              </span>
              <span aria-hidden="true" className="flex h-4 items-center">
                {status === "studied" && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                {status === "rest" && <Coffee className="h-3.5 w-3.5" />}
                {status === "missed" && <Minus className="h-3.5 w-3.5 opacity-60" />}
              </span>
              {status === "today" && (
                <span aria-hidden="true" className="absolute inset-x-1.5 bottom-1 h-1 rounded-full bg-white/30">
                  <span
                    className="block h-full rounded-full bg-white transition-[width] duration-700 ease-out"
                    style={{ width: `${progress * 100}%` }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const STRIP_STYLES: Record<DayStatus, string> = {
  studied: "bg-success",
  rest: "bg-slate-500",
  today: "bg-accent-bright/25 ring-1 ring-accent-bright",
  missed: "bg-white/10",
  upcoming: "border border-dashed border-white/15",
};

/** Faixa compacta da semana para a sidebar escura. */
export function WeekStrip({ days, summary, todayProgress }: WeekProps) {
  const progress = Math.max(0, Math.min(1, todayProgress));
  return (
    <div>
      <ol aria-label="Sua semana" className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const status = summary.statuses[idx];
          return (
            <li key={day.iso} className="flex flex-col items-center gap-1">
              <span className="sr-only">{srLabel(day, status, progress)}</span>
              <span
                aria-hidden="true"
                className={`relative h-7 w-full overflow-hidden rounded-md ${STRIP_STYLES[status]}`}
              >
                {status === "today" && progress > 0 && (
                  <span
                    className="absolute inset-x-0 bottom-0 bg-accent-bright transition-[height] duration-700"
                    style={{ height: `${progress * 100}%` }}
                  />
                )}
              </span>
              <span
                aria-hidden="true"
                className={`text-[10px] font-semibold ${
                  day.isToday ? "text-accent-soft" : "text-slate-400"
                }`}
              >
                {day.label.charAt(0)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
