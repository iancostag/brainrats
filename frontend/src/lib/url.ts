import { getApiBaseUrl } from "@/lib/api";

const LOCAL_UPLOAD_RE = /^\/api\/v1\/uploads\/[a-f0-9]{32}\.(?:png|jpg|webp)$/;
const BADGE_AVATAR_RE = /^\/badges\/[a-z0-9_]+\.(?:png|jpg|webp)$/;

/**
 * Garante que links externos só aceitem http:// ou https://,
 * bloqueando javascript:, data:, vbscript: e URLs malformadas (anti-XSS).
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/** Resolve URLs de imagem seguras (http/https ou uploads servidos pela própria API). */
export function safeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (BADGE_AVATAR_RE.test(trimmed)) {
    return trimmed;
  }
  if (LOCAL_UPLOAD_RE.test(trimmed)) {
    const apiBase = getApiBaseUrl();
    const origin = apiBase.replace(/\/api\/v1\/?$/, "");
    return `${origin}${trimmed}`;
  }
  return safeExternalUrl(trimmed);
}
