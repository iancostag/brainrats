"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "brainrats_theme";

/** Lê e grava o tema atual (data-theme no <html> + localStorage). */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => {
    setThemeState(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function setTheme(next: Theme) {
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Armazenamento indisponível: o tema vale só nesta sessão.
    }
    setThemeState(next);
  }

  return { theme, setTheme };
}

export function ThemeToggle({
  className = "",
  tone = "light",
}: {
  className?: string;
  /** "dark" para usar sobre superfícies navy. */
  tone?: "light" | "dark";
}) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Mudar para tema claro" : "Mudar para tema escuro";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
        tone === "dark"
          ? "border-white/15 bg-white/5 text-slate-200 hover:border-white/30 hover:text-white"
          : "border-lane bg-card text-ink-2 hover:border-lane-strong hover:text-ink-strong"
      } ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
