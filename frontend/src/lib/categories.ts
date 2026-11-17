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
  icon: LucideIcon;
  badgeClass: string;
  activeButtonClass: string;
}

export const CATEGORY_META: Record<CategorySlug, CategoryMeta> = {
  leetcode: {
    slug: "leetcode",
    label: "LeetCode",
    shortLabel: "LeetCode",
    icon: Code2,
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    activeButtonClass: "border-amber-500 bg-amber-500/15 text-amber-200",
  },
  project: {
    slug: "project",
    label: "Projeto",
    shortLabel: "Projeto",
    icon: GitBranch,
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    activeButtonClass: "border-emerald-500 bg-emerald-500/15 text-emerald-200",
  },
  books: {
    slug: "books",
    label: "Livros",
    shortLabel: "Livros",
    icon: BookOpen,
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    activeButtonClass: "border-sky-500 bg-sky-500/15 text-sky-200",
  },
  esw: {
    slug: "esw",
    label: "ESW (Eng. de Software)",
    shortLabel: "ESW",
    icon: Layers,
    badgeClass: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    activeButtonClass: "border-violet-500 bg-violet-500/15 text-violet-200",
  },
  data: {
    slug: "data",
    label: "Dados",
    shortLabel: "Dados",
    icon: Database,
    badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    activeButtonClass: "border-cyan-500 bg-cyan-500/15 text-cyan-200",
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
