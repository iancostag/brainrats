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
import { Notice } from "@/components/ui";

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
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Painel da marca: navy com o mascote. No celular vira um cabeçalho compacto. */}
      <section className="relative isolate overflow-hidden bg-shell px-6 py-6 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-accent-bright/30 blur-3xl" />
          <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-grape/25 blur-3xl" />
          <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,transparent_0_22px,rgb(255_255_255/0.025)_22px_24px)]" />
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <Image
              src="/logo-icon.jpg"
              alt=""
              width={48}
              height={48}
              priority
              className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10"
            />
            <span className="text-xl font-extrabold tracking-tight">
              Brain<span className="text-accent-bright">Rats</span>
            </span>
          </span>
          <ThemeToggle tone="dark" className="lg:hidden" />
        </div>

        <div className="mt-8 flex flex-col gap-6 lg:mt-0">
          <Image
            src="/mascot.png"
            alt=""
            width={480}
            height={316}
            priority
            className="hidden w-64 -rotate-3 drop-shadow-[0_24px_40px_rgb(244_81_30/0.35)] lg:block xl:w-80"
          />
          <h1 className="max-w-xl text-3xl font-extrabold tracking-tight text-balance sm:text-5xl sm:leading-[1.05]">
            Constância em grupo para estudos de{" "}
            <span className="text-accent-bright">programação</span>.
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-slate-300">
            Compita com amigos ou com a turma no{" "}
            <strong className="font-semibold text-white">Modo Check-in</strong> ou no{" "}
            <strong className="font-semibold text-white">Modo Pontuação</strong>, registre estudos
            sem atrito e proteja sua ofensiva com dias de descanso.
          </p>

          <ul className="hidden gap-3 text-sm text-slate-300 sm:grid">
            <li className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-gold ring-1 ring-white/10">
                <Code2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <strong className="font-semibold text-white">Cinco categorias de estudo:</strong>{" "}
                LeetCode, Projeto, Livros, ESW (Eng. de Software) e Dados.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-emerald-300 ring-1 ring-white/10">
                <GitBranch className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <strong className="font-semibold text-white">Publicação automática:</strong>{" "}
                commits do GitHub e submissões do LeetCode entram direto no desafio.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-grape-soft ring-1 ring-white/10">
                <BookMarked className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <strong className="font-semibold text-white">Diário pesquisável e placar:</strong>{" "}
                anotações em histórico com busca, reações e moderação do grupo.
              </span>
            </li>
          </ul>
        </div>

        <p className="mt-8 hidden font-mono text-xs text-slate-500 lg:block">BrainRats · est. 2026</p>
      </section>

      <main className="flex items-start justify-center px-5 py-8 sm:px-8 lg:items-center lg:py-12">
        <div className="w-full max-w-md">
          <div className="mb-4 hidden justify-end lg:flex">
            <ThemeToggle />
          </div>
          <section aria-labelledby="login-title" className="card p-6 sm:p-7">
            <h2 id="login-title" className="text-2xl font-extrabold tracking-tight text-ink-strong">
              {mode === "login" ? "Acesse sua conta" : "Crie sua conta"}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {providers.github_oauth_enabled
                ? "Entre com o GitHub ou com usuário e senha."
                : "Entre com seu usuário e senha."}
            </p>

            {sessionNotice && (
              <Notice tone="rest" className="mt-4">
                {sessionNotice}
              </Notice>
            )}

            {providers.github_oauth_enabled ? (
              <a href={getGithubOAuthUrl()} className="btn btn-dark mt-5 w-full">
                <Github className="h-4 w-4" aria-hidden="true" />
                Entrar com GitHub
              </a>
            ) : null}

            <div
              role="tablist"
              aria-label="Modo de acesso"
              className="segmented mt-5 grid-cols-2 bg-well ring-1 ring-lane-soft"
            >
              {(
                [
                  { id: "login", label: "Entrar" },
                  { id: "register", label: "Criar conta" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === opt.id}
                  onClick={() => {
                    setMode(opt.id);
                    setError(null);
                  }}
                  className={`segmented-item ${
                    mode === opt.id
                      ? "bg-card text-ink-strong shadow-card ring-1 ring-lane"
                      : "text-ink-2 hover:text-ink-strong"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5">
              <label className="field-label">
                Username *
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex.: iancostag"
                  autoComplete="username"
                  className="field"
                  required
                />
              </label>

              <label className="field-label">
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Senha *
                </span>
                <span className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    minLength={mode === "register" ? 6 : 1}
                    className="field pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-lane-soft hover:text-ink-strong"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </span>
              </label>

              {mode === "register" && (
                <div className="animate-reveal flex flex-col gap-3.5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="field-label">
                      Nome
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Ian Costa"
                        autoComplete="name"
                        className="field"
                      />
                    </label>
                    <label className="field-label">
                      E-mail (opcional)
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@exemplo.com"
                        autoComplete="email"
                        className="field"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="field-label">
                      <span className="inline-flex items-center gap-1">
                        <Github className="h-3.5 w-3.5" aria-hidden="true" /> GitHub (opcional)
                      </span>
                      <input
                        type="text"
                        value={githubUsername}
                        onChange={(e) => setGithubUsername(e.target.value)}
                        placeholder="iancostag"
                        className="field"
                      />
                    </label>

                    <label className="field-label">
                      <span className="inline-flex items-center gap-1">
                        <Code2 className="h-3.5 w-3.5" aria-hidden="true" /> LeetCode (opcional)
                      </span>
                      <input
                        type="text"
                        value={leetcodeUsername}
                        onChange={(e) => setLeetcodeUsername(e.target.value)}
                        placeholder="usuario_lc"
                        className="field"
                      />
                    </label>
                  </div>
                </div>
              )}

              {error && (
                <Notice tone="error" onDismiss={() => setError(null)}>
                  {error}
                </Notice>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary mt-1">
                {loading
                  ? "Autenticando..."
                  : mode === "login"
                    ? "Entrar com senha"
                    : "Criar conta"}
              </button>

              {providers.dev_login_enabled && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleDemoLogin()}
                  className="btn btn-secondary"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                  Entrar com conta demo
                </button>
              )}
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
