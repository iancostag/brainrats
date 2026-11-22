const PENDING_INVITE_STORAGE_KEY = "brainrats_pending_invite";
const LAST_CHALLENGE_PREFIX = "brainrats_last_challenge:";

export function getStoredLastChallengeId(userId: string): string | null {
  if (typeof window === "undefined" || !userId) return null;
  const value = window.localStorage.getItem(`${LAST_CHALLENGE_PREFIX}${userId}`);
  return value && value.trim() ? value.trim() : null;
}

export function setStoredLastChallengeId(userId: string, challengeId: string): void {
  if (typeof window === "undefined" || !userId || !challengeId) return;
  window.localStorage.setItem(`${LAST_CHALLENGE_PREFIX}${userId}`, challengeId);
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function getPendingInvite(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(PENDING_INVITE_STORAGE_KEY);
  return value && value.trim() ? normalizeInviteCode(value) : null;
}

export function setPendingInvite(code: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeInviteCode(code);
  if (!normalized) return;
  window.localStorage.setItem(PENDING_INVITE_STORAGE_KEY, normalized);
}

export function clearPendingInvite(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
}

export function buildChallengeInviteUrl(inviteCode: string): string {
  const normalized = normalizeInviteCode(inviteCode);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?invite=${encodeURIComponent(normalized)}`;
}
