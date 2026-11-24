"use client";

import { Play, Square, Timer } from "lucide-react";
import { useEffect, useState } from "react";

import { clearStudyPresence, setStudyPresence, type CategorySlug } from "@/lib/api";

interface FocusTimerProps {
  challengeId: string;
  categorySlug: CategorySlug;
  onFinishMinutes: (minutes: number) => void;
  onPresenceChanged?: () => void;
}

const PRESETS = [
  { label: "25 min", minutes: 25 },
  { label: "50 min", minutes: 50 },
] as const;

export function FocusTimer({
  challengeId,
  categorySlug,
  onFinishMinutes,
  onPresenceChanged,
}: FocusTimerProps) {
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [running, setRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  async function handleStart(minutes: number) {
    setTargetMinutes(minutes);
    setElapsedSeconds(0);
    setRunning(true);
    try {
      await setStudyPresence(challengeId, categorySlug, minutes);
      onPresenceChanged?.();
    } catch {
      // Presence is best-effort; timer still works locally.
    }
  }

  async function handleStop() {
    setRunning(false);
    const workedMinutes = Math.max(5, Math.round(elapsedSeconds / 60) || targetMinutes);
    onFinishMinutes(workedMinutes);
    setElapsedSeconds(0);
    try {
      await clearStudyPresence(challengeId);
      onPresenceChanged?.();
    } catch {
      // Ignore cleanup errors.
    }
  }

  const remaining = Math.max(0, targetMinutes * 60 - elapsedSeconds);
  const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
  const secs = String(remaining % 60).padStart(2, "0");

  if (running) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-shell px-3 py-2 text-white">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-accent-bright" aria-hidden="true" />
          <span className="font-score text-lg tabular-nums">
            {mins}:{secs}
          </span>
          <span className="text-xs text-slate-300">Sessão ativa · visível para o grupo</span>
        </div>
        <button
          type="button"
          onClick={() => void handleStop()}
          className="btn btn-sm btn-primary"
        >
          <Square className="h-3 w-3" aria-hidden="true" /> Concluir e preencher tempo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
      <Timer className="h-3.5 w-3.5 text-accent-text" aria-hidden="true" />
      <span className="font-semibold text-ink-3">Foco:</span>
      {PRESETS.map((preset) => (
        <button
          key={preset.minutes}
          type="button"
          onClick={() => void handleStart(preset.minutes)}
          className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-lane bg-well px-2 py-0.5 text-[11px] font-semibold text-ink-3 transition-colors hover:border-lane-strong hover:text-ink-strong"
        >
          <Play className="h-2.5 w-2.5" aria-hidden="true" /> {preset.label}
        </button>
      ))}
    </div>
  );
}
