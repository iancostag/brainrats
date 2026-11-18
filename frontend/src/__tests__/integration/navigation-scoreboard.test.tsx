import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogOut, Pencil, Trash2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { ActionMenu } from "@/components/action-menu";
import { Scoreboard } from "@/components/scoreboard";
import { leaderboardFixture } from "@/test/factories";


describe("ActionMenu keyboard behavior", () => {
  it("moves across enabled actions, activates one and returns focus after Escape", async () => {
    const user = userEvent.setup();
    const edit = vi.fn();
    const remove = vi.fn();
    render(
      <ActionMenu
        label="Ações do teste"
        items={[
          { label: "Editar", icon: Pencil, onSelect: edit },
          { label: "Indisponível", icon: Trash2, disabled: true, onSelect: vi.fn() },
          { label: "Sair", icon: LogOut, onSelect: remove },
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Ações do teste" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeVisible();
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Editar" })).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Sair" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(remove).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe("Scoreboard", () => {
  it("keeps the current user visible outside the top five and exposes ranking controls", async () => {
    const user = userEvent.setup();
    const entries = Array.from({ length: 7 }, (_, index) =>
      leaderboardFixture({
        user_id: `user-${index + 1}`,
        username: `user${index + 1}`,
        display_name: `Pessoa ${index + 1}`,
        total_points: 100 - index * 10,
      }),
    );
    const onSortChange = vi.fn();
    const onSeeAll = vi.fn();

    render(
      <Scoreboard
        entries={entries}
        sort="points"
        onSortChange={onSortChange}
        currentUserId="user-7"
        scoringMode="points"
        limit={5}
        onSeeAll={onSeeAll}
        inviteCode="CODERATS"
        copiedInvite={false}
        onCopyInvite={vi.fn()}
      />,
    );

    expect(screen.getByText("Pessoa 1")).toBeVisible();
    expect(screen.queryByText("Pessoa 6")).not.toBeInTheDocument();
    expect(screen.getByText("Pessoa 7")).toBeVisible();
    expect(screen.getByText("você")).toBeVisible();

    const sort = screen.getByRole("group", { name: "Ordenar placar" });
    await user.click(within(sort).getByRole("button", { name: "Ofensiva" }));
    expect(onSortChange).toHaveBeenCalledWith("streak");

    await user.click(screen.getByRole("button", { name: /Ver ranking completo/ }));
    expect(onSeeAll).toHaveBeenCalledOnce();
  });

  it("uses the compact invitation state for a single participant", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(
      <Scoreboard
        entries={[leaderboardFixture()]}
        sort="points"
        onSortChange={vi.fn()}
        currentUserId="user-1"
        scoringMode="points"
        inviteCode="CODERATS"
        copiedInvite={false}
        onCopyInvite={onCopy}
      />,
    );

    expect(screen.queryByRole("group", { name: "Ordenar placar" })).not.toBeInTheDocument();
    expect(screen.getByText(/Por enquanto só você/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /CODERATS/ }));
    expect(onCopy).toHaveBeenCalledOnce();
  });
});
