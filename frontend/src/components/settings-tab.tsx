"use client";

import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  Github,
  Globe,
  KeyRound,
  LogOut,
  Moon,
  Plug,
  Settings,
  ShieldAlert,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { BadgeArtwork } from "@/components/badge-artwork";
import { useTheme } from "@/components/theme-toggle";
import { Avatar, Notice, PageHeader } from "@/components/ui";
import {
  changePassword,
  clearStoredToken,
  deleteAccount,
  disconnectIntegration,
  fetchAuthProviders,
  fetchMyBadges,
  fetchVapidPublicKey,
  getPublicBadgeSvgUrl,
  logoutAllSessions,
  requestGithubOAuthLinkUrl,
  setStoredToken,
  subscribePush,
  updateProfile,
  type User,
  type UserBadge,
} from "@/lib/api";

interface SettingsTabProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onOpenIntegrations?: () => void;
  onLogout: () => void;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}

export function SettingsTab({
  user,
  onUserUpdated,
  onOpenIntegrations,
  onLogout,
}: SettingsTabProps) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? "");
  const [isPublic, setIsPublic] = useState(Boolean(user.is_public_profile));
  const [notifyStreak, setNotifyStreak] = useState(Boolean(user.notify_streak_reminder));
  const [notifySocial, setNotifySocial] = useState(user.notify_social ?? true);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdNotice, setPwdNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [githubOAuthEnabled, setGithubOAuthEnabled] = useState(false);
  const [linkingOAuth, setLinkingOAuth] = useState(false);
  const [disconnecting, setDisconnecting] = useState<"github" | "leetcode" | null>(null);
  const [accountNotice, setAccountNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pushNotice, setPushNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedBadge, setCopiedBadge] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const { theme, setTheme } = useTheme();
  const ghIntegration = user.integrations.find((i) => i.provider === "github");
  const lcIntegration = user.integrations.find((i) => i.provider === "leetcode");

  useEffect(() => {
    fetchAuthProviders()
      .then((p) => setGithubOAuthEnabled(p.github_oauth_enabled))
      .catch(() => {});
    fetchMyBadges()
      .then(setBadges)
      .catch(() => {});
  }, []);

  async function handleSelectGithubAvatar() {
    setAvatarBusy(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await updateProfile({ use_github_avatar: true });
      setAvatarUrl(updated.avatar_url ?? "");
      onUserUpdated(updated);
      setMessage("Foto do GitHub aplicada ao perfil!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aplicar a foto do GitHub.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSelectBadgeAvatar(badgeKey: string) {
    const nextUrl = `/badges/${badgeKey}.png`;
    setAvatarBusy(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await updateProfile({ avatar_url: nextUrl });
      setAvatarUrl(updated.avatar_url ?? nextUrl);
      onUserUpdated(updated);
      setMessage("Conquista aplicada como foto de perfil!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aplicar a conquista.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await updateProfile({
        display_name: displayName.trim() || undefined,
        bio,
        avatar_url: avatarUrl.trim(),
        is_public_profile: isPublic,
        notify_streak_reminder: notifyStreak,
        notify_social: notifySocial,
      });
      onUserUpdated(updated);
      setMessage("Perfil e preferências atualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    setPwdBusy(true);
    setPwdNotice(null);
    try {
      const res = await changePassword({
        current_password: user.has_password ? currentPassword : undefined,
        new_password: newPassword,
      });
      setStoredToken(res.access_token);
      onUserUpdated(res.user);
      setCurrentPassword("");
      setNewPassword("");
      setPwdNotice({
        ok: true,
        text: "Senha atualizada! Sessões em outros dispositivos foram revogadas.",
      });
    } catch (err) {
      setPwdNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Não foi possível atualizar a senha.",
      });
    } finally {
      setPwdBusy(false);
    }
  }

  async function handleLogoutAll() {
    try {
      await logoutAllSessions();
    } catch {
      // Clear local session regardless.
    }
    clearStoredToken();
    onLogout();
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      clearStoredToken();
      onLogout();
    } catch (err) {
      setAccountNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao excluir conta.",
      });
      setDeletingAccount(false);
      setConfirmDeleteAccount(false);
    }
  }

  async function handleEnableBrowserPush() {
    setPushNotice(null);
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushNotice({ ok: false, text: "Seu navegador não suporta Web Push." });
      return;
    }
    try {
      const vapid = await fetchVapidPublicKey();
      if (!vapid.enabled || !vapid.public_key) {
        setPushNotice({
          ok: false,
          text: "Chaves VAPID ainda não configuradas no servidor. Suas preferências continuam salvas.",
        });
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushNotice({ ok: false, text: "Permissão de notificação negada no navegador." });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const appServerKey = urlBase64ToUint8Array(vapid.public_key);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey.buffer as ArrayBuffer,
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Assinatura push incompleta.");
      }
      await subscribePush({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      setPushNotice({ ok: true, text: "Notificações push ativadas neste dispositivo!" });
    } catch (err) {
      setPushNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Não foi possível ativar notificações push.",
      });
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

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/u/${user.username}`
      : `/u/${user.username}`;
  const readmeSnippet = `[![BrainRats](${getPublicBadgeSvgUrl(user.username)})](${publicUrl})`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Settings}
        title="Configurações"
        description="Perfil, privacidade pública, senha, notificações push e sessão."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex flex-col gap-6">
          <form
            onSubmit={handleSave}
            className="card flex flex-col gap-4 p-5"
            aria-labelledby="profile-title"
          >
            <h2 id="profile-title" className="section-title">
              <UserRound className="h-5 w-5 text-accent-text" aria-hidden="true" />
              Perfil e Privacidade
            </h2>

            <div className="flex items-center gap-3 rounded-2xl border border-lane bg-well p-3">
              <Avatar name={user.display_name} src={avatarUrl || user.avatar_url} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-bold text-ink-strong">{user.display_name}</p>
                <p className="truncate font-mono text-xs text-ink-muted">@{user.username}</p>
                {user.email && <p className="truncate text-xs text-ink-2">{user.email}</p>}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
                URL do avatar (opcional)
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://... ou /badges/..."
                  className="field"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-lane bg-well p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-ink-strong">Foto de perfil rápida</p>
                  <p className="text-[11px] text-ink-2">
                    Escolha usar sua foto do GitHub ou uma das conquistas que você já desbloqueou.
                  </p>
                </div>
                {ghIntegration ? (
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={handleSelectGithubAvatar}
                    className="btn btn-sm btn-secondary"
                  >
                    <Github className="h-3.5 w-3.5" aria-hidden="true" />
                    Usar foto do GitHub
                  </button>
                ) : (
                  <span className="text-[11px] text-ink-muted">
                    Conecte o GitHub abaixo para usar sua foto do GitHub.
                  </span>
                )}
              </div>

              {badges.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {badges.map((badge) => {
                    const badgePath = `/badges/${badge.badge_key}.png`;
                    const selected = avatarUrl === badgePath;
                    return (
                      <button
                        key={badge.badge_key}
                        type="button"
                        disabled={avatarBusy}
                        onClick={() => handleSelectBadgeAvatar(badge.badge_key)}
                        title={`Usar conquista "${badge.title}" como foto`}
                        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                          selected
                            ? "border-accent bg-accent/12 text-accent-text ring-1 ring-accent/30"
                            : "border-lane bg-card text-ink-strong hover:border-grape/50"
                        }`}
                      >
                        <BadgeArtwork badgeKey={badge.badge_key} icon={badge.icon} size="sm" />
                        <span>{badge.title}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-ink-muted">
                  Desbloqueie conquistas nos desafios para usá-las como foto de perfil.
                </p>
              )}
            </div>

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

            <div className="flex flex-col gap-2.5 rounded-2xl bg-well p-3.5 ring-1 ring-lane-soft">
              <label className="flex items-start gap-2.5 text-xs text-ink-3">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-accent"
                />
                <span>
                  <strong className="font-semibold text-ink-strong">
                    Ativar perfil público e badge SVG para GitHub README
                  </strong>
                  <span className="block text-ink-2">
                    Exibe seu heatmap, total de estudos e conquistas em{" "}
                    <code className="font-mono">/u/{user.username}</code> (nunca mostra e-mail nem
                    grupos privados).
                  </span>
                </span>
              </label>

              {isPublic && (
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <a
                    href={`/u/${user.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-secondary"
                  >
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" /> Abrir perfil público
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(readmeSnippet);
                      setCopiedBadge(true);
                      setTimeout(() => setCopiedBadge(false), 1800);
                    }}
                    className="btn btn-sm btn-secondary"
                  >
                    {copiedBadge ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-success-text" aria-hidden="true" />{" "}
                        Snippet copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copiar badge README
                      </>
                    )}
                  </button>
                </div>
              )}

              <label className="flex items-start gap-2.5 text-xs text-ink-3">
                <input
                  type="checkbox"
                  checked={notifyStreak}
                  onChange={(e) => setNotifyStreak(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-accent"
                />
                <span>
                  <strong className="font-semibold text-ink-strong">
                    Lembrete diário “Salve sua ofensiva”
                  </strong>
                  <span className="block text-ink-2">
                    Avisa à noite caso você ainda não tenha registrado estudo nem descanso hoje.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-ink-3">
                <input
                  type="checkbox"
                  checked={notifySocial}
                  onChange={(e) => setNotifySocial(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-accent"
                />
                <span>
                  <strong className="font-semibold text-ink-strong">
                    Notificações sociais (comentários e cutucadas)
                  </strong>
                </span>
              </label>
            </div>

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

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving} className="btn btn-dark w-fit">
                {saving ? "Salvando..." : "Salvar perfil"}
              </button>
              <button
                type="button"
                onClick={() => void handleEnableBrowserPush()}
                className="btn btn-secondary w-fit"
              >
                <Bell className="h-4 w-4" aria-hidden="true" /> Ativar Push neste navegador
              </button>
            </div>

            {pushNotice && (
              <Notice
                tone={pushNotice.ok ? "success" : "rest"}
                onDismiss={() => setPushNotice(null)}
              >
                {pushNotice.text}
              </Notice>
            )}
          </form>

          <section
            className="card flex flex-col gap-4 p-5"
            aria-labelledby="linked-accounts-title"
          >
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
                    <Code2 className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />{" "}
                    LeetCode
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
            <div
              role="group"
              aria-label="Tema"
              className="segmented grid-cols-2 bg-well ring-1 ring-lane-soft"
            >
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

          <form
            onSubmit={handleChangePassword}
            className="card flex flex-col gap-3 p-5"
            aria-labelledby="password-title"
          >
            <h2 id="password-title" className="section-title">
              <KeyRound className="h-5 w-5 text-accent-text" aria-hidden="true" />
              {user.has_password ? "Alterar senha" : "Definir senha"}
            </h2>
            {user.has_password && (
              <label className="field-label">
                Senha atual
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="field"
                  required
                />
              </label>
            )}
            <label className="field-label">
              Nova senha (mín. 6 caracteres)
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="field"
                required
              />
            </label>
            {pwdNotice && (
              <Notice
                tone={pwdNotice.ok ? "success" : "error"}
                onDismiss={() => setPwdNotice(null)}
              >
                {pwdNotice.text}
              </Notice>
            )}
            <button type="submit" disabled={pwdBusy} className="btn btn-sm btn-dark w-fit">
              {pwdBusy ? "Atualizando..." : "Salvar senha"}
            </button>
          </form>

          <section className="card flex flex-col gap-3 p-5" aria-labelledby="session-title">
            <h2 id="session-title" className="section-title">
              Sessão e Conta
            </h2>
            <p className="text-xs text-ink-2">Gerencie o acesso ou encerre sua conta (LGPD).</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onLogout}
                className="btn btn-sm btn-secondary text-red-800 hover:border-red-600/40 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" /> Sair da conta
              </button>
              <button
                type="button"
                onClick={() => void handleLogoutAll()}
                className="btn btn-sm btn-secondary"
              >
                Encerrar todas as sessões
              </button>
            </div>

            <div className="border-t border-lane-soft pt-3">
              {!confirmDeleteAccount ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAccount(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-800 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Excluir minha conta
                  permanentemente
                </button>
              ) : (
                <div className="flex flex-col gap-2 rounded-xl border border-red-600/30 bg-red-50 p-3 text-xs text-red-950">
                  <p className="flex items-start gap-1.5 font-semibold">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                    Esta ação apaga sua conta, integrações e histórico de forma irreversível.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={deletingAccount}
                      onClick={() => void handleDeleteAccount()}
                      className="btn btn-sm bg-red-700 text-white hover:bg-red-700/90"
                    >
                      {deletingAccount ? "Excluindo..." : "Sim, excluir conta"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAccount(false)}
                      className="btn btn-sm btn-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
