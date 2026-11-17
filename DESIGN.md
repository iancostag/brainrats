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
  score:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontWeight: 800
    fontStretch: "72%"
    fontVariantNumeric: "tabular-nums"
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
- **Cinco Raias de Categoria:** cada categoria é uma raia numerada com cor própria, e número e cor sempre aparecem juntos (`LaneNumber` / `LaneBadge` em `lane-badge.tsx`): Raia 1 `LeetCode` âmbar, Raia 2 `Projeto` esmeralda, Raia 3 `Livros` cobalto, Raia 4 `ESW` violeta, Raia 5 `Dados` teal. O número fica num bloco sólido `{cor}-700` com texto `{cor}-50`, contraste ≥4.5:1 nos dois temas.

## Typography

- **UI e Títulos:** `Archivo` (`--font-sans`) com pesos `400`–`800`, trazendo leitura firme para títulos e formulários sem parecer template SaaS genérico.
- **Números de Placar:** utilitário `font-score` (Archivo variável, `wdth` 72, peso 800, `tabular-nums`) para pontos, posição no ranking, ofensiva, meta do dia e contagens, como num placar eletrônico de estádio.
- **Códigos e Metadados:** `JetBrains Mono` (`--font-mono`) para códigos de convite, datas, usernames e chips técnicos.

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

- **Faixa de Splits Semanais (`weekly-splits.tsx`):** pista contínua de sete segmentos `Seg–Dom` separados por fios de raia, com marcador `Hoje` sobre o dia atual e o filete de chegada `3px` terracota no fim da semana. Estados: estudado em terracota com ✓, descanso em `rest` com xícara, dia perdido em `lane-soft`, dia futuro em `well`. O segmento de hoje enche da esquerda para a direita conforme a meta do dia (`pontos de hoje / teto diário`, ou 0/1 no Modo Check-in). Acima da pista, a contagem `X/Y dias cumpridos` em `font-score`.
- **Compositor Rápido (`checkin-form.tsx`):** 5 botões de raia + título + `Publicar` em 1 linha (`Ctrl+Enter`), com métricas, notas livres e link recolhíveis.
- **Card de Entrega (`checkin-card.tsx`):** mostra autor, data relativa (`hoje`, `ontem`, `seg, 16/11`), raia da categoria, origem (`Manual`, `GitHub Auto`, `LeetCode Auto`), chips de metadados e pontos em `font-score`. O rodapé fica leve: reações sem contagem aparecem só como ícone, o campo de comentário abre pelo botão `Comentar`, e `Editar`, `Denunciar`, `Invalidar` e `Restaurar` ficam no menu `⋯` (`action-menu.tsx`, com Esc, setas e clique fora).
- **Meta de Hoje (`dashboard.tsx`):** barra de progresso terracota sob o seletor de desafio (`pontos/teto` ou `Pendente/Concluída` no Modo Check-in), com a ofensiva ao lado. Ao publicar, o ganho aparece num selo `+N pts`, o número da meta e o da ofensiva fazem um `stamp` curto e o segmento de hoje nos Splits enche.
- **Ordem no celular:** compositor, Placar Oficial e depois o feed. As ações do desafio ficam numa faixa única com rolagem horizontal.

## Do's and Don'ts

- **Faça:** mantenha o `#D94E28` concentrado em ações primárias, splits cumpridos e indicadores de ofensiva; preserve `tabular-nums` em todo placar; use `font-score` em todo número que o usuário compara (pontos, posição, ofensiva) e mostre o número da raia sempre que mostrar a cor de uma categoria.
- **Não faça:** não volte para fundos `#09090B` genéricos nem esconda metadados preenchidos nos check-ins; não adicione caixas aninhadas sem necessidade funcional.
