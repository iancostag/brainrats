"use client";

import { Check, ChevronDown, ChevronUp, PlusCircle } from "lucide-react";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";

import {
  createCheckin,
  type CategoryConfig,
  type CategorySlug,
  type CheckIn,
  type ScoringMode,
} from "@/lib/api";
import { LaneNumber } from "@/components/lane-badge";
import { CATEGORY_META, formatPointsLabel } from "@/lib/categories";

interface CheckinFormProps {
  challengeId: string;
  scoringMode: ScoringMode;
  categoryConfigs: CategoryConfig[];
  /** Quantos outros desafios o usuário participa (recebem a cópia por padrão). */
  otherChallengesCount: number;
  onCreated: (checkin: CheckIn) => void;
}

export function CheckinForm({
  challengeId,
  scoringMode,
  categoryConfigs,
  otherChallengesCount,
  onCreated,
}: CheckinFormProps) {
  const enabledConfigs = categoryConfigs.filter((c) => c.is_enabled);
  const [categorySlug, setCategorySlug] = useState<CategorySlug>(
    enabledConfigs[0]?.slug ?? "leetcode",
  );
  const [title, setTitle] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  // Metadados começam vazios: só vão para o backend se o usuário preencher.
  const [difficulty, setDifficulty] = useState<"" | "Easy" | "Medium" | "Hard">("");
  const [language, setLanguage] = useState("");
  const [repository, setRepository] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [pagesRead, setPagesRead] = useState("");
  const [topic, setTopic] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");

  const [onlyThisChallenge, setOnlyThisChallenge] = useState(false);
  const canCrosspost = otherChallengesCount > 0;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (enabledConfigs.length > 0 && !enabledConfigs.some((c) => c.slug === categorySlug)) {
      setCategorySlug(enabledConfigs[0].slug);
    }
  }, [challengeId, categorySlug, enabledConfigs]);

  function positiveNumber(value: string): number | undefined {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  function buildMetadata(): Record<string, unknown> {
    if (categorySlug === "leetcode") {
      return {
        difficulty: difficulty || undefined,
        language: language.trim() || undefined,
      };
    }
    if (categorySlug === "project") {
      return {
        repository: repository.trim() || undefined,
        duration_minutes: positiveNumber(durationMinutes),
      };
    }
    if (categorySlug === "books") {
      return {
        book_title: bookTitle.trim() || undefined,
        pages_read: positiveNumber(pagesRead),
      };
    }
    return {
      topic: topic.trim() || undefined,
      duration_minutes: positiveNumber(durationMinutes),
    };
  }

  async function submitCheckin() {
    if (!title.trim()) {
      setError("Informe o título da tarefa para publicar.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    try {
      const created = await createCheckin(challengeId, {
        category_slug: categorySlug,
        title: title.trim(),
        description: description.trim() || undefined,
        evidence_url: evidenceUrl.trim() || undefined,
        metadata_json: buildMetadata(),
        publish_to_all_challenges: canCrosspost && !onlyThisChallenge,
      });
      setTitle("");
      setDescription("");
      setEvidenceUrl("");
      const parts = [
        `Check-in publicado (${formatPointsLabel(
          created.points_awarded,
          scoringMode,
          created.status,
        )}).`,
      ];
      if (created.also_published_in.length > 0) {
        parts.push(`Também em: ${created.also_published_in.join(", ")}.`);
      }
      if (created.skipped_challenges.length > 0) {
        parts.push(`Não foi para: ${created.skipped_challenges.join(", ")}.`);
      }
      setSuccessMessage(parts.join(" "));
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar check-in.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitCheckin();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void submitCheckin();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3.5 rounded-xl border border-lane bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-ink-strong">
          <PlusCircle className="h-4 w-4 text-accent-text" />
          Registrar Estudo
        </h3>
        <span className="hidden text-xs text-ink-2 sm:inline">
          Atalho:{" "}
          <kbd className="rounded border border-lane bg-well px-1.5 py-0.5 font-mono text-[11px] text-ink-strong">
            Ctrl+Enter
          </kbd>
        </span>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria de estudo">
        {enabledConfigs.map((cfg) => {
          const meta = CATEGORY_META[cfg.slug];
          const active = cfg.slug === categorySlug;
          return (
            <button
              key={cfg.slug}
              type="button"
              aria-pressed={active}
              onClick={() => setCategorySlug(cfg.slug)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border py-1.5 pl-1.5 pr-3 text-xs font-semibold transition ${
                active
                  ? meta.activeButtonClass
                  : "border-lane bg-well text-ink-3 hover:border-ink-faint hover:text-ink-strong"
              }`}
            >
              <LaneNumber slug={cfg.slug} />
              {meta.shortLabel}
            </button>
          );
        })}
      </div>

      {categorySlug === "leetcode" && (
        <div className="flex flex-wrap items-center gap-2">
          <span id="checkin-difficulty-label" className="text-xs font-semibold text-ink-3">
            Dificuldade
          </span>
          <div
            role="group"
            aria-labelledby="checkin-difficulty-label"
            className="inline-flex rounded-lg border border-lane bg-well p-0.5"
          >
            {(
              [
                { value: "Easy", label: "Fácil" },
                { value: "Medium", label: "Médio" },
                { value: "Hard", label: "Difícil" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={difficulty === opt.value}
                onClick={() => setDifficulty((prev) => (prev === opt.value ? "" : opt.value))}
                className={`min-h-9 rounded-md px-3 text-xs font-semibold transition-colors ${
                  difficulty === opt.value
                    ? "bg-card text-ink-strong shadow-[0_1px_2px_rgba(15,23,34,0.12)]"
                    : "text-ink-2 hover:text-ink-strong"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {scoringMode === "points" && !difficulty && (
            <span className="text-xs text-ink-2">Sem escolher, pontua como Fácil.</span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="checkin-title-input">
          Título da tarefa
        </label>
        <input
          id="checkin-title-input"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (successMessage) setSuccessMessage(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="O que você estudou? Ex: Merge K Sorted Lists / Cap. 5 DDIA"
          className="min-h-11 flex-1 rounded-lg border border-lane bg-well px-3 py-2 text-sm text-ink-strong transition-colors placeholder:text-ink-muted focus:border-ink-strong"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 shrink-0 rounded-lg bg-action px-5 py-2 text-sm font-bold text-white transition hover:bg-action-hover disabled:opacity-50"
        >
          {submitting ? "Publicando..." : "Publicar"}
        </button>
      </div>

      {canCrosspost && (
        <label className="flex min-h-9 w-fit items-center gap-2 text-xs text-ink-3">
          <input
            type="checkbox"
            checked={onlyThisChallenge}
            onChange={(e) => setOnlyThisChallenge(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <span>
            <span className="font-semibold text-ink-strong">Publicar apenas neste desafio</span>
            {!onlyThisChallenge && (
              <span className="text-ink-2">
                {" "}
                · também vai para{" "}
                {otherChallengesCount === 1
                  ? "seu outro desafio"
                  : `seus outros ${otherChallengesCount} desafios`}
              </span>
            )}
          </span>
        </label>
      )}

      <div>
        <button
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((prev) => !prev)}
          className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-accent-text"
        >
          {showDetails ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Ocultar detalhes opcionais
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Adicionar detalhes (tempo, páginas, notas, link)
            </>
          )}
        </button>
      </div>

      {showDetails && (
        <div className="flex flex-col gap-3 rounded-lg border border-lane bg-well p-3.5">
          {categorySlug === "leetcode" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
                Linguagem
                <input
                  type="text"
                  value={language}
                  placeholder="Ex: Python, Go, TypeScript"
                  onChange={(e) => setLanguage(e.target.value)}
                  className="min-h-10 rounded-lg border border-lane bg-card px-3 py-2 text-sm text-ink-strong"
                />
              </label>
            </div>
          )}

          {categorySlug === "books" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
                Nome do livro
                <input
                  type="text"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="Ex: Designing Data-Intensive Applications"
                  className="min-h-10 rounded-lg border border-lane bg-card px-3 py-2 text-sm text-ink-strong"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
                Páginas lidas
                <input
                  type="number"
                  min={1}
                  value={pagesRead}
                  placeholder="Ex: 20"
                  onChange={(e) => setPagesRead(e.target.value)}
                  className="min-h-10 rounded-lg border border-lane bg-card px-3 py-2 text-sm text-ink-strong tabular-nums"
                />
              </label>
            </div>
          )}

          {categorySlug === "project" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
                Repositório / Projeto
                <input
                  type="text"
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  placeholder="ex: iancostag/brainrats"
                  className="min-h-10 rounded-lg border border-lane bg-card px-3 py-2 text-sm text-ink-strong"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
                Minutos dedicados
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={durationMinutes}
                  placeholder="Ex: 45"
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="min-h-10 rounded-lg border border-lane bg-card px-3 py-2 text-sm text-ink-strong tabular-nums"
                />
              </label>
            </div>
          )}

          {(categorySlug === "esw" || categorySlug === "data") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
                Subtema
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={
                    categorySlug === "esw"
                      ? "Ex: System Design, Testes, Arquitetura"
                      : "Ex: SQL, ETL, Pandas, Machine Learning"
                  }
                  className="min-h-10 rounded-lg border border-lane bg-card px-3 py-2 text-sm text-ink-strong"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
                Minutos dedicados
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={durationMinutes}
                  placeholder="Ex: 45"
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="min-h-10 rounded-lg border border-lane bg-card px-3 py-2 text-sm text-ink-strong tabular-nums"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
            Descrição livre (opcional)
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Espaço livre para anotações, código ou aprendizados..."
              className="rounded-lg border border-lane bg-card px-3 py-2 text-sm text-ink-strong placeholder:text-ink-muted"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
            Link de evidência (opcional)
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://..."
              className="min-h-10 rounded-lg border border-lane bg-card px-3 py-2 text-sm text-ink-strong"
            />
          </label>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-600/35 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
        >
          {error}
        </p>
      )}

      {successMessage && (
        <p
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900"
        >
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>{successMessage}</span>
        </p>
      )}
    </form>
  );
}
