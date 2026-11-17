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
} from "@/lib/categories";

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
    if (ok) setCommentText("");
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
  const CategoryIcon = categoryMeta?.icon;
  const metadataChips = formatMetadataChips(checkin.category_slug, checkin.metadata_json);
  const pointsLabel = formatPointsLabel(checkin.points_awarded, scoringMode, checkin.status);

  return (
    <article
      className={`group flex flex-col gap-3 rounded-xl border p-4 transition sm:p-5 ${
        isInvalidated
          ? "border-red-600/35 bg-red-50/70"
          : "border-[#DDD8CE] bg-white hover:border-[#C7C0B3]"
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
              className="h-9 w-9 rounded-full border border-[#DDD8CE] object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F1722] text-xs font-bold text-white">
              {checkin.display_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#0F1722]">{checkin.display_name}</span>
              <span className="font-mono text-xs text-[#64748B]">@{checkin.username}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#475569]">
              <span className="font-mono">{checkin.study_date}</span>
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
            {SOURCE_LABELS[checkin.source]}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums ${
              isInvalidated
                ? "border-red-600/35 bg-red-100 text-red-900"
                : "border-[#D94E28]/30 bg-[#D94E28]/10 text-[#B83D1B]"
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
            className="min-h-10 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-sm text-[#0F1722] transition-colors focus:border-[#0F1722]"
            required
          />
          <textarea
            rows={2}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onKeyDown={(e) => handleEscape(e, () => setEditing(false))}
            placeholder="Descrição livre..."
            aria-label="Editar descrição do check-in"
            className="rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-sm text-[#0F1722] transition-colors focus:border-[#0F1722]"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#0F1722] px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Check className="h-3.5 w-3.5" /> Salvar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]"
            >
              <X className="h-3.5 w-3.5" /> Cancelar (Esc)
            </button>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-base font-bold text-[#0F1722]">{checkin.title}</h4>
            {isAuthor && (
              <button
                type="button"
                onClick={() => {
                  setEditTitle(checkin.title);
                  setEditDescription(checkin.description ?? "");
                  setEditing(true);
                }}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-[#64748B] opacity-90 transition hover:bg-[#FAF9F6] hover:text-[#0F1722] sm:opacity-70 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                title="Editar título e descrição"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
          </div>
          {checkin.description && (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#334155]">
              {checkin.description}
            </p>
          )}
          {metadataChips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {metadataChips.map((chip, idx) => (
                <span
                  key={`${chip}-${idx}`}
                  className="rounded-md border border-[#DDD8CE] bg-[#FAF9F6] px-2 py-0.5 font-mono text-[11px] font-medium text-[#334155]"
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
              className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EBE7DF] pt-3">
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
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums transition ${
                  active
                    ? "border-[#D94E28] bg-[#D94E28]/10 text-[#B83D1B]"
                    : "border-[#DDD8CE] bg-[#FAF9F6] text-[#475569] hover:border-[#94A3B8] hover:text-[#0F1722]"
                } disabled:opacity-50`}
              >
                <span aria-hidden="true">{item.emoji}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMember && !isAuthor && (
            <button
              type="button"
              aria-expanded={showReportBox}
              onClick={() => setShowReportBox((prev) => !prev)}
              className="inline-flex min-h-10 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-[#64748B] hover:bg-[#FAF9F6] hover:text-amber-800"
            >
              <Flag className="h-3.5 w-3.5" /> Denunciar
              {checkin.reports_count > 0 && ` (${checkin.reports_count})`}
            </button>
          )}

          {isChallengeAdmin &&
            (isInvalidated ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runAction(() => moderateCheckin(checkin.id, "restore"))
                }
                className="inline-flex min-h-10 items-center gap-1 rounded-md border border-emerald-700/40 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restaurar
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                aria-expanded={showModerateBox}
                onClick={() => setShowModerateBox((prev) => !prev)}
                className="inline-flex min-h-10 items-center gap-1 rounded-md border border-red-600/35 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-900 transition hover:bg-red-100"
              >
                <ShieldAlert className="h-3.5 w-3.5" /> Invalidar
              </button>
            ))}
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
              value={moderateReason}
              onChange={(e) => setModerateReason(e.target.value)}
              onKeyDown={(e) => handleEscape(e, () => setShowModerateBox(false))}
              placeholder="Motivo visível no card (ex: commit vazio / fora do escopo)..."
              className="min-h-10 flex-1 rounded-lg border border-red-600/40 bg-white px-3 py-1.5 text-xs text-[#0F1722]"
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
                className="min-h-10 rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]"
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
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            onKeyDown={(e) => handleEscape(e, () => setShowReportBox(false))}
            placeholder="Descreva o motivo da denúncia..."
            className="min-h-10 flex-1 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs text-[#0F1722] transition-colors focus:border-[#0F1722]"
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
              className="min-h-10 rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {checkin.comments.length > 0 && (
        <div className="space-y-1.5 border-t border-[#EBE7DF] pt-2.5">
          {checkin.comments.map((cm) => (
            <div key={cm.id} className="text-xs text-[#334155]">
              <span className="font-semibold text-[#0F1722]">{cm.display_name}</span>{" "}
              <span className="font-mono text-[#64748B]">@{cm.username}:</span> {cm.content}
            </div>
          ))}
        </div>
      )}

      {isMember && (
        <form onSubmit={handleAddComment} className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Adicionar comentário..."
            aria-label="Adicionar comentário"
            className="min-h-10 flex-1 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-1.5 text-xs text-[#0F1722] placeholder:text-[#64748B]"
          />
          <button
            type="submit"
            disabled={busy || !commentText.trim()}
            className="min-h-10 rounded-lg border border-[#DDD8CE] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F1722] transition-colors hover:border-[#0F1722] disabled:opacity-40"
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
