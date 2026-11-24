"use client";

import { RefreshCw, ShieldAlert, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CheckinCard } from "@/components/checkin-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { fetchChallengeReports, type CheckIn, type ScoringMode } from "@/lib/api";

interface ModerationPanelProps {
  challengeId: string;
  currentUserId: string;
  scoringMode: ScoringMode;
  onClose: () => void;
  onModerated: (updated: CheckIn) => void;
}

export function ModerationPanel({
  challengeId,
  currentUserId,
  scoringMode,
  onClose,
  onModerated,
}: ModerationPanelProps) {
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");
  const [items, setItems] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchChallengeReports(challengeId, statusFilter);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar fila de moderação.");
    } finally {
      setLoading(false);
    }
  }, [challengeId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      aria-labelledby="moderation-panel-title"
      className="card animate-reveal overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lane-soft px-4 py-3.5 sm:px-5">
        <h2 id="moderation-panel-title" className="section-title">
          <ShieldAlert className="h-5 w-5 text-amber-700" aria-hidden="true" />
          Fila de moderação ({items.length})
        </h2>
        <div className="flex items-center gap-2">
          <div className="segmented grid-cols-2 bg-well ring-1 ring-lane-soft">
            {(
              [
                { id: "pending", label: "Pendentes" },
                { id: "all", label: "Todas" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={statusFilter === opt.id}
                onClick={() => setStatusFilter(opt.id)}
                className={`segmented-item ${
                  statusFilter === opt.id
                    ? "bg-card text-ink-strong shadow-card ring-1 ring-lane"
                    : "text-ink-2 hover:text-ink-strong"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Atualizar fila de moderação"
            className="btn btn-sm btn-secondary"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de moderação"
            className="btn btn-sm btn-ghost"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4">
          <ErrorState message={error} onRetry={() => void load()} />
        </div>
      ) : loading ? (
        <div className="p-4">
          <LoadingState label="Carregando denúncias..." />
        </div>
      ) : items.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={ShieldAlert} title="Nenhuma denúncia nesta fila">
            {statusFilter === "pending"
              ? "Tudo limpo por aqui — não há check-ins aguardando revisão."
              : "Ainda não houve denúncias neste desafio."}
          </EmptyState>
        </div>
      ) : (
        <div className="divide-y divide-lane-soft">
          {items.map((item) => (
            <CheckinCard
              key={item.id}
              checkin={item}
              currentUserId={currentUserId}
              isChallengeAdmin
              isMember
              scoringMode={scoringMode}
              onUpdated={(updated) => {
                onModerated(updated);
                void load();
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
