"use client";

import { ArrowRight, Code2, FolderGit2, Github, Lock, RefreshCw, Sparkles } from "lucide-react";
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
        className="flex flex-col gap-4 rounded-xl border border-[#DDD8CE] bg-white p-5"
      >
        <h3 className="font-bold text-[#0F1722]">Perfil e Contas Vinculadas</h3>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[#1E293B]">Nome de exibição</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[#1E293B]">Bio</span>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Fale sobre seus objetivos de estudo..."
            className="rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-sm text-[#0F1722] placeholder:text-[#64748B]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between gap-2 font-medium text-[#1E293B]">
            <span className="flex items-center gap-1.5">
              <Github className="h-4 w-4" /> GitHub Username (eventos públicos)
            </span>
            <span className="font-mono text-[11px] text-[#64748B]">
              {formatDateTimeBr(ghIntegration?.last_synced_at ?? null)}
            </span>
          </span>
          <input
            type="text"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
            placeholder="ex: iancostag"
            className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between gap-2 font-medium text-[#1E293B]">
            <span className="flex items-center gap-1.5">
              <Code2 className="h-4 w-4" /> LeetCode Username (Accepted)
            </span>
            <span className="font-mono text-[11px] text-[#64748B]">
              {formatDateTimeBr(lcIntegration?.last_synced_at ?? null)}
            </span>
          </span>
          <input
            type="text"
            value={leetcodeUsername}
            onChange={(e) => setLeetcodeUsername(e.target.value)}
            placeholder="ex: seu_usuario_lc"
            className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[#1E293B]">
            Desafio alvo da publicação automática
          </span>
          <select
            value={targetChallengeId}
            onChange={(e) => setTargetChallengeId(e.target.value)}
            className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722]"
          >
            {memberChallenges.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.title}
              </option>
            ))}
          </select>
        </label>

        {message && (
          <p role="status" aria-live="polite" className="text-xs font-semibold text-emerald-800">
            {message}
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
          className="min-h-11 w-fit rounded-lg bg-[#0F1722] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E293B] disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </form>

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border border-[#DDD8CE] bg-white p-5">
          <h3 className="font-bold text-[#0F1722]">Sincronização Automática</h3>
          <p className="text-sm leading-relaxed text-[#475569]">
            Importa apenas commits e submissões{" "}
            <code className="rounded bg-[#FAF9F6] px-1 py-0.5 font-mono text-xs text-[#0F1722]">
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
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#D94E28] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#C2411E] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncMode === "real" ? "animate-spin" : ""}`} />
              {syncMode === "real" ? "Sincronizando..." : "Sincronizar GitHub & LeetCode Agora"}
            </button>

            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleSync(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-4 py-2.5 text-sm font-semibold text-[#0F1722] hover:border-[#0F1722] disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-[#D94E28]" />
              {syncMode === "simulate" ? "Simulando..." : "Simular Check-in Automático"}
            </button>
          </div>

          {syncResult && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-3 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] p-4 text-xs text-[#334155]"
            >
              <p className="font-bold text-[#0F1722]">
                {syncResult.created_count} check-in(s) publicado(s) ·{" "}
                {syncResult.skipped_duplicates} duplicado(s) ignorado(s)
              </p>
              <ul className="list-disc space-y-1 pl-4 text-[#475569]">
                {syncResult.details.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onGoToActive}
                className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-lg bg-[#0F1722] px-3 py-1.5 font-semibold text-white hover:bg-[#1E293B]"
              >
                Ver no feed do desafio <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-[#DDD8CE] bg-white p-5">
          <h3 className="flex items-center gap-2 font-bold text-[#0F1722]">
            <FolderGit2 className="h-4 w-4 text-[#D94E28]" />
            Repositórios Monitorados (GitHub OAuth)
          </h3>

          {user.has_github_oauth ? (
            <>
              <p className="text-xs text-[#475569]">
                Selecione quais repositórios (inclusive privados) devem gerar check-ins de
                Continuidade de Projeto ao sincronizar.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loadingRepos}
                  onClick={() => void handleLoadRepos()}
                  className="min-h-10 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-1.5 text-xs font-semibold text-[#0F1722] hover:border-[#0F1722]"
                >
                  {loadingRepos ? "Carregando..." : "Carregar meus repositórios"}
                </button>
                {repos.length > 0 && (
                  <button
                    type="button"
                    disabled={savingRepos}
                    onClick={() => void handleSaveRepos()}
                    className="min-h-10 rounded-lg bg-[#0F1722] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {savingRepos ? "Salvando..." : "Salvar seleção"}
                  </button>
                )}
              </div>

              {repos.length > 0 && (
                <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] p-2.5">
                  {repos.map((repo, idx) => (
                    <label
                      key={repo.github_repo_id}
                      className="flex min-h-8 items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-white"
                    >
                      <span className="flex items-center gap-2 font-mono text-[#0F1722]">
                        <input
                          type="checkbox"
                          checked={repo.is_monitored}
                          onChange={(e) => {
                            const next = [...repos];
                            next[idx] = { ...repo, is_monitored: e.target.checked };
                            setRepos(next);
                          }}
                          className="h-4 w-4 accent-[#D94E28]"
                        />
                        {repo.full_name}
                      </span>
                      {repo.private && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-[#334155]">
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
            <div className="flex flex-col gap-2 text-xs text-[#475569]">
              <p>
                Conecte sua conta via GitHub OAuth para escolher repositórios específicos
                (públicos ou privados) no monitoramento.
              </p>
              <a
                href={getGithubOAuthUrl()}
                className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg bg-[#0F1722] px-3 py-2 font-semibold text-white"
              >
                <Github className="h-4 w-4" /> Conectar via GitHub OAuth
              </a>
            </div>
          ) : (
            <p className="text-xs text-[#475569]">
              Configure <code className="font-mono">GITHUB_CLIENT_ID</code> e{" "}
              <code className="font-mono">GITHUB_CLIENT_SECRET</code> no backend para liberar
              login OAuth e seleção de repositórios privados.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
