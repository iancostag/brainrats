# BrainRats — Especificação de Requisitos (MVP v1.1)

> Requisitos consolidados para o **MVP v1.1** do **BrainRats** (Web App responsivo / PWA estilo GymRats voltado para estudos de programação), usando **Python (FastAPI)** no backend e **Next.js** no frontend.

---

## 1. Visão Geral do Produto

O **BrainRats** é um **Web App responsivo / PWA** voltado para constância e gamificação em estudos de programação. Os usuários participam de desafios em **grupos privados** (amigos, faculdade, times) ou **desafios abertos/comunidade**, registrando check-ins diários (manuais ou automáticos) que também alimentam um **diário de estudos pesquisável**.

### Objetivos do MVP
- Transformar o estudo diário de programação em um hábito social e mensurável (estilo GymRats).
- Suportar tanto grupos focados em **constância pura (Check-in)** quanto grupos focados em **pontuação por esforço/categoria**.
- Reduzir fricção no registro: publicar integrações de **GitHub** e **LeetCode** automaticamente, com campos simples de **Título da tarefa** e **Descrição livre**.
- Evitar trapaças (*farming* de pontos) com teto diário (no modo pontuação) e moderação pelo criador do grupo.
- Preservar sustentabilidade do hábito com **dias de descanso (*Rest Days*)**.

---

## 2. Papéis de Usuário

| Papel | Descrição |
| :--- | :--- |
| **Participante (Membro)** | Cria conta, entra em desafios, registra check-ins (manuais ou via integração), consulta o próprio diário, reage/comenta e reporta check-ins suspeitos. |
| **Criador / Admin do Grupo** | Cria desafios privados ou abertos, define o **modo de pontuação**, **fuso horário do desafio**, duração, categorias ativas, pesos, teto diário, *Rest Days* e modera/invalida check-ins denunciados. |
| **Visitante** | Visualiza landing page e lista de desafios abertos, sem poder interagir até autenticar. |

---

## 3. Requisitos Funcionais (RF)

### RF01 — Autenticação e Conexões Externas
- **RF01.1:** Cadastro e login via **GitHub OAuth** (principal, já habilitando acesso aos repositórios) e opção complementar (Google OAuth ou E-mail/Senha).
- **RF01.2:** No perfil, o usuário pode vincular seu **username público do LeetCode** e selecionar quais **repositórios do GitHub** deseja monitorar para check-ins de *Continuidade de Projeto*.
- **RF01.3:** Gerenciamento de perfil básico (nome, username, avatar, bio).

### RF02 — Grupos e Desafios
- **RF02.1:** Criação de **Desafio/Grupo** com visibilidade configurável:
  - **Privado:** entrada via link ou código de convite.
  - **Aberto (Comunidade):** visível na aba de explorar desafios para qualquer usuário entrar.
- **RF02.2:** Regras configuráveis pelo **Criador do Grupo**:
  - **Modo de Pontuação:**
    1. **Modo Check-in (Constância):** estilo GymRats clássico — cada dia com pelo menos 1 check-in válido soma **1 ponto** (foco em dias ativos e *streak*, sem diferenciação de peso por categoria).
    2. **Modo Pontuação (Esforço/Categorias):** pontuação por categoria/atividade, com pesos personalizáveis pelo admin e **teto diário** anti-farm.
  - **Fuso horário do desafio:** definido na criação (ex: `America/Sao_Paulo`); determina a virada da meia-noite para contagem de dias, *streak* e teto diário de todos os participantes do desafio.
  - **Duração:** data de início e fim (ex: 30 dias, 90 dias) ou modo **contínuo / ciclos mensais**.
  - **Categorias ativas e pesos:** selecionar quais das 5 categorias padrão participam do desafio (e ajustar pesos no Modo Pontuação).
  - **Teto diário de pontos:** limite máximo contabilizável por dia (aplicável no Modo Pontuação).
  - **Rest Days:** cota semanal de dias de descanso permitidos sem quebrar o *streak*.

### RF03 — Categorias de Estudo (Padrão do Sistema)
O sistema oferece **5 categorias padrão**, usadas para organizar os check-ins, filtrar o diário e (no Modo Pontuação) calcular pontos:

1. **LeetCode**
   - Metadados: título/slug do problema, dificuldade (`Easy`, `Medium`, `Hard`), linguagem, link da submissão/problema.
   - Integração: captura automática de submissões aceitas (`Accepted`) via username do LeetCode.
2. **Continuidade de Projeto**
   - Metadados: repositório/projeto, quantidade de commits ou tempo dedicado, link do commit/PR.
   - Integração: captura automática de commits nos repositórios monitorados do GitHub.
3. **Leitura de Livros (Programação)**
   - Metadados: nome do livro, páginas/capítulos lidos (ex: quantidade de páginas ou intervalo).
4. **ESW (Engenharia de Software)**
   - Escopo: *System Design*, arquitetura, padrões de projeto, testes, documentação e cursos/artigos técnicos.
   - Metadados: subtema/tag (ex: `System Design`, `Testes`, `Arquitetura`), tempo dedicado, link opcional.
5. **Dados**
   - Escopo: SQL, modelagem, pipelines/ETL, Python/Pandas, análise/BI e Machine Learning.
   - Metadados: subtema/tag (ex: `SQL`, `ETL`, `ML`, `BI`), tempo dedicado, link opcional.

