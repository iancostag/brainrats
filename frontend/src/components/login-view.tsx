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
    <div className="min-h-screen bg-[#F3F1EC]">
      <header className="border-b-[3px] border-[#D94E28] bg-[#0F1722] px-5 py-3.5 text-white sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#D94E28] text-white">
              <Flame className="h-4 w-4" />
            </div>
            <span className="text-lg font-extrabold tracking-tight">BrainRats</span>
          </div>
          <span className="font-mono text-xs text-slate-300">PT-BR · WEB / PWA</span>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl flex-col justify-center gap-10 px-5 py-10 sm:px-8 md:flex-row md:items-center md:gap-10 lg:gap-14">
        <section className="flex flex-1 flex-col gap-5">
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
          <h2 className="text-xl font-bold text-[#0F1722]">Entrar ou criar conta</h2>
          <p className="mt-1 text-sm text-[#475569]">
            Escolha seu identificador único para acessar desafios e histórico.
          </p>

          {sessionNotice && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 rounded-lg border border-amber-600/40 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              {sessionNotice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
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
              <span className="font-medium text-[#1E293B]">Nome de exibição</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ex: Ian Costa"
                autoComplete="name"
                className="min-h-11 rounded-lg border border-[#CBD5E1] bg-[#FAF9F6] px-3 py-2 text-[#0F1722] placeholder:text-[#64748B]"
              />
            </label>

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
              className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#0F1722]/20 bg-[#FAF9F6] px-4 py-2.5 text-sm font-semibold text-[#0F1722] transition hover:border-[#0F1722] hover:bg-[#F3F1EC] disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-[#D94E28]" />
              Entrar com Conta Demo
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
