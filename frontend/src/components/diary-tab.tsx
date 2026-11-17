"use client";

import { BookMarked, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { fetchDiary, type DiaryResponse } from "@/lib/api";
import {
  CATEGORY_LIST,
  CATEGORY_META,
  formatMetadataChips,
} from "@/lib/categories";

export function DiaryTab() {
  const [query, setQuery] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [source, setSource] = useState("");
  const [diary, setDiary] = useState<DiaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDiary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDiary({
        q: query.trim() || undefined,
        category_slug: categorySlug || undefined,
        source: source || undefined,
      });
      setDiary(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar seu diário de estudos.",
      );
    } finally {
      setLoading(false);
    }
  }, [query, categorySlug, source]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDiary();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadDiary]);

  const hasFilters = Boolean(query.trim() || categorySlug || source);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-100">
            <BookMarked className="h-4 w-4 text-emerald-400" />
            Meu Diário de Estudos
          </h3>
          {diary && (
            <span className="font-mono text-xs text-zinc-400 tabular-nums">
              {diary.total_entries} registro(s){hasFilters ? " filtrados" : ""} ·{" "}
              {diary.total_points} pts válidos
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título ou notas (ex: System Design, SQL, Two Sum)..."
              aria-label="Buscar no diário"
              className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Filtrar por origem"
            className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">Todas as origens</option>
            <option value="manual">Manual</option>
            <option value="github">GitHub Auto</option>
            <option value="leetcode">LeetCode Auto</option>
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategorySlug("");
                setSource("");
              }}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
          <button
            type="button"
            aria-pressed={categorySlug === ""}
            onClick={() => setCategorySlug("")}
            className={`min-h-10 rounded-lg border px-3 py-1 text-xs font-medium ${
              categorySlug === ""
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Todas
          </button>
          {CATEGORY_LIST.map((cat) => {
            const active = categorySlug === cat.slug;
            const count = diary?.by_category[cat.slug];
            return (
              <button
                key={cat.slug}
                type="button"
                aria-pressed={active}
                onClick={() => setCategorySlug(cat.slug)}
                className={`min-h-10 rounded-lg border px-3 py-1 text-xs font-medium ${
                  active
                    ? cat.activeButtonClass
                    : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {cat.shortLabel}
                {count ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadDiary()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/30"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <p className="text-sm text-zinc-400">Carregando registros do diário...</p>
      ) : diary && diary.items.length > 0 ? (
        <div className="space-y-3">
          {diary.items.map((item) => {
            const meta = CATEGORY_META[item.category_slug];
            const chips = formatMetadataChips(item.category_slug, item.metadata_json);
            return (
              <article
                key={item.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{item.study_date}</span>
                    {meta && (
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}
                      >
                        {meta.shortLabel}
                      </span>
                    )}
                    <span>{item.challenge_title}</span>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 font-mono tabular-nums ${
                      item.status === "invalidated"
                        ? "bg-red-500/15 text-red-300"
                        : "bg-zinc-800 text-emerald-300"
                    }`}
                  >
                    {item.status === "invalidated"
                      ? "Invalidado"
                      : `+${item.points_awarded} pts`}
                  </span>
                </div>
                <h4 className="mt-2 font-semibold text-zinc-100">{item.title}</h4>
                {item.description && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">
                    {item.description}
                  </p>
                )}
                {chips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chips.map((chip, idx) => (
                      <span
                        key={`${chip}-${idx}`}
                        className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-[11px] text-zinc-300"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-400">
          Nenhum check-in encontrado para esses filtros. Publique um estudo no seu desafio ativo!
        </div>
      )}
    </div>
  );
}
