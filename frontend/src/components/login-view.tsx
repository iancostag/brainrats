"use client";

import { Flame, Github, Code2, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import { loginUser, setStoredToken, type User } from "@/lib/api";

interface LoginViewProps {
  onSuccess: (user: User) => void;
}

export function LoginView({ onSuccess }: LoginViewProps) {
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
          : "Não foi possível conectar na API. Verifique se o backend FastAPI está rodando.",
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
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-12 lg:flex-row lg:items-center">
      <section className="flex flex-1 flex-col gap-4">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          <Flame className="h-3.5 w-3.5" />
          BrainRats MVP · Pronto para Testar
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
          Seu GymRats de estudos de programação.
        </h1>
        <p className="max-w-xl text-base text-zinc-400">
          Crie grupos privados ou abertos, escolha entre{" "}
          <span className="text-zinc-200">Modo Check-in</span> (constância) ou{" "}
          <span className="text-zinc-200">Modo Pontuação</span>, registre LeetCode, projetos,
          livros, ESW e Dados, e acompanhe sua ofensiva com Rest Days.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-zinc-300 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <strong className="block text-emerald-400">5 Categorias</strong>
            LeetCode, Projeto, Livros, ESW e Dados
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <strong className="block text-emerald-400">Auto-Sync</strong>
            Commits do GitHub e LeetCode Accepted
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <strong className="block text-emerald-400">Diário + Social</strong>
            Busca de estudos, reações e moderação
          </div>
        </div>
      </section>

      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-zinc-100">Entrar no BrainRats</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Login instantâneo de MVP (cria sua conta automaticamente se for seu primeiro acesso).
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-300">Username *</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: iancostag"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
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
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
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
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
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
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
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
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Entrar com Conta Demo (1 clique)
          </button>
        </form>
      </section>
    </main>
  );
}
