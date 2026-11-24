"use client";

import {
  BellRing,
  KeyRound,
  LogOut,
  Save,
  Settings2,
  Shield,
  Target,
  UserMinus,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { Notice } from "@/components/ui";
import {
  leaveChallenge,
  regenerateInviteCode,
  removeMember,
  updateChallenge,
  updateMemberRole,
  type ChallengeDetail,
  type Visibility,
} from "@/lib/api";

interface ChallengeManageModalProps {
  detail: ChallengeDetail;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onLeftChallenge: () => Promise<void>;
}

export function ChallengeManageModal({
  detail,
  currentUserId,
  isAdmin,
  onClose,
  onUpdated,
  onLeftChallenge,
}: ChallengeManageModalProps) {
  const { challenge } = detail;

  const [title, setTitle] = useState(challenge.title);
  const [description, setDescription] = useState(challenge.description ?? "");
  const [visibility, setVisibility] = useState<Visibility>(challenge.visibility);
  const [endDate, setEndDate] = useState(challenge.end_date ?? "");
  const [restDays, setRestDays] = useState(String(challenge.rest_days_per_week));
  const [dailyCap, setDailyCap] = useState(String(challenge.daily_points_cap));
  const [collectiveGoal, setCollectiveGoal] = useState(
    challenge.collective_weekly_goal ? String(challenge.collective_weekly_goal) : "",
  );
  const [webhookUrl, setWebhookUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await updateChallenge(challenge.id, {
        title: title.trim(),
        description: description.trim(),
        visibility,
        end_date: endDate || null,
        clear_end_date: !endDate,
        rest_days_per_week: Number(restDays) || 0,
        daily_points_cap: challenge.scoring_mode === "points" ? Number(dailyCap) || 100 : undefined,
        collective_weekly_goal: collectiveGoal ? Number(collectiveGoal) : null,
        clear_collective_weekly_goal: !collectiveGoal,
        discord_webhook_url: webhookUrl.trim() || undefined,
      });
      await onUpdated();
      setWebhookUrl("");
      setNotice({ ok: true, text: "Configurações do desafio atualizadas!" });
    } catch (err) {
      setNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao salvar alterações.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerateCode() {
    setBusy(true);
    setNotice(null);
    try {
      const updated = await regenerateInviteCode(challenge.id);
      await onUpdated();
      setNotice({
        ok: true,
        text: `Novo código de convite gerado: ${updated.invite_code}`,
      });
    } catch (err) {
      setNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Não foi possível gerar novo código.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleRole(userId: string, currentRole: "admin" | "member") {
    setBusy(true);
    setNotice(null);
    try {
      await updateMemberRole(challenge.id, userId, currentRole === "admin" ? "member" : "admin");
      await onUpdated();
      setNotice({ ok: true, text: "Papel do membro atualizado." });
    } catch (err) {
      setNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao atualizar papel.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(userId: string, name: string) {
    setBusy(true);
    setNotice(null);
    try {
      await removeMember(challenge.id, userId);
      await onUpdated();
      setNotice({ ok: true, text: `${name} foi removido do desafio.` });
    } catch (err) {
      setNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao remover membro.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    setNotice(null);
    try {
      await leaveChallenge(challenge.id);
      await onLeftChallenge();
      onClose();
    } catch (err) {
      setNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Não foi possível sair do desafio.",
      });
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="manage-challenge-title"
      className="card animate-reveal flex flex-col gap-5 p-5"
    >
      <div className="flex items-center justify-between gap-3 border-b border-lane-soft pb-3">
        <h2 id="manage-challenge-title" className="section-title">
          <Settings2 className="h-5 w-5 text-accent-text" aria-hidden="true" />
          Gerenciar desafio
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar gestão do desafio"
          className="btn btn-sm btn-ghost"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {notice && (
        <Notice tone={notice.ok ? "success" : "error"} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      {isAdmin && (
        <>
          <form onSubmit={handleSave} className="flex flex-col gap-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Nome do desafio
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="field"
                  required
                />
              </label>
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
            </div>

            <label className="field-label">
              Descrição
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="field py-2"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="field-label">
                Data de término (vazio = contínuo)
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="field"
                />
              </label>
              <label className="field-label">
                Descansos / semana
                <input
                  type="number"
                  min={0}
                  max={7}
                  value={restDays}
                  onChange={(e) => setRestDays(e.target.value)}
                  className="field tabular-nums"
                />
              </label>
              {challenge.scoring_mode === "points" ? (
                <label className="field-label">
                  Teto diário (pts)
                  <input
                    type="number"
                    min={10}
                    max={2000}
                    value={dailyCap}
                    onChange={(e) => setDailyCap(e.target.value)}
                    className="field tabular-nums"
                  />
                </label>
              ) : (
                <label className="field-label">
                  <span className="inline-flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" aria-hidden="true" /> Meta coletiva / sem
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={collectiveGoal}
                    placeholder="Ex.: 30 estudos"
                    onChange={(e) => setCollectiveGoal(e.target.value)}
                    className="field tabular-nums"
                  />
                </label>
              )}
            </div>

            {challenge.scoring_mode === "points" && (
              <label className="field-label">
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" aria-hidden="true" /> Meta coletiva semanal do
                  grupo (check-ins)
                </span>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={collectiveGoal}
                  placeholder="Ex.: 30 estudos na semana (opcional)"
                  onChange={(e) => setCollectiveGoal(e.target.value)}
                  className="field tabular-nums"
                />
              </label>
            )}

            <label className="field-label">
              <span className="inline-flex items-center gap-1">
                <BellRing className="h-3.5 w-3.5" aria-hidden="true" /> Webhook Discord / Telegram
                {challenge.has_discord_webhook ? " (configurado)" : " (opcional)"}
              </span>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="field"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className="btn btn-sm btn-primary">
                <Save className="h-3.5 w-3.5" aria-hidden="true" /> Salvar regras
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRegenerateCode()}
                className="btn btn-sm btn-secondary"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Rotacionar código (
                {challenge.invite_code})
              </button>
            </div>
          </form>

          {detail.leaderboard.length > 1 && (
            <div className="border-t border-lane-soft pt-4">
              <h3 className="eyebrow mb-2">Membros ({detail.leaderboard.length})</h3>
              <ul className="divide-y divide-lane-soft rounded-xl bg-well ring-1 ring-lane-soft">
                {detail.leaderboard.map((member) => (
                  <li
                    key={member.user_id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-ink-strong">{member.display_name}</span>{" "}
                      <span className="font-mono text-ink-muted">@{member.username}</span>{" "}
                      <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] text-ink-2 ring-1 ring-lane-soft">
                        {member.role}
                      </span>
                    </div>
                    {member.user_id !== currentUserId && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleToggleRole(member.user_id, member.role)}
                          className="btn btn-sm btn-secondary"
                        >
                          <Shield className="h-3 w-3" aria-hidden="true" />
                          {member.role === "admin" ? "Rebaixar" : "Tornar admin"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleRemoveMember(member.user_id, member.display_name)}
                          className="btn btn-sm btn-secondary text-red-800"
                        >
                          <UserMinus className="h-3 w-3" aria-hidden="true" /> Remover
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-lane-soft pt-3">
        <p className="text-xs text-ink-2">
          Sair remove você da lista de participantes deste desafio.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleLeave()}
          className="btn btn-sm btn-secondary text-red-800 hover:border-red-600/40"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sair do desafio
        </button>
      </div>
    </section>
  );
}
