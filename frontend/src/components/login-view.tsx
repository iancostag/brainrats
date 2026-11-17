"use client";

import { BookMarked, Code2, Eye, EyeOff, GitBranch, Github, Lock, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";

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
import { ThemeToggle } from "@/components/theme-toggle";

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-canvas">
      <header className="border-b-[3px] border-accent bg-shell px-5 py-3 text-white sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-icon.jpg"
              alt=""
              width={48}
              height={48}
              priority
              className="h-11 w-11 rounded-xl border border-slate-700 object-cover sm:h-12 sm:w-12"
            />
            <span className="text-xl font-extrabold tracking-tight">BrainRats</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl flex-col justify-center gap-10 px-5 py-10 sm:px-8 md:flex-row md:items-center md:gap-10 lg:gap-14">
        <section className="flex flex-1 flex-col gap-5">
          <Image
            src="/logo-wordmark.png"
            alt="BrainRats"
            width={420}
            height={128}
            priority
            className="-my-3 h-24 w-auto max-w-full self-start object-contain object-left mix-blend-multiply sm:-my-5 sm:h-32 dark:hidden"
          />

          <h1 className="max-w-xl text-3xl font-extrabold tracking-tight text-ink-strong sm:text-5xl sm:leading-[1.08]">
            Constância em grupo para estudos de programação.
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-ink-2">
            Compita com amigos ou sua turma em desafios com{" "}
            <strong className="font-semibold text-ink-strong">Modo Check-in</strong> ou{" "}
            <strong className="font-semibold text-ink-strong">Modo Pontuação</strong>, registre
            estudos sem atrito e proteja sua ofensiva com dias de descanso.
          </p>

          <ul className="mt-1 space-y-3 text-sm text-ink-3">
            <li className="flex items-start gap-3">
              <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>
                <strong className="font-semibold text-ink-strong">Cinco raias de estudo:</strong>{" "}
                LeetCode, Projeto, Livros, ESW (Eng. de Software) e Dados.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>
                <strong className="font-semibold text-ink-strong">Publicação automática:</strong>{" "}
                commits do GitHub e submissões do LeetCode entram direto no desafio.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <BookMarked className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <span>
                <strong className="font-semibold text-ink-strong">
                  Diário pesquisável e placar:
                </strong>{" "}
                anotações salvas em histórico com busca, reações e moderação do grupo.
              </span>
            </li>
          </ul>
        </section>

        <section className="w-full max-w-md rounded-xl border border-lane bg-card p-6">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-emblem.jpg"
              alt=""
              width={80}
              height={80}
              className="h-16 w-16 shrink-0 rounded-full border border-lane object-cover sm:h-20 sm:w-20"
            />
            <div>
              <h2 className="text-xl font-bold text-ink-strong">Acesse sua conta</h2>
              <p className="text-sm text-ink-2">
                {providers.github_oauth_enabled
                  ? "Entre com o GitHub ou com usuário e senha."
                  : "Entre com seu usuário e senha."}
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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-action px-4 py-2.5 text-sm font-bold text-white transition hover:bg-action-hover"
              >
                <Github className="h-4 w-4" />
                Entrar com GitHub
              </a>
            ) : null}
          </div>

          <div
            role="tablist"
            aria-label="Modo de acesso"
            className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-lane bg-well p-1 text-xs font-semibold"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`min-h-9 rounded-md transition ${
                mode === "login"
                  ? "bg-card text-ink-strong ring-1 ring-lane"
                  : "text-ink-2 hover:text-ink-strong"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`min-h-9 rounded-md transition ${
                mode === "register"
                  ? "bg-card text-ink-strong ring-1 ring-lane"
                  : "text-ink-2 hover:text-ink-strong"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink-label">Username *</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: iancostag"
                autoComplete="username"
                className="min-h-11 rounded-lg border border-lane bg-well px-3 py-2 text-ink-strong transition-colors placeholder:text-ink-muted focus:border-ink-strong"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-1 font-medium text-ink-label">
                <Lock className="h-3.5 w-3.5" /> Senha *
              </span>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  minLength={mode === "register" ? 6 : 1}
                  className="min-h-11 w-full rounded-lg border border-lane bg-well py-2 pl-3 pr-11 text-ink-strong transition-colors placeholder:text-ink-muted focus:border-ink-strong"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-lane-soft hover:text-ink-strong"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {mode === "register" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-ink-label">Nome</span>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ian Costa"
                      autoComplete="name"
                      className="min-h-11 rounded-lg border border-lane bg-well px-3 py-2 text-ink-strong transition-colors placeholder:text-ink-muted focus:border-ink-strong"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-ink-label">E-mail (opcional)</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      autoComplete="email"
                      className="min-h-11 rounded-lg border border-lane bg-well px-3 py-2 text-ink-strong transition-colors placeholder:text-ink-muted focus:border-ink-strong"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-1 font-medium text-ink-label">
                      <Github className="h-3.5 w-3.5" /> GitHub (opcional)
                    </span>
                    <input
                      type="text"
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value)}
                      placeholder="iancostag"
                      className="min-h-11 rounded-lg border border-lane bg-well px-3 py-2 text-ink-strong transition-colors placeholder:text-ink-muted focus:border-ink-strong"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-1 font-medium text-ink-label">
                      <Code2 className="h-3.5 w-3.5" /> LeetCode (opcional)
                    </span>
                    <input
                      type="text"
                      value={leetcodeUsername}
                      onChange={(e) => setLeetcodeUsername(e.target.value)}
                      placeholder="usuario_lc"
                      className="min-h-11 rounded-lg border border-lane bg-well px-3 py-2 text-ink-strong transition-colors placeholder:text-ink-muted focus:border-ink-strong"
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
              className="mt-1 min-h-11 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-hover disabled:opacity-50"
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
                className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ink-strong/20 bg-well px-4 py-2.5 text-sm font-semibold text-ink-strong transition hover:border-ink-strong hover:bg-canvas disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-accent-text" />
                Entrar com Conta Demo
              </button>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}
