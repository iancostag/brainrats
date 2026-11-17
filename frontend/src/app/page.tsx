import { BookOpen, Code2, Database, Flame, GitBranch, Layers } from "lucide-react";

const CATEGORIES = [
  {
    slug: "leetcode",
    name: "LeetCode",
    description: "Algoritmos, estruturas de dados e sync automático de submissões.",
    badge: "Auto-sync",
    icon: Code2,
  },
  {
    slug: "project",
    name: "Continuidade de Projeto",
    description: "Commits monitorados no GitHub e evolução diária de repositórios.",
    badge: "Auto-sync",
    icon: GitBranch,
  },
  {
    slug: "books",
    name: "Leitura de Livros",
    description: "Registro rápido de páginas e capítulos técnicos lidos.",
    badge: "Manual",
    icon: BookOpen,
  },
  {
    slug: "esw",
    name: "ESW (Engenharia de Software)",
    description: "System Design, arquitetura, padrões de projeto, testes e docs.",
    badge: "Manual",
    icon: Layers,
  },
  {
    slug: "data",
    name: "Dados",
    description: "SQL, modelagem, pipelines/ETL, Python/Pandas, BI e ML.",
    badge: "Manual",
    icon: Database,
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-4 border-b border-zinc-800 pb-8">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          <Flame className="h-3.5 w-3.5" />
          BrainRats MVP · Python + Next.js
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
          Constância e desafios para estudos de programação.
        </h1>
        <p className="max-w-2xl text-base text-zinc-400 sm:text-lg">
          Grupos privados ou abertos com escolha entre{" "}
          <span className="text-zinc-200">Modo Check-in</span> e{" "}
          <span className="text-zinc-200">Modo Pontuação</span>, ofensiva com Rest Days e
          diário de estudos pesquisável.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <article
              key={cat.slug}
              className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-300">
                  {cat.badge}
                </span>
              </div>
              <div>
                <h2 className="font-semibold text-zinc-100">{cat.name}</h2>
                <p className="mt-1 text-sm text-zinc-400">{cat.description}</p>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
