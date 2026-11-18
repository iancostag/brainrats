"use client";

import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Code2,
  FolderGit2,
  Github,
  Lock,
  Plug,
  RefreshCw,
  Sparkles,
} from "lucide-react";
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
  type Integration,
  type SyncResponse,
  type User,
} from "@/lib/api";
import { formatDateTimeBr } from "@/lib/categories";
import { Notice, PageHeader } from "@/components/ui";

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
      setMessage("Contas atualizadas!");
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

  const lastSynced = [ghIntegration?.last_synced_at, lcIntegration?.last_synced_at]
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Plug}
        title="Integrações"
        description="Conecte GitHub e LeetCode para publicar check-ins automaticamente."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSave}
          aria-labelledby="accounts-title"
          className="card flex flex-col gap-4 p-5"
        >
          <h2 id="accounts-title" className="section-title">
            Contas vinculadas
          </h2>

          <label className="field-label">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink-label">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-shell text-white">
                  <Github className="h-4 w-4" aria-hidden="true" />
                </span>
                GitHub (eventos públicos)
              </span>
              <IntegrationStatus integration={ghIntegration} />
            </span>
            <input
              type="text"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              placeholder="Ex.: iancostag"
              className="field"
            />
          </label>

          <label className="field-label">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink-label">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Code2 className="h-4 w-4" aria-hidden="true" />
                </span>
                LeetCode (Accepted)
              </span>
              <IntegrationStatus integration={lcIntegration} />
            </span>
            <input
              type="text"
              value={leetcodeUsername}
              onChange={(e) => setLeetcodeUsername(e.target.value)}
              placeholder="Ex.: seu_usuario_lc"
              className="field"
            />
          </label>

          <label className="field-label">
            Desafio alvo da publicação automática
            <select
              value={targetChallengeId}
              disabled={memberChallenges.length === 0}
              onChange={(e) => setTargetChallengeId(e.target.value)}
              className="field"
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
            <Notice tone="success" onDismiss={() => setMessage(null)}>
              {message}
            </Notice>
          )}
          {error && (
            <Notice tone="error" onDismiss={() => setError(null)}>
              {error}
            </Notice>
          )}

          <button type="submit" disabled={saving} className="btn btn-dark w-fit">
            {saving ? "Salvando..." : "Salvar contas"}
          </button>
        </form>

        <div className="flex flex-col gap-6">
          <section
            aria-labelledby="sync-title"
            className="card-dark relative flex flex-col gap-4 overflow-hidden p-5"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -bottom-16 h-44 w-44 rounded-full bg-accent-bright/20 blur-3xl"
            />
            <div className="relative flex items-start justify-between gap-3">
              <h2 id="sync-title" className="flex items-center gap-2 text-base font-extrabold">
                <RefreshCw className="h-5 w-5 text-accent-bright" aria-hidden="true" />
                Sincronização automática
              </h2>
              <span className="shrink-0 font-mono text-[11px] text-slate-400">
                Última: {formatDateTimeBr(lastSynced ?? null)}
              </span>
            </div>
            <p className="relative text-sm leading-relaxed text-slate-300">
              Importa apenas commits e submissões{" "}
              <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs text-white">
                Accepted
              </code>{" "}
              feitos <strong className="text-white">hoje</strong> no fuso do desafio, com
              deduplicação por evento. Depois você pode editar título e notas direto no feed.
            </p>

            <div className="relative flex flex-wrap gap-3">
              <button
                type="button"
                disabled={syncing}
                onClick={() => void handleSync(false)}
                className="btn btn-primary"
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncMode === "real" ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {syncMode === "real" ? "Sincronizando..." : "Sincronizar agora"}
              </button>

              {IS_DEV && (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void handleSync(true)}
                  className="btn btn-shell"
                >
                  <Sparkles className="h-4 w-4 text-accent-soft" aria-hidden="true" />
                  {syncMode === "simulate" ? "Simulando..." : "Simular check-in (dev)"}
                </button>
              )}
            </div>

            {syncResult && (
              <div
                role="status"
                aria-live="polite"
                className="animate-rise-in relative flex flex-col gap-3 rounded-xl bg-white/5 p-4 text-xs text-slate-300 ring-1 ring-white/10"
              >
                <p className="flex items-center gap-2 text-sm font-bold text-white">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  {syncResult.created_count} check-in(s) publicado(s) ·{" "}
                  {syncResult.skipped_duplicates} duplicado(s) ignorado(s)
                </p>
                {syncResult.details.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4">
                    {syncResult.details.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
                <button type="button" onClick={onGoToActive} className="btn btn-sm btn-shell w-fit">
                  Ver no feed do desafio <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </section>

          {(user.has_github_oauth || githubOAuthEnabled || IS_DEV) && (
            <section aria-labelledby="repos-title" className="card flex flex-col gap-3 p-5">
              <h2 id="repos-title" className="section-title">
                <FolderGit2 className="h-5 w-5 text-accent-text" aria-hidden="true" />
                Repositórios monitorados (GitHub OAuth)
              </h2>

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
                      className="btn btn-sm btn-secondary"
                    >
                      {loadingRepos ? "Carregando..." : "Carregar meus repositórios"}
                    </button>
                    {repos.length > 0 && (
                      <button
                        type="button"
                        disabled={savingRepos}
                        onClick={() => void handleSaveRepos()}
                        className="btn btn-sm btn-dark"
                      >
                        {savingRepos ? "Salvando..." : "Salvar seleção"}
                      </button>
                    )}
                  </div>

                  {repos.length > 0 && (
                    <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-well p-2 ring-1 ring-lane-soft">
                      {repos.map((repo, idx) => (
                        <label
                          key={repo.github_repo_id}
                          className="flex min-h-9 items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs hover:bg-card"
                        >
                          <span className="flex min-w-0 items-center gap-2 font-mono text-ink-strong">
                            <input
                              type="checkbox"
                              checked={repo.is_monitored}
                              onChange={(e) => {
                                const next = [...repos];
                                next[idx] = { ...repo, is_monitored: e.target.checked };
                                setRepos(next);
                              }}
                              className="h-4 w-4 shrink-0 accent-accent"
                            />
                            <span className="truncate">{repo.full_name}</span>
                          </span>
                          {repo.private && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-rest px-1.5 py-0.5 text-[10px] text-ink-3">
                              <Lock className="h-2.5 w-2.5" aria-hidden="true" /> privado
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                  {repoMessage && (
                    <Notice tone="success" onDismiss={() => setRepoMessage(null)}>
                      {repoMessage}
                    </Notice>
                  )}
                </>
              ) : githubOAuthEnabled ? (
                <div className="flex flex-col gap-2 text-xs text-ink-2">
                  <p>
                    Conecte sua conta via GitHub OAuth para escolher repositórios específicos
                    (públicos ou privados) no monitoramento.
                  </p>
                  <a href={getGithubOAuthUrl()} className="btn btn-sm btn-dark w-fit">
                    <Github className="h-4 w-4" aria-hidden="true" /> Conectar via GitHub OAuth
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
    </div>
  );
}

/** Estado da conta: conectada (com data do último sync) ou não conectada. */
function IntegrationStatus({ integration }: { integration: Integration | undefined }) {
  if (!integration) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-well px-2 py-0.5 text-[11px] font-medium text-ink-2 ring-1 ring-lane-soft">
        <CircleDashed className="h-3 w-3" aria-hidden="true" /> Não conectado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900 ring-1 ring-emerald-700/20">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      Conectado · {formatDateTimeBr(integration.last_synced_at)}
    </span>
  );
}
