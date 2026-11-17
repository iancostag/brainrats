"use client";

import { BookMarked, RefreshCw, Search, X } from "lucide-react";
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
import { LaneBadge, LaneNumber } from "@/components/lane-badge";

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
        className={`shrink-0 rounded px-2 py-0.5 font-score text-sm ${
          entry.status === "invalidated"
            ? "bg-red-100 text-red-900"
            : "bg-accent/10 text-accent-strong"
        }`}
      >
        {label}
      </span>
    );
  }

  const hasFilters = Boolean(
    query.trim() || categorySlug || challengeId || source || dateFrom || dateTo,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-lane bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-bold text-ink-strong">
            <BookMarked className="h-4 w-4 text-accent-text" />
            Meu Diário de Estudos
          </h3>
          {diary && (
            <span className="text-xs text-ink-2">
              <span className="font-score text-base text-ink-strong">{diary.total_entries}</span>{" "}
              registro(s){hasFilters ? " filtrados" : ""} ·{" "}
              <span className="font-score text-base text-ink-strong">{diary.total_points}</span>{" "}
              pts válidos
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-ink-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título ou notas (ex: System Design, SQL, Two Sum)..."
              aria-label="Buscar no diário"
              className="min-h-11 w-full rounded-lg border border-lane bg-well py-2 pl-9 pr-3 text-sm text-ink-strong placeholder:text-ink-muted"
            />
          </div>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Filtrar por origem"
            className="min-h-11 rounded-lg border border-lane bg-well px-3 py-2 text-sm text-ink-strong"
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
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-lane bg-card px-3 py-2 text-xs font-semibold text-ink-strong transition-colors hover:border-ink-strong"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
            Desafio
            <select
              value={challengeId}
              onChange={(e) => setChallengeId(e.target.value)}
              className="min-h-10 rounded-lg border border-lane bg-well px-3 py-1.5 text-sm text-ink-strong"
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

          <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
            Data inicial
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="min-h-10 rounded-lg border border-lane bg-well px-3 py-1.5 text-sm text-ink-strong"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
            Data final
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="min-h-10 rounded-lg border border-lane bg-well px-3 py-1.5 text-sm text-ink-strong"
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
                ? "border-action bg-action text-white"
                : "border-lane bg-well text-ink-2 hover:text-ink-strong"
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
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border py-1 pl-1.5 pr-3 text-xs font-semibold ${
                  active
                    ? cat.activeButtonClass
                    : "border-lane bg-well text-ink-2 hover:text-ink-strong"
                }`}
              >
                <LaneNumber slug={cat.slug} />
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
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 rounded-xl border border-lane bg-card p-6 text-sm text-ink-2"
        >
          <RefreshCw className="h-4 w-4 animate-spin text-accent-text" />
          <span>Carregando registros do diário...</span>
        </div>
      ) : diary && diary.items.length > 0 ? (
        <div className="space-y-3">
          {diary.items.map((item) => {
            const meta = CATEGORY_META[item.category_slug];
            const chips = formatMetadataChips(item.category_slug, item.metadata_json);
            const entries = entriesOf(item);
            const multi = entries.length > 1;
            return (
              <article
                key={item.id}
                className="rounded-xl border border-lane bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <time dateTime={item.study_date} title={item.study_date}>
                      {formatStudyDate(item.study_date)}
                    </time>
                    {meta && <LaneBadge slug={item.category_slug} />}
                    {!multi && <span>{entries[0].challenge_title}</span>}
                  </div>
                  {multi ? (
                    <span className="text-xs text-ink-2">
                      Em <span className="font-score text-sm text-ink-strong">{entries.length}</span>{" "}
                      desafios
                    </span>
                  ) : (
                    pointsChip(entries[0])
                  )}
                </div>
                <h4 className="mt-2 font-bold text-ink-strong">{item.title}</h4>
                {item.description && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-3">
                    {item.description}
                  </p>
                )}
                {chips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chips.map((chip, idx) => (
                      <span
                        key={`${chip}-${idx}`}
                        className="rounded-md border border-lane bg-well px-2 py-0.5 font-mono text-[11px] font-medium text-ink-3"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
                {multi && (
                  <ul className="mt-3 divide-y divide-lane-soft rounded-lg border border-lane bg-well text-xs">
                    {entries.map((entry) => (
                      <li
                        key={entry.checkin_id}
                        className="flex items-center justify-between gap-2 px-3 py-1.5"
                      >
                        <span className="min-w-0 truncate text-ink-3">{entry.challenge_title}</span>
                        {pointsChip(entry)}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-lane-strong bg-card/60 p-8 text-center text-sm text-ink-2">
          Nenhum check-in encontrado para esses filtros. Publique um estudo no seu desafio ativo!
        </div>
      )}
    </div>
  );
}
