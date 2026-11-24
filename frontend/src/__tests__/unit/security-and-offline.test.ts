import { beforeEach, describe, expect, it, vi } from "vitest";

import { enqueueOfflineCheckin, flushOfflineQueue, getOfflineQueue } from "@/lib/offline-queue";
import { applyOptimisticReaction } from "@/lib/queries";
import { safeExternalUrl, safeImageUrl } from "@/lib/url";
import { checkinFixture } from "@/test/factories";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createCheckin: vi.fn().mockResolvedValue({ id: "synced-1" }),
  };
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("safeExternalUrl and safeImageUrl", () => {
  it("allows http/https and rejects javascript/data schemes", () => {
    expect(safeExternalUrl("https://github.com/octocat/hello")).toBe(
      "https://github.com/octocat/hello",
    );
    expect(safeExternalUrl("http://localhost:3000/test")).toBe("http://localhost:3000/test");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("JAVASCRIPT:fetch('https://evil.test')")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
  });

  it("resolves valid local upload image paths and blocks traversal", () => {
    const valid = `/api/v1/uploads/${"a".repeat(32)}.png`;
    expect(safeImageUrl(valid)).toContain(valid);
    expect(safeImageUrl("/api/v1/uploads/../../etc/passwd")).toBeNull();
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("offline checkin queue and optimistic reactions", () => {
  it("enqueues offline check-ins and flushes them when back online", async () => {
    enqueueOfflineCheckin("ch-1", {
      category_slug: "books",
      title: "Leitura no metrô",
      metadata_json: { pages_read: 15 },
    });
    expect(getOfflineQueue()).toHaveLength(1);

    const res = await flushOfflineQueue();
    expect(res).toEqual({ synced: 1, remaining: 0 });
    expect(getOfflineQueue()).toHaveLength(0);
  });

  it("toggles reactions optimistically without mutating original object", () => {
    const base = checkinFixture({ reactions: { fire: 1 }, user_reactions: [] });
    const added = applyOptimisticReaction(base, "fire");
    expect(added.reactions.fire).toBe(2);
    expect(added.user_reactions).toContain("fire");

    const removed = applyOptimisticReaction(added, "fire");
    expect(removed.reactions.fire).toBe(1);
    expect(removed.user_reactions).not.toContain("fire");
  });
});
