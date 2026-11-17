export type ScoringMode = "checkin" | "points";
export type Visibility = "private" | "public";
export type CategorySlug = "leetcode" | "project" | "books" | "esw" | "data";
export type ReactionType = "fire" | "rocket" | "brain" | "clap";

export interface Integration {
  provider: "github" | "leetcode";
  external_username: string;
  target_challenge_id: string | null;
  last_synced_at: string | null;
  has_oauth_token?: boolean;
}

export interface User {
  id: string;
  username: string;
  display_name: string;
  email?: string | null;
  avatar_url: string | null;
  bio: string | null;
  has_github_oauth?: boolean;
  integrations: Integration[];
}

export interface AuthProviders {
  github_oauth_enabled: boolean;
  password_auth_enabled: boolean;
  dev_login_enabled: boolean;
}

export interface GitHubRepoItem {
  github_repo_id: number;
  full_name: string;
  default_branch: string;
  private: boolean;
  is_monitored: boolean;
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

export interface DiaryChallengeEntry {
  checkin_id: string;
  challenge_id: string;
  challenge_title: string;
  points_awarded: number;
  status: "valid" | "invalidated";
}

/** Estudo único no diário, com a pontuação em cada desafio onde foi publicado. */
export interface DiaryItem extends CheckIn {
  challenges: DiaryChallengeEntry[];
}

export interface DiaryResponse {
  items: DiaryItem[];
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

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
      0,
    );
  }

  if (!response.ok) {
    let message = `Erro inesperado (${response.status}). Tente novamente.`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) message = payload.detail;
    } catch {
      // Ignore JSON parsing failure on non-JSON error responses.
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export function fetchAuthProviders(): Promise<AuthProviders> {
  return apiRequest<AuthProviders>("/auth/providers");
}

export function getGithubOAuthUrl(): string {
  return `${API_BASE_URL}/auth/github/login`;
}

export function registerWithPassword(payload: {
  username: string;
  password: string;
  display_name?: string;
  email?: string;
  github_username?: string;
  leetcode_username?: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginWithPassword(payload: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/password-login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
  start_date?: string;
  end_date?: string | null;
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

export function fetchChallengeFeed(
  challengeId: string,
  params?: { before?: string; limit?: number },
): Promise<CheckIn[]> {
  const search = new URLSearchParams();
  if (params?.before) search.set("before", params.before);
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return apiRequest<CheckIn[]>(`/challenges/${challengeId}/feed${qs ? `?${qs}` : ""}`);
}

/** Check-in recém-criado, com os outros desafios que receberam a cópia. */
export interface CheckInCreated extends CheckIn {
  also_published_in: string[];
  skipped_challenges: string[];
}

export function createCheckin(
  challengeId: string,
  payload: {
    category_slug: CategorySlug;
    title: string;
    description?: string;
    evidence_url?: string;
    metadata_json: Record<string, unknown>;
    publish_to_all_challenges?: boolean;
  },
): Promise<CheckInCreated> {
  return apiRequest<CheckInCreated>(`/challenges/${challengeId}/checkins`, {
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
  challenge_id?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
}): Promise<DiaryResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category_slug) search.set("category_slug", params.category_slug);
  if (params.challenge_id) search.set("challenge_id", params.challenge_id);
  if (params.source) search.set("source", params.source);
  if (params.date_from) search.set("date_from", params.date_from);
  if (params.date_to) search.set("date_to", params.date_to);
  const qs = search.toString();
  return apiRequest<DiaryResponse>(`/diary${qs ? `?${qs}` : ""}`);
}

export function fetchGithubRepos(): Promise<GitHubRepoItem[]> {
  return apiRequest<GitHubRepoItem[]>("/integrations/github/repos");
}

export function saveMonitoredRepos(payload: {
  target_challenge_id?: string | null;
  repos: Array<{
    github_repo_id: number;
    full_name: string;
    default_branch: string;
  }>;
}): Promise<GitHubRepoItem[]> {
  return apiRequest<GitHubRepoItem[]>("/integrations/github/repos", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
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
