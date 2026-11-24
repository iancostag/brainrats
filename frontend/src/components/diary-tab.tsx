"use client";

import {
  BarChart3,
  BookMarked,
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  ListChecks,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { SourceChip } from "@/components/checkin-card";
import { ConsistencyHeatmap } from "@/components/consistency-heatmap";
import { CategoryBadge, CategoryFilter, CategoryIcon } from "@/components/lane-badge";
import { MarkdownContent } from "@/components/markdown-content";
import { EmptyState, ErrorState, LoadingState, Notice, PageHeader } from "@/components/ui";
import {
  downloadDiaryExport,
  fetchDiary,
  fetchDiaryBooks,
  fetchDiaryHeatmap,
  fetchDiaryReviews,
  fetchWeeklyRecap,
  logDiaryReview,
  updateCheckin,
  type BookShelfItem,
  type ChallengeListItem,
  type DiaryChallengeEntry,
  type DiaryHeatmapResponse,
  type DiaryItem,
  type DiaryResponse,
  type ReviewSuggestion,
  type ScoringMode,
  type WeeklyRecapResponse,
} from "@/lib/api";
import {
  CATEGORY_LIST,
  CATEGORY_META,
  formatMetadataChips,
  formatPointsLabel,
  formatStudyDate,
} from "@/lib/categories";
import { safeExternalUrl, safeImageUrl } from "@/lib/url";

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [heatmap, setHeatmap] = useState<DiaryHeatmapResponse | null>(null);
  const [books, setBooks] = useState<BookShelfItem[]>([]);
  const [reviews, setReviews] = useState<ReviewSuggestion[]>([]);
  const [recap, setRecap] = useState<WeeklyRecapResponse | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  const [copiedRecap, setCopiedRecap] = useState(false);
  const [exportNotice, setExportNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  useEffect(() => {
    void Promise.all([
      fetchDiaryHeatmap(365).then(setHeatmap).catch(() => {}),
      fetchDiaryBooks().then(setBooks).catch(() => {}),
      fetchDiaryReviews().then(setReviews).catch(() => {}),
      fetchWeeklyRecap().then(setRecap).catch(() => {}),
    ]);
  }, []);

  async function handleLoadMore() {
    if (!diary?.next_cursor) return;
    setLoadingMore(true);
    try {
      const older = await fetchDiary({
        q: query.trim() || undefined,
        category_slug: categorySlug || undefined,
        challenge_id: challengeId || undefined,
        source: source || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        before: diary.next_cursor,
      });
      setDiary((prev) =>
        prev
          ? {
              ...prev,
              items: [...prev.items, ...older.items],
              total_entries: prev.items.length + older.items.length,
              has_more: older.has_more,
              next_cursor: older.next_cursor,
            }
          : older,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleReviewAction(checkinId: string, action: "reviewed" | "dismissed") {
    try {
      await logDiaryReview(checkinId, action);
      setReviews((prev) => prev.filter((item) => item.checkin_id !== checkinId));
    } catch {
      // Ignore transient errors.
    }
  }

  async function handleExport(format: "markdown" | "json" | "csv") {
    setExportNotice(null);
    try {
      await downloadDiaryExport(format);
      setExportNotice({ ok: true, text: `Diário exportado em ${format.toUpperCase()}.` });
    } catch (err) {
      setExportNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao exportar diário.",
      });
    }
  }

  async function handleSaveInlineEdit(event: FormEvent, item: DiaryItem) {
    event.preventDefault();
    setSavingEdit(true);
    try {
      const updated = await updateCheckin(item.id, {
        title: editTitle.trim(),
        description: editDescription,
      });
      setDiary((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) =>
                it.id === item.id
                  ? { ...it, title: updated.title, description: updated.description }
                  : it,
              ),
            }
          : prev,
      );
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  }

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
        description="Heatmap de constância, revisões espaçadas, estante de livros e diário pesquisável."
        aside={
          <div className="flex flex-wrap gap-2">
            {recap && (
              <button
                type="button"
                onClick={() => setShowRecap((prev) => !prev)}
                className="btn btn-sm btn-secondary"
              >
                <Sparkles className="h-3.5 w-3.5 text-accent-text" aria-hidden="true" />
                Dev Log semanal
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleExport("markdown")}
              className="btn btn-sm btn-secondary"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> MD
            </button>
            <button
              type="button"
              onClick={() => void handleExport("json")}
              className="btn btn-sm btn-secondary"
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => void handleExport("csv")}
              className="btn btn-sm btn-secondary"
            >
              CSV
            </button>
          </div>
        }
      />

      {exportNotice && (
        <Notice
          tone={exportNotice.ok ? "success" : "error"}
          onDismiss={() => setExportNotice(null)}
        >
          {exportNotice.text}
        </Notice>
      )}

      {showRecap && recap && (
        <section aria-label="Dev Log semanal" className="card animate-reveal flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">
              <Sparkles className="h-5 w-5 text-accent-text" aria-hidden="true" />
              Dev Log Semanal ({recap.start_date} → {recap.end_date})
            </h2>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(recap.markdown);
                setCopiedRecap(true);
                setTimeout(() => setCopiedRecap(false), 1800);
              }}
              className="btn btn-sm btn-dark"
            >
              {copiedRecap ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" /> Markdown copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copiar Markdown
                </>
              )}
            </button>
          </div>
          <pre className="max-h-64 overflow-auto rounded-xl bg-well p-3.5 font-mono text-xs whitespace-pre-wrap text-ink-3 ring-1 ring-lane-soft">
            {recap.markdown}
          </pre>
        </section>
      )}

      {heatmap && (
        <ConsistencyHeatmap
          days={heatmap.days}
          totalActiveDays={heatmap.total_active_days}
          currentStreak={heatmap.current_global_streak}
          longestStreak={heatmap.longest_global_streak}
          selectedDate={dateFrom && dateFrom === dateTo ? dateFrom : ""}
          onSelectDate={(iso) => {
            setDateFrom(iso);
            setDateTo(iso);
          }}
        />
      )}

      {(reviews.length > 0 || books.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {reviews.length > 0 && (
            <section aria-label="Revisões sugeridas hoje" className="card flex flex-col gap-3 p-4 sm:p-5">
              <h2 className="section-title">
                <RotateCcw className="h-5 w-5 text-grape" aria-hidden="true" />
                Revisão espaçada ({reviews.length})
              </h2>
              <p className="text-xs text-ink-2">
                Estudos antigos no ponto ideal de revisão (D+3, D+7, D+21).
              </p>
              <ul className="divide-y divide-lane-soft rounded-xl bg-well ring-1 ring-lane-soft">
                {reviews.map((rev) => {
                  const safeUrl = safeExternalUrl(rev.evidence_url);
                  return (
                    <li
                      key={rev.checkin_id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="rounded bg-grape/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-grape">
                          {rev.interval_label}
                        </span>{" "}
                        <span className="font-bold text-ink-strong">{rev.title}</span>
                        <span className="block text-[11px] text-ink-muted">
                          {rev.category_name} · há {rev.days_ago} dias
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {safeUrl && (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-ghost"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleReviewAction(rev.checkin_id, "reviewed")}
                          className="btn btn-sm btn-primary"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Revisei
                        </button>
                        <button
                          type="button"
                          aria-label="Dispensar revisão"
                          onClick={() => void handleReviewAction(rev.checkin_id, "dismissed")}
                          className="btn btn-sm btn-ghost"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {books.length > 0 && (
            <section aria-label="Estante de livros" className="card flex flex-col gap-3 p-4 sm:p-5">
              <h2 className="section-title">
                <BookOpen className="h-5 w-5 text-blue-700" aria-hidden="true" />
                Estante de livros ({books.length})
              </h2>
              <ul className="divide-y divide-lane-soft rounded-xl bg-well ring-1 ring-lane-soft">
                {books.slice(0, 6).map((book) => (
                  <li
                    key={book.book_title}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink-strong">{book.book_title}</p>
                      <p className="text-[11px] text-ink-muted">
                        {book.sessions_count} sessão(ões) · último registro{" "}
                        {formatStudyDate(book.last_read_date)}
                      </p>
                    </div>
                    <span className="shrink-0 font-score text-base text-ink-strong">
                      {book.total_pages} <span className="font-sans text-xs text-ink-2">págs</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {diary && (
        <section
          aria-label="Resumo do diário"
          className="grid gap-3 sm:grid-cols-[auto_auto_minmax(0,1fr)]"
        >
          <div className="card flex items-center gap-3 p-4">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-well text-ink-2 ring-1 ring-lane-soft">
              <ListChecks className="h-5 w-5" aria-hidden="true" />
            </span>
            <p>
              <span className="block font-score text-3xl leading-none text-ink-strong">
                {diary.total_entries}
              </span>
              <span className="text-xs text-ink-2">
                registro(s){hasFilters ? " filtrados" : ""}
              </span>
            </p>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-well text-gold ring-1 ring-lane-soft">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </span>
            <p>
              <span className="block font-score text-3xl leading-none text-ink-strong">
                {diary.total_points}
              </span>
              <span className="text-xs text-ink-2">pts válidos</span>
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
        <div className="card overflow-hidden">
          <ul
            className={`divide-y divide-lane-soft transition-opacity ${loading ? "opacity-60" : ""}`}
          >
            {diary.items.map((item) => {
              const meta = CATEGORY_META[item.category_slug];
              const chips = formatMetadataChips(item.category_slug, item.metadata_json);
              const entries = entriesOf(item);
              const multi = entries.length > 1;
              const safeEvidence = safeExternalUrl(item.evidence_url);
              const safeImage = safeImageUrl(item.image_url);
              const isEditing = editingId === item.id;

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
                      <div className="flex items-center gap-2">
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditTitle(item.title);
                              setEditDescription(item.description ?? "");
                            }}
                            aria-label="Editar anotação no diário"
                            className="btn btn-sm btn-ghost"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                        {multi ? (
                          <span className="text-xs text-ink-2">
                            Em{" "}
                            <span className="font-score text-sm text-ink-strong">
                              {entries.length}
                            </span>{" "}
                            desafios
                          </span>
                        ) : (
                          pointsChip(entries[0])
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <form
                        onSubmit={(e) => void handleSaveInlineEdit(e, item)}
                        className="mt-2 flex flex-col gap-2"
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="field"
                          required
                        />
                        <textarea
                          rows={3}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Anotações em Markdown..."
                          className="field py-2"
                        />
                        <div className="flex gap-2">
                          <button type="submit" disabled={savingEdit} className="btn btn-sm btn-dark">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="btn btn-sm btn-secondary"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <h3 className="mt-2 font-bold text-ink-strong">{item.title}</h3>
                        {item.description && (
                          <MarkdownContent content={item.description} className="mt-1" />
                        )}
                        {safeImage && (
                          <div className="mt-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={safeImage}
                              alt={`Evidência de ${item.title}`}
                              className="max-h-48 rounded-xl border border-lane object-cover"
                            />
                          </div>
                        )}
                        {(chips.length > 0 || safeEvidence) && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {chips.map((chip, idx) => (
                              <span
                                key={`${chip}-${idx}`}
                                className="rounded-md bg-well px-2 py-0.5 font-mono text-[11px] font-medium text-ink-3 ring-1 ring-lane-soft"
                              >
                                {chip}
                              </span>
                            ))}
                            {safeEvidence && (
                              <a
                                href={safeEvidence}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-link hover:underline"
                              >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Ver
                                evidência
                              </a>
                            )}
                          </div>
                        )}
                      </>
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
          {diary.has_more && (
            <div className="border-t border-lane-soft p-3">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void handleLoadMore()}
                className="btn btn-sm btn-ghost w-full"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{" "}
                    Carregando...
                  </>
                ) : (
                  "Carregar registros anteriores"
                )}
              </button>
            </div>
          )}
        </div>
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
