# BrainRats — atalhos para desenvolvimento local.
# Uso: make help

BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 3000
API_URL := http://localhost:$(BACKEND_PORT)/api/v1
# IP da máquina na rede local, para abrir o front por http://<ip>:3000 além de localhost.
LAN_IP := $(shell hostname -I 2>/dev/null | awk '{print $$1}')
comma := ,
CORS := http://localhost:$(FRONTEND_PORT),http://127.0.0.1:$(FRONTEND_PORT)$(if $(LAN_IP),$(comma)http://$(LAN_IP):$(FRONTEND_PORT))

.DEFAULT_GOAL := help
.PHONY: help install install-back install-front dev back front test test-back test-front lint

help: ## Lista os comandos disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  Portas: make dev BACKEND_PORT=8010 FRONTEND_PORT=3001"

install: install-back install-front ## Instala dependências do back e do front

install-back:
	cd backend && uv sync

install-front:
	cd frontend && npm install

dev: ## Roda back e front juntos no mesmo terminal (Ctrl+C encerra os dois)
	@$(MAKE) -j2 --no-print-directory back front

back: ## Roda só o backend (FastAPI com reload)
	cd backend && CORS_ORIGINS=$(CORS) uv run uvicorn app.main:app --reload --port $(BACKEND_PORT)

front: ## Roda só o frontend (Next.js)
	cd frontend && NEXT_PUBLIC_API_URL=$(API_URL) npx next dev -p $(FRONTEND_PORT)

test: test-back test-front ## Roda todos os testes e checagens

test-back: ## Testes do backend (pytest)
	cd backend && uv run pytest -v

test-front: ## Checagem de tipos do frontend (não há testes de front no projeto)
	cd frontend && npm run typecheck

lint: ## Lint do backend (ruff)
	cd backend && uv run ruff check .
