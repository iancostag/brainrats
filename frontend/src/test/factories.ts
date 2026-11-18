import type {
  CategoryConfig,
  CheckIn,
  CheckInCreated,
  LeaderboardEntry,
  User,
} from "@/lib/api";

export const userFixture = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  username: "ada",
  display_name: "Ada Lovelace",
  email: "ada@example.com",
  avatar_url: null,
  bio: null,
  integrations: [],
  ...overrides,
});

export const categoryConfigFixture = (
  slug: CategoryConfig["slug"],
  overrides: Partial<CategoryConfig> = {},
): CategoryConfig => ({
  category_id: `category-${slug}`,
  slug,
  name: slug,
  is_enabled: true,
  base_points: 15,
  daily_cap: 50,
  weights_json: {},
  ...overrides,
});

export const checkinFixture = (overrides: Partial<CheckIn> = {}): CheckIn => ({
  id: "checkin-1",
  challenge_id: "challenge-1",
  challenge_title: "Desafio Teste",
  user_id: "user-1",
  username: "ada",
  display_name: "Ada Lovelace",
  avatar_url: null,
  category_slug: "project",
  category_name: "Projeto",
  title: "Implementar testes",
  description: "Cobertura das regras importantes.",
  study_date: "2026-11-18",
  source: "manual",
  metadata_json: {},
  evidence_url: null,
  points_awarded: 15,
  status: "valid",
  invalidation_reason: null,
  reactions: { fire: 0, rocket: 0, brain: 0, clap: 0 },
  user_reactions: [],
  comments: [],
  reports_count: 0,
  reports: [],
  created_at: "2026-11-18T12:00:00Z",
  ...overrides,
});

export const createdCheckinFixture = (
  overrides: Partial<CheckInCreated> = {},
): CheckInCreated => ({
  ...checkinFixture(overrides),
  also_published_in: [],
  skipped_challenges: [],
  ...overrides,
});

export const leaderboardFixture = (
  overrides: Partial<LeaderboardEntry> = {},
): LeaderboardEntry => ({
  user_id: "user-1",
  username: "ada",
  display_name: "Ada Lovelace",
  avatar_url: null,
  role: "member",
  total_points: 15,
  active_days: 1,
  checkins_count: 1,
  current_streak: 1,
  rest_days_used_this_week: 0,
  ...overrides,
});
