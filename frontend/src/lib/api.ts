export type ScoringMode = "checkin" | "points";
export type Visibility = "private" | "public";
export type CategorySlug = "leetcode" | "project" | "books" | "esw" | "data";
export type ReactionType = "fire" | "rocket" | "brain" | "clap";

export interface Integration {
  provider: "github" | "leetcode";
  external_username: string;
  target_challenge_id: string | null;
  last_synced_at: string | null;
}

export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  integrations: Integration[];
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}

export interface ChallengeListItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  invite_code: string;
  scoring_mode: ScoringMode;
  timezone: string;
  start_date: string;
  end_date: string | null;
  rest_days_per_week: number;
  daily_points_cap: number;
  is_member: boolean;
  member_role: "admin" | "member" | null;
  members_count: number;
  created_at: string;
}

export interface CategoryConfig {
  category_id: string;
  slug: CategorySlug;
  name: string;
  is_enabled: boolean;
  base_points: number;
  daily_cap: number;
  weights_json: Record<string, unknown>;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: "admin" | "member";
  total_points: number;
  active_days: number;
  checkins_count: number;
  current_streak: number;
  rest_days_used_this_week: number;
}

export interface ChallengeDetail {
  challenge: ChallengeListItem;
  category_configs: CategoryConfig[];
  leaderboard: LeaderboardEntry[];
  user_rest_dates: string[];
  rest_days_remaining_this_week: number;
}

export interface CommentOut {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  content: string;
  created_at: string;
}

export interface ReportOut {
  id: string;
  reporter_username: string;
  reason: string;
  status: string;
  created_at: string;
}

export interface CheckIn {
  id: string;
  challenge_id: string;
  challenge_title: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  category_slug: CategorySlug;
  category_name: string;
  title: string;
  description: string | null;
  study_date: string;
  source: "manual" | "github" | "leetcode";
  metadata_json: Record<string, unknown>;
  evidence_url: string | null;
  points_awarded: number;
  status: "valid" | "invalidated";
  invalidation_reason: string | null;
  reactions: Record<string, number>;
  user_reactions: string[];
  comments: CommentOut[];
  reports_count: number;
  reports: ReportOut[];
  created_at: string;
}

export interface DiaryResponse {
  items: CheckIn[];
  total_entries: number;
  total_points: number;
  by_category: Record<string, number>;
}

export interface SyncResponse {
  created_count: number;
  skipped_duplicates: number;
  details: string[];
  created_checkins: CheckIn[];
}

export interface RestDayResponse {
  rest_date: string;
  rest_days_used_this_week: number;
  rest_days_remaining_this_week: number;
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const TOKEN_STORAGE_KEY = "brainrats_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Erro ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) message = payload.detail;
    } catch {
      // Ignore JSON parsing failure on non-JSON error responses.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function loginUser(payload: {
  username: string;
  display_name?: string;
  github_username?: string;
  leetcode_username?: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchMe(): Promise<User> {
  return apiRequest<User>("/auth/me");
}

export function updateProfile(payload: {
  display_name?: string;
  bio?: string;
  github_username?: string;
  leetcode_username?: string;
  target_challenge_id?: string | null;
}): Promise<User> {
  return apiRequest<User>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchChallenges(): Promise<ChallengeListItem[]> {
  return apiRequest<ChallengeListItem[]>("/challenges");
}

export function createChallenge(payload: {
  title: string;
  description?: string;
  visibility: Visibility;
  scoring_mode: ScoringMode;
  timezone: string;
  rest_days_per_week: number;
  daily_points_cap: number;
  category_configs: Array<{
    category_slug: CategorySlug;
    is_enabled: boolean;
    base_points: number;
    daily_cap: number;
  }>;
}): Promise<ChallengeListItem> {
  return apiRequest<ChallengeListItem>("/challenges", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function joinChallenge(payload: {
  invite_code?: string;
  challenge_id?: string;
}): Promise<ChallengeListItem> {
  return apiRequest<ChallengeListItem>("/challenges/join", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchChallengeDetail(challengeId: string): Promise<ChallengeDetail> {
  return apiRequest<ChallengeDetail>(`/challenges/${challengeId}`);
}

export function registerRestDay(challengeId: string): Promise<RestDayResponse> {
  return apiRequest<RestDayResponse>(`/challenges/${challengeId}/rest-days`, {
    method: "POST",
  });
}

export function fetchChallengeFeed(challengeId: string): Promise<CheckIn[]> {
  return apiRequest<CheckIn[]>(`/challenges/${challengeId}/feed`);
}

export function createCheckin(
  challengeId: string,
  payload: {
    category_slug: CategorySlug;
    title: string;
    description?: string;
    evidence_url?: string;
    metadata_json: Record<string, unknown>;
  },
): Promise<CheckIn> {
  return apiRequest<CheckIn>(`/challenges/${challengeId}/checkins`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCheckin(
  checkinId: string,
  payload: { title?: string; description?: string },
): Promise<CheckIn> {
  return apiRequest<CheckIn>(`/checkins/${checkinId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function toggleReaction(
  checkinId: string,
  reaction_type: ReactionType,
): Promise<CheckIn> {
  return apiRequest<CheckIn>(`/checkins/${checkinId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ reaction_type }),
  });
}

export function addComment(checkinId: string, content: string): Promise<CheckIn> {
  return apiRequest<CheckIn>(`/checkins/${checkinId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function reportCheckin(checkinId: string, reason: string): Promise<CheckIn> {
  return apiRequest<CheckIn>(`/checkins/${checkinId}/reports`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function moderateCheckin(
  checkinId: string,
  action: "invalidate" | "restore",
  reason?: string,
): Promise<CheckIn> {
  return apiRequest<CheckIn>(`/checkins/${checkinId}/moderate`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
}

export function fetchDiary(params: {
  q?: string;
  category_slug?: string;
  source?: string;
}): Promise<DiaryResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category_slug) search.set("category_slug", params.category_slug);
  if (params.source) search.set("source", params.source);
  const qs = search.toString();
  return apiRequest<DiaryResponse>(`/diary${qs ? `?${qs}` : ""}`);
}

export function syncIntegrations(payload: {
  simulate: boolean;
  challenge_id?: string;
}): Promise<SyncResponse> {
  return apiRequest<SyncResponse>("/integrations/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
