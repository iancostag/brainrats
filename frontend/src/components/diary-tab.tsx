"use client";

import { BookMarked, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchDiary, type DiaryResponse } from "@/lib/api";

const CATEGORY_OPTIONS = [
  { slug: "", label: "Todas" },
  { slug: "leetcode", label: "LeetCode" },
  { slug: "project", label: "Projeto" },
  { slug: "books", label: "Livros" },
  { slug: "esw", label: "ESW" },
  { slug: "data", label: "Dados" },
];

export function DiaryTab() {
  const [query, setQuery] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [source, setSource] = useState("");
  const [diary, setDiary] = useState<DiaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void fetchDiary({
        q: query.trim() || undefined,
        category_slug: categorySlug || undefined,
        source: source || undefined,
      })
        .then((res) => {
          if (active) setDiary(res);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, categorySlug, source]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-100">
            <BookMarked className="h-4 w-4 text-emerald-400" />
            Meu Diário de Estudos
          </h3>
          {diary && (
            <span className="text-xs text-zinc-400">
              {diary.total_entries} registros · {diary.total_points} pts acumulados
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título ou descrição (ex: System Design, SQL, Two Sum)..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">Todas as origens</option>
            <option value="manual">Manual</option>
            <option value="github">GitHub Auto</option>
            <option value="leetcode">LeetCode Auto</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.slug || "all"}
              type="button"
              onClick={() => setCategorySlug(opt.slug)}
              className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                categorySlug === opt.slug
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {opt.label}
              {opt.slug && diary?.by_category[opt.slug]
                ? ` (${diary.by_category[opt.slug]})`
                : ""}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400">Carregando registros do diário...</p>
      ) : diary && diary.items.length > 0 ? (
        <div className="space-y-3">
          {diary.items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                <span>
                  {item.study_date} · <strong className="text-zinc-200">{item.category_name}</strong>{" "}
                  · {item.challenge_title}
                </span>
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-emerald-300">
                  {item.status === "invalidated" ? "Invalidado" : `+${item.points_awarded} pts`}
                </span>
              </div>
              <h4 className="mt-1.5 font-semibold text-zinc-100">{item.title}</h4>
              {item.description && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{item.description}</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-400">
          Nenhum check-in encontrado para esses filtros. Publique um estudo no seu desafio ativo!
        </div>
      )}
    </div>
  );
}
