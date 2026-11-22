# AGENTS.md — BrainRats

Guia operacional para agentes de código trabalhando neste repositório.

## 1. Visão Geral do Projeto

**BrainRats** é uma plataforma social de constância de estudos em programação (PT-BR), com 5 categorias padrão (`leetcode`, `project`, `books`, `esw`, `data`), desafios em modo `checkin` ou `points`, *Rest Days* semanais, diário pesquisável e sincronização com GitHub e LeetCode.

- `backend/` — API REST em **FastAPI** + **SQLAlchemy async** + **Pydantic v2** + worker **ARQ** (SQLite `backend/brainrats.db` por padrão em dev; PostgreSQL + Redis em Docker/produção).
- `frontend/` — **Next.js 15** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS v4** + **TanStack Query** + **PWA** (`public/manifest.webmanifest`, `public/sw.js`, `public/offline.html`).
- `docs/` — Requisitos (`docs/requisitos-mvp.md`) e arquitetura/DER (`docs/arquitetura-e-dados.md`).
- `PRODUCT.md` e `DESIGN.md` — Contexto de produto e sistema visual (*Placar de Pista & Treino*).

---

## 2. Comandos de Desenvolvimento e Validação

> **Windows (PowerShell):** use `npm.cmd` (em vez de `npm`) se a ExecutionPolicy bloquear scripts `.ps1`, e `;` no lugar de `&&`.

### Atalhos via `Makefile` (Linux/macOS/WSL/Git Bash)
- `make dev` — Sobe backend (`:8000`) e frontend (`:3000`) com `CORS_ORIGINS` incluindo IP da LAN.
- `make validate` — Roda lint, testes unitários/integração, typecheck e build de produção.

### Backend (`backend/`)
- Servidor local: `uv run uvicorn app.main:app --reload --port 8000`
- Worker ARQ: `uv run arq app.workers.sync_worker.WorkerSettings`
- Lint (Ruff): `uv run ruff check app tests`
- Testes completos: `uv run pytest -v` (unitários em `tests/unit/`, integração em `tests/integration/` e `tests/test_github_sync.py`)

### Frontend (`frontend/`)
- Servidor dev: `npm.cmd run dev`
- Typecheck: `npm.cmd run typecheck`
- Testes (Vitest): `npm.cmd run test:run` (`test:unit` / `test:integration`)
- Build de produção: `npm.cmd run build`

---

## 3. Regras Críticas de Arquitetura e Domínio

1. **Timezone e `study_date`:**
   - Todos os timestamps são armazenados em UTC, mas `study_date`, janela do dia e teto diário são sempre calculados no `challenge.timezone` via `compute_study_date` (`backend/app/services/scoring.py`).
2. **Idempotência e Deduplicação no Sync:**
   - Check-ins automáticos são deduplicados por `(challenge_id, user_id, source, external_event_id)` (`backend/app/services/checkins.py`). O mesmo commit/submissão pode ser publicado em desafios diferentes, mas nunca duplicado no mesmo desafio.
3. **Integração GitHub (`backend/app/services/github_sync.py`):**
   - A API pública `/users/{username}/events/public` não retorna mais `payload.commits` em `PushEvent`; manter resolução via `/repos/{repo}/compare/{before}...{head}` com fallback para `/repos/{repo}/commits/{head}` e filtro de autoria (`_is_commit_by_user`).
   - Preservar `_fetch_github_push_commits(github_username: str)` em `backend/app/api/v1/integrations.py`, pois os testes de integração fazem `monkeypatch` nessa função com 1 argumento.
4. **Moderação no modo `checkin`:**
   - Ao invalidar um check-in que detinha o ponto único do dia, manter `re_evaluate_checkin_mode_points_after_invalidation` para promover outro check-in válido da mesma data.
5. **Compatibilidade SQLite local:**
   - Ao adicionar colunas nullable em modelos existentes, atualizar `_ensure_sqlite_migrations()` em `backend/app/main.py` para não quebrar bancos locais existentes (`brainrats.db`).

---

## 4. Convenções de Frontend, UI e PWA

- **Idioma:** toda a copy visível ao usuário, rótulos, erros e validações devem ser escritos em **Português do Brasil (PT-BR)**.
- **Tokens e Tema:** usar as variáveis CSS semânticas de `frontend/src/app/globals.css` (`bg-canvas`, `bg-card`, `bg-shell`, `text-ink`, `accent`, etc.) compatíveis com modo claro e `[data-theme="dark"]`, além de `font-score` (`tabular-nums`) em placares e métricas.
- **Navegação e Shortcuts (`app-shell.tsx` / `dashboard.tsx`):**
  - As abas válidas são `"home" | "progress" | "ranking" | "challenges" | "integrations" | "settings"`.
  - Manter suporte ao query param `?tab=` no `Dashboard` alinhado aos `shortcuts` de `frontend/public/manifest.webmanifest`.
- **PWA (`sw.js`, `manifest.webmanifest`, `pwa-controls.tsx`):**
  - Nunca interceptar rotas `/api/` nem origens externas no Service Worker; manter fallback de navegação para `/offline.html`.
  - Preservar `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)` no shell, headers e barra inferior móvel.
- **URL da API (`frontend/src/lib/api.ts`):** usar `getApiBaseUrl()` para respeitar `NEXT_PUBLIC_API_URL` quando definida e resolver `:8000/api/v1` automaticamente em testes locais via LAN.

---

## 5. Padrões de Qualidade e Git

- **Python 3.12:** respeitar `backend/pyproject.toml` (Ruff `line-length = 100`, regras `E, F, I, UP, B`) e docstrings concisas em funções/classes públicas.
- **Testes sem rede externa:** usar `httpx.MockTransport` ou `monkeypatch` no backend e mocks locais no Vitest; nunca depender de chamadas reais ao GitHub/LeetCode na suíte.
- **Checklist antes de finalizar ou commitar:**
  1. `cd backend && uv run ruff check app tests && uv run pytest -v`
  2. `cd frontend && npm.cmd run typecheck && npm.cmd run test:run && npm.cmd run build`
- **Higiene do repositório:** nunca commitar `.env`, bancos `*.db`, relatórios de cobertura, `.codex/` ou alterações acidentais de tooling local (`.agents/`) sem solicitação explícita.
