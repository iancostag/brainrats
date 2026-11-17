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
import { useState, type FormEvent } from "react";

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
  const [showReportBox, setShowReportBox] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAction(fn: () => Promise<CheckIn>) {
    setError(null);
    setBusy(true);
    try {
      const updated = await fn();
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar ação.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    await runAction(() =>
      updateCheckin(checkin.id, {
        title: editTitle.trim(),
        description: editDescription,
      }),
    );
    setEditing(false);
  }

  async function handleAddComment(event: FormEvent) {
    event.preventDefault();
    if (!commentText.trim()) return;
    await runAction(() => addComment(checkin.id, commentText.trim()));
    setCommentText("");
  }

  async function handleReport(event: FormEvent) {
    event.preventDefault();
    if (!reportReason.trim()) return;
    await runAction(() => reportCheckin(checkin.id, reportReason.trim()));
    setReportReason("");
    setShowReportBox(false);
  }

  const isInvalidated = checkin.status === "invalidated";
  const pointsLabel =
    scoringMode === "checkin"
      ? `${checkin.points_awarded > 0 ? "+1" : "0"} check-in`
      : `+${checkin.points_awarded} pts`;

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl border p-5 transition ${
        isInvalidated
          ? "border-red-500/30 bg-red-950/10 opacity-75"
          : "border-zinc-800 bg-zinc-900/60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {checkin.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={checkin.avatar_url}
              alt={checkin.display_name}
              className="h-9 w-9 rounded-full border border-zinc-700 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-300">
              {checkin.display_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-zinc-100">{checkin.display_name}</span>
              <span className="text-xs text-zinc-400">@{checkin.username}</span>
            </div>
            <p className="text-xs text-zinc-400">
              {checkin.study_date} · {checkin.category_name}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-0.5 text-xs text-zinc-300">
            {SOURCE_LABELS[checkin.source]}
          </span>
          {isInvalidated ? (
            <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-300">
              Invalidado
            </span>
          ) : (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              {pointsLabel}
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSaveEdit} className="flex flex-col gap-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            required
          />
          <textarea
            rows={2}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Descrição livre..."
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950"
            >
              <Check className="h-3.5 w-3.5" /> Salvar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-base font-semibold text-zinc-50">{checkin.title}</h4>
            {isAuthor && (
              <button
                type="button"
                onClick={() => {
                  setEditTitle(checkin.title);
                  setEditDescription(checkin.description ?? "");
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                title="Editar título e descrição"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
          </div>
          {checkin.description && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{checkin.description}</p>
          )}
          {checkin.evidence_url && (
            <a
              href={checkin.evidence_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ver evidência / link
            </a>
          )}
          {isInvalidated && checkin.invalidation_reason && (
            <p className="mt-2 text-xs text-red-300">
              Motivo da invalidação: {checkin.invalidation_reason}
            </p>
          )}
        </div>
      )}

      {isChallengeAdmin && checkin.reports.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            Denúncias ({checkin.reports.length})
          </div>
          <ul className="mt-1 space-y-1 text-amber-100/90">
            {checkin.reports.map((rep) => (
              <li key={rep.id}>
                @{rep.reporter_username}: {rep.reason} ({rep.status})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3">
        <div className="flex flex-wrap gap-1.5">
          {REACTION_ITEMS.map((item) => {
            const count = checkin.reactions[item.type] ?? 0;
            const active = checkin.user_reactions.includes(item.type);
            return (
              <button
                key={item.type}
                type="button"
                disabled={!isMember || busy}
                onClick={() => void runAction(() => toggleReaction(checkin.id, item.type))}
                title={item.label}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition ${
                  active
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                    : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                } disabled:opacity-50`}
              >
                <span>{item.emoji}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMember && !isAuthor && (
            <button
              type="button"
              onClick={() => setShowReportBox((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-amber-300"
            >
              <Flag className="h-3.5 w-3.5" /> Denunciar
              {checkin.reports_count > 0 && ` (${checkin.reports_count})`}
            </button>
          )}

          {isChallengeAdmin && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void runAction(() =>
                  moderateCheckin(
                    checkin.id,
                    isInvalidated ? "restore" : "invalidate",
                    isInvalidated ? undefined : "Invalidado pelo criador do desafio.",
                  ),
                )
              }
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                isInvalidated
                  ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                  : "border-red-500/40 text-red-300 hover:bg-red-500/10"
              }`}
            >
              {isInvalidated ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" /> Invalidar
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {showReportBox && (
        <form onSubmit={handleReport} className="flex gap-2">
          <input
            type="text"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Descreva o motivo da denúncia..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-amber-500"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950"
          >
            Enviar
          </button>
        </form>
      )}

      {checkin.comments.length > 0 && (
        <div className="space-y-1.5 border-t border-zinc-800/80 pt-2.5">
          {checkin.comments.map((cm) => (
            <div key={cm.id} className="text-xs text-zinc-300">
              <span className="font-semibold text-zinc-100">{cm.display_name}</span>{" "}
              <span className="text-zinc-500">@{cm.username}:</span> {cm.content}
            </div>
          ))}
        </div>
      )}

      {isMember && (
        <form onSubmit={handleAddComment} className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Adicionar comentário..."
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={busy || !commentText.trim()}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-emerald-500/50 disabled:opacity-40"
          >
            Comentar
          </button>
        </form>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </article>
  );
}
