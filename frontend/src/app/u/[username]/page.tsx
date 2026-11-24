"use client";

import { ArrowLeft, Award, Flame, ListChecks } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BadgeArtwork } from "@/components/badge-artwork";
import { ConsistencyHeatmap } from "@/components/consistency-heatmap";
import { CategoryIcon } from "@/components/lane-badge";
import { Avatar, ErrorState, LoadingState } from "@/components/ui";
import { fetchPublicProfile, type PublicProfile } from "@/lib/api";
import { CATEGORY_LIST } from "@/lib/categories";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = String(params?.username ?? "");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reloadSeq, setReloadSeq] = useState(0);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError(null);
    fetchPublicProfile(username)
      .then(setProfile)
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Perfil público não encontrado ou desativado.",
        ),
      )
      .finally(() => setLoading(false));
  }, [username, reloadSeq]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="btn btn-sm btn-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Voltar ao BrainRats
        </Link>
        <span className="font-extrabold tracking-tight text-ink-strong">
          Brain<span className="text-accent-text">Rats</span>
        </span>
      </div>

      {loading ? (
        <LoadingState label="Carregando perfil público..." />
      ) : error || !profile ? (
        <ErrorState
          message={error ?? "Perfil público indisponível."}
          onRetry={() => setReloadSeq((n) => n + 1)}
        />
      ) : (
        <>
          <section className="card-dark flex flex-col gap-4 p-6 shadow-raised sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar name={profile.display_name} src={profile.avatar_url} size="lg" />
              <div>
                <h1 className="text-2xl font-extrabold text-white">{profile.display_name}</h1>
                <p className="font-mono text-xs text-slate-400">@{profile.username}</p>
                {profile.bio && <p className="mt-1.5 text-sm text-slate-300">{profile.bio}</p>}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="rounded-xl bg-shell-raised px-4 py-2.5 text-center ring-1 ring-white/10">
                <span className="flex items-center justify-center gap-1 font-score text-2xl text-gold">
                  <Flame className="h-4 w-4 text-accent-bright" aria-hidden="true" />
                  {profile.current_streak}d
                </span>
                <span className="text-[11px] text-slate-300">ofensiva</span>
              </div>
              <div className="rounded-xl bg-shell-raised px-4 py-2.5 text-center ring-1 ring-white/10">
                <span className="flex items-center justify-center gap-1 font-score text-2xl text-emerald-300">
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
            <section className="card p-5">
              <h2 className="section-title mb-3">Por categoria</h2>
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

            <section className="card p-5">
              <h2 className="section-title mb-3">
                <Award className="h-5 w-5 text-grape" aria-hidden="true" />
                Conquistas ({profile.badges.length})
              </h2>
              {profile.badges.length === 0 ? (
                <p className="text-xs text-ink-2">Nenhuma conquista desbloqueada ainda.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {profile.badges.map((badge) => (
                    <li
                      key={badge.badge_key}
                      title={badge.description}
                      className="inline-flex items-center gap-1.5 rounded-full bg-grape/12 py-1 pr-3 pl-1.5 text-xs font-bold text-grape ring-1 ring-grape/25"
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
    </main>
  );
}