#### Valores Padrão Sugeridos para o **Modo Pontuação** *(editáveis pelo Admin do Grupo)*
| Categoria | Regra Base Padrão | Teto Padrão por Categoria/Dia |
| :--- | :--- | :--- |
| **LeetCode** | Easy: 10 pts · Medium: 20 pts · Hard: 35 pts | Máx. 70 pts/dia |
| **Continuidade de Projeto** | 15 pts por sessão/dia com commit válido (ou +5 pts a cada 30 min) | Máx. 50 pts/dia |
| **Leitura de Livros** | 1 pt por página lida (mín. 5 págs) ou 15 pts por bloco de 30 min | Máx. 40 pts/dia |
| **ESW** | 15 pts por bloco de 30 min (ou por módulo/artigo concluído) | Máx. 50 pts/dia |
| **Dados** | 15 pts por bloco de 30 min (ou entrega de notebook/query/pipeline) | Máx. 50 pts/dia |
| **Teto Global Diário** | Máximo somado no desafio em um único dia | **100 pts/dia** |

> No **Modo Check-in**, as categorias e metadados continuam existindo para dar contexto no feed e alimentar os filtros do diário, mas a pontuação diária é binária: fez ao menos 1 check-in válido no dia = **+1 ponto**.

### RF04 — Check-ins, Automação e Diário de Estudos
- **RF04.1:** No MVP, cada check-in é vinculado a **1 único desafio** (escolhido pelo usuário no envio ou pré-configurado para suas integrações automáticas).
- **RF04.2:** Estrutura simples e sem fricção para todo check-in:
  - **Título da tarefa** (obrigatório; preenchido automaticamente no caso de integrações, ex: nome do problema LeetCode ou mensagem principal do commit);
  - **Descrição livre** (opcional; campo aberto para o usuário elaborar anotações, código ou aprendizados como quiser);
  - **Categoria** e **evidência opcional** (print/imagem ou link).
- **RF04.3:** **Publicação Automática (GitHub e LeetCode):**
  - Ao detectar novos commits (nos repositórios selecionados) ou novas submissões *Accepted* no LeetCode, o sistema **publica o check-in automaticamente** no desafio alvo escolhido pelo usuário nas configurações da integração.
  - O usuário pode editar posteriormente o **título** e a **descrição livre** do check-in publicado automaticamente.
- **RF04.4:** **Diário de Estudos Pesquisável ("Meu Diário"):**
  - Visão cronológica de todos os check-ins do usuário (de todos os seus desafios).
  - Busca por texto livre (em título e descrição) e filtros por **categoria**, **tags**, **período** e **desafio**.

### RF05 — Ofensiva (*Streak*), *Rest Days* e Ranking
- **RF05.1:** Cálculo de **Streak** (dias consecutivos com ao menos 1 check-in válido no desafio) seguindo o **fuso horário do desafio**.
- **RF05.2:** **Rest Days:** o usuário pode utilizar dias de descanso dentro do limite semanal configurado pelo grupo para preservar o *streak* sem somar pontos no dia.
- **RF05.3:** **Ranking (Leaderboard)** por desafio, ordenável por:
  - Pontuação total (seja contagem de check-ins no Modo Check-in ou soma de pontos no Modo Pontuação);
  - Maior *streak* atual;
  - Dias ativos no período.

### RF06 — Feed Social e Moderação pelo Criador
- **RF06.1:** Cada desafio possui um **Feed** exibindo os check-ins dos membros (título, categoria, descrição livre, print/link, pontos e horário).
- **RF06.2:** Membros podem interagir com **reações rápidas** (fogo, foguete, cérebro, palmas) e **comentários** nos check-ins.
- **RF06.3:** **Denúncia e Validação:**
  - Qualquer membro pode reportar um check-in suspeito (ex: commit vazio/spam, conteúdo fora do desafio) informando o motivo.
  - O **Criador/Admin do grupo** visualiza as denúncias e decide se **mantém** ou **invalida** o check-in.
  - Se invalidado, os pontos do check-in são removidos do ranking do desafio (e o *streak* recalculado).

### RF07 — PWA e Experiência Responsiva
- **RF07.1:** Layout *mobile-first* responsivo, funcional em navegador desktop e celular.
- **RF07.2:** Suporte a instalação como **PWA** (*manifest*, ícones, experiência standalone no mobile).

---

## 4. Requisitos Não Funcionais (RNF)

| Categoria | Requisito |
| :--- | :--- |
| **Performance** | Carregamento inicial < 2s; paginação por cursor no feed e no diário; busca *full-text* nativa no PostgreSQL (`tsvector` / índice `GIN`) sobre título e descrição dos check-ins. |
| **Segurança e Privacidade** | Tokens OAuth do GitHub criptografados em repouso; escopo mínimo de leitura nos repositórios autorizados; isolamento estrito de acesso a grupos privados. |
| **Confiabilidade das Integrações** | Deduplicação idempotente por `external_event_id` (ex: commit SHA ou LeetCode submission ID) para nunca pontuar duas vezes; fila assíncrona com retry/backoff para *rate limits*. |
| **Integridade Temporal** | Datas salvas em UTC no banco; todo cálculo de "dia do check-in", teto diário e *streak* convertido para o `timezone` configurado no desafio. |
| **Manutenibilidade** | Separação clara entre API REST (FastAPI), workers assíncronos de sync e frontend (Next.js) com tipagem compartilhada via OpenAPI. |

---

## 5. Stack Tecnológica

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, PWA (Serwist).
- **Backend:** Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), Alembic, Redis + ARQ.
- **Banco & Storage:** PostgreSQL 16 (com Full-Text Search `tsvector`) + S3 compatível (Cloudflare R2 / Supabase Storage).
