"use client";

import { BookMarked, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  fetchDiary,
  type ChallengeListItem,
  type DiaryResponse,
} from "@/lib/api";
import {
  CATEGORY_LIST,
  CATEGORY_META,
  formatMetadataChips,
} from "@/lib/categories";

interface DiaryTabProps {
  challenges: ChallengeListItem[];
}

export function DiaryTab({ challenges }: DiaryTabProps) {
  const [query, setQuery] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [source, setSource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
        challenge_id: challengeId || undefined,
        source: source || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
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
  }, [query, categorySlug, challengeId, source, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDiary();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadDiary]);

  const hasFilters = Boolean(
    query.trim() || categorySlug || challengeId || source || dateFrom || dateTo,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-[#DDD8CE] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-bold text-[#0F1722]">
            <BookMarked className="h-4 w-4 text-[#D94E28]" />
            Meu Diário de Estudos
          </h3>
          {diary && (
            <span className="font-mono text-xs text-[#475569] tabular-nums">
              {diary.total_entries} registro(s){hasFilters ? " filtrados" : ""} ·{" "}
              {diary.total_points} pts válidos
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-[#64748B]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título ou notas (ex: System Design, SQL, Two Sum)..."
              aria-label="Buscar no diário"
              className="min-h-11 w-full rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] py-2 pl-9 pr-3 text-sm text-[#0F1722] placeholder:text-[#64748B]"
            />
          </div>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Filtrar por origem"
            className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-sm text-[#0F1722]"
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
                setChallengeId("");
                setSource("");
                setDateFrom("");
                setDateTo("");
              }}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#0F1722] hover:border-[#0F1722]"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-[#475569]">
            Desafio
            <select
              value={challengeId}
              onChange={(e) => setChallengeId(e.target.value)}
              className="min-h-10 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-1.5 text-sm text-[#0F1722]"
            >
              <option value="">Todos os desafios</option>
              {challenges
                .filter((c) => c.is_member)
                .map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title}
                  </option>
                ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-[#475569]">
            Data inicial
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="min-h-10 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-1.5 text-sm text-[#0F1722]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-[#475569]">
            Data final
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="min-h-10 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-1.5 text-sm text-[#0F1722]"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
          <button
            type="button"
            aria-pressed={categorySlug === ""}
            onClick={() => setCategorySlug("")}
            className={`min-h-10 rounded-lg border px-3 py-1 text-xs font-semibold ${
              categorySlug === ""
                ? "border-[#0F1722] bg-[#0F1722] text-white"
                : "border-[#DDD8CE] bg-[#FAF9F6] text-[#475569] hover:text-[#0F1722]"
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
                className={`min-h-10 rounded-lg border px-3 py-1 text-xs font-semibold ${
                  active
                    ? cat.activeButtonClass
                    : "border-[#DDD8CE] bg-[#FAF9F6] text-[#475569] hover:text-[#0F1722]"
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
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-600/35 bg-red-50 p-4 text-sm text-red-900"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadDiary()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <p className="text-sm text-[#475569]">Carregando registros do diário...</p>
      ) : diary && diary.items.length > 0 ? (
        <div className="space-y-3">
          {diary.items.map((item) => {
            const meta = CATEGORY_META[item.category_slug];
            const chips = formatMetadataChips(item.category_slug, item.metadata_json);
            return (
              <article
                key={item.id}
                className="rounded-xl border border-[#DDD8CE] bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{item.study_date}</span>
                    {meta && (
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                      >
                        {meta.shortLabel}
                      </span>
                    )}
                    <span>{item.challenge_title}</span>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 font-mono font-bold tabular-nums ${
                      item.status === "invalidated"
                        ? "bg-red-100 text-red-900"
                        : "bg-[#D94E28]/10 text-[#B83D1B]"
                    }`}
                  >
                    {item.status === "invalidated"
                      ? "Invalidado"
                      : `+${item.points_awarded} pts`}
                  </span>
                </div>
                <h4 className="mt-2 font-bold text-[#0F1722]">{item.title}</h4>
                {item.description && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">
                    {item.description}
                  </p>
                )}
                {chips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chips.map((chip, idx) => (
                      <span
                        key={`${chip}-${idx}`}
                        className="rounded-md border border-[#DDD8CE] bg-[#FAF9F6] px-2 py-0.5 font-mono text-[11px] font-medium text-[#334155]"
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
        <div className="rounded-xl border border-dashed border-[#C7C0B3] bg-white/60 p-8 text-center text-sm text-[#475569]">
          Nenhum check-in encontrado para esses filtros. Publique um estudo no seu desafio ativo!
        </div>
      )}
    </div>
  );
}
