import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { ApiError, fetchMe, setStoredToken } from "@/lib/api";
import { userFixture } from "@/test/factories";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, fetchMe: vi.fn() };
});

vi.mock("@/components/login-view", () => ({
  LoginView: ({
    sessionNotice,
    onSuccess,
  }: {
    sessionNotice?: string | null;
    onSuccess: (user: ReturnType<typeof userFixture>) => void;
  }) => (
    <div data-testid="login-view">
      <span>{sessionNotice}</span>
      <button type="button" onClick={() => onSuccess(userFixture())}>
        Login simulado
      </button>
    </div>
  ),
}));

vi.mock("@/components/dashboard", () => ({
  Dashboard: ({
    user,
    onLogout,
  }: {
    user: ReturnType<typeof userFixture>;
    onLogout: () => void;
  }) => (
    <div data-testid="dashboard">
      <span>{user.username}</span>
      <button type="button" onClick={onLogout}>
        Logout simulado
      </button>
    </div>
  ),
}));

beforeEach(() => {
  vi.mocked(fetchMe).mockReset();
  window.history.replaceState({}, "", "/");
});

describe("application session flow", () => {
  it("shows login when there is no stored token and enters the dashboard after success", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    expect(await screen.findByTestId("login-view")).toBeVisible();
    expect(fetchMe).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Login simulado" }));
    expect(screen.getByTestId("dashboard")).toHaveTextContent("ada");
  });

  it("restores a valid session and clears local state on logout", async () => {
    const user = userEvent.setup();
    setStoredToken("valid-token");
    vi.mocked(fetchMe).mockResolvedValueOnce(userFixture({ username: "restored" }));

    render(<HomePage />);

    expect(await screen.findByTestId("dashboard")).toHaveTextContent("restored");
    expect(fetchMe).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Logout simulado" }));
    expect(await screen.findByTestId("login-view")).toBeVisible();
  });

  it("expires a rejected token and explains why login is required", async () => {
    setStoredToken("expired-token");
    vi.mocked(fetchMe).mockRejectedValueOnce(new ApiError("expired", 401));

    render(<HomePage />);

    expect(await screen.findByTestId("login-view")).toHaveTextContent(
      "Sua sessão expirou. Entre novamente para continuar.",
    );
    expect(window.localStorage.getItem("brainrats_token")).toBeNull();
  });

  it("offers retry for a temporary server failure and recovers", async () => {
    const user = userEvent.setup();
    setStoredToken("valid-token");
    vi.mocked(fetchMe)
      .mockRejectedValueOnce(new ApiError("Servidor indisponível", 0))
      .mockResolvedValueOnce(userFixture({ username: "recovered" }));

    render(<HomePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Servidor indisponível");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByTestId("dashboard")).toHaveTextContent("recovered"));
    expect(fetchMe).toHaveBeenCalledTimes(2);
  });
});
