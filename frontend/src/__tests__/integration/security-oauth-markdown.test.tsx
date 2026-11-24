import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { MarkdownContent } from "@/components/markdown-content";
import * as api from "@/lib/api";
import { userFixture } from "@/test/factories";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    exchangeOAuthCode: vi.fn(),
    fetchMe: vi.fn(),
  };
});

vi.mock("@/components/dashboard", () => ({
  Dashboard: ({ user }: { user: api.User }) => (
    <div data-testid="dashboard">{user.username}</div>
  ),
}));

vi.mock("@/components/login-view", () => ({
  LoginView: ({ sessionNotice }: { sessionNotice?: string | null }) => (
    <div data-testid="login-view">{sessionNotice}</div>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("OAuth one-time code exchange and safe Markdown", () => {
  it("exchanges ?oauth_code= via POST instead of reading raw JWT from URL", async () => {
    window.history.replaceState({}, "", "/?oauth_code=one-time-code-1234567890");
    vi.mocked(api.exchangeOAuthCode).mockResolvedValueOnce({
      access_token: "fresh-jwt",
      token_type: "bearer",
      user: userFixture({ username: "oauth_dev" }),
    });

    render(<HomePage />);

    await waitFor(() =>
      expect(api.exchangeOAuthCode).toHaveBeenCalledWith("one-time-code-1234567890"),
    );
    expect(await screen.findByTestId("dashboard")).toHaveTextContent("oauth_dev");
    expect(window.location.search).toBe("");
    expect(window.localStorage.getItem("brainrats_token")).toBe("fresh-jwt");
  });

  it("renders safe links and strips unsafe javascript links in Markdown", () => {
    render(
      <MarkdownContent
        content={
          "Veja [GitHub](https://github.com) e [Malicioso](javascript:alert(1)) com `const x = 1`"
        }
      />,
    );

    const safeLink = screen.getByRole("link", { name: "GitHub" });
    expect(safeLink).toHaveAttribute("href", "https://github.com/");
    expect(screen.queryByRole("link", { name: "Malicioso" })).not.toBeInTheDocument();
    expect(screen.getByText("Malicioso")).toBeVisible();
    expect(screen.getByText("const x = 1")).toBeVisible();
  });
});
