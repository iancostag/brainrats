"use client";

import { ChevronDown, ChevronUp, PlusCircle } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

import {
  createCheckin,
  type CategoryConfig,
  type CategorySlug,
  type CheckIn,
  type ScoringMode,
} from "@/lib/api";
import { CATEGORY_META, formatPointsLabel } from "@/lib/categories";

interface CheckinFormProps {
  challengeId: string;
  scoringMode: ScoringMode;
  categoryConfigs: CategoryConfig[];
  onCreated: (checkin: CheckIn) => void;
}

export function CheckinForm({
  challengeId,
  scoringMode,
  categoryConfigs,
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

  const [difficulty, setDifficulty] = useState("Medium");
  const [language, setLanguage] = useState("Python");
  const [repository, setRepository] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [pagesRead, setPagesRead] = useState("15");
  const [topic, setTopic] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("45");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function buildMetadata(): Record<string, unknown> {
    if (categorySlug === "leetcode") {
      return { difficulty, language: language.trim() || undefined };
    }
    if (categorySlug === "project") {
      return {
        repository: repository.trim() || undefined,
        duration_minutes: Number(durationMinutes) || 30,
      };
    }
    if (categorySlug === "books") {
      return {
        book_title: bookTitle.trim() || undefined,
        pages_read: Number(pagesRead) || 10,
      };
    }
    return {
      topic: topic.trim() || undefined,
      duration_minutes: Number(durationMinutes) || 30,
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
      });
      setTitle("");
      setDescription("");
      setEvidenceUrl("");
      setSuccessMessage(
        `Check-in publicado (${formatPointsLabel(
          created.points_awarded,
          scoringMode,
          created.status,
        )}).`,
      );
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
      className="flex flex-col gap-3.5 rounded-xl border border-[#DDD8CE] bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-[#0F1722]">
          <PlusCircle className="h-4 w-4 text-[#D94E28]" />
          Registrar Estudo
        </h3>
        <span className="text-xs text-[#475569]">
          Atalho:{" "}
          <kbd className="rounded border border-[#DDD8CE] bg-[#FAF9F6] px-1.5 py-0.5 font-mono text-[11px] text-[#0F1722]">
            Ctrl+Enter
          </kbd>
        </span>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria de estudo">
        {enabledConfigs.map((cfg) => {
          const meta = CATEGORY_META[cfg.slug];
          const Icon = meta.icon;
          const active = cfg.slug === categorySlug;
          return (
            <button
              key={cfg.slug}
              type="button"
              aria-pressed={active}
              onClick={() => setCategorySlug(cfg.slug)}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? meta.activeButtonClass
                  : "border-[#DDD8CE] bg-[#FAF9F6] text-[#334155] hover:border-[#94A3B8] hover:text-[#0F1722]"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {meta.shortLabel}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="checkin-title-input">
          Título da tarefa
        </label>
        <input
          id="checkin-title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="O que você estudou? Ex: Merge K Sorted Lists / Cap. 5 DDIA"
          className="min-h-11 flex-1 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-sm text-[#0F1722] placeholder:text-[#64748B]"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 shrink-0 rounded-lg bg-[#0F1722] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#1E293B] disabled:opacity-50"
        >
          {submitting ? "Publicando..." : "Publicar"}
        </button>
      </div>

      <div>
        <button
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((prev) => !prev)}
          className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#D94E28]"
        >
          {showDetails ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Ocultar detalhes opcionais
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Adicionar detalhes (métricas, notas livres, link)
            </>
          )}
        </button>
      </div>

      {showDetails && (
        <div className="flex flex-col gap-3 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] p-3.5">
          {categorySlug === "leetcode" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
                Dificuldade
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="min-h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F1722]"
                >
                  <option value="Easy">Fácil (Easy)</option>
                  <option value="Medium">Médio (Medium)</option>
                  <option value="Hard">Difícil (Hard)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
                Linguagem
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="min-h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F1722]"
                />
              </label>
            </div>
          )}

          {categorySlug === "books" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
                Nome do livro
                <input
                  type="text"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="Ex: Designing Data-Intensive Applications"
                  className="min-h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F1722]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
                Páginas lidas
                <input
                  type="number"
                  min={1}
                  value={pagesRead}
                  onChange={(e) => setPagesRead(e.target.value)}
                  className="min-h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F1722] tabular-nums"
                />
              </label>
            </div>
          )}

          {categorySlug === "project" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
                Repositório / Projeto
                <input
                  type="text"
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  placeholder="ex: iancostag/brainrats"
                  className="min-h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F1722]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
                Minutos dedicados
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="min-h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F1722] tabular-nums"
                />
              </label>
            </div>
          )}

          {(categorySlug === "esw" || categorySlug === "data") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
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
                  className="min-h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F1722]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
                Minutos dedicados
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="min-h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F1722] tabular-nums"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
            Descrição livre (opcional)
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Espaço livre para anotações, código ou aprendizados..."
              className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F1722] placeholder:text-[#64748B]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
            Link de evidência (opcional)
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://..."
              className="min-h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F1722]"
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
          className="rounded-lg border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900"
        >
          {successMessage}
        </p>
      )}
    </form>
  );
}
