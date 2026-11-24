"use client";

import {
  Award,
  BookOpen,
  CalendarCheck,
  Code2,
  Flame,
  Layers,
  Moon,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

export const BADGE_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  flame: Flame,
  trophy: Trophy,
  layers: Layers,
  code: Code2,
  book: BookOpen,
  moon: Moon,
  calendar: CalendarCheck,
  medal: Award,
};

const SIZE_CLASSES = {
  xs: { box: "h-4 w-4", icon: "h-3.5 w-3.5" },
  sm: { box: "h-5 w-5", icon: "h-3.5 w-3.5" },
  md: { box: "h-9 w-9", icon: "h-4 w-4" },
  lg: { box: "h-12 w-12", icon: "h-5 w-5" },
} as const;

export function BadgeArtwork({
  badgeKey,
  icon,
  size = "xs",
  className = "",
}: {
  badgeKey: string;
  icon: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = `/badges/${badgeKey}.png`;

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  const Icon = BADGE_ICONS[icon] ?? Award;
  const dims = SIZE_CLASSES[size];

  if (!imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setImgFailed(true)}
        className={`${dims.box} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return <Icon className={`${dims.icon} shrink-0 ${className}`} aria-hidden="true" />;
}
