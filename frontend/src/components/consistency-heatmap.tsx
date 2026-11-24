"use client";

import { Flame } from "lucide-react";

import type { DiaryHeatmapDay } from "@/lib/api";

interface ConsistencyHeatmapProps {
  days: DiaryHeatmapDay[];
  totalActiveDays: number;
  currentStreak: number;
  longestStreak: number;
  weeks?: number;
  selectedDate?: string;
  onSelectDate?: (isoDate: string) => void;
}

function cellTone(count: number): string {
  if (count <= 0) return "bg-well ring-1 ring-lane-soft";
  if (count === 1) return "bg-accent/30 ring-1 ring-accent/40";
  if (count === 2) return "bg-accent/60 ring-1 ring-accent/70";
  return "bg-accent ring-1 ring-accent-hover";
}

function buildGridDates(weeks: number): string[] {
  const totalDays = weeks * 7;
  const today = new Date();
  const endUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const result: string[] = [];
  for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
    const dt = new Date(endUtc.getTime() - offset * 86_400_000);
    result.push(dt.toISOString().slice(0, 10));
  }
  return result;
}

export function ConsistencyHeatmap({
  days,
  totalActiveDays,
  currentStreak,
  longestStreak,
  weeks = 16,
  selectedDate,
  onSelectDate,
}: ConsistencyHeatmapProps) {
  const countByDate = new Map(days.map((d) => [d.study_date, d.count]));
  const grid = buildGridDates(weeks);

  const columns: string[][] = [];
  for (let i = 0; i < grid.length; i += 7) {
    columns.push(grid.slice(i, i + 7));
  }

  return (
    <section aria-label="Mapa de constância" className="card flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="section-title">
            <Flame className="h-5 w-5 text-accent-text" aria-hidden="true" />
            Constância ({weeks} semanas)
          </h2>
          <p className="text-xs text-ink-2">
            Clique em um dia para filtrar o diário naquela data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
          <span>
            <strong className="font-score text-base text-ink-strong">{totalActiveDays}</strong> dias
            ativos
          </span>
          <span>
            <strong className="font-score text-base text-accent-text">{currentStreak}d</strong>{" "}
            atual
          </span>
          <span>
            <strong className="font-score text-base text-ink-strong">{longestStreak}d</strong>{" "}
            recorde
          </span>
        </div>
      </div>

      <div className="no-scrollbar overflow-x-auto pb-1">
        <div className="inline-flex gap-1" role="grid" aria-label="Grade diária de estudos">
          {columns.map((col, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-1" role="row">
              {col.map((iso) => {
                const count = countByDate.get(iso) ?? 0;
                const isSelected = selectedDate === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!onSelectDate}
                    onClick={() => onSelectDate?.(isSelected ? "" : iso)}
                    title={`${iso}: ${count} estudo(s)`}
                    aria-label={`${iso}: ${count} estudo(s)`}
                    aria-pressed={isSelected}
                    className={`h-3.5 w-3.5 rounded-[4px] transition-transform hover:scale-125 disabled:cursor-default disabled:hover:scale-100 ${cellTone(count)} ${
                      isSelected ? "ring-2 ring-ink-strong ring-offset-1" : ""
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 text-[11px] text-ink-muted">
        <span>Menos</span>
        <span className="h-3 w-3 rounded-[3px] bg-well ring-1 ring-lane-soft" />
        <span className="h-3 w-3 rounded-[3px] bg-accent/30" />
        <span className="h-3 w-3 rounded-[3px] bg-accent/60" />
        <span className="h-3 w-3 rounded-[3px] bg-accent" />
        <span>Mais</span>
      </div>
    </section>
  );
}
