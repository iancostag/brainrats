"use client";

import { ArrowRight, Code2, Github, RefreshCw, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  syncIntegrations,
  updateProfile,
  type ChallengeListItem,
  type SyncResponse,
  type User,
} from "@/lib/api";
import { formatDateTimeBr } from "@/lib/categories";

interface IntegrationsTabProps {
  user: User;
  challenges: ChallengeListItem[];
  onUserUpdated: (user: User) => void;
  onSynced: () => Promise<void>;
  onGoToActive: () => void;
}

export function IntegrationsTab({
  user,
  challenges,
  onUserUpdated,
  onSynced,
  onGoToActive,
}: IntegrationsTabProps) {
  const ghIntegration = user.integrations.find((i) => i.provider === "github");
  const lcIntegration = user.integrations.find((i) => i.provider === "leetcode");
  const memberChallenges = challenges.filter((c) => c.is_member);

  const [displayName, setDisplayName] = useState(user.display_name);
  const [githubUsername, setGithubUsername] = useState(
    ghIntegration?.external_username ?? "",
  );
  const [leetcodeUsername, setLeetcodeUsername] = useState(
    lcIntegration?.external_username ?? "",
  );
  const [targetChallengeId, setTargetChallengeId] = useState(
    ghIntegration?.target_challenge_id ??
      lcIntegration?.target_challenge_id ??
      memberChallenges[0]?.id ??
      "",
  );

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persistSettings() {
    const updated = await updateProfile({
      display_name: displayName.trim() || undefined,
      github_username: githubUsername.trim() || undefined,
      leetcode_username: leetcodeUsername.trim() || undefined,
      target_challenge_id: targetChallengeId || null,
    });
    onUserUpdated(updated);
    return updated;
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await persistSettings();
      setMessage("Integrações e perfil atualizados!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync(simulate: boolean) {
    setError(null);
    setMessage(null);
    setSyncing(true);
    try {
      // Save unsaved integration fields automatically so the user doesn't have to remember saving first.
      if (!simulate) {
        await persistSettings();
      }
      const result = await syncIntegrations({
        simulate,
        challenge_id: targetChallengeId || undefined,
      });
      setSyncResult(result);
      await onSynced();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na sincronização.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5"
      >
        <h3 className="font-semibold text-zinc-100">Perfil e Contas Vinculadas</h3>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-300">Nome de exibição</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between gap-2 text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Github className="h-4 w-4" /> GitHub Username (eventos públicos)
            </span>
            <span className="text-[11px] text-zinc-500">
              {formatDateTimeBr(ghIntegration?.last_synced_at ?? null)}
            </span>
          </span>
          <input
            type="text"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
            placeholder="ex: iancostag"
            className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between gap-2 text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Code2 className="h-4 w-4" /> LeetCode Username (Accepted)
            </span>
            <span className="text-[11px] text-zinc-500">
              {formatDateTimeBr(lcIntegration?.last_synced_at ?? null)}
            </span>
          </span>
          <input
            type="text"
            value={leetcodeUsername}
            onChange={(e) => setLeetcodeUsername(e.target.value)}
            placeholder="ex: seu_usuario_lc"
            className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-300">Desafio alvo da publicação automática</span>
          <select
            value={targetChallengeId}
            onChange={(e) => setTargetChallengeId(e.target.value)}
            className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          >
            {memberChallenges.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.title}
              </option>
            ))}
          </select>
        </label>

        {message && (
          <p role="status" aria-live="polite" className="text-xs text-emerald-400">
            {message}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="min-h-11 w-fit rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </form>

      <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
        <h3 className="font-semibold text-zinc-100">Sincronização Automática</h3>
        <p className="text-sm leading-relaxed text-zinc-400">
          Busca os últimos commits públicos do GitHub e submissões{" "}
          <code className="font-mono text-zinc-200">Accepted</code> do LeetCode, publicando
          automaticamente no desafio alvo (com deduplicação por evento). Depois você pode editar
          título e notas direto no feed.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleSync(false)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar GitHub & LeetCode Agora
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleSync(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-emerald-500/50"
          >
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Simular Check-in Automático
          </button>
        </div>

        {syncResult && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300"
          >
            <p className="font-semibold text-emerald-400">
              {syncResult.created_count} check-in(s) publicado(s) · {syncResult.skipped_duplicates}{" "}
              duplicado(s) ignorado(s)
            </p>
            <ul className="list-disc space-y-1 pl-4 text-zinc-400">
              {syncResult.details.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onGoToActive}
              className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-300 hover:bg-emerald-500/20"
            >
              Ver no feed do desafio <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
