import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CheckinForm } from "@/components/checkin-form";
import { createCheckin } from "@/lib/api";
import { categoryConfigFixture, createdCheckinFixture } from "@/test/factories";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, createCheckin: vi.fn() };
});

const configs = [
  categoryConfigFixture("project"),
  categoryConfigFixture("books"),
  categoryConfigFixture("leetcode"),
];

beforeEach(() => {
  vi.mocked(createCheckin).mockReset();
});

describe("CheckinForm", () => {
  it("publishes the selected category, optional metadata and cross-post preference", async () => {
    const user = userEvent.setup();
    const created = createdCheckinFixture({
      category_slug: "books",
      metadata_json: { book_title: "DDIA", pages_read: 12 },
      also_published_in: ["Segundo desafio"],
    });
    vi.mocked(createCheckin).mockResolvedValueOnce(created);
    const onCreated = vi.fn();

    render(
      <CheckinForm
        challengeId="challenge-1"
        scoringMode="points"
        categoryConfigs={configs}
        otherChallengesCount={2}
        onCreated={onCreated}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Livros" }));
    await user.click(screen.getByRole("button", { name: /Adicionar detalhes/ }));
    await user.type(screen.getByLabelText("Nome do livro"), "DDIA");
    await user.type(screen.getByLabelText("Páginas lidas"), "12");
    await user.type(screen.getByLabelText("Descrição livre (opcional)"), "Capítulo sobre replicação");
    await user.type(screen.getByLabelText("Link de evidência (opcional)"), "https://example.com/ddia");
    await user.type(screen.getByLabelText("Título da tarefa"), "Ler capítulo 5");
    await user.click(screen.getByLabelText(/Publicar apenas neste desafio/));
    await user.click(screen.getByRole("button", { name: "Publicar" }));

    await waitFor(() => expect(createCheckin).toHaveBeenCalledOnce());
    expect(createCheckin).toHaveBeenCalledWith("challenge-1", {
      category_slug: "books",
      title: "Ler capítulo 5",
      description: "Capítulo sobre replicação",
      evidence_url: "https://example.com/ddia",
      metadata_json: { book_title: "DDIA", pages_read: 12 },
      publish_to_all_challenges: false,
    });
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(screen.getByRole("status")).toHaveTextContent("Check-in publicado (+15 pts). Também em: Segundo desafio.");
    expect(screen.getByRole("button", { name: "Publicado" })).toBeEnabled();
    expect(screen.getByLabelText("Título da tarefa")).toHaveValue("");
  });

  it("keeps Ctrl+Enter and publishes to all challenges by default", async () => {
    const created = createdCheckinFixture({ points_awarded: 1 });
    vi.mocked(createCheckin).mockResolvedValueOnce(created);

    render(
      <CheckinForm
        challengeId="challenge-2"
        scoringMode="checkin"
        categoryConfigs={[categoryConfigFixture("project")]}
        otherChallengesCount={1}
        onCreated={vi.fn()}
      />,
    );

    const title = screen.getByLabelText("Título da tarefa");
    fireEvent.change(title, { target: { value: "Revisar filas" } });
    fireEvent.keyDown(title, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(createCheckin).toHaveBeenCalledOnce());
    expect(createCheckin).toHaveBeenCalledWith(
      "challenge-2",
      expect.objectContaining({
        title: "Revisar filas",
        publish_to_all_challenges: true,
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("+1 check-in");
  });

  it("shows an actionable API error and preserves the typed title", async () => {
    const user = userEvent.setup();
    vi.mocked(createCheckin).mockRejectedValueOnce(new Error("O teto diário foi atingido."));

    render(
      <CheckinForm
        challengeId="challenge-1"
        scoringMode="points"
        categoryConfigs={configs}
        otherChallengesCount={0}
        onCreated={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Título da tarefa"), "Continuar projeto");
    await user.click(screen.getByRole("button", { name: "Publicar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("O teto diário foi atingido.");
    expect(screen.getByLabelText("Título da tarefa")).toHaveValue("Continuar projeto");
  });
});
