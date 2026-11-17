"use client";

import { BookMarked, Code2, Flame, GitBranch, Github, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import { loginUser, setStoredToken, type User } from "@/lib/api";

interface LoginViewProps {
  sessionNotice?: string | null;
  onSuccess: (user: User) => void;
}

export function LoginView({ sessionNotice, onSuccess }: LoginViewProps) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(payload: {
    username: string;
    display_name?: string;
    github_username?: string;
    leetcode_username?: string;
  }) {
    setError(null);
    setLoading(true);
    try {
      const result = await loginUser(payload);
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim()) {
      setError("Informe um username para entrar.");
      return;
    }
    void handleLogin({
      username: username.trim(),
      display_name: displayName.trim() || undefined,
      github_username: githubUsername.trim() || undefined,
      leetcode_username: leetcodeUsername.trim() || undefined,
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-5 py-10 sm:px-6 md:flex-row md:items-center md:gap-10 lg:gap-14">
      <section className="flex flex-1 flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Flame className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-zinc-100">BrainRats</span>
        </div>

        <h1 className="max-w-xl text-3xl font-bold tracking-tight text-zinc-50 sm:text-5xl sm:leading-[1.1]">
          Constância em grupo para estudos de programação.
        </h1>

        <p className="max-w-xl text-base leading-relaxed text-zinc-400">
          Compita com amigos ou sua turma em desafios com{" "}
          <span className="text-zinc-200">Modo Check-in</span> ou{" "}
          <span className="text-zinc-200">Modo Pontuação</span>, registre estudos sem atrito e
          proteja sua ofensiva com dias de descanso.
        </p>

        <ul className="mt-1 space-y-3 text-sm text-zinc-300">
          <li className="flex items-start gap-3">
            <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong className="font-medium text-zinc-100">Cinco frentes de estudo:</strong>{" "}
              LeetCode, Projeto, Livros, ESW (Eng. de Software) e Dados.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              <strong className="font-medium text-zinc-100">Publicação automática:</strong>{" "}
              commits do GitHub e submissões do LeetCode entram direto no desafio.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <BookMarked className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
            <span>
              <strong className="font-medium text-zinc-100">Diário pesquisável e social:</strong>{" "}
              anotações salvas em histórico com busca, reações e moderação do grupo.
            </span>
          </li>
        </ul>
      </section>

      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-zinc-100">Entrar ou criar conta</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Escolha seu identificador único para acessar desafios e histórico.
        </p>

        {sessionNotice && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          >
            {sessionNotice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-300">Username *</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: iancostag"
              autoComplete="username"
              className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-300">Nome de exibição</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="ex: Ian Costa"
              autoComplete="name"
              className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-1 text-zinc-300">
                <Github className="h-3.5 w-3.5" /> GitHub (opcional)
              </span>
              <input
                type="text"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                placeholder="iancostag"
                className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-1 text-zinc-300">
                <Code2 className="h-3.5 w-3.5" /> LeetCode (opcional)
              </span>
              <input
                type="text"
                value={leetcodeUsername}
                onChange={(e) => setLeetcodeUsername(e.target.value)}
                placeholder="usuario_lc"
                className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
              />
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 min-h-11 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar Agora"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void handleLogin({
                username: "demo_dev",
                display_name: "Dev Demo",
                github_username: "iancostag",
              })
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
            Entrar com Conta Demo
          </button>
        </form>
      </section>
    </main>
  );
}
