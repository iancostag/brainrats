"use client";

import {
  ChevronDown,
  ChevronUp,
  Globe,
  KeyRound,
  Lock,
  Plus,
  Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  createChallenge,
  joinChallenge,
  type CategorySlug,
  type ChallengeListItem,
  type ScoringMode,
  type Visibility,
} from "@/lib/api";
import { formatTimezoneLabel } from "@/lib/categories";

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
    label: "Projeto",
    is_enabled: true,
    base_points: 15,
    daily_cap: 50,
  },
  {
    category_slug: "books",
    label: "Livros",
    is_enabled: true,
    base_points: 15,
    daily_cap: 40,
  },
  {
    category_slug: "esw",
    label: "ESW (Eng. de Software)",
    is_enabled: true,
    base_points: 15,
    daily_cap: 50,
  },
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
  const [showAdvancedWeights, setShowAdvancedWeights] = useState(false);
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
    if (!catConfigs.some((c) => c.is_enabled)) {
      setCreateError("Ative pelo menos uma categoria para o desafio.");
      return;
    }

    const globalCap = Number(dailyPointsCap) || 100;
    if (
      scoringMode === "points" &&
      catConfigs.some((c) => c.is_enabled && c.daily_cap > globalCap)
    ) {
      setCreateError(
        `O teto de nenhuma categoria pode ultrapassar o teto global (${globalCap} pts/dia).`,
      );
      return;
    }

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
        daily_points_cap: globalCap,
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
          className="flex flex-col gap-3 rounded-xl border border-[#DDD8CE] bg-white p-5"
        >
          <h3 className="flex items-center gap-2 font-bold text-[#0F1722]">
            <KeyRound className="h-4 w-4 text-[#D94E28]" />
            Entrar em Grupo Privado por Código
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Ex: CODERATS"
              aria-label="Código de convite do grupo"
              className="min-h-11 flex-1 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 font-mono text-sm uppercase text-[#0F1722]"
            />
            <button
              type="submit"
              disabled={joining || !inviteCode.trim()}
              className="min-h-11 rounded-lg bg-[#0F1722] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E293B] disabled:opacity-50"
            >
              Entrar
            </button>
          </div>
          {joinError && (
            <p
              role="alert"
              className="rounded-lg border border-red-600/35 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
            >
              {joinError}
            </p>
          )}
        </form>

        <div className="flex flex-col gap-3">
          <h3 className="font-bold text-[#0F1722]">Seus Desafios & Comunidade Aberta</h3>
          {challenges.map((ch) => (
            <article
              key={ch.id}
              className="flex flex-col gap-3 rounded-xl border border-[#DDD8CE] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-[#0F1722]">{ch.title}</h4>
                  {ch.description && (
                    <p className="mt-1 text-xs text-[#475569]">{ch.description}</p>
                  )}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#DDD8CE] bg-[#FAF9F6] px-2.5 py-0.5 text-xs font-medium text-[#334155]">
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

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-[#DDD8CE] bg-[#FAF9F6] px-2 py-0.5 font-semibold text-[#0F1722]">
                    {ch.scoring_mode === "checkin" ? "Modo Check-in" : "Modo Pontuação"}
                  </span>
                  <span>{formatTimezoneLabel(ch.timezone)}</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Users className="h-3.5 w-3.5" /> {ch.members_count}
                  </span>
                  <span className="font-mono">Convite: {ch.invite_code}</span>
                </div>

                {ch.is_member ? (
                  <button
                    type="button"
                    onClick={() => onSelectChallenge(ch.id)}
                    className="min-h-10 rounded-lg border border-[#0F1722] bg-[#0F1722] px-3 py-1.5 font-semibold text-white hover:bg-[#1E293B]"
                  >
                    Abrir Desafio
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={joining}
                    onClick={() => void handleJoinPublic(ch.id)}
                    className="min-h-10 rounded-lg bg-[#D94E28] px-3 py-1.5 font-bold text-white hover:bg-[#C2411E]"
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
          className="flex flex-col gap-4 rounded-xl border border-[#DDD8CE] bg-white p-5"
        >
          <h3 className="flex items-center gap-2 font-bold text-[#0F1722]">
            <Plus className="h-4 w-4 text-[#D94E28]" />
            Criar Novo Desafio
          </h3>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[#1E293B]">Nome do desafio *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Clube ESW + LeetCode 2026"
              className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722]"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[#1E293B]">Descrição</span>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Regras e foco do grupo..."
              className="rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
              Visibilidade
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as Visibility)}
                className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-sm text-[#0F1722]"
              >
                <option value="private">Privado (convite)</option>
                <option value="public">Aberto (comunidade)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
              Tipo de Pontuação (Admin)
              <select
                value={scoringMode}
                onChange={(e) => setScoringMode(e.target.value as ScoringMode)}
                className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-sm text-[#0F1722]"
              >
                <option value="points">Modo Pontuação (pesos + teto)</option>
                <option value="checkin">Modo Check-in (1 estudo/dia = 1 pt)</option>
              </select>
            </label>
          </div>

          <p className="text-xs text-[#475569]">
            {scoringMode === "checkin"
              ? "Modo Check-in: recompensa constância pura (1 check-in válido no dia = +1 ponto, independente da categoria)."
              : "Modo Pontuação: cada atividade soma pontos pelo peso da categoria até o teto diário anti-farm."}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
              Fuso horário do desafio
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-sm text-[#0F1722]"
              >
                <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                <option value="UTC">UTC (GMT+0)</option>
                <option value="America/New_York">Nova York (EST)</option>
                <option value="Europe/Lisbon">Lisboa (WET)</option>
                <option value="Europe/London">Londres (GMT)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
              Dias de descanso / sem
              <input
                type="number"
                min={0}
                max={7}
                value={restDaysPerWeek}
                onChange={(e) => setRestDaysPerWeek(e.target.value)}
                className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-sm text-[#0F1722] tabular-nums"
              />
            </label>

            {scoringMode === "points" && (
              <label className="flex flex-col gap-1 text-xs font-medium text-[#334155]">
                Teto diário global (pts)
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={dailyPointsCap}
                  onChange={(e) => setDailyPointsCap(e.target.value)}
                  className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-sm text-[#0F1722] tabular-nums"
                />
              </label>
            )}
          </div>

          <div className="rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] p-3">
            <button
              type="button"
              aria-expanded={showAdvancedWeights}
              onClick={() => setShowAdvancedWeights((prev) => !prev)}
              className="flex min-h-9 w-full items-center justify-between text-xs font-semibold text-[#0F1722] hover:text-[#D94E28]"
            >
              <span>
                Personalizar categorias {scoringMode === "points" ? "e pesos" : ""} (opcional)
              </span>
              {showAdvancedWeights ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showAdvancedWeights && (
              <div className="mt-3 space-y-3 border-t border-[#DDD8CE] pt-3">
                {catConfigs.map((cfg, idx) => (
                  <div
                    key={cfg.category_slug}
                    className="flex flex-col gap-2 rounded-lg border border-[#DDD8CE] bg-white p-3"
                  >
                    <label className="flex min-h-8 items-center gap-2.5 text-xs font-semibold text-[#0F1722]">
                      <input
                        type="checkbox"
                        checked={cfg.is_enabled}
                        onChange={(e) => {
                          const next = [...catConfigs];
                          next[idx] = { ...cfg, is_enabled: e.target.checked };
                          setCatConfigs(next);
                        }}
                        className="h-4 w-4 accent-[#D94E28]"
                      />
                      {cfg.label}
                    </label>
                    {scoringMode === "points" && cfg.is_enabled && (
                      <div className="grid grid-cols-2 gap-3 pl-6">
                        <label className="flex flex-col gap-1 text-[11px] font-medium text-[#475569]">
                          Pontos base
                          <input
                            type="number"
                            min={1}
                            value={cfg.base_points}
                            onChange={(e) => {
                              const next = [...catConfigs];
                              next[idx] = {
                                ...cfg,
                                base_points: Number(e.target.value) || 1,
                              };
                              setCatConfigs(next);
                            }}
                            className="min-h-9 rounded border border-[#CBD5E1] bg-[#FAF9F6] px-2.5 py-1 text-xs text-[#0F1722] tabular-nums"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] font-medium text-[#475569]">
                          Teto diário (pts)
                          <input
                            type="number"
                            min={1}
                            value={cfg.daily_cap}
                            onChange={(e) => {
                              const next = [...catConfigs];
                              next[idx] = {
                                ...cfg,
                                daily_cap: Number(e.target.value) || 1,
                              };
                              setCatConfigs(next);
                            }}
                            className="min-h-9 rounded border border-[#CBD5E1] bg-[#FAF9F6] px-2.5 py-1 text-xs text-[#0F1722] tabular-nums"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {createError && (
            <p
              role="alert"
              className="rounded-lg border border-red-600/35 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
            >
              {createError}
            </p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="min-h-11 rounded-lg bg-[#D94E28] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#C2411E] disabled:opacity-50"
          >
            {creating ? "Criando..." : "Criar Desafio"}
          </button>
        </form>
      </section>
    </div>
  );
}
