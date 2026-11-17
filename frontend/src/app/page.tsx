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
  type User,
} from "@/lib/api";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const validateSession = useCallback(async () => {
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
      <main className="flex min-h-screen items-center justify-center px-6 text-sm text-zinc-400">
        Carregando sua sessão no BrainRats...
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="flex max-w-md flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 text-center">
          <h1 className="text-lg font-semibold text-zinc-100">
            Falha ao conectar com o servidor
          </h1>
          <p className="text-sm text-zinc-400">{sessionError}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void validateSession()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
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
              className="min-h-10 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500"
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
