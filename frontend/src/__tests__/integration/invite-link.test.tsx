import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { ChallengeHero } from "@/components/challenge-hero";
import { Dashboard } from "@/components/dashboard";
import * as api from "@/lib/api";
import { buildChallengeInviteUrl, getPendingInvite, setPendingInvite } from "@/lib/invite";
import { categoryConfigFixture, leaderboardFixture, userFixture } from "@/test/factories";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchMe: vi.fn(),
    fetchChallenges: vi.fn(),
    fetchChallengeDetail: vi.fn(),
    fetchChallengeFeed: vi.fn(),
    joinChallenge: vi.fn(),
    updateProfile: vi.fn(),
  };
});

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

describe("challenge direct invite link flow", () => {
  it("builds normalized invite URLs", () => {
    expect(buildChallengeInviteUrl("  coderats ")).toBe(`${window.location.origin}/?invite=CODERATS`);
  });

  it("persists ?invite= from URL before login and shows an invite notice", async () => {
    window.history.replaceState({}, "", "/?invite=turma26");
    render(<HomePage />);

    expect(await screen.findByTestId("login-view")).toHaveTextContent(
      "Você recebeu um convite para um desafio (TURMA26).",
    );
    expect(getPendingInvite()).toBe("TURMA26");
    expect(window.location.search).toBe("");
  });

  it("joins and opens the invited challenge automatically inside Dashboard", async () => {
    const privateChallenge: api.ChallengeListItem = {
      id: "ch-private",
      slug: "turma-privada",
      title: "Turma Privada",
      description: null,
      visibility: "private",
      invite_code: "PRIVATE9",
      scoring_mode: "points",
      timezone: "America/Sao_Paulo",
      start_date: "2026-11-01",
      end_date: null,
      rest_days_per_week: 1,
      daily_points_cap: 100,
      is_member: true,
      member_role: "member",
      members_count: 2,
      created_at: "2026-11-01T00:00:00Z",
    };

    setPendingInvite("PRIVATE9");
    vi.mocked(api.joinChallenge).mockResolvedValueOnce(privateChallenge);
    vi.mocked(api.fetchChallenges).mockResolvedValueOnce([privateChallenge]);
    vi.mocked(api.fetchChallengeDetail).mockResolvedValueOnce({
      challenge: privateChallenge,
      category_configs: [categoryConfigFixture("project")],
      leaderboard: [leaderboardFixture()],
      user_rest_dates: [],
      rest_days_remaining_this_week: 1,
    });
    vi.mocked(api.fetchChallengeFeed).mockResolvedValueOnce([]);

    render(<Dashboard user={userFixture()} onUserUpdated={vi.fn()} onLogout={vi.fn()} />);

    await waitFor(() =>
      expect(api.joinChallenge).toHaveBeenCalledWith({ invite_code: "PRIVATE9" }),
    );
    await waitFor(() =>
      expect(api.fetchChallengeDetail).toHaveBeenCalledWith("ch-private"),
    );
    expect(
      await screen.findByText('Desafio "Turma Privada" aberto via link de convite.'),
    ).toBeVisible();
    expect(getPendingInvite()).toBeNull();
  });

  it("exposes a Copiar link button in ChallengeHero", async () => {
    const user = userEvent.setup();
    const onCopyInviteLink = vi.fn();
    const challenge: api.ChallengeListItem = {
      id: "ch-1",
      slug: "desafio-1",
      title: "Desafio 1",
      description: null,
      visibility: "public",
      invite_code: "CODERATS",
      scoring_mode: "points",
      timezone: "America/Sao_Paulo",
      start_date: "2026-11-01",
      end_date: null,
      rest_days_per_week: 1,
      daily_points_cap: 100,
      is_member: true,
      member_role: "admin",
      members_count: 1,
      created_at: "2026-11-01T00:00:00Z",
    };

    render(
      <ChallengeHero
        challenges={[challenge]}
        activeChallengeId="ch-1"
        onChangeChallenge={vi.fn()}
        detail={{
          challenge,
          category_configs: [categoryConfigFixture("project")],
          leaderboard: [leaderboardFixture()],
          user_rest_dates: [],
          rest_days_remaining_this_week: 1,
        }}
        days={[]}
        summary={{
          statuses: [],
          completed: 0,
          elapsed: 1,
          todayStatus: "today",
          checkedInToday: false,
        }}
        todayProgress={0}
        userPointsToday={0}
        streak={0}
        lastGain={null}
        copiedInvite={false}
        onCopyInvite={vi.fn()}
        copiedLink={false}
        onCopyInviteLink={onCopyInviteLink}
        restOpen={false}
        onToggleRest={vi.fn()}
        hasIntegrations={false}
        syncing={false}
        onSync={vi.fn()}
        onConnectIntegrations={vi.fn()}
        rulesOpen={false}
        onToggleRules={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Copiar link de convite/ }));
    expect(onCopyInviteLink).toHaveBeenCalledOnce();
  });

  it("restores user.last_challenge_id on load and persists changes on switch", async () => {
    const user = userEvent.setup();
    const first: api.ChallengeListItem = {
      id: "ch-1",
      slug: "primeiro",
      title: "Primeiro Desafio",
      description: null,
      visibility: "public",
      invite_code: "FIRST001",
      scoring_mode: "points",
      timezone: "America/Sao_Paulo",
      start_date: "2026-11-01",
      end_date: null,
      rest_days_per_week: 1,
      daily_points_cap: 100,
      is_member: true,
      member_role: "member",
      members_count: 2,
      created_at: "2026-11-02T00:00:00Z",
    };
    const second: api.ChallengeListItem = {
      ...first,
      id: "ch-2",
      slug: "segundo",
      title: "Segundo Desafio",
      invite_code: "SECOND02",
      created_at: "2026-11-01T00:00:00Z",
    };

    const initialUser = userFixture({ last_challenge_id: "ch-2" });
    vi.mocked(api.fetchChallenges).mockResolvedValueOnce([first, second]);
    vi.mocked(api.fetchChallengeDetail).mockImplementation(async (id) => ({
      challenge: id === "ch-2" ? second : first,
      category_configs: [categoryConfigFixture("project")],
      leaderboard: [leaderboardFixture()],
      user_rest_dates: [],
      rest_days_remaining_this_week: 1,
    }));
    vi.mocked(api.fetchChallengeFeed).mockResolvedValue([]);
    vi.mocked(api.updateProfile).mockResolvedValueOnce(
      userFixture({ last_challenge_id: "ch-1" }),
    );

    render(<Dashboard user={initialUser} onUserUpdated={vi.fn()} onLogout={vi.fn()} />);

    await waitFor(() => expect(api.fetchChallengeDetail).toHaveBeenCalledWith("ch-2"));

    const switcher = await screen.findByLabelText("Trocar desafio ativo");
    await user.selectOptions(switcher, "ch-1");

    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith({ last_challenge_id: "ch-1" }),
    );
    await waitFor(() => expect(api.fetchChallengeDetail).toHaveBeenCalledWith("ch-1"));
  });
});
