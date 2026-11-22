"use client";

import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Github,
  LogOut,
  Moon,
  Plug,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { useTheme } from "@/components/theme-toggle";
import { Avatar, Notice, PageHeader } from "@/components/ui";
import {
  disconnectIntegration,
  fetchAuthProviders,
  requestGithubOAuthLinkUrl,
  updateProfile,
  type User,
} from "@/lib/api";

interface SettingsTabProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onOpenIntegrations?: () => void;
  onLogout: () => void;
}

/** Perfil (nome e bio), resumo das contas vinculadas, aparência e sessão. */
export function SettingsTab({
  user,
  onUserUpdated,
  onOpenIntegrations,
  onLogout,
}: SettingsTabProps) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [bio, setBio] = useState(user.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [githubOAuthEnabled, setGithubOAuthEnabled] = useState(false);
  const [linkingOAuth, setLinkingOAuth] = useState(false);
  const [disconnecting, setDisconnecting] = useState<"github" | "leetcode" | null>(null);
  const [accountNotice, setAccountNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const { theme, setTheme } = useTheme();

  const ghIntegration = user.integrations.find((i) => i.provider === "github");
  const lcIntegration = user.integrations.find((i) => i.provider === "leetcode");

  useEffect(() => {
    fetchAuthProviders()
      .then((p) => setGithubOAuthEnabled(p.github_oauth_enabled))
      .catch(() => {});
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await updateProfile({
        display_name: displayName.trim() || undefined,
        bio,
      });
      onUserUpdated(updated);
      setMessage("Perfil atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkGithubOAuth() {
    setAccountNotice(null);
    setLinkingOAuth(true);
    try {
      const { url } = await requestGithubOAuthLinkUrl("settings");
      window.location.assign(url);
    } catch (err) {
      setAccountNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Não foi possível iniciar o GitHub OAuth.",
      });
      setLinkingOAuth(false);
    }
  }

  async function handleDisconnect(provider: "github" | "leetcode") {
    setAccountNotice(null);
    setDisconnecting(provider);
    try {
      const updated = await disconnectIntegration(provider);
      onUserUpdated(updated);
      setAccountNotice({
        ok: true,
        text:
          provider === "github"
            ? "Conta do GitHub desconectada."
            : "Usuário do LeetCode removido.",
      });
    } catch (err) {
      setAccountNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Não foi possível desconectar a conta.",
      });
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Settings} title="Configurações" description="Seu perfil, aparência e sessão." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <form onSubmit={handleSave} className="card flex flex-col gap-4 p-5" aria-labelledby="profile-title">
            <h2 id="profile-title" className="section-title">
              <UserRound className="h-5 w-5 text-accent-text" aria-hidden="true" />
              Perfil
            </h2>

            <div className="flex items-center gap-3 rounded-2xl border border-lane bg-well p-3">
              <Avatar name={user.display_name} src={user.avatar_url} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-bold text-ink-strong">{user.display_name}</p>
                <p className="truncate font-mono text-xs text-ink-muted">@{user.username}</p>
                {user.email && <p className="truncate text-xs text-ink-2">{user.email}</p>}
              </div>
            </div>

            <label className="field-label">
              Nome de exibição
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                className="field"
              />
            </label>

            <label className="field-label">
              Bio
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Fale sobre seus objetivos de estudo..."
                className="field py-2.5"
              />
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
              {saving ? "Salvando..." : "Salvar perfil"}
            </button>
          </form>

          <section className="card flex flex-col gap-4 p-5" aria-labelledby="linked-accounts-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="linked-accounts-title" className="section-title">
                <Plug className="h-5 w-5 text-accent-text" aria-hidden="true" />
                Contas conectadas
              </h2>
              {onOpenIntegrations && (
                <button
                  type="button"
                  onClick={onOpenIntegrations}
                  className="btn btn-sm btn-secondary"
                >
                  Editar em Integrações
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-lane bg-well p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-strong">
                      <Github className="h-4 w-4 shrink-0" aria-hidden="true" /> GitHub
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-ink-2">
                      {ghIntegration ? `@${ghIntegration.external_username}` : "Não conectado"}
                    </p>
                  </div>
                  {user.has_github_oauth && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900 ring-1 ring-emerald-700/20">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> OAuth
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {githubOAuthEnabled && !user.has_github_oauth && (
                    <button
                      type="button"
                      disabled={linkingOAuth}
                      onClick={() => void handleLinkGithubOAuth()}
                      className="btn btn-sm btn-dark"
                    >
                      <Github className="h-3.5 w-3.5" aria-hidden="true" />
                      {linkingOAuth ? "Redirecionando..." : "Conectar OAuth"}
                    </button>
                  )}
                  {ghIntegration && (
                    <button
                      type="button"
                      disabled={disconnecting === "github"}
                      onClick={() => void handleDisconnect("github")}
                      className="btn btn-sm btn-secondary text-red-800 hover:border-red-600/40"
                    >
                      {disconnecting === "github" ? "Removendo..." : "Desconectar"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-lane bg-well p-3.5">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-strong">
                    <Code2 className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" /> LeetCode
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-ink-2">
                    {lcIntegration ? lcIntegration.external_username : "Não configurado"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {onOpenIntegrations && (
                    <button
                      type="button"
                      onClick={onOpenIntegrations}
                      className="btn btn-sm btn-secondary"
                    >
                      {lcIntegration ? "Alterar" : "Configurar"}
                    </button>
                  )}
                  {lcIntegration && (
                    <button
                      type="button"
                      disabled={disconnecting === "leetcode"}
                      onClick={() => void handleDisconnect("leetcode")}
                      className="btn btn-sm btn-secondary text-red-800 hover:border-red-600/40"
                    >
                      {disconnecting === "leetcode" ? "Removendo..." : "Desconectar"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {accountNotice && (
              <Notice
                tone={accountNotice.ok ? "success" : "error"}
                onDismiss={() => setAccountNotice(null)}
              >
                {accountNotice.text}
              </Notice>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-3 p-5" aria-labelledby="appearance-title">
            <h2 id="appearance-title" className="section-title">
              Aparência
            </h2>
            <div role="group" aria-label="Tema" className="segmented grid-cols-2 bg-well ring-1 ring-lane-soft">
              {(
                [
                  { id: "light", label: "Claro", icon: Sun },
                  { id: "dark", label: "Escuro", icon: Moon },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTheme(opt.id)}
                    className={`segmented-item inline-flex items-center justify-center gap-1.5 ${
                      active
                        ? "bg-card text-ink-strong shadow-card ring-1 ring-lane"
                        : "text-ink-2 hover:text-ink-strong"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card flex flex-col gap-3 p-5" aria-labelledby="session-title">
            <h2 id="session-title" className="section-title">
              Sessão
            </h2>
            <p className="text-xs text-ink-2">Sai desta conta neste navegador.</p>
            <button
              type="button"
              onClick={onLogout}
              className="btn btn-secondary w-fit text-red-800 hover:border-red-600/40 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sair da conta
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
