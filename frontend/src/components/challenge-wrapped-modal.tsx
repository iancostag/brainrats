"use client";

import { Download, Sparkles, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorState, LoadingState } from "@/components/ui";
import { fetchChallengeSummary, type ChallengeSummary } from "@/lib/api";
import { CATEGORY_META } from "@/lib/categories";

interface ChallengeWrappedModalProps {
  challengeId: string;
  onClose: () => void;
}

export function ChallengeWrappedModal({ challengeId, onClose }: ChallengeWrappedModalProps) {
  const [summary, setSummary] = useState<ChallengeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reloadSeq, setReloadSeq] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchChallengeSummary(challengeId)
      .then(setSummary)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao gerar retrospectiva."),
      )
      .finally(() => setLoading(false));
  }, [challengeId, reloadSeq]);

  function handleDownloadPng() {
    if (!summary) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 620;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Navy shell background
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Brand accent bar
    ctx.fillStyle = "#F4511E";
    ctx.fillRect(0, 0, canvas.width, 12);

    ctx.fillStyle = "#FF8A65";
    ctx.font = "bold 22px monospace";
    ctx.fillText("BRAINRATS · RETROSPECTIVA DO DESAFIO", 64, 78);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 44px system-ui, sans-serif";
    ctx.fillText(summary.challenge_title.slice(0, 42), 64, 140);

    ctx.fillStyle = "#94A3B8";
    ctx.font = "600 22px monospace";
    const range = summary.end_date
      ? `${summary.start_date} → ${summary.end_date}`
      : `Início em ${summary.start_date} · contínuo`;
    ctx.fillText(range, 64, 184);

    // Stats cards
    const cards = [
      { label: "ESTUDOS DO GRUPO", value: String(summary.total_checkins), color: "#FBBF24" },
      { label: "PARTICIPANTES", value: String(summary.participants_count), color: "#34D399" },
      {
        label: "SUA POSIÇÃO",
        value: summary.my_position ? `${summary.my_position}º` : "—",
        color: "#FF8A65",
      },
      {
        label: "SUA OFENSIVA",
        value: summary.my_entry ? `${summary.my_entry.current_streak}d` : "0d",
        color: "#A78BFA",
      },
    ];
    cards.forEach((card, i) => {
      const x = 64 + i * 242;
      ctx.fillStyle = "#1B2333";
      ctx.fillRect(x, 232, 224, 130);
      ctx.fillStyle = card.color;
      ctx.font = "800 48px system-ui, sans-serif";
      ctx.fillText(card.value, x + 22, 302);
      ctx.fillStyle = "#CBD5E1";
      ctx.font = "bold 14px monospace";
      ctx.fillText(card.label, x + 22, 338);
    });

    // Podium
    ctx.fillStyle = "#F3F4F7";
    ctx.font = "800 24px system-ui, sans-serif";
    ctx.fillText("Pódio atual", 64, 422);
    summary.podium.slice(0, 3).forEach((entry, idx) => {
      const y = 466 + idx * 42;
      ctx.fillStyle = idx === 0 ? "#FBBF24" : "#E2E8F0";
      ctx.font = "bold 22px monospace";
      const pts =
        summary.scoring_mode === "checkin"
          ? `${entry.total_points} chk`
          : `${entry.total_points} pts`;
      ctx.fillText(
        `${idx + 1}º  ${entry.display_name.slice(0, 26)}  ·  ${pts}  ·  ${entry.current_streak}d`,
        64,
        y,
      );
    });

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `brainrats-retrospectiva-${summary.challenge_id.slice(0, 8)}.png`;
    link.click();
  }

  return (
    <section
      aria-labelledby="wrapped-title"
      className="card-dark animate-reveal flex flex-col gap-4 p-5 shadow-raised"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="wrapped-title" className="flex items-center gap-2 text-base font-extrabold text-white">
          <Sparkles className="h-5 w-5 text-gold" aria-hidden="true" />
          Retrospectiva do desafio
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar retrospectiva"
          className="btn btn-sm btn-shell"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => setReloadSeq((n) => n + 1)} />
      ) : loading || !summary ? (
        <LoadingState label="Montando retrospectiva..." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-shell-raised p-3 ring-1 ring-white/10">
              <span className="block font-score text-2xl text-gold">{summary.total_checkins}</span>
              <span className="text-xs text-slate-300">estudos do grupo</span>
            </div>
            <div className="rounded-xl bg-shell-raised p-3 ring-1 ring-white/10">
              <span className="block font-score text-2xl text-emerald-300">
                {summary.participants_count}
              </span>
              <span className="text-xs text-slate-300">participantes</span>
            </div>
            <div className="rounded-xl bg-shell-raised p-3 ring-1 ring-white/10">
              <span className="block font-score text-2xl text-accent-soft">
                {summary.my_position ? `${summary.my_position}º` : "—"}
              </span>
              <span className="text-xs text-slate-300">sua posição</span>
            </div>
            <div className="rounded-xl bg-shell-raised p-3 ring-1 ring-white/10">
              <span className="block font-score text-2xl text-grape-soft">
                {summary.top_category_slug
                  ? CATEGORY_META[summary.top_category_slug]?.shortLabel ?? summary.top_category_slug
                  : "—"}
              </span>
              <span className="text-xs text-slate-300">frente mais ativa</span>
            </div>
          </div>

          {summary.podium.length > 0 && (
            <div className="rounded-xl bg-shell-raised p-3.5 ring-1 ring-white/10">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                <Trophy className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> Destaques do pódio
              </p>
              <ol className="space-y-1.5 text-sm">
                {summary.podium.map((entry, idx) => (
                  <li key={entry.user_id} className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-white">
                      {idx + 1}º {entry.display_name}{" "}
                      <span className="font-mono text-xs text-slate-400">@{entry.username}</span>
                    </span>
                    <span className="font-score text-base text-gold">
                      {entry.total_points} {summary.scoring_mode === "checkin" ? "chk" : "pts"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" onClick={handleDownloadPng} className="btn btn-sm btn-primary">
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Baixar card PNG para
              compartilhar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
