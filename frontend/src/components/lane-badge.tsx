import { Check, ShieldAlert } from "lucide-react";

import type { CategorySlug } from "@/lib/api";
import { CATEGORY_META } from "@/lib/categories";

/** Bloco com o ícone da categoria. Decorativo: o rótulo vem ao lado. */
export function CategoryIcon({
  slug,
  size = "sm",
  round = false,
  checked = false,
  className = "",
}: {
  slug: CategorySlug;
  size?: "sm" | "md";
  round?: boolean;
  /** Mostra um check no lugar do ícone (estado selecionado, sem depender só da cor). */
  checked?: boolean;
  className?: string;
}) {
  const meta = CATEGORY_META[slug];
  if (!meta) return null;
  const Icon = checked ? Check : meta.icon;
  const box = `${size === "md" ? "h-7 w-7" : "h-5 w-5"} ${
    round ? "rounded-full" : size === "md" ? "rounded-lg" : "rounded-md"
  }`;
  const icon = size === "md" ? "h-4 w-4" : "h-3 w-3";
  const tileStyle = checked ? "bg-ink-strong text-canvas" : `${meta.tileClass} border border-current/15`;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center ${box} ${tileStyle} ${className}`}
    >
      <Icon className={icon} strokeWidth={2.4} />
    </span>
  );
}

/** Chip de categoria: ícone + nome curto, nas cores da categoria. */
export function CategoryBadge({ slug }: { slug: CategorySlug }) {
  const meta = CATEGORY_META[slug];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs font-semibold ${meta.chipClass}`}
    >
      <CategoryIcon slug={slug} round />
      {meta.shortLabel}
    </span>
  );
}

/**
 * Filtro por categoria reutilizado no feed e no diário.
 * "Todas" + uma opção por categoria + opção extra (ex.: denunciados).
 * Rola na horizontal em telas estreitas em vez de quebrar em várias linhas.
 */
export function CategoryFilter({
  slugs,
  value,
  onChange,
  counts,
  label,
  reportedCount,
}: {
  slugs: CategorySlug[];
  value: string;
  onChange: (next: string) => void;
  counts?: Record<string, number>;
  label: string;
  /** Quando definido e > 0, mostra o filtro "Denunciados" (só admins). */
  reportedCount?: number;
}) {
  const base =
    "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border text-xs font-semibold transition-colors";
  return (
    <div
      role="group"
      aria-label={label}
      className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 sm:flex-wrap sm:overflow-visible"
    >
      <button
        type="button"
        aria-pressed={value === "all"}
        onClick={() => onChange("all")}
        className={`${base} px-3.5 ${
          value === "all"
            ? "border-action bg-action text-white"
            : "border-lane bg-card text-ink-2 hover:border-lane-strong hover:text-ink-strong"
        }`}
      >
        Todas
      </button>
      {slugs.map((slug) => {
        const meta = CATEGORY_META[slug];
        if (!meta) return null;
        const active = value === slug;
        const count = counts?.[slug];
        return (
          <button
            key={slug}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(slug)}
            className={`${base} py-0.5 pr-3 pl-0.5 ${
              active ? meta.chipActiveClass : `${meta.chipClass} hover:border-lane-strong`
            }`}
          >
            <CategoryIcon slug={slug} size="md" round checked={active} />
            {meta.shortLabel}
            {count ? <span className="font-score text-sm opacity-80">{count}</span> : null}
          </button>
        );
      })}
      {reportedCount !== undefined && reportedCount > 0 && (
        <button
          type="button"
          aria-pressed={value === "reported"}
          onClick={() => onChange("reported")}
          className={`${base} px-3 ${
            value === "reported"
              ? "border-red-600 bg-red-100 text-red-950 ring-1 ring-red-600"
              : "border-red-600/35 bg-red-50 text-red-900"
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Denunciados ({reportedCount})
        </button>
      )}
    </div>
  );
}
