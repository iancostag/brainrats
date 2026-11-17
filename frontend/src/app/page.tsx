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
      <main className="flex min-h-screen items-center justify-center bg-[#F3F1EC] px-6 text-sm font-medium text-[#475569]">
        Carregando sua sessão no BrainRats...
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F3F1EC] px-6">
        <div className="flex max-w-md flex-col gap-4 rounded-xl border border-[#DDD8CE] bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-[#0F1722]">
            Falha ao conectar com o servidor
          </h1>
          <p className="text-sm text-[#475569]">{sessionError}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void validateSession()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#D94E28] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C2411E]"
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
              className="min-h-10 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-4 py-2 text-sm font-medium text-[#111827] hover:border-[#0F1722]"
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
