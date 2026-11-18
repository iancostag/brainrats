import {
  BookOpen,
  Code2,
  Database,
  GitBranch,
  Layers,
  type LucideIcon,
} from "lucide-react";

import type { CategorySlug, ScoringMode } from "@/lib/api";

export interface CategoryMeta {
  slug: CategorySlug;
  label: string;
  shortLabel: string;
  /** Ícone fixo da categoria: sempre aparece junto da cor, nunca só a cor. */
  icon: LucideIcon;
  /** Bloco do ícone (fundo suave + ícone na cor da categoria). */
  tileClass: string;
  /** Chip não selecionado: fundo tingido e texto escuro da mesma família. */
  chipClass: string;
  /** Chip selecionado: borda e anel na cor da categoria. */
  chipActiveClass: string;
  /** Cor sólida para barras de distribuição. */
  barClass: string;
}

export const CATEGORY_META: Record<CategorySlug, CategoryMeta> = {
  leetcode: {
    slug: "leetcode",
    label: "LeetCode",
    shortLabel: "LeetCode",
    icon: Code2,
    tileClass: "bg-amber-100 text-amber-700",
    chipClass: "border-amber-700/20 bg-amber-50 text-amber-900",
    chipActiveClass: "border-amber-700 bg-amber-100 text-amber-950 ring-1 ring-amber-700",
    barClass: "bg-amber-500",
  },
  project: {
    slug: "project",
    label: "Projeto",
    shortLabel: "Projeto",
    icon: GitBranch,
    tileClass: "bg-emerald-100 text-emerald-700",
    chipClass: "border-emerald-700/20 bg-emerald-50 text-emerald-900",
    chipActiveClass:
      "border-emerald-700 bg-emerald-100 text-emerald-950 ring-1 ring-emerald-700",
    barClass: "bg-emerald-500",
  },
  books: {
    slug: "books",
    label: "Livros",
    shortLabel: "Livros",
    icon: BookOpen,
    tileClass: "bg-blue-100 text-blue-700",
    chipClass: "border-blue-700/20 bg-blue-50 text-blue-900",
    chipActiveClass: "border-blue-700 bg-blue-100 text-blue-950 ring-1 ring-blue-700",
    barClass: "bg-blue-500",
  },
  esw: {
    slug: "esw",
    label: "ESW (Eng. de Software)",
    shortLabel: "ESW",
    icon: Layers,
    tileClass: "bg-violet-100 text-violet-700",
    chipClass: "border-violet-700/20 bg-violet-50 text-violet-900",
    chipActiveClass: "border-violet-700 bg-violet-100 text-violet-950 ring-1 ring-violet-700",
    barClass: "bg-violet-500",
  },
  data: {
    slug: "data",
    label: "Dados",
    shortLabel: "Dados",
    icon: Database,
    tileClass: "bg-teal-100 text-teal-700",
    chipClass: "border-teal-700/20 bg-teal-50 text-teal-900",
    chipActiveClass: "border-teal-700 bg-teal-100 text-teal-950 ring-1 ring-teal-700",
    barClass: "bg-teal-500",
  },
};

export const CATEGORY_LIST: CategoryMeta[] = [
  CATEGORY_META.leetcode,
  CATEGORY_META.project,
  CATEGORY_META.books,
  CATEGORY_META.esw,
  CATEGORY_META.data,
];

const DIFFICULTY_PT: Record<string, string> = {
  Easy: "Fácil",
  Medium: "Médio",
  Hard: "Difícil",
};

export function formatMetadataChips(
  slug: CategorySlug,
  metadata: Record<string, unknown>,
): string[] {
  const chips: string[] = [];
  if (slug === "leetcode") {
    if (typeof metadata.difficulty === "string" && metadata.difficulty) {
      chips.push(DIFFICULTY_PT[metadata.difficulty] ?? metadata.difficulty);
    }
    if (typeof metadata.language === "string" && metadata.language) {
      chips.push(metadata.language);
    }
  } else if (slug === "books") {
    if (typeof metadata.book_title === "string" && metadata.book_title) {
      chips.push(metadata.book_title);
    }
    if (typeof metadata.pages_read === "number" && metadata.pages_read > 0) {
      chips.push(`${metadata.pages_read} págs`);
    }
  } else if (slug === "project") {
    if (typeof metadata.repository === "string" && metadata.repository) {
      chips.push(metadata.repository);
    }
    if (typeof metadata.commits_count === "number" && metadata.commits_count > 0) {
      chips.push(`${metadata.commits_count} commit(s)`);
    }
    if (typeof metadata.duration_minutes === "number" && metadata.duration_minutes > 0) {
      chips.push(`${metadata.duration_minutes} min`);
    }
  } else {
    if (typeof metadata.topic === "string" && metadata.topic) {
      chips.push(metadata.topic);
    }
    if (typeof metadata.duration_minutes === "number" && metadata.duration_minutes > 0) {
      chips.push(`${metadata.duration_minutes} min`);
    }
  }
  return chips;
}

export function formatPointsLabel(
  points: number,
  scoringMode: ScoringMode,
  status: "valid" | "invalidated",
): string {
  if (status === "invalidated") return "Invalidado";
  if (scoringMode === "checkin") {
    return points > 0 ? "+1 check-in" : "0 check-in (já pontuou hoje)";
  }
  return `+${points} pts`;
}

const TIMEZONE_LABELS: Record<string, string> = {
  "America/Sao_Paulo": "Brasília (GMT-3)",
  UTC: "UTC (GMT+0)",
  "America/New_York": "Nova York (EST)",
  "Europe/Lisbon": "Lisboa (WET)",
  "Europe/London": "Londres (GMT)",
};

export function formatTimezoneLabel(tz: string): string {
  return TIMEZONE_LABELS[tz] ?? tz;
}

export function formatDateTimeBr(iso: string | null): string {
  if (!iso) return "Nunca sincronizado";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const WEEKDAY_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function localTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Data de estudo (YYYY-MM-DD) em formato relativo: "hoje", "ontem" ou "seg, 16/11".
 * Datas de outro ano levam o ano: "seg, 16/11/2025".
 */
export function formatStudyDate(iso: string, todayIso: string = localTodayIso()): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  const diffDays = Math.round((today - date) / 86_400_000);
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "ontem";
  const weekday = WEEKDAY_PT[new Date(date).getUTCDay()];
  const dayMonth = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  return y === ty ? `${weekday}, ${dayMonth}` : `${weekday}, ${dayMonth}/${y}`;
}
