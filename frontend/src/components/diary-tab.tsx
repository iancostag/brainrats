"use client";

import { BarChart3, BookMarked, ListChecks, Search, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  fetchDiary,
  type ChallengeListItem,
  type DiaryChallengeEntry,
  type DiaryItem,
  type DiaryResponse,
  type ScoringMode,
} from "@/lib/api";
import {
  CATEGORY_LIST,
  CATEGORY_META,
  formatMetadataChips,
  formatPointsLabel,
  formatStudyDate,
} from "@/lib/categories";
import { SourceChip } from "@/components/checkin-card";
import { CategoryBadge, CategoryFilter, CategoryIcon } from "@/components/lane-badge";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";

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

  const scoringModeById = new Map<string, ScoringMode>(
    challenges.map((ch) => [ch.id, ch.scoring_mode]),
  );

  function entriesOf(item: DiaryItem): DiaryChallengeEntry[] {
    if (item.challenges?.length) return item.challenges;
    return [
      {
        checkin_id: item.id,
        challenge_id: item.challenge_id,
        challenge_title: item.challenge_title,
        points_awarded: item.points_awarded,
        status: item.status,
      },
    ];
  }

  function pointsChip(entry: DiaryChallengeEntry) {
    const label = formatPointsLabel(
      entry.points_awarded,
      scoringModeById.get(entry.challenge_id) ?? "points",
      entry.status,
    );
    return (
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 font-score text-sm ${
          entry.status === "invalidated"
            ? "bg-red-100 text-red-900"
            : "bg-accent/12 text-accent-strong ring-1 ring-accent/25"
        }`}
      >
        {label}
      </span>
    );
  }

  const hasFilters = Boolean(
    query.trim() || categorySlug || challengeId || source || dateFrom || dateTo,
  );

  const totalByCategory = diary
    ? CATEGORY_LIST.reduce((sum, cat) => sum + (diary.by_category[cat.slug] ?? 0), 0)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={BarChart3}
        title="Meu Progresso"
        description="Seu diário de estudos pesquisável, em todos os desafios."
      />

      {diary && (
        <section
          aria-label="Resumo do diário"
          className="grid gap-3 sm:grid-cols-[auto_auto_minmax(0,1fr)]"
        >
          <div className="card-dark flex items-center gap-3 p-4">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-grape/25 text-grape-soft">
              <ListChecks className="h-5 w-5" aria-hidden="true" />
            </span>
            <p>
              <span className="block font-score text-3xl leading-none">{diary.total_entries}</span>
              <span className="text-xs text-slate-300">
                registro(s){hasFilters ? " filtrados" : ""}
              </span>
            </p>
          </div>
          <div className="card-dark flex items-center gap-3 p-4">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </span>
            <p>
              <span className="block font-score text-3xl leading-none">{diary.total_points}</span>
              <span className="text-xs text-slate-300">pts válidos</span>
            </p>
          </div>
          <div className="card flex flex-col justify-center gap-2.5 p-4">
            <p className="eyebrow">Por categoria{hasFilters ? " (filtro atual)" : ""}</p>
            {totalByCategory > 0 ? (
              <>
                <div
                  aria-hidden="true"
                  className="flex h-2.5 overflow-hidden rounded-full bg-well"
                >
                  {CATEGORY_LIST.map((cat) => {
                    const count = diary.by_category[cat.slug] ?? 0;
                    if (!count) return null;
                    return (
                      <span
                        key={cat.slug}
                        className={`${cat.barClass} h-full`}
                        style={{ width: `${(count / totalByCategory) * 100}%` }}
                      />
                    );
                  })}
                </div>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
                  {CATEGORY_LIST.map((cat) => {
                    const count = diary.by_category[cat.slug] ?? 0;
                    if (!count) return null;
                    return (
                      <li key={cat.slug} className="inline-flex items-center gap-1.5">
                        <CategoryIcon slug={cat.slug} />
                        {cat.shortLabel}
                        <span className="font-score text-sm text-ink-strong">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-xs text-ink-2">Nenhum registro ainda.</p>
            )}
          </div>
        </section>
      )}

      <section aria-label="Filtros do diário" className="card flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título ou notas (ex.: System Design, SQL, Two Sum)..."
              aria-label="Buscar no diário"
              className="field pl-10"
            />
          </div>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Filtrar por origem"
            className="field sm:w-48"
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
              className="btn btn-secondary"
            >
              <X className="h-4 w-4" aria-hidden="true" /> Limpar filtros
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="field-label">
            Desafio
            <select
              value={challengeId}
              onChange={(e) => setChallengeId(e.target.value)}
              className="field"
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

          <label className="field-label">
            Data inicial
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="field"
            />
          </label>

          <label className="field-label">
            Data final
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="field"
            />
          </label>
        </div>

        <CategoryFilter
          label="Filtrar por categoria"
          slugs={CATEGORY_LIST.map((c) => c.slug)}
          value={categorySlug || "all"}
          onChange={(next) => setCategorySlug(next === "all" ? "" : next)}
          counts={diary?.by_category}
        />
      </section>

      {error ? (
        <ErrorState message={error} onRetry={() => void loadDiary()} />
      ) : loading && !diary ? (
        <LoadingState label="Carregando registros do diário..." />
      ) : diary && diary.items.length > 0 ? (
        <ul
          className={`card divide-y divide-lane-soft overflow-hidden transition-opacity ${
            loading ? "opacity-60" : ""
          }`}
        >
          {diary.items.map((item) => {
            const meta = CATEGORY_META[item.category_slug];
            const chips = formatMetadataChips(item.category_slug, item.metadata_json);
            const entries = entriesOf(item);
            const multi = entries.length > 1;
            return (
              <li key={item.id} className="px-4 py-4 sm:px-5">
                <article>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <time
                        dateTime={item.study_date}
                        title={item.study_date}
                        className="font-medium"
                      >
                        {formatStudyDate(item.study_date)}
                      </time>
                      <span aria-hidden="true" className="text-ink-faint">
                        ·
                      </span>
                      {meta && <CategoryBadge slug={item.category_slug} />}
                      <SourceChip source={item.source} />
                      {!multi && <span className="text-ink-2">{entries[0].challenge_title}</span>}
                    </div>
                    {multi ? (
                      <span className="text-xs text-ink-2">
                        Em{" "}
                        <span className="font-score text-sm text-ink-strong">{entries.length}</span>{" "}
                        desafios
                      </span>
                    ) : (
                      pointsChip(entries[0])
                    )}
                  </div>
                  <h3 className="mt-2 font-bold text-ink-strong">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 text-sm whitespace-pre-wrap text-ink-3">
                      {item.description}
                    </p>
                  )}
                  {chips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {chips.map((chip, idx) => (
                        <span
                          key={`${chip}-${idx}`}
                          className="rounded-md bg-well px-2 py-0.5 font-mono text-[11px] font-medium text-ink-3 ring-1 ring-lane-soft"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}
                  {multi && (
                    <ul className="mt-3 divide-y divide-lane-soft overflow-hidden rounded-xl bg-well text-xs ring-1 ring-lane-soft">
                      {entries.map((entry) => (
                        <li
                          key={entry.checkin_id}
                          className="flex items-center justify-between gap-2 px-3 py-1.5"
                        >
                          <span className="min-w-0 truncate text-ink-3">
                            {entry.challenge_title}
                          </span>
                          {pointsChip(entry)}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={BookMarked} title="Nenhum estudo encontrado">
          {hasFilters
            ? "Nenhum check-in corresponde a esses filtros."
            : "Publique um estudo no seu desafio ativo e ele aparece aqui."}
        </EmptyState>
      )}
    </div>
  );
}
