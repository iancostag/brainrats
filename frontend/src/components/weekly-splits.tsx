import { Check, Coffee } from "lucide-react";

export interface SplitDay {
  iso: string;
  label: string;
  isToday: boolean;
}

interface WeeklySplitsProps {
  days: SplitDay[];
  studiedDates: Set<string>;
  restDates: Set<string>;
  /** Progresso da meta de hoje, de 0 a 1. */
  todayProgress: number;
}

type SplitStatus = "studied" | "rest" | "today" | "missed" | "upcoming";

const STATUS_TEXT: Record<SplitStatus, string> = {
  studied: "estudado",
  rest: "dia de descanso",
  today: "em andamento",
  missed: "sem registro",
  upcoming: "ainda não chegou",
};

function formatDayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * Faixa de Splits Semanais desenhada como uma pista: sete segmentos contínuos de Seg a Dom,
 * marcador "Hoje" sobre o dia atual e o filete de chegada em terracota no fim da semana.
 * O segmento de hoje enche conforme a meta do dia avança.
 */
export function WeeklySplits({ days, studiedDates, restDates, todayProgress }: WeeklySplitsProps) {
  const todayIso = days.find((d) => d.isToday)?.iso ?? "";
  const progress = Math.max(0, Math.min(1, todayProgress));

  const statuses = days.map((day): SplitStatus => {
    if (restDates.has(day.iso)) return "rest";
    if (day.isToday) return progress >= 1 ? "studied" : "today";
    if (studiedDates.has(day.iso)) return "studied";
    return day.iso < todayIso ? "missed" : "upcoming";
  });

  const completed = statuses.filter((s) => s === "studied").length;
  const elapsed = days.filter((d) => d.iso <= todayIso).length;

  return (
    <div className="flex w-full flex-col gap-1.5 lg:w-[26rem]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-2">
          Splits da semana
        </span>
        <span className="text-xs text-ink-2">
          <span className="font-score text-base text-ink-strong">
            {completed}/{elapsed}
          </span>{" "}
          dias cumpridos
        </span>
      </div>

      {/* Marcador do dia atual, alinhado às colunas da pista. */}
      <div aria-hidden="true" className="flex pr-[3px]">
        {days.map((day) => (
          <span key={day.iso} className="flex flex-1 justify-center">
            {day.isToday && (
              <span className="flex flex-col items-center font-score text-xs uppercase leading-none text-accent-text">
                Hoje
                <span className="mt-0.5 h-0 w-0 border-x-4 border-t-[5px] border-x-transparent border-t-accent" />
              </span>
            )}
          </span>
        ))}
      </div>

      <ol
        aria-label="Splits da semana"
        className="flex h-10 overflow-hidden rounded-md border border-lane bg-well"
      >
        {days.map((day, idx) => {
          const status = statuses[idx];
          return (
            <li
              key={day.iso}
              className={`relative flex flex-1 items-center justify-center border-lane ${
                idx > 0 ? "border-l" : ""
              } ${
                status === "studied"
                  ? "bg-accent text-white"
                  : status === "rest"
                    ? "bg-rest text-ink-strong"
                    : status === "missed"
                      ? "bg-lane-soft"
                      : ""
              } ${day.isToday ? "shadow-[inset_0_0_0_2px_var(--ink-strong)]" : ""}`}
            >
              <span className="sr-only">
                {day.label} {formatDayMonth(day.iso)}: {STATUS_TEXT[status]}
                {status === "today" && progress > 0
                  ? `, ${Math.round(progress * 100)}% da meta`
                  : ""}
              </span>
              {status === "today" && progress > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-accent/70 transition-[width] duration-500 ease-out"
                  style={{ width: `${progress * 100}%` }}
                />
              )}
              {status === "studied" && <Check aria-hidden="true" className="relative h-4 w-4" />}
              {status === "rest" && <Coffee aria-hidden="true" className="relative h-4 w-4" />}
            </li>
          );
        })}
        {/* Filete de chegada da semana. */}
        <li aria-hidden="true" className="w-[3px] shrink-0 bg-accent" />
      </ol>

      <div aria-hidden="true" className="flex pr-[3px]">
        {days.map((day) => (
          <span
            key={day.iso}
            className={`flex-1 text-center text-xs ${
              day.isToday ? "font-bold text-ink-strong" : "text-ink-2"
            }`}
          >
            {day.label}
          </span>
        ))}
      </div>
    </div>
  );
}
