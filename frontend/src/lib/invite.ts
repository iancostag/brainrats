const PENDING_INVITE_STORAGE_KEY = "brainrats_pending_invite";

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
