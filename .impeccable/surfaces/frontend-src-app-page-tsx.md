---
version: 1
slug: "frontend-src-app-page-tsx"
primary_target: "frontend/src/app/page.tsx"
related_targets: []
---

# Surface Brief — BrainRats Web App (`frontend/src/app/page.tsx`)

- **Scope:** `frontend/src/app/page.tsx` e fluxo principal autenticado (`LoginView`, `Dashboard`, `ChallengesTab`, `DiaryTab`, `IntegrationsTab`).
- **Visitor Mode:** Operate (uso misto dia e noite no PC e celular para registrar estudos, acompanhar ofensiva/splits e revisar o placar do grupo).

## Direction contract

- **THESIS:** O estudo diário de programação tratado como treino cronometrado em pista oficial, recusando o painel SaaS escuro genérico (`zinc + neon emerald`) em favor de uma casca em ardósia profunda combinada com fichas claras de papel-giz sem brilho excessivo.
- **OWN-WORLD:** Cabeçalho e Placar Oficial em ardósia profunda (`#0F1722`) com linha de chegada em terracota de pista (`#D94E28`); área de trabalho em papel-giz (`#F3F1EC`) com cartões nítidos (`#FFFFFF`), fios de raia 1px (`#DDD8CE`), tipografia `Archivo` + `JetBrains Mono` tabular e 5 raias cromáticas distintas para LeetCode, Projeto, Livros, ESW e Dados.
- **STORY:** Ao abrir o app de dia ou à noite, o usuário bate o olho na barra superior escura e na Faixa de Splits Semanais, enxerga imediatamente sua ofensiva, quantos pontos faltam no teto do dia e os envios recentes do grupo, e registra um estudo em segundos sem atrito.
- **FIRST VIEWPORT:** Topbar fixa em `#0F1722` com borda inferior terracota (`3px`), logo abaixo a Faixa de Splits Semanais (meta do dia, ofensiva, código de convite e 7 raias Seg–Dom), seguida de grade 2:1 com o compositor compacto de check-in + feed à esquerda e o Placar Oficial escuro (`#0F1722`) à direita; no mobile, bottom nav fixa para o polegar.
- **FORM:** Placar de Pista & Treino (Track & Field Official Split Sheet) · posição 6 na lista fundamentada · `seed:a831a115e8dac09f` (elevada com escala tipográfica em degraus inteiros de `emigre-bitmap-specimen`, marcadores calibrados de `star-atlas`, foco silencioso de `streaming-title-card-wall` e âncoras de borda de `terminal-yellow-wayfinding`).
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
