import { afterEach, describe, expect, it, vi } from "vitest";

import type { LeaderboardEntry } from "@/lib/api";
import {
  formatDateTimeBr,
  formatMetadataChips,
  formatPointsLabel,
  formatStudyDate,
  formatTimezoneLabel,
} from "@/lib/categories";
import { primaryMetric, sortLeaderboard } from "@/lib/leaderboard";
import { getChallengeWeekDays, summarizeWeek, type WeekDay } from "@/lib/week";

const player = (overrides: Partial<LeaderboardEntry>): LeaderboardEntry => ({
  user_id: crypto.randomUUID(),
  username: "user",
  display_name: "User",
  avatar_url: null,
  role: "member",
  total_points: 0,
  active_days: 0,
  checkins_count: 0,
  current_streak: 0,
  rest_days_used_this_week: 0,
  ...overrides,
});

afterEach(() => vi.useRealTimers());

describe("week calculations", () => {
  it("builds the ISO week using the challenge timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T02:30:00Z"));

    const saoPaulo = getChallengeWeekDays("America/Sao_Paulo");
    const tokyo = getChallengeWeekDays("Asia/Tokyo");

    expect(saoPaulo.map((day) => day.iso)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(saoPaulo.find((day) => day.isToday)?.iso).toBe("2026-11-17");
    expect(tokyo.find((day) => day.isToday)?.iso).toBe("2026-11-18");
  });

  it("separates a check-in today from a completed daily points target", () => {
    const days: WeekDay[] = [
      { iso: "2026-11-16", label: "Seg", isToday: false },
      { iso: "2026-11-17", label: "Ter", isToday: false },
      { iso: "2026-11-18", label: "Qua", isToday: true },
      { iso: "2026-11-19", label: "Qui", isToday: false },
    ];

    const partial = summarizeWeek(
      days,
      new Set(["2026-11-16", "2026-11-18"]),
      new Set(["2026-11-17"]),
      0.4,
    );
    const complete = summarizeWeek(
      days,
      new Set(["2026-11-16", "2026-11-18"]),
      new Set(["2026-11-17"]),
      1,
    );

    expect(partial.statuses).toEqual(["studied", "rest", "today", "upcoming"]);
    expect(partial).toMatchObject({ completed: 1, elapsed: 3, checkedInToday: true });
    expect(complete.statuses[2]).toBe("studied");
    expect(complete.completed).toBe(2);
  });
});

describe("leaderboard calculations", () => {
  const ada = player({
    user_id: "ada",
    display_name: "Ada",
    total_points: 80,
    current_streak: 2,
    active_days: 8,
  });
  const grace = player({
    user_id: "grace",
    display_name: "Grace",
    total_points: 60,
    current_streak: 7,
    active_days: 9,
  });
  const linus = player({
    user_id: "linus",
    display_name: "Linus",
    total_points: 60,
    current_streak: 3,
    active_days: 12,
  });

  it("preserves the backend order for the official points ranking", () => {
    expect(sortLeaderboard([ada, grace, linus], "points")).toEqual([ada, grace, linus]);
  });

  it("sorts by streak and active days with deterministic tie-breakers", () => {
    expect(sortLeaderboard([ada, grace, linus], "streak").map((item) => item.user_id)).toEqual([
      "grace",
      "linus",
      "ada",
    ]);
    expect(
      sortLeaderboard([ada, grace, linus], "active_days").map((item) => item.user_id),
    ).toEqual(["linus", "grace", "ada"]);
  });

  it("returns the metric and unit for every ranking mode", () => {
    expect(primaryMetric(ada, "points", "points")).toEqual({ value: 80, unit: "pts" });
    expect(primaryMetric(ada, "points", "checkin")).toEqual({ value: 80, unit: "chk" });
    expect(primaryMetric(ada, "streak", "points")).toEqual({ value: 2, unit: "dias" });
    expect(primaryMetric(player({ active_days: 1 }), "active_days", "points")).toEqual({
      value: 1,
      unit: "dia",
    });
  });
});

describe("formatters", () => {
  it("formats metadata according to the category", () => {
    expect(
      formatMetadataChips("leetcode", { difficulty: "Medium", language: "Python" }),
    ).toEqual(["Médio", "Python"]);
    expect(formatMetadataChips("books", { book_title: "DDIA", pages_read: 12 })).toEqual([
      "DDIA",
      "12 págs",
    ]);
    expect(
      formatMetadataChips("project", { repository: "team/app", commits_count: 2, duration_minutes: 45 }),
    ).toEqual(["team/app", "2 commit(s)", "45 min"]);
    expect(formatMetadataChips("data", { topic: "SQL", duration_minutes: 30 })).toEqual([
      "SQL",
      "30 min",
    ]);
  });

  it("formats points, relative study dates and known timezones", () => {
    expect(formatPointsLabel(1, "checkin", "valid")).toBe("+1 check-in");
    expect(formatPointsLabel(0, "checkin", "valid")).toBe("0 check-in (já pontuou hoje)");
    expect(formatPointsLabel(15, "points", "valid")).toBe("+15 pts");
    expect(formatPointsLabel(15, "points", "invalidated")).toBe("Invalidado");
    expect(formatStudyDate("2026-11-18", "2026-11-18")).toBe("hoje");
    expect(formatStudyDate("2026-11-17", "2026-11-18")).toBe("ontem");
    expect(formatStudyDate("2026-11-16", "2026-11-18")).toBe("seg, 16/11");
    expect(formatTimezoneLabel("America/Sao_Paulo")).toBe("Brasília (GMT-3)");
    expect(formatTimezoneLabel("Custom/Zone")).toBe("Custom/Zone");
    expect(formatDateTimeBr(null)).toBe("Nunca sincronizado");
  });
});
