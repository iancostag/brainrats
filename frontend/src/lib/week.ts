export interface WeekDay {
  iso: string;
  label: string;
  isToday: boolean;
}

export type DayStatus = "studied" | "rest" | "today" | "missed" | "upcoming";

export const DAY_STATUS_TEXT: Record<DayStatus, string> = {
  studied: "estudado",
  rest: "dia de descanso",
  today: "em andamento",
  missed: "sem registro",
  upcoming: "ainda não chegou",
};

const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Semana ISO (Seg–Dom) que contém "hoje" no fuso do desafio. */
export function getChallengeWeekDays(timezone: string): WeekDay[] {
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

export interface WeekSummary {
  statuses: DayStatus[];
  /** Dias com estudo válido (hoje conta quando a meta do dia fecha). */
  completed: number;
  /** Dias da semana já iniciados, incluindo hoje. */
  elapsed: number;
  todayStatus: DayStatus;
  /** Há check-in válido hoje (a ofensiva do dia está garantida), mesmo sem fechar o teto. */
  checkedInToday: boolean;
}

export function summarizeWeek(
  days: WeekDay[],
  studiedDates: Set<string>,
  restDates: Set<string>,
  todayProgress: number,
): WeekSummary {
  const todayIso = days.find((d) => d.isToday)?.iso ?? "";
  const progress = Math.max(0, Math.min(1, todayProgress));
  const statuses = days.map((day): DayStatus => {
    if (restDates.has(day.iso)) return "rest";
    if (day.isToday) return progress >= 1 ? "studied" : "today";
    if (studiedDates.has(day.iso)) return "studied";
    return day.iso < todayIso ? "missed" : "upcoming";
  });
  const todayIdx = days.findIndex((d) => d.isToday);
  return {
    statuses,
    completed: statuses.filter((s) => s === "studied").length,
    elapsed: days.filter((d) => d.iso <= todayIso).length,
    todayStatus: todayIdx >= 0 ? statuses[todayIdx] : "upcoming",
    checkedInToday: todayIso !== "" && studiedDates.has(todayIso),
  };
}

export function formatDayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
