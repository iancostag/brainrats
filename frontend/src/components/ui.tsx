"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

/* ---------- Avatar ---------- */

const AVATAR_SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  ring = "ring-card",
  className = "",
}: {
  name: string;
  src: string | null | undefined;
  size?: keyof typeof AVATAR_SIZES;
  /** Cor do anel: a da superfície ao redor, ou um destaque. */
  ring?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const sizeClass = AVATAR_SIZES[size];
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-2 ${ring} ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent-bright to-accent font-bold text-white ring-2 ${ring} ${className}`}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/* ---------- Aviso inline (sucesso, erro, info, descanso) ---------- */

type NoticeTone = "success" | "error" | "info" | "rest";

const NOTICE_STYLES: Record<NoticeTone, { box: string; icon: LucideIcon }> = {
  success: {
    box: "border-emerald-700/25 bg-emerald-50 text-emerald-900",
    icon: CheckCircle2,
  },
  error: { box: "border-red-600/30 bg-red-50 text-red-900", icon: AlertTriangle },
  info: { box: "border-accent/25 bg-accent/10 text-accent-strong", icon: Info },
  rest: { box: "border-amber-700/25 bg-amber-50 text-amber-950", icon: Info },
};

export function Notice({
  tone,
  children,
  onDismiss,
  action,
  className = "",
}: {
  tone: NoticeTone;
  children: ReactNode;
  onDismiss?: () => void;
  action?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = NOTICE_STYLES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? undefined : "polite"}
      className={`animate-rise-in flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium ${box} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="-my-1 -mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-80 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Erro com botão de nova tentativa, para falhas de carregamento. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Notice
      tone="error"
      action={
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-sm -my-1 bg-red-700 text-white hover:bg-red-700/90"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Tentar novamente
        </button>
      }
    >
      {message}
    </Notice>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="card flex items-center gap-3 p-5 text-sm font-medium text-ink-2"
    >
      <RefreshCw className="h-4 w-4 animate-spin text-accent-text" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-lane-strong bg-well/70 px-6 py-8 text-center ${className}`}
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent-text">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-bold text-ink-strong">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-2">{children}</div>}
      {action}
    </div>
  );
}

/* ---------- Cabeçalho das páginas internas ---------- */

export function PageHeader({
  icon: Icon,
  title,
  description,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3.5">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-shell text-accent-bright shadow-raised">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-strong">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
        </div>
      </div>
      {aside}
    </header>
  );
}
