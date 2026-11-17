---
name: BrainRats — Placar de Pista & Treino
description: Sistema visual para estudos diários de programação em grupo, unindo casca em ardósia profunda e fichas em papel-giz.
colors:
  shell-slate: "#0F1722"
  shell-elevated: "#182232"
  canvas-chalk: "#F3F1EC"
  card-paper: "#FFFFFF"
  well-paper: "#FAF9F6"
  border-lane: "#DDD8CE"
  ink-primary: "#111827"
  ink-secondary: "#475569"
  track-terracotta: "#D94E28"
  track-terracotta-hover: "#C2411E"
  lane-cobalt: "#2563EB"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.track-terracotta}"
    textColor: "{colors.card-paper}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.track-terracotta-hover}"
  button-dark:
    backgroundColor: "{colors.shell-slate}"
    textColor: "{colors.card-paper}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  card-sheet:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

## Overview

O sistema **Placar de Pista & Treino** trata o estudo diário de programação como treino cronometrado em pista oficial. Projetado para uso misto de dia e de noite (PC e celular), combina uma casca estrutural em ardósia profunda (`#0F1722`) para navegação e **Placar Oficial** com uma área de trabalho antirreflexo em papel-giz (`#F3F1EC`) e cartões nítidos (`#FFFFFF`).

## Colors

- **Casca & Placar Oficial:** `#0F1722` (cabeçalho fixo, barra inferior móvel e painel de ranking) com linhas elevadas em `#182232` e filete de chegada `3px` em terracota (`#D94E28`).
- **Área de Trabalho:** fundo em papel-giz (`#F3F1EC`), cartões em `#FFFFFF`, campos de entrada em `#FAF9F6` e fios de raia `1px` em `#DDD8CE`.
- **Acento Principal:** terracota de pista (`#D94E28` / hover `#C2411E`) reservada para CTAs principais, marcação de dias estudados nos **Splits da Semana**, ofensiva e linha do usuário no placar.
- **Cinco Raias de Categoria:** badges semânticas distintas com contraste ≥4.5:1 (`LeetCode` âmbar, `Projeto` esmeralda, `Livros` cobalto, `ESW` violeta, `Dados` teal).

## Typography

- **UI e Títulos:** `Archivo` (`--font-sans`) com pesos `400`–`800`, trazendo leitura firme para títulos e formulários sem parecer template SaaS genérico.
- **Métricas, Códigos e Metadados:** `JetBrains Mono` (`--font-mono`) com `tabular-nums` para pontuações, tetos diários, códigos de convite, datas e chips técnicos.

## Layout

- **Desktop:** topbar fixa de linha única (`max-w-6xl`), **Faixa de Splits Semanais** horizontal no topo da aba `Desafio Ativo`, seguida por grade `2:1` (`lg:grid-cols-3`) com compositor + entregas à esquerda e **Placar Oficial** escuro à direita.
- **Mobile:** cabeçalho compacto (`~61px`) + barra de navegação fixa na base (`bottom nav` de 4 abas com alvos mínimos de `56px` de altura).

## Elevation & Depth

Hierarquia plana baseada em **contraste de casca** (ardósia `#0F1722` vs. papel `#FFFFFF` sobre giz `#F3F1EC`) e bordas `1px solid #DDD8CE`, evitando sombras pesadas ou vidro decorativo.

## Shapes

- Cartões e painéis: `12px` (`rounded-xl`).
- Inputs, botões e células dos Splits Semanais: `6px`–`8px` (`rounded-md` / `rounded-lg`).
- Badges de status e pontuação: `9999px` (`rounded-full`).

## Components

- **Faixa de Splits Semanais (`dashboard.tsx`):** exibe saldo do dia (`HOJE X/100 PTS` ou `CONCLUÍDO/PENDENTE`), ofensiva atual e grade `Seg–Dom` (estudado em `#D94E28`, descanso em `#E2E8F0`, pendente em `#FAF9F6`).
- **Compositor Rápido (`checkin-form.tsx`):** 5 botões de raia + título + `Publicar` em 1 linha (`Ctrl+Enter`), com métricas, notas livres e link recolhíveis.
- **Card de Entrega (`checkin-card.tsx`):** mostra autor, categoria cromática, origem (`Manual`, `GitHub Auto`, `LeetCode Auto`), chips de metadados, reações acessíveis, comentários e moderação com motivo obrigatório.

## Do's and Don'ts

- **Faça:** mantenha o `#D94E28` concentrado em ações primárias, splits cumpridos e indicadores de ofensiva; preserve `tabular-nums` em todo placar.
- **Não faça:** não volte para fundos `#09090B` genéricos nem esconda metadados preenchidos nos check-ins; não adicione caixas aninhadas sem necessidade funcional.
