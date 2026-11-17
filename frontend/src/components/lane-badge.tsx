import type { CategorySlug } from "@/lib/api";
import { CATEGORY_META } from "@/lib/categories";

/** Número da raia em bloco sólido na cor da categoria. Decorativo: o rótulo vem ao lado. */
export function LaneNumber({ slug, className = "" }: { slug: CategorySlug; className?: string }) {
  const meta = CATEGORY_META[slug];
  if (!meta) return null;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 font-score text-xs leading-none ${meta.laneClass} ${className}`}
    >
      {meta.lane}
    </span>
  );
}

/** Chip de categoria: número da raia + nome curto, nas cores da raia. */
export function LaneBadge({ slug }: { slug: CategorySlug }) {
  const meta = CATEGORY_META[slug];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border py-0.5 pl-0.5 pr-2 text-xs font-semibold ${meta.badgeClass}`}
    >
      <LaneNumber slug={slug} />
      <span>
        <span className="sr-only">Raia {meta.lane}: </span>
        {meta.shortLabel}
      </span>
    </span>
  );
}
