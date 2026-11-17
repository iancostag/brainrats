# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Desenvolvedores em início ou meio de carreira e estudantes de computação que estudam em grupos de amigos, turmas de faculdade ou preparação para vagas técnicas (entrevistas, projetos práticos e fundamentos).

- **Criador / Admin do Grupo:** organiza desafios privados (por convite) ou abertos, define regras (Modo Check-in vs. Modo Pontuação, fuso horário do desafio, pesos, teto diário e Rest Days) e modera denúncias.
- **Participante (Membro):** registra estudos manuais ou via integrações automáticas, acompanha o ranking e o feed do grupo, consulta seu diário pesquisável e utiliza Rest Days.

## Product Purpose

Transformar o estudo diário de programação em um hábito social, sustentável e mensurável (no estilo GymRats), cobrindo cinco frentes práticas: **LeetCode**, **Continuidade de Projeto**, **Leitura de Livros**, **ESW (Engenharia de Software)** e **Dados**.

O sucesso do produto significa que o usuário consegue abrir o app no PC ou no celular, registrar ou sincronizar seu estudo em segundos sem atrito, manter sua ofensiva com saúde mental (via *Rest Days*) e consultar o que aprendeu ao longo do tempo.

## Positioning

Constância social sem fricção: combina grupos entre amigos, publicação automática de commits do GitHub e submissões *Accepted* do LeetCode (com título e descrição livre editáveis depois) e *Rest Days* semanais configuráveis — além da escolha pelo admin entre **Modo Check-in** (1 estudo/dia = 1 ponto) e **Modo Pontuação** (pesos por categoria com teto diário anti-farm) em um único fuso horário por desafio.

## Operating Context

- Uso misto em navegador desktop (enquanto programa, resolve LeetCode ou lê docs) e celular via Web App responsivo / PWA (para check-ins rápidos de leitura, acompanhar feed, reagir e comentar).
- Sessões curtas de registro após ou durante blocos de estudo; o envio manual pede apenas categoria, **título da tarefa** e **descrição livre** opcional (sem obrigar resumos longos).
- Integrações com GitHub (commits em repositórios/eventos públicos) e LeetCode (submissões *Accepted*) publicam check-ins automaticamente no desafio alvo configurado.

## Capabilities and Constraints

- **5 categorias padrão no MVP:** LeetCode, Continuidade de Projeto, Leitura de Livros, ESW (System Design, arquitetura, padrões, testes, docs e cursos técnicos) e Dados (SQL, modelagem, pipelines/ETL, Python/Pandas, BI e ML).
- **1 desafio por check-in no MVP:** cada check-in pontua em um único desafio; suporte a múltiplos desafios simultâneos fica fora do escopo inicial.
- **Fuso horário por desafio:** virada do dia para *streak*, janela de check-in e teto diário usa o fuso definido no desafio.
- **Moderação centralizada:** membros denunciam check-ins suspeitos e o criador/admin do grupo tem a decisão final de invalidar ou restaurar os pontos.
- **Decisão aberta pós-MVP:** login OAuth completo do GitHub com seleção granular de repositórios privados e worker assíncrono em fila Redis/ARQ (o MVP local atual usa login rápido por username + sync sob demanda).

## Brand Commitments

- **Nome oficial:** BrainRats.
- **Idioma:** Português do Brasil (PT-BR) em toda a interface e copy do MVP.
- **Tom de voz:** direto, técnico e encorajador, sem jargões de marketing vazios.

## Evidence on Hand

- Especificação consolidada do produto: `docs/requisitos-mvp.md`
- Arquitetura e modelagem de dados: `docs/arquitetura-e-dados.md`
- Aplicação funcional local: backend FastAPI (`backend/`) e frontend Next.js (`frontend/`).
- **Ausências declaradas:** ainda não existem depoimentos reais de usuários externos, métricas de retenção ou prints de clientes; trabalhos futuros não devem fabricar prova social ou números de uso.

## Product Principles

1. **Zero fricção no registro:** publicar primeiro (especialmente via GitHub/LeetCode), permitir elaborar notas depois.
2. **Constância sustentável:** *Rest Days* semanais protegem a ofensiva contra esgotamento sem punir pausas planejadas.
3. **Competição justa e transparente:** regras claras por grupo (Check-in vs. Pontuação, teto diário anti-farm, fuso único do desafio e moderação pelo admin).
4. **Memória acumulativa:** todo check-in alimenta automaticamente o diário de estudos pesquisável do usuário.

## Accessibility & Inclusion

- Interface web responsiva (*mobile-first* + desktop) com contraste adequado em tema escuro e navegação completa por teclado, mirando boas práticas de acessibilidade web (WCAG AA).
