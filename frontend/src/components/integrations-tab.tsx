"use client";

import { ArrowRight, Check, Code2, FolderGit2, Github, Lock, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import {
  fetchAuthProviders,
  fetchGithubRepos,
  getGithubOAuthUrl,
  saveMonitoredRepos,
  syncIntegrations,
  updateProfile,
  type ChallengeListItem,
  type GitHubRepoItem,
  type SyncResponse,
  type User,
} from "@/lib/api";
import { formatDateTimeBr } from "@/lib/categories";

// Ferramentas de teste (simulação de sync, avisos de configuração) só aparecem no `next dev`.
const IS_DEV = process.env.NODE_ENV === "development";

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
  const [bio, setBio] = useState(user.bio ?? "");
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

  const [githubOAuthEnabled, setGithubOAuthEnabled] = useState(false);
  const [repos, setRepos] = useState<GitHubRepoItem[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [savingRepos, setSavingRepos] = useState(false);
  const [repoMessage, setRepoMessage] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [syncMode, setSyncMode] = useState<"real" | "simulate" | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncing = syncMode !== null;

  useEffect(() => {
    fetchAuthProviders()
      .then((p) => setGithubOAuthEnabled(p.github_oauth_enabled))
      .catch(() => {});
  }, []);

  async function handleLoadRepos() {
    setLoadingRepos(true);
    setRepoMessage(null);
    setError(null);
    try {
      const list = await fetchGithubRepos();
      setRepos(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar repositórios.");
    } finally {
      setLoadingRepos(false);
    }
  }

  async function handleSaveRepos() {
    setSavingRepos(true);
    setRepoMessage(null);
    setError(null);
    try {
      const selected = repos.filter((r) => r.is_monitored);
      await saveMonitoredRepos({
        target_challenge_id: targetChallengeId || null,
        repos: selected.map((r) => ({
          github_repo_id: r.github_repo_id,
          full_name: r.full_name,
          default_branch: r.default_branch,
        })),
      });
      setRepoMessage(`${selected.length} repositório(s) monitorado(s) salvo(s)!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar repositórios.");
    } finally {
      setSavingRepos(false);
    }
  }

  async function persistSettings() {
    const updated = await updateProfile({
      display_name: displayName.trim() || undefined,
      bio,
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
    setSyncMode(simulate ? "simulate" : "real");
    try {
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
      setSyncMode(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-4 rounded-xl border border-lane bg-card p-5"
      >
        <h3 className="font-bold text-ink-strong">Perfil e Contas Vinculadas</h3>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-label">Nome de exibição</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="min-h-11 rounded-lg border border-lane bg-well px-3 py-2 text-ink-strong"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-label">Bio</span>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Fale sobre seus objetivos de estudo..."
            className="rounded-lg border border-lane bg-well px-3 py-2 text-sm text-ink-strong placeholder:text-ink-muted"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between gap-2 font-medium text-ink-label">
            <span className="flex items-center gap-1.5">
              <Github className="h-4 w-4" /> GitHub Username (eventos públicos)
            </span>
            <span className="font-mono text-[11px] text-ink-muted">
              {formatDateTimeBr(ghIntegration?.last_synced_at ?? null)}
            </span>
          </span>
          <input
            type="text"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
            placeholder="ex: iancostag"
            className="min-h-11 rounded-lg border border-lane bg-well px-3 py-2 text-ink-strong"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between gap-2 font-medium text-ink-label">
            <span className="flex items-center gap-1.5">
              <Code2 className="h-4 w-4" /> LeetCode Username (Accepted)
            </span>
            <span className="font-mono text-[11px] text-ink-muted">
              {formatDateTimeBr(lcIntegration?.last_synced_at ?? null)}
            </span>
          </span>
          <input
            type="text"
            value={leetcodeUsername}
            onChange={(e) => setLeetcodeUsername(e.target.value)}
            placeholder="ex: seu_usuario_lc"
            className="min-h-11 rounded-lg border border-lane bg-well px-3 py-2 text-ink-strong"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-label">
            Desafio alvo da publicação automática
          </span>
          <select
            value={targetChallengeId}
            disabled={memberChallenges.length === 0}
            onChange={(e) => setTargetChallengeId(e.target.value)}
            className="min-h-11 rounded-lg border border-lane bg-well px-3 py-2 text-ink-strong disabled:opacity-60"
          >
            {memberChallenges.length === 0 ? (
              <option value="">Entre em um desafio primeiro</option>
            ) : (
              memberChallenges.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title}
                </option>
              ))
            )}
          </select>
        </label>

        {message && (
          <p
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800"
          >
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>{message}</span>
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-600/35 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="min-h-11 w-fit rounded-lg bg-action px-4 py-2 text-sm font-bold text-white hover:bg-action-hover disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </form>

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border border-lane bg-card p-5">
          <h3 className="font-bold text-ink-strong">Sincronização Automática</h3>
          <p className="text-sm leading-relaxed text-ink-2">
            Importa apenas commits e submissões{" "}
            <code className="rounded bg-well px-1 py-0.5 font-mono text-xs text-ink-strong">
              Accepted
            </code>{" "}
            feitos <strong>hoje</strong> no fuso do desafio (com deduplicação por evento). Depois
            você pode editar título e notas direto no feed.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleSync(false)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncMode === "real" ? "animate-spin" : ""}`} />
              {syncMode === "real" ? "Sincronizando..." : "Sincronizar GitHub & LeetCode Agora"}
            </button>

            {IS_DEV && (
            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleSync(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-lane bg-well px-4 py-2.5 text-sm font-semibold text-ink-strong hover:border-ink-strong disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-accent-text" />
              {syncMode === "simulate" ? "Simulando..." : "Simular check-in automático (dev)"}
            </button>
            )}
          </div>

          {syncResult && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-3 rounded-lg border border-lane bg-well p-4 text-xs text-ink-3"
            >
              <p className="font-bold text-ink-strong">
                {syncResult.created_count} check-in(s) publicado(s) ·{" "}
                {syncResult.skipped_duplicates} duplicado(s) ignorado(s)
              </p>
              <ul className="list-disc space-y-1 pl-4 text-ink-2">
                {syncResult.details.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onGoToActive}
                className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-lg bg-action px-3 py-1.5 font-semibold text-white hover:bg-action-hover"
              >
                Ver no feed do desafio <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </section>

        {(user.has_github_oauth || githubOAuthEnabled || IS_DEV) && (
        <section className="flex flex-col gap-3 rounded-xl border border-lane bg-card p-5">
          <h3 className="flex items-center gap-2 font-bold text-ink-strong">
            <FolderGit2 className="h-4 w-4 text-accent-text" />
            Repositórios Monitorados (GitHub OAuth)
          </h3>

          {user.has_github_oauth ? (
            <>
              <p className="text-xs text-ink-2">
                Selecione quais repositórios (inclusive privados) devem gerar check-ins de
                Continuidade de Projeto ao sincronizar.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loadingRepos}
                  onClick={() => void handleLoadRepos()}
                  className="min-h-10 rounded-lg border border-lane bg-well px-3 py-1.5 text-xs font-semibold text-ink-strong hover:border-ink-strong"
                >
                  {loadingRepos ? "Carregando..." : "Carregar meus repositórios"}
                </button>
                {repos.length > 0 && (
                  <button
                    type="button"
                    disabled={savingRepos}
                    onClick={() => void handleSaveRepos()}
                    className="min-h-10 rounded-lg bg-action px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {savingRepos ? "Salvando..." : "Salvar seleção"}
                  </button>
                )}
              </div>

              {repos.length > 0 && (
                <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-lane bg-well p-2.5">
                  {repos.map((repo, idx) => (
                    <label
                      key={repo.github_repo_id}
                      className="flex min-h-8 items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-card"
                    >
                      <span className="flex items-center gap-2 font-mono text-ink-strong">
                        <input
                          type="checkbox"
                          checked={repo.is_monitored}
                          onChange={(e) => {
                            const next = [...repos];
                            next[idx] = { ...repo, is_monitored: e.target.checked };
                            setRepos(next);
                          }}
                          className="h-4 w-4 accent-accent"
                        />
                        {repo.full_name}
                      </span>
                      {repo.private && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-ink-3">
                          <Lock className="h-2.5 w-2.5" /> privado
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              {repoMessage && (
                <p role="status" className="text-xs font-semibold text-emerald-800">
                  {repoMessage}
                </p>
              )}
            </>
          ) : githubOAuthEnabled ? (
            <div className="flex flex-col gap-2 text-xs text-ink-2">
              <p>
                Conecte sua conta via GitHub OAuth para escolher repositórios específicos
                (públicos ou privados) no monitoramento.
              </p>
              <a
                href={getGithubOAuthUrl()}
                className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg bg-action px-3 py-2 font-semibold text-white"
              >
                <Github className="h-4 w-4" /> Conectar via GitHub OAuth
              </a>
            </div>
          ) : (
            <p className="text-xs text-ink-2">
              Configure <code className="font-mono">GITHUB_CLIENT_ID</code> e{" "}
              <code className="font-mono">GITHUB_CLIENT_SECRET</code> no backend para liberar
              login OAuth e seleção de repositórios privados. Este aviso só aparece em
              desenvolvimento.
            </p>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
