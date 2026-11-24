import { createCheckin, type CategorySlug } from "@/lib/api";

export interface QueuedCheckin {
  id: string;
  challengeId: string;
  payload: {
    category_slug: CategorySlug;
    title: string;
    description?: string;
    evidence_url?: string;
    image_url?: string;
    metadata_json: Record<string, unknown>;
    publish_to_all_challenges?: boolean;
  };
  queuedAt: string;
}

const STORAGE_KEY = "brainrats_offline_checkins_v1";
const EVENT_NAME = "brainrats:offline-queue-changed";

function emitChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

export function getOfflineQueue(): QueuedCheckin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedCheckin[]) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(items: QueuedCheckin[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    // Ignore storage quota errors.
  }
  emitChange();
}

export function enqueueOfflineCheckin(
  challengeId: string,
  payload: QueuedCheckin["payload"],
): QueuedCheckin {
  const item: QueuedCheckin = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    challengeId,
    payload,
    queuedAt: new Date().toISOString(),
  };
  saveOfflineQueue([...getOfflineQueue(), item]);
  return item;
}

export async function flushOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  const items = getOfflineQueue();
  if (items.length === 0) return { synced: 0, remaining: 0 };

  const failed: QueuedCheckin[] = [];
  let synced = 0;
  for (const item of items) {
    try {
      await createCheckin(item.challengeId, item.payload);
      synced += 1;
    } catch {
      failed.push(item);
    }
  }
  saveOfflineQueue(failed);
  return { synced, remaining: failed.length };
}

export function subscribeOfflineQueue(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    window.removeEventListener("storage", listener);
  };
}
