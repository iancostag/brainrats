import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GroupFeed } from "@/components/group-feed";
import { categoryConfigFixture, checkinFixture } from "@/test/factories";


describe("GroupFeed", () => {
  it("groups synchronized events and filters real feed items by category", async () => {
    const user = userEvent.setup();
    const feed = [
      checkinFixture({
        id: "github-1",
        source: "github",
        category_slug: "project",
        title: "Commit A",
        created_at: "2026-11-18T12:03:00Z",
      }),
      checkinFixture({
        id: "github-2",
        source: "github",
        category_slug: "project",
        title: "Commit B",
        created_at: "2026-11-18T12:02:00Z",
      }),
      checkinFixture({
        id: "book-1",
        source: "manual",
        category_slug: "books",
        category_name: "Livros",
        title: "Ler DDIA",
        created_at: "2026-11-18T12:01:00Z",
      }),
    ];
    const onFilterChange = vi.fn();
    const { rerender } = render(
      <GroupFeed
        feed={feed}
        filter="all"
        onFilterChange={onFilterChange}
        categoryConfigs={[categoryConfigFixture("project"), categoryConfigFixture("books")]}
        currentUserId="user-1"
        isAdmin={false}
        isMember
        scoringMode="points"
        onUpdated={vi.fn()}
        hasMore={false}
        loadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "2 commits GitHub sincronizados" })).toBeVisible();
    expect(screen.getByText("Commit A")).toBeVisible();
    expect(screen.getByText("Commit B")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ler DDIA" })).toBeVisible();

    const filters = screen.getByRole("group", { name: "Filtrar entregas por categoria" });
    await user.click(within(filters).getByRole("button", { name: "Livros" }));
    expect(onFilterChange).toHaveBeenCalledWith("books");

    rerender(
      <GroupFeed
        feed={feed}
        filter="books"
        onFilterChange={onFilterChange}
        categoryConfigs={[categoryConfigFixture("project"), categoryConfigFixture("books")]}
        currentUserId="user-1"
        isAdmin={false}
        isMember
        scoringMode="points"
        onUpdated={vi.fn()}
        hasMore={false}
        loadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.queryByRole("heading", { name: "2 commits GitHub sincronizados" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ler DDIA" })).toBeVisible();
    expect(screen.getByRole("heading", { name: /Entregas do grupo/ })).toHaveTextContent("(1)");
  });
});
