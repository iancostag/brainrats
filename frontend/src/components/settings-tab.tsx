"use client";

import { LogOut, Moon, Settings, Sun, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useTheme } from "@/components/theme-toggle";
import { Avatar, Notice, PageHeader } from "@/components/ui";
import { updateProfile, type User } from "@/lib/api";

interface SettingsTabProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
}

/** Perfil (nome e bio), aparência e sessão. Contas externas ficam em Integrações. */
export function SettingsTab({ user, onUserUpdated, onLogout }: SettingsTabProps) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [bio, setBio] = useState(user.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Settings} title="Configurações" description="Seu perfil, aparência e sessão." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form onSubmit={handleSave} className="card flex flex-col gap-4 p-5" aria-labelledby="profile-title">
          <h2 id="profile-title" className="section-title">
            <UserRound className="h-5 w-5 text-accent-text" aria-hidden="true" />
            Perfil
          </h2>

          <div className="flex items-center gap-3 rounded-2xl bg-well p-3">
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
