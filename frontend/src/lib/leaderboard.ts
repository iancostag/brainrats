import type { LeaderboardEntry, ScoringMode } from "@/lib/api";

export type LeaderboardSort = "points" | "streak" | "active_days";

export const LEADERBOARD_SORTS: Array<{ id: LeaderboardSort; label: string }> = [
  { id: "points", label: "Pontos" },
  { id: "streak", label: "Ofensiva" },
  { id: "active_days", label: "Dias" },
];

/**
 * Ordena o placar. "points" mantém a ordem oficial do backend
 * (pontos, ofensiva, dias ativos); os outros critérios desempatam pelos demais.
 */
export function sortLeaderboard(
  entries: LeaderboardEntry[],
  sort: LeaderboardSort,
): LeaderboardEntry[] {
  const list = [...entries];
  if (sort === "streak") {
    list.sort(
      (a, b) =>
        b.current_streak - a.current_streak ||
        b.total_points - a.total_points ||
        b.active_days - a.active_days,
    );
  } else if (sort === "active_days") {
    list.sort(
      (a, b) =>
        b.active_days - a.active_days ||
        b.total_points - a.total_points ||
        b.current_streak - a.current_streak,
    );
  }
  return list;
}

/** Valor principal exibido para o critério de ordenação ativo. */
export function primaryMetric(
  entry: LeaderboardEntry,
  sort: LeaderboardSort,
  scoringMode: ScoringMode,
): { value: number; unit: string } {
  if (sort === "streak") {
    return { value: entry.current_streak, unit: entry.current_streak === 1 ? "dia" : "dias" };
  }
  if (sort === "active_days") {
    return { value: entry.active_days, unit: entry.active_days === 1 ? "dia" : "dias" };
  }
  return { value: entry.total_points, unit: scoringMode === "checkin" ? "chk" : "pts" };
}

export function pluralDays(n: number): string {
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}
