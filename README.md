# BrainRats

> GymRats para estudos de programação — constância, desafios em grupo e diário de estudos pesquisável com **LeetCode**, **Continuidade de Projeto**, **Leitura de Livros**, **ESW** e **Dados**.

## Documentação

- [Especificação de Requisitos (MVP v1.1)](./docs/requisitos-mvp.md)
- [Arquitetura e Modelagem de Dados](./docs/arquitetura-e-dados.md)

## Estrutura do Repositório

```text
brainrats/
├── backend/              # API REST em Python (FastAPI + SQLAlchemy async + Alembic + ARQ)
├── frontend/             # Web App / PWA em Next.js (App Router + TypeScript + Tailwind)
├── docs/                 # Requisitos, DER, arquitetura e contratos da API
└── docker-compose.yml    # PostgreSQL 16 + Redis 7 + Backend + Worker + Frontend
```

## Rodando com Docker

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend API / Swagger: `http://localhost:8000/docs`

## Rodando Localmente (Sem Docker)

### Backend (FastAPI)

```bash
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Testes do backend:

```bash
cd backend
uv run pytest
```

### Frontend (Next.js)

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
