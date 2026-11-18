"use client";

import { Inbox, RefreshCw, Zap } from "lucide-react";
import { useMemo } from "react";

import { AutoSyncGroupCard } from "@/components/auto-sync-group-card";
import { CheckinCard } from "@/components/checkin-card";
import { CategoryFilter } from "@/components/lane-badge";
import { EmptyState } from "@/components/ui";
import type { CategoryConfig, CheckIn, ScoringMode } from "@/lib/api";

type FeedEntry =
  | { type: "single"; checkin: CheckIn }
  | { type: "group"; key: string; items: CheckIn[] };

/**
 * Agrupa check-ins automáticos (GitHub / LeetCode) por (autor, origem, dia)
 * quando há 2+ itens, para um sync em lote não inundar o feed.
 */
function groupEntries(items: CheckIn[]): FeedEntry[] {
  const autoBuckets = new Map<string, CheckIn[]>();
  for (const item of items) {
    if (item.source === "github" || item.source === "leetcode") {
      const key = `${item.user_id}:${item.source}:${item.study_date}`;
      const bucket = autoBuckets.get(key) ?? [];
      bucket.push(item);
      autoBuckets.set(key, bucket);
    }
  }

  const emitted = new Set<string>();
  const entries: FeedEntry[] = [];
  for (const item of items) {
    if (item.source === "github" || item.source === "leetcode") {
      const key = `${item.user_id}:${item.source}:${item.study_date}`;
      const bucket = autoBuckets.get(key) ?? [];
      if (bucket.length >= 2) {
        if (!emitted.has(key)) {
          emitted.add(key);
          entries.push({ type: "group", key, items: bucket });
        }
        continue;
      }
    }
    entries.push({ type: "single", checkin: item });
  }
  return entries;
}

interface GroupFeedProps {
  feed: CheckIn[];
  filter: string;
  onFilterChange: (next: string) => void;
  categoryConfigs: CategoryConfig[];
  currentUserId: string;
  isAdmin: boolean;
  isMember: boolean;
  scoringMode: ScoringMode;
  onUpdated: (updated: CheckIn) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function GroupFeed({
  feed,
  filter,
  onFilterChange,
  categoryConfigs,
  currentUserId,
  isAdmin,
  isMember,
  scoringMode,
  onUpdated,
  hasMore,
  loadingMore,
  onLoadMore,
}: GroupFeedProps) {
  const reportedCount = useMemo(() => feed.filter((c) => c.reports_count > 0).length, [feed]);

  const filtered = useMemo(() => {
    if (filter === "all") return feed;
    if (filter === "reported") return feed.filter((c) => c.reports_count > 0);
    return feed.filter((c) => c.category_slug === filter);
  }, [feed, filter]);

  const entries = useMemo(() => groupEntries(filtered), [filtered]);

  return (
    <section aria-labelledby="feed-title" className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-lane-soft px-4 py-4 sm:px-5">
        <h2 id="feed-title" className="section-title">
          <Zap className="h-5 w-5 fill-gold text-gold" aria-hidden="true" />
          Entregas do grupo
          <span className="font-score text-base text-ink-2">({filtered.length})</span>
        </h2>
        <CategoryFilter
          label="Filtrar entregas por categoria"
          slugs={categoryConfigs.filter((c) => c.is_enabled).map((c) => c.slug)}
          value={filter}
          onChange={onFilterChange}
          reportedCount={isAdmin ? reportedCount : undefined}
        />
      </div>

      {entries.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon={Inbox}
            title={filter === "all" ? "Nenhuma entrega ainda" : "Nada nesta categoria"}
          >
            {filter === "all"
              ? "Quando alguém do grupo publicar um estudo, ele aparece aqui."
              : "Troque o filtro ou publique o primeiro estudo desta categoria."}
          </EmptyState>
        </div>
      ) : (
        <div className="divide-y divide-lane-soft">
          {entries.map((entry) =>
            entry.type === "group" ? (
              <AutoSyncGroupCard
                key={entry.key}
                items={entry.items}
                currentUserId={currentUserId}
                isChallengeAdmin={isAdmin}
                isMember={isMember}
                scoringMode={scoringMode}
                onUpdated={onUpdated}
              />
            ) : (
              <CheckinCard
                key={entry.checkin.id}
                checkin={entry.checkin}
                currentUserId={currentUserId}
                isChallengeAdmin={isAdmin}
                isMember={isMember}
                scoringMode={scoringMode}
                onUpdated={onUpdated}
              />
            ),
          )}
        </div>
      )}

      {hasMore && (
        <div className="border-t border-lane-soft p-3">
          <button
            type="button"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="btn btn-sm btn-ghost w-full"
          >
            {loadingMore ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Carregando
                anteriores...
              </>
            ) : (
              "Carregar entregas anteriores"
            )}
          </button>
        </div>
      )}
    </section>
  );
}
