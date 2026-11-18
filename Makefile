# BrainRats — atalhos para desenvolvimento local e validação.
# Uso: make help

BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 3000
API_URL := http://localhost:$(BACKEND_PORT)/api/v1

# IP da máquina na rede local, para abrir o front por http://<ip>:3000 além de localhost.
LAN_IP := $(shell hostname -I 2>/dev/null | awk '{print $$1}')
comma := ,
CORS := http://localhost:$(FRONTEND_PORT),http://127.0.0.1:$(FRONTEND_PORT)$(if $(LAN_IP),$(comma)http://$(LAN_IP):$(FRONTEND_PORT))

.DEFAULT_GOAL := help

.PHONY: help install install-back install-front dev back front \
	test test-unit test-integration test-back test-back-unit test-back-integration \
	test-front test-front-unit test-front-integration test-front-types \
	test-coverage test-back-coverage test-front-coverage lint lint-back build validate

help: ## Lista os comandos disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-23s\033[0m %s\n", $$1, $$2}'
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

# A suíte padrão separa unidade e integração para deixar explícito o que está sendo validado.
test: test-unit test-integration test-front-types ## Roda todos os testes e a checagem TypeScript

test-unit: test-back-unit test-front-unit ## Roda todos os testes unitários

test-integration: test-back-integration test-front-integration ## Roda todos os testes de integração

test-back: ## Roda toda a suíte do backend
	cd backend && uv run pytest -v

test-back-unit: ## Roda regras puras, segurança e cálculo de pontos/ofensiva
	cd backend && uv run pytest tests/unit -v

test-back-integration: ## Roda a API contra um banco SQLite novo por teste
	cd backend && uv run pytest tests/integration -v

test-front: ## Roda toda a suíte do frontend e verifica os tipos
	cd frontend && npm run test:run && npm run typecheck

test-front-unit: ## Roda utilitários e cliente HTTP do frontend
	cd frontend && npm run test:unit

test-front-integration: ## Roda componentes e fluxos do frontend em JSDOM
	cd frontend && npm run test:integration

test-front-types: ## Verifica os tipos TypeScript sem gerar arquivos
	cd frontend && npm run typecheck

test-coverage: test-back-coverage test-front-coverage ## Gera relatórios de cobertura das duas aplicações

test-back-coverage: ## Mede cobertura do backend e gera relatório HTML
	cd backend && uv run pytest --cov=app --cov-report=term-missing --cov-report=html

test-front-coverage: ## Mede cobertura do frontend e gera relatório HTML
	cd frontend && npm run test:coverage

lint: lint-back ## Executa análise estática disponível no repositório

lint-back: ## Executa Ruff no backend e nos testes
	cd backend && uv run ruff check .

build: ## Gera o build de produção do frontend
	cd frontend && npm run build

validate: lint test build ## Executa lint, testes, tipos e build de produção
