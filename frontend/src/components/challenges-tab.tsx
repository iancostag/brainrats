"use client";

import { KeyRound, Lock, Globe, Plus, Users } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  createChallenge,
  joinChallenge,
  type CategorySlug,
  type ChallengeListItem,
  type ScoringMode,
  type Visibility,
} from "@/lib/api";

interface ChallengesTabProps {
  challenges: ChallengeListItem[];
  onSelectChallenge: (challengeId: string) => void;
  onRefreshChallenges: (selectId?: string) => Promise<void>;
}

const DEFAULT_CATEGORY_CONFIGS: Array<{
  category_slug: CategorySlug;
  label: string;
  is_enabled: boolean;
  base_points: number;
  daily_cap: number;
}> = [
  { category_slug: "leetcode", label: "LeetCode", is_enabled: true, base_points: 10, daily_cap: 70 },
  {
    category_slug: "project",
    label: "Continuidade de Projeto",
    is_enabled: true,
    base_points: 15,
    daily_cap: 50,
  },
  {
    category_slug: "books",
    label: "Leitura de Livros",
    is_enabled: true,
    base_points: 15,
    daily_cap: 40,
  },
  { category_slug: "esw", label: "ESW", is_enabled: true, base_points: 15, daily_cap: 50 },
  { category_slug: "data", label: "Dados", is_enabled: true, base_points: 15, daily_cap: 50 },
];

