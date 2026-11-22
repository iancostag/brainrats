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
import { getPendingInvite, setPendingInvite } from "@/lib/invite";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [dashboardNotice, setDashboardNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const validateSession = useCallback(async () => {
    let oauthNotice: string | null = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const oauthToken = params.get("token");
      const oauthError = params.get("oauth_error");
      const oauthLinked = params.get("oauth_linked");
      const inviteParam = params.get("invite");
      const tabParam = params.get("tab");

      if (inviteParam && inviteParam.trim()) {
        setPendingInvite(inviteParam);
      }

      if (oauthToken) {
        setStoredToken(oauthToken);
      }
      if (oauthLinked === "1") {
        setDashboardNotice({
          ok: true,
          text: "Conta do GitHub vinculada com sucesso via OAuth!",
        });
      }
      if (oauthError) {
        oauthNotice =
          oauthError === "github_already_linked"
            ? "Esta conta do GitHub já está vinculada a outro usuário no BrainRats."
            : "Não foi possível concluir o login com GitHub. Tente novamente.";
        setSessionNotice(oauthNotice);
        setDashboardNotice({ ok: false, text: oauthNotice });
      }

      if (oauthToken || oauthError || oauthLinked || inviteParam) {
        const nextUrl = tabParam
          ? `${window.location.pathname}?tab=${encodeURIComponent(tabParam)}`
          : window.location.pathname;
        window.history.replaceState({}, "", nextUrl);
      }
    }

    const pendingInvite = getPendingInvite();
    const token = getStoredToken();
    if (!token) {
      if (!oauthNotice && pendingInvite) {
        setSessionNotice(
          `Você recebeu um convite para um desafio (${pendingInvite}). Entre ou crie sua conta para abrir direto nele.`,
        );
      }
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
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.jpg" alt="" className="h-16 w-16 rounded-2xl object-cover shadow-raised" />
          <div className="card flex items-center gap-3 px-5 py-3 text-sm font-medium text-ink-2">
            <RefreshCw className="h-4 w-4 animate-spin text-accent-text" aria-hidden="true" />
            <span>Carregando sua sessão no BrainRats...</span>
          </div>
        </div>
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div role="alert" className="card flex max-w-md flex-col gap-4 p-6 text-center">
          <h1 className="text-lg font-bold text-ink-strong">
            Falha ao conectar com o servidor
          </h1>
          <p className="text-sm text-ink-2">{sessionError}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void validateSession()}
              className="btn btn-primary"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => {
                clearStoredToken();
                setSessionError(null);
                setUser(null);
              }}
              className="btn btn-secondary"
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
      initialNotice={dashboardNotice}
      onUserUpdated={setUser}
      onLogout={() => {
        setSessionNotice(null);
        setDashboardNotice(null);
        setUser(null);
      }}
    />
  );
}
