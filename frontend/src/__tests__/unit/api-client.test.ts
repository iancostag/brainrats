import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  API_BASE_URL,
  ApiError,
  clearStoredToken,
  createCheckin,
  fetchChallengeFeed,
  fetchMe,
  getStoredToken,
  setStoredToken,
} from "@/lib/api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("token storage", () => {
  it("stores and clears the authentication token", () => {
    expect(getStoredToken()).toBeNull();
    setStoredToken("signed-token");
    expect(getStoredToken()).toBe("signed-token");
    clearStoredToken();
    expect(getStoredToken()).toBeNull();
  });
});

describe("API requests", () => {
  it("sends authentication, JSON payload and no-store cache to create a check-in", async () => {
    setStoredToken("signed-token");
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ id: "checkin-1", points_awarded: 15 }),
    );

    await createCheckin("challenge-1", {
      category_slug: "project",
      title: "Implementar autenticação",
      metadata_json: { duration_minutes: 45 },
      publish_to_all_challenges: true,
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/challenges/challenge-1/checkins`);
    expect(init).toMatchObject({ method: "POST", cache: "no-store" });
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer signed-token");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      category_slug: "project",
      title: "Implementar autenticação",
      metadata_json: { duration_minutes: 45 },
      publish_to_all_challenges: true,
    });
  });

  it("encodes feed pagination parameters", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([]));

    await fetchChallengeFeed("challenge id", {
      before: "2026-11-18T10:20:30+00:00",
      limit: 25,
    });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      `${API_BASE_URL}/challenges/challenge id/feed?before=2026-11-18T10%3A20%3A30%2B00%3A00&limit=25`,
    );
  });

  it("turns API errors into ApiError with backend detail", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: "Sessão expirada." }, 401));

    await expect(fetchMe()).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Sessão expirada.",
    });
  });

  it("uses a safe fallback for non-JSON errors", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("gateway down", { status: 502 }));

    await expect(fetchMe()).rejects.toEqual(
      expect.objectContaining({
        name: "ApiError",
        status: 502,
        message: "Erro inesperado (502). Tente novamente.",
      }),
    );
  });

  it("reports network failures distinctly from HTTP failures", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("offline"));

    await expect(fetchMe()).rejects.toMatchObject({
      status: 0,
      message: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
    });
  });
});
