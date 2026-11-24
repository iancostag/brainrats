"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { useId, useState } from "react";

import { CheckinCard, CheckinHeader } from "@/components/checkin-card";
import type { CheckIn, ScoringMode } from "@/lib/api";
import { formatPointsLabel } from "@/lib/categories";
import { safeExternalUrl } from "@/lib/url";

interface AutoSyncGroupCardProps {
  items: CheckIn[];
  currentUserId: string;
  isChallengeAdmin: boolean;
  isMember: boolean;
  scoringMode: ScoringMode;
  onUpdated: (updated: CheckIn) => void;
  onDeleted?: (checkinId: string) => void;
}

/** Quantos itens do lote aparecem na prévia recolhida. */
const PREVIEW_LIMIT = 5;

export function AutoSyncGroupCard({
  items,
  currentUserId,
  isChallengeAdmin,
  isMember,
  scoringMode,
  onUpdated,
  onDeleted,
}: AutoSyncGroupCardProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  const first = items[0];
  const validItems = items.filter((item) => item.status === "valid");
  const totalPoints = validItems.reduce((sum, item) => sum + item.points_awarded, 0);
  const allInvalidated = validItems.length === 0;

  const summaryTitle =
    first.source === "leetcode"
      ? `${items.length} submissões LeetCode sincronizadas`
      : `${items.length} commits GitHub sincronizados`;

  const pointsText = allInvalidated
    ? "Invalidado"
    : formatPointsLabel(totalPoints, scoringMode, "valid");

  const preview = items.slice(0, PREVIEW_LIMIT);
  const hiddenInPreview = items.length - preview.length;

  return (
    <article className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-well/60 sm:px-5">
      <CheckinHeader
        checkin={first}
        pointsLabel={pointsText}
        isInvalidated={allInvalidated}
        scored={totalPoints > 0}
        sourceSuffix=" · lote"
      />

      <div className="flex flex-col gap-2.5 sm:pl-[3.25rem]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-bold text-ink-strong">{summaryTitle}</h3>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((prev) => !prev)}
            className="btn btn-sm btn-secondary"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
            {expanded ? "Recolher" : "Ver detalhes"}
          </button>
        </div>

        {!expanded ? (
          <ul
            id={listId}
            className="divide-y divide-lane-soft overflow-hidden rounded-xl bg-well ring-1 ring-lane-soft"
          >
            {preview.map((item) => {
              const safeUrl = safeExternalUrl(item.evidence_url);
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-1">
                    <span
                      className={`truncate font-medium ${
                        item.status === "invalidated"
                          ? "text-red-800 line-through"
                          : "text-ink-strong"
                      }`}
                    >
                      {item.title}
                    </span>
                    {safeUrl && (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir link de ${item.title}`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-link transition-colors hover:bg-lane-soft"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  <span
                    className={`shrink-0 font-score text-sm ${
                      item.status === "valid" && item.points_awarded > 0
                        ? "text-accent-strong"
                        : "text-ink-muted"
                    }`}
                  >
                    {item.status === "invalidated"
                      ? "Invalidado"
                      : scoringMode === "checkin"
                        ? item.points_awarded > 0
                          ? "+1 chk"
                          : "0 chk"
                        : `+${item.points_awarded} pts`}
                  </span>
                </li>
              );
            })}
            {hiddenInPreview > 0 && (
              <li className="px-3 py-2 text-xs font-medium text-ink-2">
                e mais {hiddenInPreview} {hiddenInPreview === 1 ? "item" : "itens"} em “Ver
                detalhes”
              </li>
            )}
          </ul>
        ) : (
          <div
            id={listId}
            className="animate-reveal divide-y divide-lane-soft overflow-hidden rounded-xl ring-1 ring-lane"
          >
            {items.map((item) => (
              <CheckinCard
                key={item.id}
                checkin={item}
                currentUserId={currentUserId}
                isChallengeAdmin={isChallengeAdmin}
                isMember={isMember}
                scoringMode={scoringMode}
                onUpdated={onUpdated}
                onDeleted={onDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
