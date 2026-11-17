# BrainRats

> GymRats para estudos de programação — constância, desafios em grupo e diário de estudos pesquisável com **LeetCode**, **Continuidade de Projeto**, **Leitura de Livros**, **ESW** e **Dados**.

## Documentação

- [Especificação de Requisitos (MVP v1.1)](./docs/requisitos-mvp.md)
- [Arquitetura e Modelagem de Dados](./docs/arquitetura-e-dados.md)

## Estrutura do Repositório

```text
brainrats/
├── backend/              # API REST em Python (FastAPI + SQLAlchemy async + SQLite/PostgreSQL)
├── frontend/             # Web App / PWA em Next.js (App Router + TypeScript + Tailwind)
├── docs/                 # Requisitos, DER, arquitetura e contratos da API
└── docker-compose.yml    # PostgreSQL 16 + Redis 7 + Backend + Worker + Frontend
```

## Rodando Localmente (Mais Rápido — Sem Docker)

Por padrão, o backend inicia usando **SQLite local** (`backend/brainrats.db`) com seed automático das 5 categorias e 2 desafios públicos iniciais.

### 1. Backend (FastAPI)

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

- Swagger/OpenAPI: `http://localhost:8000/docs`
- Testes do backend: `uv run pytest -v`

### 2. Frontend (Next.js)

```bash
cd frontend
npm.cmd install
npm.cmd run dev
```

- Aplicação Web: `http://localhost:3000`

## Rodando com Docker (PostgreSQL + Redis + Worker)

```bash
docker compose up --build
```
