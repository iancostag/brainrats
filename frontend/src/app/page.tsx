"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Dashboard } from "@/components/dashboard";
import { LoginView } from "@/components/login-view";
import {
  ApiError,
  clearStoredToken,
  fetchMe,
  getStoredToken,
  setStoredToken,
  type User,
} from "@/lib/api";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const validateSession = useCallback(async () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const oauthToken = params.get("token");
      const oauthError = params.get("oauth_error");
      if (oauthToken) {
        setStoredToken(oauthToken);
        window.history.replaceState({}, "", window.location.pathname);
      } else if (oauthError) {
        setSessionNotice("Não foi possível concluir o login com GitHub. Tente novamente.");
        window.history.replaceState({}, "", window.location.pathname);
      }
    }

    const token = getStoredToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }

    setCheckingSession(true);
    setSessionError(null);
    try {
      const me = await fetchMe();
      setUser(me);
      setSessionNotice(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearStoredToken();
        setUser(null);
        setSessionNotice("Sua sessão expirou. Entre novamente para continuar.");
      } else {
        setSessionError(
          err instanceof Error
            ? err.message
            : "Não foi possível validar sua sessão no momento.",
        );
      }
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    void validateSession();
  }, [validateSession]);

  if (checkingSession) {
    return (
      <main
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-canvas px-6"
      >
        <div className="flex items-center gap-3 rounded-xl border border-lane bg-card px-5 py-4 text-sm font-medium text-ink-2">
          <RefreshCw className="h-4 w-4 animate-spin text-accent-text" />
          <span>Carregando sua sessão no BrainRats...</span>
        </div>
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="flex max-w-md flex-col gap-4 rounded-xl border border-lane bg-card p-6 text-center">
          <h1 className="text-lg font-bold text-ink-strong">
            Falha ao conectar com o servidor
          </h1>
          <p className="text-sm text-ink-2">{sessionError}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void validateSession()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => {
                clearStoredToken();
                setSessionError(null);
                setUser(null);
              }}
              className="min-h-10 rounded-lg border border-lane bg-well px-4 py-2 text-sm font-medium text-ink hover:border-ink-strong"
            >
              Trocar de conta
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <LoginView
        sessionNotice={sessionNotice}
        onSuccess={(loggedUser) => {
          setSessionNotice(null);
          setUser(loggedUser);
        }}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      onUserUpdated={setUser}
      onLogout={() => {
        setSessionNotice(null);
        setUser(null);
      }}
    />
  );
}
