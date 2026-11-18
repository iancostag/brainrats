"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";

import type { ChallengeListItem } from "@/lib/api";

/** Seletor do desafio ativo. Some quando só existe um desafio para escolher. */
export function ChallengeSwitcher({
  challenges,
  value,
  onChange,
  tone = "light",
}: {
  challenges: ChallengeListItem[];
  value: string;
  onChange: (id: string) => void;
  tone?: "light" | "dark";
}) {
  const id = useId();
  if (challenges.length < 2) return null;
  const dark = tone === "dark";
  return (
    <div className="relative inline-flex w-fit max-w-full items-center self-start sm:self-auto">
      <label htmlFor={id} className="sr-only">
        Trocar desafio ativo
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-9 w-full max-w-[15rem] appearance-none truncate rounded-lg border py-1 pr-8 pl-3 text-xs font-semibold transition-colors ${
          dark
            ? "border-white/15 bg-white/5 text-slate-100 hover:border-white/30 [&>option]:bg-shell"
            : "border-lane bg-card text-ink-strong hover:border-lane-strong"
        }`}
      >
        {challenges.map((ch) => (
          <option key={ch.id} value={ch.id}>
            {ch.title}
            {ch.is_member ? "" : " (aberto · não inscrito)"}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={`pointer-events-none absolute right-2.5 h-3.5 w-3.5 ${
          dark ? "text-slate-300" : "text-ink-muted"
        }`}
      />
    </div>
  );
}
