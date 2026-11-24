"use client";

import { Award, ExternalLink, Flame, ListChecks, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { BadgeArtwork } from "@/components/badge-artwork";
import { ConsistencyHeatmap } from "@/components/consistency-heatmap";
import { CategoryIcon } from "@/components/lane-badge";
import { Avatar, ErrorState, LoadingState } from "@/components/ui";
import { fetchMemberProfile, type PublicProfile } from "@/lib/api";
import { CATEGORY_LIST } from "@/lib/categories";

interface UserProfileModalProps {
  username: string | null;
  currentUsername: string;
  onClose: () => void;
  onEditOwnProfile?: () => void;
}

/**
 * Exibe o perfil de qualquer colega do grupo (ou o próprio):
 * no desktop abre como modal centralizado; no celular abre como bottom sheet.
 */
export function UserProfileModal({
  username,
  currentUsername,
  onClose,
  onEditOwnProfile,
}: UserProfileModalProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadSeq, setReloadSeq] = useState(0);

  useEffect(() => {
    if (!username) return;
    let active = true;
    setLoading(true);
    setError(null);
    setProfile(null);
    fetchMemberProfile(username)
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Não foi possível carregar este perfil.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username, reloadSeq]);

  useEffect(() => {
    if (!username) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [username, onClose]);

  if (!username) return null;

  const isOwn = username.toLowerCase() === currentUsername.toLowerCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Perfil de @${username}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div className="relative flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl border border-lane bg-canvas p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[85vh] sm:max-w-2xl sm:rounded-3xl sm:p-6">
        {/* Alça visual do bottom sheet no celular */}
        <div className="mx-auto mb-1 h-1.5 w-12 shrink-0 rounded-full bg-lane-strong sm:hidden" />

        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">
            {isOwn ? "Seu perfil" : "Perfil do atleta"}
          </span>
          <div className="flex items-center gap-2">
            {isOwn && onEditOwnProfile && (
              <button
                type="button"
                onClick={onEditOwnProfile}
                className="btn btn-sm btn-secondary"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Editar perfil
              </button>
            )}
            {profile?.is_public_profile && (
              <Link
                href={`/u/${profile.username}`}
                className="btn btn-sm btn-secondary"
                onClick={onClose}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Página pública
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar perfil"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-lane bg-card text-ink-2 transition-colors hover:border-lane-strong hover:text-ink-strong"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingState label={`Carregando @${username}...`} />
        ) : error || !profile ? (
          <ErrorState
            message={error ?? "Perfil indisponível."}
            onRetry={() => setReloadSeq((n) => n + 1)}
          />
        ) : (
          <>
            <section className="card-dark flex flex-col gap-4 p-5 shadow-raised sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar name={profile.display_name} src={profile.avatar_url} size="lg" />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-extrabold text-white">
                    {profile.display_name}
                  </h2>
                  <p className="truncate font-mono text-xs text-slate-400">@{profile.username}</p>
                  {profile.bio && (
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{profile.bio}</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 gap-2.5">
                <div className="rounded-xl bg-shell-raised px-3.5 py-2 text-center ring-1 ring-white/10">
                  <span className="flex items-center justify-center gap-1 font-score text-xl text-gold">
                    <Flame className="h-4 w-4 text-accent-bright" aria-hidden="true" />
                    {profile.current_streak}d
                  </span>
                  <span className="text-[11px] text-slate-300">ofensiva</span>
                </div>
                <div className="rounded-xl bg-shell-raised px-3.5 py-2 text-center ring-1 ring-white/10">
                  <span className="flex items-center justify-center gap-1 font-score text-xl text-emerald-300">
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                    {profile.total_studies}
                  </span>
                  <span className="text-[11px] text-slate-300">estudos</span>
                </div>
              </div>
            </section>

            <ConsistencyHeatmap
              days={profile.heatmap}
              totalActiveDays={profile.total_active_days}
              currentStreak={profile.current_streak}
              longestStreak={profile.longest_streak}
              weeks={16}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="card p-4">
                <h3 className="section-title mb-3 text-sm">Por categoria</h3>
                <ul className="space-y-2 text-sm">
                  {CATEGORY_LIST.map((cat) => {
                    const count = profile.by_category[cat.slug] ?? 0;
                    return (
                      <li key={cat.slug} className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-ink-3">
                          <CategoryIcon slug={cat.slug} />
                          {cat.label}
                        </span>
                        <span className="font-score text-base text-ink-strong">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="card p-4">
                <h3 className="section-title mb-3 text-sm">
                  <Award className="h-4 w-4 text-grape" aria-hidden="true" />
                  Conquistas ({profile.badges.length})
                </h3>
                {profile.badges.length === 0 ? (
                  <p className="text-xs text-ink-2">Nenhuma conquista desbloqueada ainda.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {profile.badges.map((badge) => (
                      <li
                        key={badge.badge_key}
                        title={badge.description}
                        className="inline-flex items-center gap-1.5 rounded-full bg-grape/12 py-1 pr-2.5 pl-1.5 text-xs font-bold text-grape ring-1 ring-grape/25"
                      >
                        <BadgeArtwork badgeKey={badge.badge_key} icon={badge.icon} size="sm" />
                        {badge.title}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
