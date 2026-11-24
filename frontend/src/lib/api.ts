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

export interface UserBadge {
  badge_key: string;
  title: string;
  description: string;
  icon: string;
  unlocked_at: string;
  metadata_json: Record<string, unknown>;
}

export interface User {
  id: string;
  username: string;
  display_name: string;
  email?: string | null;
  avatar_url: string | null;
  bio: string | null;
  last_challenge_id?: string | null;
  has_github_oauth?: boolean;
  has_password?: boolean;
  is_public_profile?: boolean;
  notify_streak_reminder?: boolean;
  notify_social?: boolean;
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
  collective_weekly_goal?: number | null;
  has_discord_webhook?: boolean;
  is_member: boolean;
  member_role: "admin" | "member" | null;
  members_count: number;
  created_at: string;
}

export interface ChallengePreview {
  id: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  scoring_mode: ScoringMode;
  timezone: string;
  start_date: string;
  end_date: string | null;
  rest_days_per_week: number;
  daily_points_cap: number;
  members_count: number;
  is_member: boolean;
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
  checked_in_today?: boolean;
}

export interface StudyPresence {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  category_slug: CategorySlug;
  started_at: string;
  expires_at: string;
}

export interface Nudge {
  id: string;
  sender_username: string;
  sender_display_name: string;
  nudge_date: string;
  created_at: string;
}

export interface ChallengeDetail {
  challenge: ChallengeListItem;
  category_configs: CategoryConfig[];
  leaderboard: LeaderboardEntry[];
  user_rest_dates: string[];
  rest_days_remaining_this_week: number;
  user_active_dates_this_week?: string[];
  user_points_today?: number;
  collective_week_checkins?: number;
  active_studiers?: StudyPresence[];
  pending_reports_count?: number;
  received_nudges_today?: Nudge[];
}

export interface ChallengeSummary {
  challenge_id: string;
  challenge_title: string;
  scoring_mode: ScoringMode;
  start_date: string;
  end_date: string | null;
  total_checkins: number;
  total_points: number;
  participants_count: number;
  top_category_slug: CategorySlug | null;
  by_category: Record<string, number>;
  podium: LeaderboardEntry[];
  my_entry: LeaderboardEntry | null;
  my_position: number | null;
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
  image_url?: string | null;
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

export interface DiaryItem extends CheckIn {
  challenges: DiaryChallengeEntry[];
}

export interface DiaryResponse {
  items: DiaryItem[];
  total_entries: number;
  total_points: number;
  by_category: Record<string, number>;
  has_more?: boolean;
  next_cursor?: string | null;
}

export interface DiaryHeatmapDay {
  study_date: string;
  count: number;
  top_category: CategorySlug | null;
}

export interface DiaryHeatmapResponse {
  days: DiaryHeatmapDay[];
  total_active_days: number;
  current_global_streak: number;
  longest_global_streak: number;
}

export interface BookShelfItem {
  book_title: string;
  total_pages: number;
  sessions_count: number;
  last_read_date: string;
}

export interface ReviewSuggestion {
  checkin_id: string;
  title: string;
  category_slug: CategorySlug;
  category_name: string;
  study_date: string;
  days_ago: number;
  interval_label: string;
  evidence_url: string | null;
}

export interface WeeklyRecapResponse {
  start_date: string;
  end_date: string;
  total_studies: number;
  by_category: Record<string, number>;
  markdown: string;
}

export interface PublicProfile {
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  total_studies: number;
  total_active_days: number;
  current_streak: number;
  longest_streak: number;
  by_category: Record<string, number>;
  badges: UserBadge[];
  heatmap: DiaryHeatmapDay[];
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

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined" && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
  }
  return API_BASE_URL;
}

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
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
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
  return `${getApiBaseUrl()}/auth/github/login`;
}

export function requestGithubOAuthLinkUrl(
  redirectTab: "integrations" | "settings" = "integrations",
  includePrivateRepos = false,
): Promise<{ url: string }> {
  return apiRequest<{ url: string }>("/auth/github/link", {
    method: "POST",
    body: JSON.stringify({
      redirect_tab: redirectTab,
      include_private_repos: includePrivateRepos,
    }),
  });
}

