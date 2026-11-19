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
  studied: "border-transparent bg-accent text-white shadow-sm",
  rest: "border-transparent bg-white/10 text-slate-200",
  today: "border-accent-bright/80 bg-white/5 text-white ring-2 ring-accent-bright/30",
  missed: "border-transparent bg-white/[0.04] text-slate-500",
  upcoming: "border-dashed border-white/15 bg-transparent text-slate-400",
};

/** Calendário da semana no hero: Seg–Dom com data, estado do dia e contagem de dias cumpridos. */
export function WeekCalendar({ days, summary, todayProgress }: WeekProps) {
  const progress = Math.max(0, Math.min(1, todayProgress));
  return (
    <div className="rounded-2xl bg-shell-raised/85 p-3.5 text-white ring-1 ring-white/10 shadow-raised sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white">
          <CalendarDays className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          Sua semana
        </span>
        <span className="text-xs font-medium text-slate-300">
          <span className="font-score text-base text-white">
            {summary.completed}/{summary.elapsed}
          </span>{" "}
          dias cumpridos
        </span>
      </div>

      <ol aria-label="Dias da semana" className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5">
        {days.map((day, idx) => {
          const status = summary.statuses[idx];
          return (
            <li
              key={day.iso}
              aria-current={day.isToday ? "date" : undefined}
              className={`relative flex flex-col items-center gap-0.5 overflow-hidden rounded-xl border px-0.5 pt-1.5 pb-1 transition-colors ${
                CELL_STYLES[status]
              }`}
            >
              <span className="sr-only">{srLabel(day, status, progress)}</span>
              <span
                aria-hidden="true"
                className={`text-[11px] font-semibold ${
                  status === "today" ? "text-accent-soft" : "opacity-80"
                }`}
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
                <span aria-hidden="true" className="absolute inset-x-1.5 bottom-1 h-1 rounded-full bg-white/20">
                  <span
                    className="block h-full rounded-full bg-accent-bright transition-[width] duration-700 ease-out"
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
  studied: "bg-accent",
  rest: "bg-slate-500",
  today: "bg-accent-bright/20 ring-1 ring-accent-bright/70",
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
