"use client";

import { BookMarked, Code2, GitBranch, Github, Lock, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import {
  fetchAuthProviders,
  getGithubOAuthUrl,
  loginUser,
  loginWithPassword,
  registerWithPassword,
  setStoredToken,
  type AuthProviders,
  type User,
} from "@/lib/api";

interface LoginViewProps {
  sessionNotice?: string | null;
  onSuccess: (user: User) => void;
}

export function LoginView({ sessionNotice, onSuccess }: LoginViewProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [providers, setProviders] = useState<AuthProviders>({
    github_oauth_enabled: false,
    password_auth_enabled: true,
    dev_login_enabled: true,
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthProviders()
      .then(setProviders)
      .catch(() => {
        // Keep safe defaults if providers probe fails before backend starts.
      });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Informe username e senha.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result =
        mode === "login"
          ? await loginWithPassword({ username: username.trim(), password })
          : await registerWithPassword({
              username: username.trim(),
              password,
              display_name: displayName.trim() || undefined,
              email: email.trim() || undefined,
              github_username: githubUsername.trim() || undefined,
              leetcode_username: leetcodeUsername.trim() || undefined,
            });
      setStoredToken(result.access_token);
      onSuccess(result.user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível entrar agora. Tente novamente em instantes.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError(null);
    setLoading(true);
    try {
      const result = await loginUser({
        username: "demo_dev",
        display_name: "Dev Demo",
        github_username: "iancostag",
      });
      setStoredToken(result.access_token);
      onSuccess(result.user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível entrar com a conta demo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F1EC]">
      <header className="border-b-[3px] border-[#D94E28] bg-[#0F1722] px-5 py-3 text-white sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-icon.jpg"
              alt="Ícone BrainRats"
              className="h-9 w-9 rounded-lg border border-slate-700 object-cover"
            />
            <span className="text-lg font-extrabold tracking-tight">BrainRats</span>
          </div>
          <span className="font-mono text-xs text-slate-300">PT-BR · WEB / PWA</span>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl flex-col justify-center gap-10 px-5 py-10 sm:px-8 md:flex-row md:items-center md:gap-10 lg:gap-14">
        <section className="flex flex-1 flex-col gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-wordmark.png"
            alt="BrainRats"
            className="h-12 w-auto self-start object-contain sm:h-14"
          />

          <h1 className="max-w-xl text-3xl font-extrabold tracking-tight text-[#0F1722] sm:text-5xl sm:leading-[1.08]">
            Constância em grupo para estudos de programação.
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-[#475569]">
            Compita com amigos ou sua turma em desafios com{" "}
            <strong className="font-semibold text-[#0F1722]">Modo Check-in</strong> ou{" "}
            <strong className="font-semibold text-[#0F1722]">Modo Pontuação</strong>, registre
            estudos sem atrito e proteja sua ofensiva com dias de descanso.
          </p>

          <ul className="mt-1 space-y-3 text-sm text-[#334155]">
            <li className="flex items-start gap-3">
              <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
              <span>
                <strong className="font-semibold text-[#0F1722]">Cinco raias de estudo:</strong>{" "}
                LeetCode, Projeto, Livros, ESW (Eng. de Software) e Dados.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-[#15803D]" />
              <span>
                <strong className="font-semibold text-[#0F1722]">Publicação automática:</strong>{" "}
                commits do GitHub e submissões do LeetCode entram direto no desafio.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <BookMarked className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]" />
              <span>
                <strong className="font-semibold text-[#0F1722]">
                  Diário pesquisável e placar:
                </strong>{" "}
                anotações salvas em histórico com busca, reações e moderação do grupo.
              </span>
            </li>
          </ul>
        </section>

        <section className="w-full max-w-md rounded-xl border border-[#DDD8CE] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-emblem.jpg"
              alt="Emblema BrainRats"
              className="h-12 w-12 shrink-0 rounded-full border border-[#DDD8CE] object-cover"
            />
            <div>
              <h2 className="text-xl font-bold text-[#0F1722]">Acesse sua conta</h2>
              <p className="text-xs text-[#475569]">
                Entre com GitHub OAuth ou usuário e senha.
              </p>
            </div>
          </div>

          {sessionNotice && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 rounded-lg border border-amber-600/40 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              {sessionNotice}
            </div>
          )}

          <div className="mt-5">
            {providers.github_oauth_enabled ? (
              <a
                href={getGithubOAuthUrl()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0F1722] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1E293B]"
              >
                <Github className="h-4 w-4" />
                Entrar com GitHub
              </a>
            ) : (
              <div className="rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-2 text-xs text-[#475569]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F1722]">
                  <Github className="h-3.5 w-3.5" /> GitHub OAuth
                </span>{" "}
                pronto para ativar via{" "}
                <code className="font-mono text-[11px]">GITHUB_CLIENT_ID</code> no servidor.
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`min-h-9 rounded-md transition ${
                mode === "login"
                  ? "bg-white text-[#0F1722] shadow-xs"
                  : "text-[#475569] hover:text-[#0F1722]"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`min-h-9 rounded-md transition ${
                mode === "register"
                  ? "bg-white text-[#0F1722] shadow-xs"
                  : "text-[#475569] hover:text-[#0F1722]"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-[#1E293B]">Username *</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: iancostag"
                autoComplete="username"
                className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722] placeholder:text-[#64748B]"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-1 font-medium text-[#1E293B]">
                <Lock className="h-3.5 w-3.5" /> Senha *
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                minLength={mode === "register" ? 6 : 1}
                className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722] placeholder:text-[#64748B]"
                required
              />
            </label>

            {mode === "register" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-[#1E293B]">Nome</span>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ian Costa"
                      autoComplete="name"
                      className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722] placeholder:text-[#64748B]"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-[#1E293B]">E-mail (opcional)</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      autoComplete="email"
                      className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722] placeholder:text-[#64748B]"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-1 font-medium text-[#1E293B]">
                      <Github className="h-3.5 w-3.5" /> GitHub (opcional)
                    </span>
                    <input
                      type="text"
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value)}
                      placeholder="iancostag"
                      className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722] placeholder:text-[#64748B]"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-1 font-medium text-[#1E293B]">
                      <Code2 className="h-3.5 w-3.5" /> LeetCode (opcional)
                    </span>
                    <input
                      type="text"
                      value={leetcodeUsername}
                      onChange={(e) => setLeetcodeUsername(e.target.value)}
                      placeholder="usuario_lc"
                      className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722] placeholder:text-[#64748B]"
                    />
                  </label>
                </div>
              </>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-600/35 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 min-h-11 rounded-lg bg-[#D94E28] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#C2411E] disabled:opacity-50"
            >
              {loading
                ? "Autenticando..."
                : mode === "login"
                  ? "Entrar com Senha"
                  : "Criar Conta"}
            </button>

            {providers.dev_login_enabled && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleDemoLogin()}
                className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#0F1722]/20 bg-[#FAF9F6] px-4 py-2.5 text-sm font-semibold text-[#0F1722] transition hover:border-[#0F1722] hover:bg-[#F3F1EC] disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-[#D94E28]" />
                Entrar com Conta Demo
              </button>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}
