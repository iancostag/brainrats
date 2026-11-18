"use client";

import {
  Check,
  Code2,
  ExternalLink,
  Flag,
  Github,
  MessageSquare,
  Pencil,
  PenLine,
  RotateCcw,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

import {
  addComment,
  moderateCheckin,
  reportCheckin,
  toggleReaction,
  updateCheckin,
  type CheckIn,
  type ReactionType,
  type ScoringMode,
} from "@/lib/api";
import {
  CATEGORY_META,
  formatMetadataChips,
  formatPointsLabel,
  formatStudyDate,
} from "@/lib/categories";
import { ActionMenu, type ActionMenuItem } from "@/components/action-menu";
import { CategoryBadge } from "@/components/lane-badge";
import { Avatar, Notice } from "@/components/ui";

interface CheckinCardProps {
  checkin: CheckIn;
  currentUserId: string;
  isChallengeAdmin: boolean;
  isMember: boolean;
  scoringMode: ScoringMode;
  onUpdated: (updated: CheckIn) => void;
}

const REACTION_ITEMS: Array<{ type: ReactionType; emoji: string; label: string }> = [
  { type: "fire", emoji: "🔥", label: "Fogo" },
  { type: "rocket", emoji: "🚀", label: "Foguete" },
  { type: "brain", emoji: "🧠", label: "Cérebro" },
  { type: "clap", emoji: "👏", label: "Palmas" },
];

const SOURCE_LABELS: Record<CheckIn["source"], string> = {
  manual: "Manual",
  github: "GitHub Auto",
  leetcode: "LeetCode Auto",
};

export function CheckinCard({
  checkin,
  currentUserId,
  isChallengeAdmin,
  isMember,
  scoringMode,
  onUpdated,
}: CheckinCardProps) {
  const isAuthor = checkin.user_id === currentUserId;

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(checkin.title);
  const [editDescription, setEditDescription] = useState(checkin.description ?? "");

  const [commentText, setCommentText] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [showReportBox, setShowReportBox] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const [showModerateBox, setShowModerateBox] = useState(false);
  const [moderateReason, setModerateReason] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAction(fn: () => Promise<CheckIn>) {
    setError(null);
    setBusy(true);
    try {
      const updated = await fn();
      onUpdated(updated);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar ação.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleEscape(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    closeFn: () => void,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeFn();
    }
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    const ok = await runAction(() =>
      updateCheckin(checkin.id, {
        title: editTitle.trim(),
        description: editDescription,
      }),
    );
    if (ok) setEditing(false);
  }

  async function handleAddComment(event: FormEvent) {
    event.preventDefault();
    if (!commentText.trim()) return;
    const ok = await runAction(() => addComment(checkin.id, commentText.trim()));
    if (ok) {
      setCommentText("");
      setShowCommentBox(false);
    }
  }

  async function handleReport(event: FormEvent) {
    event.preventDefault();
    if (!reportReason.trim()) return;
    const ok = await runAction(() => reportCheckin(checkin.id, reportReason.trim()));
    if (ok) {
      setReportReason("");
      setShowReportBox(false);
    }
  }

  async function handleConfirmInvalidate(event: FormEvent) {
    event.preventDefault();
    const ok = await runAction(() =>
      moderateCheckin(
        checkin.id,
        "invalidate",
        moderateReason.trim() || "Invalidado pelo criador do desafio.",
      ),
    );
    if (ok) {
      setModerateReason("");
      setShowModerateBox(false);
    }
  }

  const isInvalidated = checkin.status === "invalidated";
  const metadataChips = formatMetadataChips(checkin.category_slug, checkin.metadata_json);
  const pointsLabel = formatPointsLabel(checkin.points_awarded, scoringMode, checkin.status);

  const menuItems: ActionMenuItem[] = [];
  if (isAuthor && !editing) {
    menuItems.push({
      label: "Editar título e notas",
      icon: Pencil,
      onSelect: () => {
        setEditTitle(checkin.title);
        setEditDescription(checkin.description ?? "");
        setEditing(true);
      },
    });
  }
  if (isMember && !isAuthor) {
    menuItems.push({
      label: "Denunciar",
      icon: Flag,
      onSelect: () => setShowReportBox(true),
    });
  }
  if (isChallengeAdmin) {
    menuItems.push(
      isInvalidated
        ? {
            label: "Restaurar pontos",
            icon: RotateCcw,
            disabled: busy,
            onSelect: () => void runAction(() => moderateCheckin(checkin.id, "restore")),
          }
        : {
            label: "Invalidar",
            icon: ShieldAlert,
            tone: "danger",
            disabled: busy,
            onSelect: () => setShowModerateBox(true),
          },
    );
  }

  return (
    <article
      className={`group flex flex-col gap-3 px-4 py-4 transition-colors sm:px-5 ${
        isInvalidated ? "bg-red-50/70" : "hover:bg-well/60"
      }`}
    >
      <CheckinHeader checkin={checkin} pointsLabel={pointsLabel} isInvalidated={isInvalidated} />

      {editing ? (
        <form onSubmit={handleSaveEdit} className="flex flex-col gap-2 sm:pl-[3.25rem]">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => handleEscape(e, () => setEditing(false))}
            aria-label="Editar título do check-in"
            className="field"
            required
          />
          <textarea
            rows={2}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onKeyDown={(e) => handleEscape(e, () => setEditing(false))}
            placeholder="Descrição livre..."
            aria-label="Editar descrição do check-in"
            className="field py-2"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-sm btn-dark">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Salvar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-sm btn-secondary"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancelar (Esc)
            </button>
          </div>
        </form>
      ) : (
        <div className="sm:pl-[3.25rem]">
          <h3
            className={`text-[15px] leading-snug font-bold text-ink-strong ${
              isInvalidated ? "line-through decoration-red-700/60" : ""
            }`}
          >
            {checkin.title}
          </h3>
          {checkin.description && (
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-ink-3">
              {checkin.description}
            </p>
          )}
          {(metadataChips.length > 0 || checkin.evidence_url) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {metadataChips.map((chip, idx) => (
                <span
                  key={`${chip}-${idx}`}
                  className="rounded-md bg-well px-2 py-0.5 font-mono text-[11px] font-medium text-ink-3 ring-1 ring-lane-soft"
                >
                  {chip}
                </span>
              ))}
              {checkin.evidence_url && (
                <a
                  href={checkin.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-link hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Ver evidência
                </a>
              )}
            </div>
          )}
          {isInvalidated && checkin.invalidation_reason && (
            <p className="mt-2 text-xs font-medium text-red-800">
              Motivo da invalidação: {checkin.invalidation_reason}
            </p>
          )}
        </div>
      )}

      {isChallengeAdmin && checkin.reports.length > 0 && (
        <div className="rounded-xl border border-amber-700/25 bg-amber-50 p-3 text-xs text-amber-950 sm:ml-[3.25rem]">
          <div className="flex items-center gap-1.5 font-bold">
            <ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden="true" />
            Denúncias ({checkin.reports.length})
          </div>
          <ul className="mt-1 space-y-1 text-amber-900">
            {checkin.reports.map((rep) => (
              <li key={rep.id}>
                @{rep.reporter_username}: {rep.reason} ({rep.status})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-1 sm:pl-[3.25rem]">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Reações">
          {REACTION_ITEMS.map((item) => {
            const count = checkin.reactions[item.type] ?? 0;
            const active = checkin.user_reactions.includes(item.type);
            return (
              <button
                key={item.type}
                type="button"
                disabled={!isMember || busy}
                aria-label={`Reagir com ${item.label} (${count})`}
                aria-pressed={active}
                onClick={() => void runAction(() => toggleReaction(checkin.id, item.type))}
                className={`inline-flex min-h-9 min-w-10 items-center justify-center gap-1 rounded-full border px-2 text-xs font-semibold transition-[background-color,border-color,opacity,transform] active:scale-95 ${
                  active
                    ? "border-accent/50 bg-accent/10 text-accent-strong"
                    : count > 0
                      ? "border-lane bg-card text-ink-2 hover:border-lane-strong hover:text-ink-strong"
                      : "border-transparent text-ink-2 opacity-60 hover:border-lane hover:bg-card hover:opacity-100 focus-visible:opacity-100"
                } disabled:opacity-40`}
              >
                <span aria-hidden="true">{item.emoji}</span>
                {count > 0 && <span className="font-score text-sm">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-0.5">
          {isMember && (
            <button
              type="button"
              aria-expanded={showCommentBox}
              onClick={() => setShowCommentBox((prev) => !prev)}
              className="btn btn-sm btn-ghost"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Comentar
              {checkin.comments.length > 0 && (
                <span className="font-score text-sm">{checkin.comments.length}</span>
              )}
            </button>
          )}
          <ActionMenu items={menuItems} label="Mais ações do check-in" />
        </div>
      </div>

      {showModerateBox && !isInvalidated && (
        <form
          onSubmit={handleConfirmInvalidate}
          className="animate-reveal flex flex-col gap-2 rounded-xl border border-red-600/30 bg-red-50 p-3 sm:ml-[3.25rem]"
        >
          <span className="text-xs font-semibold text-red-950">
            Confirmar invalidação (os pontos serão removidos do ranking):
          </span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              autoFocus
              value={moderateReason}
              onChange={(e) => setModerateReason(e.target.value)}
              onKeyDown={(e) => handleEscape(e, () => setShowModerateBox(false))}
              placeholder="Motivo visível no card (ex.: commit vazio / fora do escopo)..."
              aria-label="Motivo da invalidação"
              className="field min-h-10 flex-1 border-red-600/40 bg-card text-xs"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="btn btn-sm min-h-10 bg-red-700 text-white hover:bg-red-700/90"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setShowModerateBox(false)}
                className="btn btn-sm btn-secondary min-h-10"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {showReportBox && (
        <form
          onSubmit={handleReport}
          className="animate-reveal flex flex-col gap-2 sm:ml-[3.25rem] sm:flex-row"
        >
          <input
            type="text"
            autoFocus
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            onKeyDown={(e) => handleEscape(e, () => setShowReportBox(false))}
            placeholder="Descreva o motivo da denúncia..."
            aria-label="Motivo da denúncia"
            className="field min-h-10 flex-1 text-xs"
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="btn btn-sm min-h-10 bg-amber-700 text-white hover:bg-amber-700/90 dark:text-shell"
            >
              Enviar denúncia
            </button>
            <button
              type="button"
              onClick={() => setShowReportBox(false)}
              className="btn btn-sm btn-secondary min-h-10"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {checkin.comments.length > 0 && (
        <ul className="space-y-1.5 rounded-xl bg-well px-3 py-2.5 sm:ml-[3.25rem]">
          {checkin.comments.map((cm) => (
            <li key={cm.id} className="text-xs text-ink-3">
              <span className="font-semibold text-ink-strong">{cm.display_name}</span>{" "}
              <span className="font-mono text-ink-muted">@{cm.username}:</span> {cm.content}
            </li>
          ))}
        </ul>
      )}

      {isMember && showCommentBox && (
        <form
          onSubmit={handleAddComment}
          className="animate-reveal flex items-center gap-2 sm:ml-[3.25rem]"
        >
          <input
            type="text"
            autoFocus
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => handleEscape(e, () => setShowCommentBox(false))}
            placeholder="Adicionar comentário..."
            aria-label="Adicionar comentário"
            className="field min-h-10 flex-1 text-xs"
          />
          <button
            type="submit"
            disabled={busy || !commentText.trim()}
            className="btn btn-sm btn-secondary min-h-10"
          >
            Comentar
          </button>
        </form>
      )}

      {error && (
        <Notice tone="error" onDismiss={() => setError(null)} className="sm:ml-[3.25rem]">
          {error}
        </Notice>
      )}
    </article>
  );
}

const SOURCE_ICONS: Record<CheckIn["source"], LucideIcon> = {
  manual: PenLine,
  github: Github,
  leetcode: Code2,
};

/** Chip de origem: Manual, GitHub Auto ou LeetCode Auto (com ícone). */
export function SourceChip({ source, suffix }: { source: CheckIn["source"]; suffix?: string }) {
  const Icon = SOURCE_ICONS[source];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-well px-2 py-0.5 text-[11px] font-semibold text-ink-2 ring-1 ring-lane-soft">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {SOURCE_LABELS[source]}
      {suffix}
    </span>
  );
}

/** Pílula de pontuação: laranja quando pontua, neutra quando não pontua, vermelha se invalidada. */
export function PointsPill({
  label,
  invalidated,
  scored,
}: {
  label: string;
  invalidated: boolean;
  scored: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 font-score text-sm ${
        invalidated
          ? "bg-red-100 text-red-900"
          : scored
            ? "bg-accent/12 text-accent-strong ring-1 ring-accent/25"
            : "bg-well text-ink-2 ring-1 ring-lane-soft"
      }`}
    >
      {label}
    </span>
  );
}

/** Autor, data, categoria, origem e pontos: o cabeçalho comum do feed. */
export function CheckinHeader({
  checkin,
  pointsLabel,
  isInvalidated,
  sourceSuffix,
  scored,
}: {
  checkin: CheckIn;
  pointsLabel: string;
  isInvalidated: boolean;
  sourceSuffix?: string;
  scored?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar name={checkin.display_name} src={checkin.avatar_url} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate leading-6">
            <span className="font-bold text-ink-strong">{checkin.display_name}</span>{" "}
            <span className="font-mono text-xs text-ink-muted">@{checkin.username}</span>
          </p>
          <PointsPill
            label={pointsLabel}
            invalidated={isInvalidated}
            scored={scored ?? checkin.points_awarded > 0}
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
          <time dateTime={checkin.study_date} title={checkin.study_date} className="font-medium">
            {formatStudyDate(checkin.study_date)}
          </time>
          <span aria-hidden="true" className="text-ink-faint">
            ·
          </span>
          {CATEGORY_META[checkin.category_slug] && <CategoryBadge slug={checkin.category_slug} />}
          <SourceChip source={checkin.source} suffix={sourceSuffix} />
        </div>
      </div>
    </div>
  );
}
