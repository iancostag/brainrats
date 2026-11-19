"use client";

import { ArrowRight, Check, Coffee, Copy, Crown, Flame, Trophy, UserPlus } from "lucide-react";

import { Avatar } from "@/components/ui";
import type { LeaderboardEntry, ScoringMode } from "@/lib/api";
import {
  LEADERBOARD_SORTS,
  primaryMetric,
  type LeaderboardSort,
} from "@/lib/leaderboard";

/* Cores das três primeiras posições: ouro, prata, bronze. */
const MEDAL_STYLES = [
  "bg-gold text-shell",
  "bg-[#cbd5e1] text-shell",
  "bg-[#b45309] text-white",
] as const;

function PositionBadge({ position }: { position: number }) {
  const medal = MEDAL_STYLES[position - 1];
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-score text-sm ${
        medal ?? "bg-well text-ink-2 ring-1 ring-lane-soft"
      }`}
    >
      <span className="sr-only">Posição </span>
      {position}
    </span>
  );
}

function SortTabs({
  value,
  onChange,
}: {
  value: LeaderboardSort;
  onChange: (next: LeaderboardSort) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Ordenar placar"
      className="segmented mt-4 grid-cols-3 bg-well ring-1 ring-lane-soft"
    >
      {LEADERBOARD_SORTS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`segmented-item ${
            value === opt.id
              ? "bg-accent text-white shadow-[0_6px_14px_-6px_rgb(244_81_30/0.8)]"
              : "text-ink-2 hover:bg-card hover:text-ink-strong"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Row({
  entry,
  position,
  sort,
  scoringMode,
  isMe,
  roomy,
}: {
  entry: LeaderboardEntry;
  position: number;
  sort: LeaderboardSort;
  scoringMode: ScoringMode;
  isMe: boolean;
  roomy: boolean;
}) {
  const metric = primaryMetric(entry, sort, scoringMode);
  return (
    <li
      aria-current={isMe ? "true" : undefined}
      className={`flex items-center gap-3 rounded-xl transition-colors ${roomy ? "p-3" : "px-2.5 py-2"} ${
        isMe
          ? "bg-accent/10 ring-1 ring-accent-bright/50"
          : "hover:bg-well"
      }`}
    >
      <PositionBadge position={position} />
      {roomy && <Avatar name={entry.display_name} src={entry.avatar_url} size="sm" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-ink-strong">{entry.display_name}</span>
          {isMe && (
            <span className="shrink-0 rounded bg-accent px-1.5 py-px text-[10px] font-bold text-white">
              você
            </span>
          )}
          {entry.role === "admin" && (
            <span className="shrink-0 rounded bg-well px-1.5 py-px font-mono text-[10px] text-ink-2 ring-1 ring-lane-soft">
              adm
            </span>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-2 tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3 w-3 text-accent-text" aria-hidden="true" />
            {entry.current_streak}d<span className="sr-only"> de ofensiva</span>
          </span>
          <span>{entry.active_days}d ativos</span>
          <span className="inline-flex items-center gap-1">
            <Coffee className="h-3 w-3" aria-hidden="true" />
            {entry.rest_days_used_this_week}
            <span className="sr-only"> descanso(s) nesta semana</span>
          </span>
        </p>
      </div>
      <span className="shrink-0 text-right">
        <span className="font-score text-2xl leading-none text-ink-strong">{metric.value}</span>{" "}
        <span className="text-xs text-ink-2">{metric.unit}</span>
      </span>
    </li>
  );
}

interface ScoreboardProps {
  entries: LeaderboardEntry[];
  sort: LeaderboardSort;
  onSortChange: (next: LeaderboardSort) => void;
  currentUserId: string;
  scoringMode: ScoringMode;
  /** Limite de linhas (o usuário sempre aparece, mesmo fora do limite). */
  limit?: number;
  onSeeAll?: () => void;
  inviteCode: string;
  copiedInvite: boolean;
  onCopyInvite: () => void;
  title?: string;
}

/**
 * Placar Oficial. Com até 5 atletas mostra linhas espaçosas com avatar;
 * com mais vira lista compacta. Com um único atleta, mostra a linha e o convite.
 */
export function Scoreboard({
  entries,
  sort,
  onSortChange,
  currentUserId,
  scoringMode,
  limit,
  onSeeAll,
  inviteCode,
  copiedInvite,
  onCopyInvite,
  title = "Placar Oficial",
}: ScoreboardProps) {
  const roomy = entries.length <= 5;
  const myIndex = entries.findIndex((e) => e.user_id === currentUserId);
  const visible =
    limit && entries.length > limit ? entries.slice(0, limit) : entries;
  const meOutside = limit !== undefined && myIndex >= limit;
  const hiddenCount = entries.length - visible.length;
  const solo = entries.length === 1;

  return (
    <section aria-labelledby="scoreboard-title" className="card relative overflow-hidden p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-10 h-32 w-32 rounded-full bg-gold/10 blur-2xl"
      />
      <div className="relative flex items-center justify-between gap-2">
        <h2 id="scoreboard-title" className="section-title">
          <Trophy className="h-5 w-5 text-gold" aria-hidden="true" />
          {title}
        </h2>
        <span className="font-mono text-xs text-ink-muted">
          {entries.length} {entries.length === 1 ? "atleta" : "atletas"}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 rounded-xl bg-well p-4 text-center text-sm text-ink-2">
          Nenhum participante ainda.
        </p>
      ) : (
        <>
          {!solo && <SortTabs value={sort} onChange={onSortChange} />}

          <ol className={`relative mt-3 flex flex-col ${roomy ? "gap-1.5" : "gap-0.5"}`}>
            {visible.map((entry, idx) => (
              <Row
                key={entry.user_id}
                entry={entry}
                position={idx + 1}
                sort={sort}
                scoringMode={scoringMode}
                isMe={entry.user_id === currentUserId}
                roomy={roomy}
              />
            ))}
          </ol>

          {meOutside && (
            <>
              <p aria-hidden="true" className="py-1 text-center text-xs text-ink-faint">
                ···
              </p>
              <ol>
                <Row
                  entry={entries[myIndex]}
                  position={myIndex + 1}
                  sort={sort}
                  scoringMode={scoringMode}
                  isMe
                  roomy={false}
                />
              </ol>
            </>
          )}

          {solo && (
            <div className="relative mt-3 flex flex-col gap-2 rounded-xl border border-dashed border-lane p-3 text-xs text-ink-2">
              <p className="flex items-start gap-2">
                <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                Por enquanto só você. Compartilhe o código para trazer a turma.
              </p>
              <button type="button" onClick={onCopyInvite} className="btn btn-sm btn-secondary self-start font-mono">
                {copiedInvite ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-success-text" aria-hidden="true" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {inviteCode}
                  </>
                )}
              </button>
            </div>
          )}

          {onSeeAll && hiddenCount > 0 && (
            <button
              type="button"
              onClick={onSeeAll}
              className="relative mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-accent-text transition-colors hover:bg-well hover:text-accent-strong"
            >
              Ver ranking completo ({entries.length}) <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** Pódio dos três primeiros, usado na página de Ranking quando há 3+ atletas. */
export function Podium({
  entries,
  sort,
  scoringMode,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  sort: LeaderboardSort;
  scoringMode: ScoringMode;
  currentUserId: string;
}) {
  const top = entries.slice(0, 3);
  if (top.length < 3) return null;
  // Ordem visual: 2º, 1º, 3º.
  const order = [1, 0, 2];
  const heights = ["h-28", "h-20", "h-16"];
  return (
    <ol aria-label="Pódio" className="grid grid-cols-3 items-end gap-2 sm:gap-4">
      {order.map((idx) => {
        const entry = top[idx];
        const metric = primaryMetric(entry, sort, scoringMode);
        const isMe = entry.user_id === currentUserId;
        return (
          <li key={entry.user_id} className="flex min-w-0 flex-col items-center gap-2 text-center">
            <div className="relative">
              {idx === 0 && (
                <Crown
                  aria-hidden="true"
                  className="absolute -top-5 left-1/2 h-5 w-5 -translate-x-1/2 text-gold"
                />
              )}
              <Avatar
                name={entry.display_name}
                src={entry.avatar_url}
                size="lg"
                ring={isMe ? "ring-accent-bright" : "ring-card"}
              />
            </div>
            <div className="w-full min-w-0">
              <p className="truncate text-sm font-bold text-ink-strong">
                {entry.display_name}
                {isMe && <span className="text-accent-text"> (você)</span>}
              </p>
              <p className="text-xs text-ink-2">
                <span className="font-score text-base text-ink-strong">{metric.value}</span>{" "}
                {metric.unit}
              </p>
            </div>
            <div
              className={`flex w-full items-start justify-center rounded-t-2xl pt-2 ${heights[idx]} ${
                idx === 0 ? "bg-linear-to-b from-gold to-[#f59e0b]" : idx === 1 ? "bg-[#cbd5e1]" : "bg-[#b45309]"
              }`}
            >
              <span className={`font-score text-2xl ${idx === 2 ? "text-white" : "text-shell"}`}>
                <span className="sr-only">Posição </span>
                {idx + 1}º
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
