"use client";

import {
  ArrowRight,
  CalendarRange,
  ChevronDown,
  Globe,
  KeyRound,
  Lock,
  Plus,
  Swords,
  UserPlus,
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
import { CategoryIcon } from "@/components/lane-badge";
import { EmptyState, Notice, PageHeader } from "@/components/ui";

interface ChallengesTabProps {
  challenges: ChallengeListItem[];
  activeChallengeId: string;
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
  activeChallengeId,
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
  const todayIso = new Date().toISOString().slice(0, 10);
  const plus30Iso = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const [durationPreset, setDurationPreset] = useState<"30d" | "90d" | "continuous" | "custom">("30d");
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(plus30Iso);
  const [restDaysPerWeek, setRestDaysPerWeek] = useState("1");
  const [dailyPointsCap, setDailyPointsCap] = useState("100");
  const [showAdvancedWeights, setShowAdvancedWeights] = useState(false);
  const [catConfigs, setCatConfigs] = useState(DEFAULT_CATEGORY_CONFIGS);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function handlePresetChange(preset: "30d" | "90d" | "continuous" | "custom") {
    setDurationPreset(preset);
    if (preset === "continuous") {
      setEndDate("");
      return;
    }
    if (preset === "30d" || preset === "90d") {
      const days = preset === "30d" ? 30 : 90;
      const base = startDate ? new Date(`${startDate}T00:00:00Z`) : new Date();
      setEndDate(new Date(base.getTime() + days * 86_400_000).toISOString().slice(0, 10));
    }
  }

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
        start_date: startDate || undefined,
        end_date: durationPreset === "continuous" ? null : endDate || null,
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

  const mine = challenges.filter((c) => c.is_member);
  const open = challenges.filter((c) => !c.is_member);

  function renderChallenge(ch: ChallengeListItem) {
    const isActive = ch.id === activeChallengeId;
    return (
      <li
        key={ch.id}
        className={`card flex flex-col gap-3 p-4 transition-shadow ${
          isActive ? "ring-2 ring-accent-bright" : "hover:shadow-raised"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 font-bold text-ink-strong">
              {ch.title}
              {isActive && (
                <span className="rounded-full bg-accent px-2 py-px text-[10px] font-bold tracking-wide text-white uppercase">
                  Ativo
                </span>
              )}
              {ch.member_role === "admin" && (
                <span className="rounded-full bg-well px-2 py-px font-mono text-[10px] text-ink-2 ring-1 ring-lane">
                  admin
                </span>
              )}
            </h3>
            {ch.description && <p className="mt-1 text-sm text-ink-2">{ch.description}</p>}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-well px-2.5 py-1 text-xs font-semibold text-ink-3 ring-1 ring-lane-soft">
            {ch.visibility === "private" ? (
              <>
                <Lock className="h-3 w-3" aria-hidden="true" /> Privado
              </>
            ) : (
              <>
                <Globe className="h-3 w-3" aria-hidden="true" /> Aberto
              </>
            )}
          </span>
        </div>

        <dl className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-2">
          <div className="rounded-md bg-accent/10 px-2 py-0.5 font-semibold text-accent-strong">
            <dt className="sr-only">Modo</dt>
            <dd>{ch.scoring_mode === "checkin" ? "Modo Check-in" : "Modo Pontuação"}</dd>
          </div>
          <div className="inline-flex items-center gap-1">
            <dt className="sr-only">Período</dt>
            <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
            <dd className="font-mono">
              {ch.start_date} {ch.end_date ? `→ ${ch.end_date}` : "· contínuo"}
            </dd>
          </div>
          <div className="inline-flex items-center gap-1 tabular-nums">
            <dt className="sr-only">Participantes</dt>
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <dd>{ch.members_count}</dd>
          </div>
          <div>
            <dt className="sr-only">Fuso horário</dt>
            <dd>{formatTimezoneLabel(ch.timezone)}</dd>
          </div>
          <div className="font-mono">
            <dt className="inline">Convite: </dt>
            <dd className="inline font-semibold text-ink-strong">{ch.invite_code}</dd>
          </div>
        </dl>

        <div className="flex justify-end">
          {ch.is_member ? (
            <button
              type="button"
              onClick={() => onSelectChallenge(ch.id)}
              className="btn btn-sm btn-dark"
            >
              {isActive ? "Ir para o desafio" : "Abrir desafio"}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              disabled={joining}
              onClick={() => void handleJoinPublic(ch.id)}
              className="btn btn-sm btn-primary"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Participar
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Swords}
        title="Desafios"
        description="Entre por convite, participe de desafios abertos ou crie o do seu grupo."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-5">
          <form
            onSubmit={handleJoinByCode}
            aria-labelledby="join-title"
            className="card-dark relative flex flex-col gap-3 overflow-hidden p-5"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-accent-bright/25 blur-2xl"
            />
            <h2 id="join-title" className="relative flex items-center gap-2 font-extrabold">
              <KeyRound className="h-5 w-5 text-accent-bright" aria-hidden="true" />
              Entrar com código de convite
            </h2>
            <div className="relative flex gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Ex.: CODERATS"
                aria-label="Código de convite do grupo"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3.5 font-mono text-sm text-white uppercase placeholder:text-slate-400 focus:border-accent-bright"
              />
              <button
                type="submit"
                disabled={joining || !inviteCode.trim()}
                className="btn btn-primary"
              >
                Entrar
              </button>
            </div>
            {joinError && (
              <Notice tone="error" onDismiss={() => setJoinError(null)}>
                {joinError}
              </Notice>
            )}
          </form>

          {challenges.length === 0 ? (
            <EmptyState icon={Swords} title="Nenhum desafio encontrado ainda">
              Crie o primeiro ao lado ou entre com um código de convite.
            </EmptyState>
          ) : (
            <>
              {mine.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="eyebrow">Seus desafios ({mine.length})</h2>
                  <ul className="flex flex-col gap-3">{mine.map(renderChallenge)}</ul>
                </div>
              )}
              {open.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="eyebrow">Abertos para a comunidade ({open.length})</h2>
                  <ul className="flex flex-col gap-3">{open.map(renderChallenge)}</ul>
                </div>
              )}
            </>
          )}
        </section>

        <section className="min-w-0">
          <form
            onSubmit={handleCreateChallenge}
            aria-labelledby="create-title"
            className="card flex flex-col gap-4 p-5"
          >
            <h2 id="create-title" className="section-title">
              <Plus className="h-5 w-5 text-accent-text" aria-hidden="true" />
              Criar novo desafio
            </h2>

            <label className="field-label">
              Nome do desafio *
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Clube ESW + LeetCode 2026"
                className="field"
                required
              />
            </label>

            <label className="field-label">
              Descrição
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Regras e foco do grupo..."
                className="field py-2.5"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Visibilidade
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                  className="field"
                >
                  <option value="private">Privado (convite)</option>
                  <option value="public">Aberto (comunidade)</option>
                </select>
              </label>

              <label className="field-label">
                Tipo de pontuação
                <select
                  value={scoringMode}
                  onChange={(e) => setScoringMode(e.target.value as ScoringMode)}
                  className="field"
                >
                  <option value="points">Modo Pontuação (pesos + teto)</option>
                  <option value="checkin">Modo Check-in (1 estudo/dia = 1 pt)</option>
                </select>
              </label>
            </div>

            <p className="rounded-xl bg-well px-3 py-2 text-xs text-ink-2">
              {scoringMode === "checkin"
                ? "Modo Check-in: recompensa constância pura (1 check-in válido no dia = +1 ponto, independente da categoria)."
                : "Modo Pontuação: cada atividade soma pontos pelo peso da categoria até o teto diário anti-farm."}
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="field-label">
                Duração
                <select
                  value={durationPreset}
                  onChange={(e) =>
                    handlePresetChange(
                      e.target.value as "30d" | "90d" | "continuous" | "custom",
                    )
                  }
                  className="field"
                >
                  <option value="30d">30 dias</option>
                  <option value="90d">90 dias</option>
                  <option value="continuous">Contínuo (sem fim)</option>
                  <option value="custom">Personalizado</option>
                </select>
              </label>

              <label className="field-label">
                Início
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDurationPreset("custom");
                  }}
                  className="field"
                />
              </label>

              <label className="field-label">
                Término
                <input
                  type="date"
                  value={endDate}
                  disabled={durationPreset === "continuous"}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDurationPreset("custom");
                  }}
                  className="field"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="field-label">
                Fuso horário
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="field"
                >
                  <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                  <option value="UTC">UTC (GMT+0)</option>
                  <option value="America/New_York">Nova York (EST)</option>
                  <option value="Europe/Lisbon">Lisboa (WET)</option>
                  <option value="Europe/London">Londres (GMT)</option>
                </select>
              </label>

              <label className="field-label">
                Descansos por semana
                <input
                  type="number"
                  min={0}
                  max={7}
                  value={restDaysPerWeek}
                  onChange={(e) => setRestDaysPerWeek(e.target.value)}
                  className="field tabular-nums"
                />
              </label>

              {scoringMode === "points" && (
                <label className="field-label">
                  Teto diário global (pts)
                  <input
                    type="number"
                    min={10}
                    max={2000}
                    value={dailyPointsCap}
                    onChange={(e) => setDailyPointsCap(e.target.value)}
                    className="field tabular-nums"
                  />
                </label>
              )}
            </div>

            <div className="rounded-2xl bg-well p-3 ring-1 ring-lane-soft">
              <button
                type="button"
                aria-expanded={showAdvancedWeights}
                onClick={() => setShowAdvancedWeights((prev) => !prev)}
                className="flex min-h-9 w-full items-center justify-between rounded-lg text-xs font-semibold text-ink-strong hover:text-accent-text"
              >
                <span>
                  Personalizar categorias {scoringMode === "points" ? "e pesos" : ""} (opcional)
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showAdvancedWeights ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {showAdvancedWeights && (
                <div className="animate-reveal mt-3 space-y-2 border-t border-lane pt-3">
                  {catConfigs.map((cfg, idx) => (
                    <div
                      key={cfg.category_slug}
                      className="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-lane-soft"
                    >
                      <label className="flex min-h-8 items-center gap-2.5 text-xs font-semibold text-ink-strong">
                        <input
                          type="checkbox"
                          checked={cfg.is_enabled}
                          onChange={(e) => {
                            const next = [...catConfigs];
                            next[idx] = { ...cfg, is_enabled: e.target.checked };
                            setCatConfigs(next);
                          }}
                          className="h-4 w-4 accent-accent"
                        />
                        <CategoryIcon slug={cfg.category_slug} />
                        {cfg.label}
                      </label>
                      {scoringMode === "points" && cfg.is_enabled && (
                        <div className="grid grid-cols-2 gap-3 pl-6">
                          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-2">
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
                              className="field min-h-9 text-xs tabular-nums"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-2">
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
                              className="field min-h-9 text-xs tabular-nums"
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
              <Notice tone="error" onDismiss={() => setCreateError(null)}>
                {createError}
              </Notice>
            )}

            <button type="submit" disabled={creating} className="btn btn-primary">
              {creating ? "Criando..." : "Criar desafio"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
