"use client";

import { Download, Share, Smartphone, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_STORAGE_KEY = "brainrats_pwa_install_dismissed_until";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone = Boolean((window.navigator as { standalone?: boolean }).standalone);
  return mediaStandalone || iosStandalone;
}

function isIosSafariBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isSafari;
}

function isInstallDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
  if (!raw) return false;
  const until = Number(raw);
  return Number.isFinite(until) && Date.now() < until;
}

export function PwaControls() {
  const [isOnline, setIsOnline] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setIsOnline(window.navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const standalone = isStandaloneMode();
    const alreadyDismissed = isInstallDismissed();
    setDismissed(standalone || alreadyDismissed);

    if (!standalone && !alreadyDismissed && isIosSafariBrowser()) {
      setShowIosHint(true);
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (isStandaloneMode() || isInstallDismissed()) return;
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShowIosHint(false);
      setDismissed(false);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowIosHint(false);
      setDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function handleDismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_DURATION_MS));
    }
    setDeferredPrompt(null);
    setShowIosHint(false);
    setDismissed(true);
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
        setDismissed(true);
      }
    } finally {
      setInstalling(false);
    }
  }

  const showInstallBanner = !dismissed && (deferredPrompt !== null || showIosHint);

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-0 right-0 top-0 z-50 border-b border-amber-500/40 bg-[#0F1722] px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-xs font-medium text-amber-200"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 text-center">
            <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>
              Sem conexão com a internet. Novos check-ins e sync exigem rede ativa.
            </span>
          </div>
        </div>
      )}

      {showInstallBanner && (
        <aside
          aria-label="Instalar aplicativo BrainRats"
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 rounded-xl border border-slate-700 bg-[#0F1722] p-3.5 text-white md:bottom-5 md:left-auto md:right-5 md:w-96"
        >
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-192.png"
              alt="Ícone BrainRats"
              className="h-10 w-10 shrink-0 rounded-lg border border-slate-700 object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">Instalar BrainRats no celular</p>
              {deferredPrompt ? (
                <>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                    Abra em tela cheia direto da tela inicial para registrar estudos mais rápido.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={installing}
                      onClick={() => void handleInstallClick()}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#D94E28] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#C2411E] disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {installing ? "Instalando..." : "Instalar app"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDismiss}
                      className="min-h-9 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-[#182232] hover:text-white"
                    >
                      Agora não
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs leading-relaxed text-slate-300">
                  <Smartphone className="inline h-3.5 w-3.5 shrink-0 text-[#FF8A65]" />
                  <span>
                    No Safari, toque em{" "}
                    <strong className="inline-flex items-center gap-1 font-semibold text-white">
                      <Share className="h-3 w-3" /> Compartilhar
                    </strong>{" "}
                    e depois em{" "}
                    <strong className="font-semibold text-white">Adicionar à Tela de Início</strong>.
                  </span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Fechar aviso de instalação"
              className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-[#182232] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
