"use client";

import { PlusCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  createCheckin,
  type CategoryConfig,
  type CategorySlug,
  type CheckIn,
  type ScoringMode,
} from "@/lib/api";

interface CheckinFormProps {
  challengeId: string;
  scoringMode: ScoringMode;
  categoryConfigs: CategoryConfig[];
  onCreated: (checkin: CheckIn) => void;
}

const CATEGORY_LABELS: Record<CategorySlug, string> = {
  leetcode: "LeetCode",
  project: "Continuidade de Projeto",
  books: "Leitura de Livros",
  esw: "ESW",
  data: "Dados",
};

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
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  // Dynamic metadata fields
  const [difficulty, setDifficulty] = useState("Medium");
  const [language, setLanguage] = useState("Python");
  const [repository, setRepository] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [pagesRead, setPagesRead] = useState("15");
  const [topic, setTopic] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("45");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildMetadata(): Record<string, unknown> {
    if (categorySlug === "leetcode") {
      return { difficulty, language };
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Informe o título da tarefa.");
      return;
    }
    setError(null);
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
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar check-in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-zinc-100">
          <PlusCircle className="h-4 w-4 text-emerald-400" />
          Registrar Check-in de Estudo
        </h3>
        <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">
          {scoringMode === "checkin" ? "Modo Check-in (+1/dia)" : "Modo Pontuação"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {enabledConfigs.map((cfg) => {
          const active = cfg.slug === categorySlug;
          return (
            <button
              key={cfg.slug}
              type="button"
              onClick={() => setCategorySlug(cfg.slug)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {CATEGORY_LABELS[cfg.slug] ?? cfg.name}
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-300">Título da tarefa *</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Resolvi Merge K Sorted Lists / Implementei JWT auth"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
          required
        />
      </label>

      {categorySlug === "leetcode" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-300">
            Dificuldade
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-300">
            Linguagem
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
        </div>
      )}

      {categorySlug === "books" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-300">
            Nome do livro
            <input
              type="text"
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder="Ex: Designing Data-Intensive Applications"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-300">
            Páginas lidas
            <input
              type="number"
              min={1}
              value={pagesRead}
              onChange={(e) => setPagesRead(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
        </div>
      )}

      {categorySlug === "project" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-300">
            Repositório / Projeto
            <input
              type="text"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              placeholder="ex: iancostag/brainrats"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-300">
            Minutos dedicados
            <input
              type="number"
              min={5}
              step={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
        </div>
      )}

      {(categorySlug === "esw" || categorySlug === "data") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-300">
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
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-300">
            Minutos dedicados
            <input
              type="number"
              min={5}
              step={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-300">Descrição livre (opcional)</span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Espaço livre para notas, insights ou links..."
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-zinc-300">
        Link de evidência (opcional)
        <input
          type="url"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://..."
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
        />
      </label>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {submitting ? "Publicando..." : "Publicar Check-in"}
      </button>
    </form>
  );
}
