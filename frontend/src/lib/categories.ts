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
    badgeClass: "border-amber-600/35 bg-amber-50 text-amber-900",
    activeButtonClass: "border-amber-700 bg-amber-100 text-amber-950",
  },
  project: {
    slug: "project",
    label: "Projeto",
    shortLabel: "Projeto",
    icon: GitBranch,
    badgeClass: "border-emerald-700/35 bg-emerald-50 text-emerald-900",
    activeButtonClass: "border-emerald-800 bg-emerald-100 text-emerald-950",
  },
  books: {
    slug: "books",
    label: "Livros",
    shortLabel: "Livros",
    icon: BookOpen,
    badgeClass: "border-blue-700/35 bg-blue-50 text-blue-900",
    activeButtonClass: "border-blue-800 bg-blue-100 text-blue-950",
  },
  esw: {
    slug: "esw",
    label: "ESW (Eng. de Software)",
    shortLabel: "ESW",
    icon: Layers,
    badgeClass: "border-violet-700/35 bg-violet-50 text-violet-900",
    activeButtonClass: "border-violet-800 bg-violet-100 text-violet-950",
  },
  data: {
    slug: "data",
    label: "Dados",
    shortLabel: "Dados",
    icon: Database,
    badgeClass: "border-teal-700/35 bg-teal-50 text-teal-900",
    activeButtonClass: "border-teal-800 bg-teal-100 text-teal-950",
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
