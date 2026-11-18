---
name: BrainRats — Treino Gamificado
description: Sistema visual para estudos diários de programação em grupo. Casca navy com brilho laranja da marca, área de trabalho creme e cards brancos arredondados.
colors:
  shell-navy: "#111827"
  shell-raised: "#1B2333"
  canvas-cream: "#FFF5EC"
  card-paper: "#FFFFFF"
  well-cream: "#FFFAF5"
  border-lane: "#ECDCCD"
  ink-primary: "#111827"
  ink-secondary: "#4B5563"
  brand-orange: "#F4511E"
  accent-orange: "#D23F10"
  accent-orange-hover: "#B8360C"
  grape: "#7C3AED"
  success: "#10B981"
  gold: "#FBBF24"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.25
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  score:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontWeight: 800
    fontStretch: "72%"
    fontVariantNumeric: "tabular-nums"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 700
rounded:
  control: "12px"
  card: "20px"
  hero: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
---
## Overview
O sistema trata o estudo diário como treino com placar: uma **casca navy** (`#111827`) para navegação, hero do desafio e Placar Oficial, com brilho laranja da marca atrás dos elementos de destaque, e uma **área de trabalho creme** (`#FFF5EC`) com cards brancos arredondados. O mascote é o rato-cérebro do `logo-icon.jpg`, recortado em `public/mascot.png`, e aparece só no hero, no login e na tela de carregamento.

Tokens e peças compartilhadas vivem em `frontend/src/app/globals.css` (`@theme` + `@layer components`).

## Colors
- **Laranja:** `accent` `#D23F10` leva texto branco (4.7:1) em botões primários e na aba ativa; `accent-bright` `#F4511E` é a cor de marca para brilhos, ícones e foco. `accent-text` `#C2410C` para texto laranja sobre creme.
- **Gamificação, com moderação:** verde `success` para meta cumprida e "Publicado"; dourado `gold` para troféu, coroa e 1º lugar; roxo `grape` para marcos e descanso.
- **Categorias:** cada categoria tem ícone fixo e cor própria, e o ícone sempre aparece junto da cor (`CategoryIcon`, `CategoryBadge`, `CategoryFilter` em `lane-badge.tsx`): LeetCode âmbar (`</>`), Projeto esmeralda (branch), Livros azul (livro), ESW violeta (camadas), Dados teal (banco). Selecionado troca o ícone por um check.
- **Tema escuro:** superfícies e a escala de cores semânticas são invertidas em `[data-theme="dark"]`. Medalhas usam hex fixos para não mudar de cor com o tema.

## Typography
- `Archivo` para UI e títulos; `font-score` (Archivo condensada, `tabular-nums`) em todo número comparável: pontos, posição, ofensiva, meta, datas do calendário.
- `JetBrains Mono` para códigos de convite, usernames, eyebrows e chips de metadados.

## Layout
- **Desktop (`lg`+):** sidebar navy fixa, como trilho de ícones em `lg` e completa em `xl` (256px), com o card de ofensiva e a semana no rodapé. Topbar discreta só com tema e menu do perfil. Conteúdo até `76rem`.
- **Início:** hero do desafio na largura toda; abaixo, grade `1fr / 20–22rem` com formulário + feed à esquerda e placar + marcos à direita.
- **Celular:** barra inferior com 5 abas (Configurações fica no menu do perfil). Ordem: hero, formulário, placar e marcos, feed. Ações do hero e chips de categoria rolam na horizontal.

## Components
- **Shell (`app-shell.tsx`):** sidebar, topbar, barra móvel, link "Pular para o conteúdo".
- **Hero (`challenge-hero.tsx`):** eyebrow + seletor de desafio + modo/fuso/membros; título; mensagem curta derivada do estado real (pendente, estudado, meta cumprida, descanso); blocos "Meta de hoje" (verde e com check quando cumprida) e "Ofensiva atual"; calendário semanal (`week-calendar.tsx`); faixa de ações (convite, descanso, sync, regras). O mascote aparece em `2xl` e, pequeno, no celular.
- **Registro (`checkin-form.tsx`):** chips de categoria, campo de título com `Ctrl+Enter`, botão Publicar com estados de carregamento e "Publicado", e detalhes opcionais recolhidos por padrão.
- **Placar (`scoreboard.tsx`):** abas Pontos/Ofensiva/Dias. Até 5 atletas mostra linhas com avatar; acima disso, lista compacta. No Início mostra o top 5 e a linha do usuário. Com um único atleta, mostra o convite. A página Ranking acrescenta o pódio (3+ atletas) e as regras.
- **Seus marcos (`milestones.tsx`):** ofensiva, dias da semana, estudos válidos e posição, todos vindos do placar. Não há badges desbloqueáveis: o backend não tem esse sistema.
- **Feed (`group-feed.tsx`, `checkin-card.tsx`, `auto-sync-group-card.tsx`):** um card com divisórias; lotes do GitHub/LeetCode mostram prévia de até 5 itens e "Ver detalhes" abre cada check-in com reações, comentários e menu `⋯`.
- **Primitivas (`ui.tsx`):** `Avatar`, `Notice`, `ErrorState`, `LoadingState`, `EmptyState`, `PageHeader`. Classes: `.card`, `.card-dark`, `.btn` (+ `-primary`, `-dark`, `-secondary`, `-ghost`, `-shell`, `-sm`), `.field`, `.field-label`, `.segmented`.

## Motion
Animações curtas (`rise-in`, `stamp`, `reveal`, `flicker` da chama). `prefers-reduced-motion` zera animações e transições.

## Do's and Don'ts
- **Faça:** use dados reais ou um estado vazio; mostre ícone + rótulo em toda categoria; mantenha o laranja sólido para a ação principal de cada área.
- **Não faça:** não simule conquistas com dados fixos; não use gradiente em todo card (só hero, placar e realces pontuais); não aninhe cards com borda dentro de cards com borda.
