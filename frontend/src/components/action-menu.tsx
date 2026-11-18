"use client";

import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface ActionMenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}

/**
 * Menu com ações secundárias. Fecha com Esc, clique fora ou ao escolher; setas navegam.
 * Por padrão o gatilho é "⋯"; `trigger` permite outro conteúdo (ex.: avatar no perfil).
 */
export function ActionMenu({
  items,
  label,
  trigger,
  triggerClassName,
  header,
}: {
  items: ActionMenuItem[];
  label: string;
  trigger?: ReactNode;
  triggerClassName?: string;
  header?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();

    function handlePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const buttons = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
      );
      if (buttons.length === 0) return;
      event.preventDefault();
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      buttons[(idx + step + buttons.length) % buttons.length].focus();
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        className={
          triggerClassName ??
          "inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-well hover:text-ink-strong"
        }
      >
        {trigger ?? <MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className="animate-reveal absolute top-full right-0 z-40 mt-1.5 flex min-w-48 flex-col rounded-xl border border-lane bg-card p-1 shadow-raised"
        >
          {header}
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm font-medium transition-colors disabled:opacity-50 ${
                  item.tone === "danger"
                    ? "text-red-900 hover:bg-red-50"
                    : "text-ink-3 hover:bg-well hover:text-ink-strong"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