export function exchangeOAuthCode(code: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/oauth/exchange", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function disconnectIntegration(provider: "github" | "leetcode"): Promise<User> {
  return apiRequest<User>(`/auth/me/integrations/${provider}`, {
    method: "DELETE",
  });
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

export function fetchMyBadges(): Promise<UserBadge[]> {
  return apiRequest<UserBadge[]>("/auth/me/badges");
}

export function updateProfile(payload: {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  github_username?: string;
  leetcode_username?: string;
  target_challenge_id?: string | null;
  last_challenge_id?: string | null;
  is_public_profile?: boolean;
  notify_streak_reminder?: boolean;
  notify_social?: boolean;
}): Promise<User> {
  return apiRequest<User>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload: {
  current_password?: string;
  new_password: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logoutAllSessions(): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>("/auth/logout-all", { method: "POST" });
}

export function deleteAccount(): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>("/auth/me", { method: "DELETE" });
}

export function fetchChallenges(): Promise<ChallengeListItem[]> {
  return apiRequest<ChallengeListItem[]>("/challenges");
}

export function previewChallengeInvite(inviteCode: string): Promise<ChallengePreview> {
  return apiRequest<ChallengePreview>(
    `/challenges/preview/${encodeURIComponent(inviteCode.trim().toUpperCase())}`,
  );
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
  collective_weekly_goal?: number | null;
  discord_webhook_url?: string | null;
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

export function updateChallenge(
  challengeId: string,
  payload: {
    title?: string;
    description?: string;
    visibility?: Visibility;
    end_date?: string | null;
    clear_end_date?: boolean;
    rest_days_per_week?: number;
    daily_points_cap?: number;
    collective_weekly_goal?: number | null;
    clear_collective_weekly_goal?: boolean;
    discord_webhook_url?: string | null;
    category_configs?: Array<{
      category_slug: CategorySlug;
      is_enabled: boolean;
      base_points: number;
      daily_cap: number;
    }>;
  },
): Promise<ChallengeListItem> {
  return apiRequest<ChallengeListItem>(`/challenges/${challengeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function regenerateInviteCode(challengeId: string): Promise<ChallengeListItem> {
  return apiRequest<ChallengeListItem>(`/challenges/${challengeId}/invite-code/regenerate`, {
    method: "POST",
  });
}

export function leaveChallenge(challengeId: string): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>(`/challenges/${challengeId}/leave`, {
    method: "DELETE",
  });
}

export function updateMemberRole(
  challengeId: string,
  userId: string,
  role: "admin" | "member",
): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>(`/challenges/${challengeId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function removeMember(challengeId: string, userId: string): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>(`/challenges/${challengeId}/members/${userId}`, {
    method: "DELETE",
  });
}

export function setStudyPresence(
  challengeId: string,
  category_slug: CategorySlug,
  duration_minutes: number,
): Promise<StudyPresence> {
  return apiRequest<StudyPresence>(`/challenges/${challengeId}/presence`, {
    method: "POST",
    body: JSON.stringify({ category_slug, duration_minutes }),
  });
}

export function clearStudyPresence(challengeId: string): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>(`/challenges/${challengeId}/presence`, {
    method: "DELETE",
  });
}

export function nudgeMember(challengeId: string, targetUserId: string): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>(`/challenges/${challengeId}/nudge/${targetUserId}`, {
    method: "POST",
  });
}

export function fetchChallengeSummary(challengeId: string): Promise<ChallengeSummary> {
  return apiRequest<ChallengeSummary>(`/challenges/${challengeId}/summary`);
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

export function fetchChallengeReports(
  challengeId: string,
  statusFilter: "pending" | "all" = "pending",
): Promise<CheckIn[]> {
  return apiRequest<CheckIn[]>(
    `/challenges/${challengeId}/reports?status_filter=${statusFilter}`,
  );
}

export interface CheckInCreated extends CheckIn {
  also_published_in: string[];
  skipped_challenges: string[];
  newly_unlocked_badges?: string[];
}

export function createCheckin(
  challengeId: string,
  payload: {
    category_slug: CategorySlug;
    title: string;
    description?: string;
    evidence_url?: string;
    image_url?: string;
    metadata_json: Record<string, unknown>;
    publish_to_all_challenges?: boolean;
  },
): Promise<CheckInCreated> {
  return apiRequest<CheckInCreated>(`/challenges/${challengeId}/checkins`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function uploadEvidenceImage(file: File): Promise<{ image_url: string }> {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<{ image_url: string }>("/uploads/evidence", {
    method: "POST",
    body: form,
  });
}

export function updateCheckin(
  checkinId: string,
  payload: { title?: string; description?: string; evidence_url?: string; image_url?: string },
): Promise<CheckIn> {
  return apiRequest<CheckIn>(`/checkins/${checkinId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteCheckin(
  checkinId: string,
  deleteCopies = false,
): Promise<{ deleted_count: number }> {
  return apiRequest<{ deleted_count: number }>(
    `/checkins/${checkinId}?delete_copies=${deleteCopies ? "true" : "false"}`,
    { method: "DELETE" },
  );
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

export function deleteComment(commentId: string): Promise<CheckIn> {
  return apiRequest<CheckIn>(`/comments/${commentId}`, { method: "DELETE" });
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
  before?: string;
  limit?: number;
}): Promise<DiaryResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category_slug) search.set("category_slug", params.category_slug);
  if (params.challenge_id) search.set("challenge_id", params.challenge_id);
  if (params.source) search.set("source", params.source);
  if (params.date_from) search.set("date_from", params.date_from);
  if (params.date_to) search.set("date_to", params.date_to);
  if (params.before) search.set("before", params.before);
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return apiRequest<DiaryResponse>(`/diary${qs ? `?${qs}` : ""}`);
}

export function fetchDiaryHeatmap(daysBack = 365): Promise<DiaryHeatmapResponse> {
  return apiRequest<DiaryHeatmapResponse>(`/diary/heatmap?days_back=${daysBack}`);
}

export function fetchDiaryBooks(): Promise<BookShelfItem[]> {
  return apiRequest<BookShelfItem[]>("/diary/books");
}

export function fetchDiaryReviews(): Promise<ReviewSuggestion[]> {
  return apiRequest<ReviewSuggestion[]>("/diary/reviews");
}

export function logDiaryReview(
  checkinId: string,
  action: "reviewed" | "dismissed" = "reviewed",
): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>(`/diary/reviews/${checkinId}`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export function fetchWeeklyRecap(): Promise<WeeklyRecapResponse> {
  return apiRequest<WeeklyRecapResponse>("/diary/weekly-recap");
}

export async function downloadDiaryExport(format: "markdown" | "json" | "csv"): Promise<void> {
  const token = getStoredToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const resp = await fetch(`${getApiBaseUrl()}/diary/export?format=${format}`, {
    headers,
    cache: "no-store",
  });
  if (!resp.ok) {
    throw new ApiError("Não foi possível exportar o diário.", resp.status);
  }
  const blob = await resp.blob();
  const ext = format === "markdown" ? "md" : format;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `brainrats-diario.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
    private?: boolean;
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

export function fetchVapidPublicKey(): Promise<{ enabled: boolean; public_key: string }> {
  return apiRequest<{ enabled: boolean; public_key: string }>("/push/vapid-public-key");
}

export function subscribePush(payload: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>("/push/subscribe", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function unsubscribePush(endpoint: string): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>("/push/subscribe", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}

export function fetchPublicProfile(username: string): Promise<PublicProfile> {
  return apiRequest<PublicProfile>(`/public/users/${encodeURIComponent(username)}`);
}

export function getPublicBadgeSvgUrl(username: string): string {
  return `${getApiBaseUrl()}/public/users/${encodeURIComponent(username)}/badge.svg`;
}
