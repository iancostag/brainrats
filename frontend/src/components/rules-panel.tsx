import type { ChallengeDetail } from "@/lib/api";
import { CATEGORY_META, formatTimezoneLabel } from "@/lib/categories";
import { CategoryIcon } from "@/components/lane-badge";

/** Regras do desafio: modo, teto diário, descanso e pesos por categoria habilitada. */
export function RulesPanel({ detail, className = "" }: { detail: ChallengeDetail; className?: string }) {
  const { challenge } = detail;
  const isCheckin = challenge.scoring_mode === "checkin";
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <li>
          <strong className="font-semibold text-ink-strong">
            {isCheckin ? "Modo Check-in" : "Modo Pontuação"}
          </strong>
          {isCheckin
            ? ": 1 estudo válido no dia = 1 ponto."
            : `: pesos por categoria, teto de ${challenge.daily_points_cap} pts/dia.`}
        </li>
        <li>
          Descanso:{" "}
          <strong className="font-semibold text-ink-strong">
            {challenge.rest_days_per_week}/semana
          </strong>
        </li>
        <li>Fuso: {formatTimezoneLabel(challenge.timezone)}</li>
      </ul>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {detail.category_configs
          .filter((c) => c.is_enabled)
          .map((cfg) => {
            const meta = CATEGORY_META[cfg.slug];
            return (
              <li
                key={cfg.category_id}
                className="flex items-center justify-between gap-2 rounded-xl bg-well px-3 py-2 text-xs"
              >
                <span className="inline-flex items-center gap-2 font-semibold text-ink-strong">
                  <CategoryIcon slug={cfg.slug} size="md" />
                  {meta?.shortLabel ?? cfg.name}
                </span>
                <span className="font-mono text-ink-2 tabular-nums">
                  {isCheckin ? "1 pt/dia" : `${cfg.base_points} base · máx ${cfg.daily_cap}/dia`}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
