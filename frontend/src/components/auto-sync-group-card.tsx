"use client";

import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useState } from "react";

import { CheckinCard } from "@/components/checkin-card";
import type { CheckIn, ScoringMode } from "@/lib/api";
import { CATEGORY_META, formatPointsLabel } from "@/lib/categories";

interface AutoSyncGroupCardProps {
  items: CheckIn[];
  currentUserId: string;
  isChallengeAdmin: boolean;
  isMember: boolean;
  scoringMode: ScoringMode;
  onUpdated: (updated: CheckIn) => void;
}

export function AutoSyncGroupCard({
  items,
  currentUserId,
  isChallengeAdmin,
  isMember,
  scoringMode,
  onUpdated,
}: AutoSyncGroupCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const first = items[0];
  const validItems = items.filter((item) => item.status === "valid");
  const totalPoints = validItems.reduce((sum, item) => sum + item.points_awarded, 0);
  const allInvalidated = validItems.length === 0;

  const categoryMeta = CATEGORY_META[first.category_slug];
  const CategoryIcon = categoryMeta?.icon;
  const sourceLabel = first.source === "leetcode" ? "LeetCode Auto" : "GitHub Auto";
  const summaryTitle =
    first.source === "leetcode"
      ? `${items.length} submissões LeetCode sincronizadas`
      : `${items.length} commits GitHub sincronizados`;

  const pointsText = allInvalidated
    ? "Invalidado"
    : formatPointsLabel(totalPoints, scoringMode, "valid");

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[#DDD8CE] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {first.avatar_url && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={first.avatar_url}
              alt={`Avatar de ${first.display_name}`}
              onError={() => setAvatarFailed(true)}
              className="h-9 w-9 rounded-full border border-[#DDD8CE] object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F1722] text-xs font-bold text-white">
              {first.display_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#0F1722]">{first.display_name}</span>
              <span className="font-mono text-xs text-[#64748B]">@{first.username}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#475569]">
              <span className="font-mono">{first.study_date}</span>
              {categoryMeta && (
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${categoryMeta.badgeClass}`}
                >
                  {CategoryIcon && <CategoryIcon className="h-3 w-3" />}
                  {categoryMeta.shortLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#DDD8CE] bg-[#FAF9F6] px-2.5 py-0.5 text-xs font-medium text-[#475569]">
            {sourceLabel} · Lote ({items.length})
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums ${
              allInvalidated
                ? "border-red-600/35 bg-red-100 text-red-900"
                : "border-[#D94E28]/30 bg-[#D94E28]/10 text-[#B83D1B]"
            }`}
          >
            {pointsText}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-bold text-[#0F1722]">{summaryTitle}</h4>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs font-semibold text-[#0F1722] hover:border-[#0F1722]"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Recolher itens
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Ver todos ({items.length})
            </>
          )}
        </button>
      </div>

      {!expanded ? (
        <ul className="divide-y divide-[#EBE7DF] rounded-lg border border-[#DDD8CE] bg-[#FAF9F6]">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs transition-colors hover:bg-white"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={`truncate font-medium ${
                    item.status === "invalidated"
                      ? "text-red-800 line-through"
                      : "text-[#0F1722]"
                  }`}
                >
                  {item.title}
                </span>
                {item.evidence_url && (
                  <a
                    href={item.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir link de ${item.title}`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#2563EB] transition-colors hover:bg-[#EBE7DF]"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <span className="shrink-0 font-mono text-[11px] text-[#475569] tabular-nums">
                {item.status === "invalidated"
                  ? "Invalidado"
                  : scoringMode === "checkin"
                    ? item.points_awarded > 0
                      ? "+1 chk"
                      : "0 chk"
                    : `+${item.points_awarded} pts`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 space-y-3 border-t border-[#EBE7DF] pt-3">
          {items.map((item) => (
            <CheckinCard
              key={item.id}
              checkin={item}
              currentUserId={currentUserId}
              isChallengeAdmin={isChallengeAdmin}
              isMember={isMember}
              scoringMode={scoringMode}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      )}
    </article>
  );
}
