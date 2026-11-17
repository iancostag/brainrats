"use client";

import {
  Check,
  ExternalLink,
  Flag,
  MessageSquare,
  Pencil,
  RotateCcw,
  ShieldAlert,
  X,
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
import { LaneBadge } from "@/components/lane-badge";

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
  const [avatarFailed, setAvatarFailed] = useState(false);

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
  const categoryMeta = CATEGORY_META[checkin.category_slug];
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
      className={`group flex flex-col gap-3 rounded-xl border p-4 transition sm:p-5 ${
        isInvalidated
          ? "border-red-600/35 bg-red-50/70"
          : "border-lane bg-card hover:border-lane-strong"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {checkin.avatar_url && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={checkin.avatar_url}
              alt={`Avatar de ${checkin.display_name}`}
              onError={() => setAvatarFailed(true)}
              className="h-9 w-9 rounded-full border border-lane object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-action text-xs font-bold text-white">
              {checkin.display_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink-strong">{checkin.display_name}</span>
              <span className="font-mono text-xs text-ink-muted">@{checkin.username}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-2">
              <time dateTime={checkin.study_date} title={checkin.study_date}>
                {formatStudyDate(checkin.study_date)}
              </time>
              {categoryMeta && <LaneBadge slug={checkin.category_slug} />}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-lane bg-well px-2.5 py-0.5 text-xs font-medium text-ink-2">
            {SOURCE_LABELS[checkin.source]}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 font-score text-sm ${
              isInvalidated
                ? "border-red-600/35 bg-red-100 text-red-900"
                : "border-accent/30 bg-accent/10 text-accent-strong"
            }`}
          >
            {pointsLabel}
          </span>
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSaveEdit} className="flex flex-col gap-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => handleEscape(e, () => setEditing(false))}
            aria-label="Editar título do check-in"
            className="min-h-10 rounded-lg border border-lane bg-well px-3 py-1.5 text-sm text-ink-strong transition-colors focus:border-ink-strong"
            required
          />
          <textarea
            rows={2}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onKeyDown={(e) => handleEscape(e, () => setEditing(false))}
            placeholder="Descrição livre..."
            aria-label="Editar descrição do check-in"
            className="rounded-lg border border-lane bg-well px-3 py-1.5 text-sm text-ink-strong transition-colors focus:border-ink-strong"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-action px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Check className="h-3.5 w-3.5" /> Salvar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-lane bg-card px-3 py-1.5 text-xs font-medium text-ink-3"
            >
              <X className="h-3.5 w-3.5" /> Cancelar (Esc)
            </button>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-base font-bold text-ink-strong">{checkin.title}</h4>
          </div>
          {checkin.description && (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-3">
              {checkin.description}
            </p>
          )}
          {metadataChips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {metadataChips.map((chip, idx) => (
                <span
                  key={`${chip}-${idx}`}
                  className="rounded-md border border-lane bg-well px-2 py-0.5 font-mono text-[11px] font-medium text-ink-3"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          {checkin.evidence_url && (
            <a
              href={checkin.evidence_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-link hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ver evidência / link
            </a>
          )}
          {isInvalidated && checkin.invalidation_reason && (
            <p className="mt-2 text-xs font-medium text-red-800">
              Motivo da invalidação: {checkin.invalidation_reason}
            </p>
          )}
        </div>
      )}

      {isChallengeAdmin && checkin.reports.length > 0 && (
        <div className="rounded-lg border border-amber-600/35 bg-amber-50 p-3 text-xs text-amber-950">
          <div className="flex items-center gap-1.5 font-bold">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-lane-soft pt-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reações">
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
                className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                  active
                    ? "border-accent bg-accent/10 text-accent-strong"
                    : count > 0
                      ? "border-lane bg-well text-ink-2 hover:border-ink-faint hover:text-ink-strong"
                      : "border-transparent text-ink-2 opacity-70 hover:border-lane hover:bg-well hover:opacity-100"
                } disabled:opacity-50`}
              >
                <span aria-hidden="true">{item.emoji}</span>
                {count > 0 && <span className="font-score text-sm">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          {isMember && (
            <button
              type="button"
              aria-expanded={showCommentBox}
              onClick={() => setShowCommentBox((prev) => !prev)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-ink-2 transition-colors hover:bg-well hover:text-ink-strong"
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
          className="flex flex-col gap-2 rounded-lg border border-red-600/35 bg-red-50 p-3"
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
              placeholder="Motivo visível no card (ex: commit vazio / fora do escopo)..."
              className="min-h-10 flex-1 rounded-lg border border-red-600/40 bg-card px-3 py-1.5 text-xs text-ink-strong"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="min-h-10 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setShowModerateBox(false)}
                className="min-h-10 rounded-lg border border-lane bg-card px-3 py-1.5 text-xs font-medium text-ink-3"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {showReportBox && (
        <form onSubmit={handleReport} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            autoFocus
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            onKeyDown={(e) => handleEscape(e, () => setShowReportBox(false))}
            placeholder="Descreva o motivo da denúncia..."
            className="min-h-10 flex-1 rounded-lg border border-lane bg-well px-3 py-1.5 text-xs text-ink-strong transition-colors focus:border-ink-strong"
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-10 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Enviar denúncia
            </button>
            <button
              type="button"
              onClick={() => setShowReportBox(false)}
              className="min-h-10 rounded-lg border border-lane bg-card px-3 py-1.5 text-xs font-medium text-ink-3"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {checkin.comments.length > 0 && (
        <div className="space-y-1.5 border-t border-lane-soft pt-2.5">
          {checkin.comments.map((cm) => (
            <div key={cm.id} className="text-xs text-ink-3">
              <span className="font-semibold text-ink-strong">{cm.display_name}</span>{" "}
              <span className="font-mono text-ink-muted">@{cm.username}:</span> {cm.content}
            </div>
          ))}
        </div>
      )}

      {isMember && showCommentBox && (
        <form onSubmit={handleAddComment} className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => handleEscape(e, () => setShowCommentBox(false))}
            placeholder="Adicionar comentário..."
            aria-label="Adicionar comentário"
            className="min-h-10 flex-1 rounded-lg border border-lane bg-well px-3 py-1.5 text-xs text-ink-strong placeholder:text-ink-muted"
          />
          <button
            type="submit"
            disabled={busy || !commentText.trim()}
            className="min-h-10 rounded-lg border border-lane bg-card px-3 py-1.5 text-xs font-semibold text-ink-strong transition-colors hover:border-ink-strong disabled:opacity-40"
          >
            Comentar
          </button>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-600/35 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
        >
          {error}
        </p>
      )}
    </article>
  );
}