export function ChallengesTab({
  challenges,
  onSelectChallenge,
  onRefreshChallenges,
}: ChallengesTabProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [scoringMode, setScoringMode] = useState<ScoringMode>("points");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [restDaysPerWeek, setRestDaysPerWeek] = useState("1");
  const [dailyPointsCap, setDailyPointsCap] = useState("100");
  const [catConfigs, setCatConfigs] = useState(DEFAULT_CATEGORY_CONFIGS);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleJoinByCode(event: FormEvent) {
    event.preventDefault();
    if (!inviteCode.trim()) return;
    setJoinError(null);
    setJoining(true);
    try {
      const joined = await joinChallenge({ invite_code: inviteCode.trim() });
      setInviteCode("");
      await onRefreshChallenges(joined.id);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Código inválido.");
    } finally {
      setJoining(false);
    }
  }

  async function handleJoinPublic(challengeId: string) {
    setJoinError(null);
    setJoining(true);
    try {
      const joined = await joinChallenge({ challenge_id: challengeId });
      await onRefreshChallenges(joined.id);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setJoining(false);
    }
  }

  async function handleCreateChallenge(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setCreateError(null);
    setCreating(true);
    try {
      const created = await createChallenge({
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        scoring_mode: scoringMode,
        timezone,
        rest_days_per_week: Number(restDaysPerWeek) || 0,
        daily_points_cap: Number(dailyPointsCap) || 100,
        category_configs: catConfigs.map((c) => ({
          category_slug: c.category_slug,
          is_enabled: c.is_enabled,
          base_points: c.base_points,
          daily_cap: c.daily_cap,
        })),
      });
      setTitle("");
      setDescription("");
      await onRefreshChallenges(created.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao criar desafio.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="flex flex-col gap-5">
        <form
          onSubmit={handleJoinByCode}
          className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5"
        >
          <h3 className="flex items-center gap-2 font-semibold text-zinc-100">
            <KeyRound className="h-4 w-4 text-emerald-400" />
            Entrar em Grupo Privado por Código
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Ex: CODERATS"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm uppercase text-zinc-100 outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={joining || !inviteCode.trim()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              Entrar
            </button>
          </div>
          {joinError && <p className="text-xs text-red-400">{joinError}</p>}
        </form>

        <div className="flex flex-col gap-3">
          <h3 className="font-semibold text-zinc-100">Seus Desafios & Comunidade Aberta</h3>
          {challenges.map((ch) => (
            <article
              key={ch.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-zinc-100">{ch.title}</h4>
                  {ch.description && (
                    <p className="mt-1 text-xs text-zinc-400">{ch.description}</p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-300">
                  {ch.visibility === "private" ? (
                    <>
                      <Lock className="h-3 w-3" /> Privado
                    </>
                  ) : (
                    <>
                      <Globe className="h-3 w-3" /> Aberto
                    </>
                  )}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-200">
                    {ch.scoring_mode === "checkin" ? "Modo Check-in" : "Modo Pontuação"}
                  </span>
                  <span>Fuso: {ch.timezone}</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {ch.members_count}
                  </span>
                  <span>Convite: {ch.invite_code}</span>
                </div>

                {ch.is_member ? (
                  <button
                    type="button"
                    onClick={() => onSelectChallenge(ch.id)}
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-300 hover:bg-emerald-500/20"
                  >
                    Abrir Desafio
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={joining}
                    onClick={() => void handleJoinPublic(ch.id)}
                    className="rounded-lg bg-emerald-500 px-3 py-1 font-semibold text-zinc-950 hover:bg-emerald-400"
                  >
                    Participar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <form
          onSubmit={handleCreateChallenge}
          className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5"
        >
          <h3 className="flex items-center gap-2 font-semibold text-zinc-100">
            <Plus className="h-4 w-4 text-emerald-400" />
            Criar Novo Desafio
          </h3>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-300">Nome do desafio *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Clube ESW + LeetCode 2026"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-300">Descrição</span>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Regras e foco do grupo..."
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Visibilidade
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as Visibility)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="private">Privado (convite)</option>
                <option value="public">Aberto (comunidade)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Tipo de Pontuação (Admin)
              <select
                value={scoringMode}
                onChange={(e) => setScoringMode(e.target.value as ScoringMode)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="points">Modo Pontuação (pesos + teto)</option>
                <option value="checkin">Modo Check-in (1 ponto/dia)</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Fuso horário do desafio
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/Lisbon">Europe/Lisbon</option>
                <option value="Europe/London">Europe/London</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-zinc-300">
              Rest Days / semana
              <input
                type="number"
                min={0}
                max={7}
                value={restDaysPerWeek}
                onChange={(e) => setRestDaysPerWeek(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </label>

            {scoringMode === "points" && (
              <label className="flex flex-col gap-1 text-xs text-zinc-300">
                Teto diário global (pts)
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={dailyPointsCap}
                  onChange={(e) => setDailyPointsCap(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </label>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <span className="text-xs font-medium text-zinc-300">
              Categorias Ativas {scoringMode === "points" && "& Pesos"}
            </span>
            {catConfigs.map((cfg, idx) => (
              <div key={cfg.category_slug} className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex min-w-40 items-center gap-2 text-zinc-200">
                  <input
                    type="checkbox"
                    checked={cfg.is_enabled}
                    onChange={(e) => {
                      const next = [...catConfigs];
                      next[idx] = { ...cfg, is_enabled: e.target.checked };
                      setCatConfigs(next);
                    }}
                  />
                  {cfg.label}
                </label>
                {scoringMode === "points" && cfg.is_enabled && (
                  <>
                    <input
                      type="number"
                      min={1}
                      value={cfg.base_points}
                      onChange={(e) => {
                        const next = [...catConfigs];
                        next[idx] = { ...cfg, base_points: Number(e.target.value) || 1 };
                        setCatConfigs(next);
                      }}
                      className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                      title="Pontos base"
                    />
                    <span className="text-zinc-500">pts · teto/dia</span>
                    <input
                      type="number"
                      min={1}
                      value={cfg.daily_cap}
                      onChange={(e) => {
                        const next = [...catConfigs];
                        next[idx] = { ...cfg, daily_cap: Number(e.target.value) || 1 };
                        setCatConfigs(next);
                      }}
                      className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                      title="Teto diário da categoria"
                    />
                  </>
                )}
              </div>
            ))}
          </div>

          {createError && <p className="text-xs text-red-400">{createError}</p>}

          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {creating ? "Criando..." : "Criar Desafio"}
          </button>
        </form>
      </section>
    </div>
  );
}
