# Guia de Estilo — Badges e Conquistas do BrainRats

Padrão visual oficial para criação, geração por IA e manutenção de todas as badges (medalhas de conquista) do **BrainRats**. Sempre que uma nova conquista for adicionada em `backend/app/services/badges.py`, sua arte deve seguir este guia para manter a coleção coesa.

---

## 1. Identidade Visual da Coleção

Todas as badges seguem a linguagem **"Medalhão Enamel-Pin / Placar de Pista & Treino"**, alinhada ao `DESIGN.md` e ao mascote oficial (`frontend/public/mascot.png`):

- **Formato:** Medalha circular centralizada ocupando **~92% do quadro `1:1`** (encaixa direto em containers `rounded-full` sem depender de recorte manual).
- **Fundo externo e interno:** Navy escuro sólido (`#111827`) — garante contraste limpo tanto no tema claro (`#FFF5EC` / `#FFFFFF`) quanto no tema escuro (`[data-theme="dark"]`).
- **Moldura (aro):** Aro circular chanfrado (*beveled*) com 2 cores da paleta oficial, refletindo o tema/raridade da conquista.
- **Traço e sombreamento:** Contornos vetoriais limpos e grossos (*clean bold vector outlines*), *cel shading* moderno de badge de jogo (*esports / Duolingo achievement medallion*), alto contraste.
- **Proibido na arte:** **Zero texto, letras, números ou marcas d'água** (`no text, no letters, no numbers, no watermark`), para garantir leitura nítida em tamanhos pequenos (`28px`–`64px`).

---

## 2. DNA do Personagem (Ratinho BrainRats)

Toda conquista deve trazer o mascote **ratinho-cérebro** com traços consistentes:

- **Pelagem:** Creme-branco (`#F5F3EC`) inspirado no `frontend/public/mascot.png`.
- **Marca registrada:** Linhas geométricas sutis de **circuito/labirinto cerebral** na testa ou orelhas, e **cauda curva laranja** (`#F4511E`) quando visível.
- **Personalidade:** Esperta, focada, atlética/coder — varia a expressão e o acessório conforme o feito (teclado mecânico, faixa de corrida, armadura de ferro, óculos redondos, fone + caneca de café, etc.).
- **Referência visual obrigatória ao gerar:** Quando possível, anexe `frontend/public/mascot.png` na conversa do gerador (Gemini / Imagen) como referência de paleta e identidade.

---

## 3. Paleta Oficial para Aros e Destaques

| Papel | Cor | Hex | Quando usar |
| --- | --- | --- | --- |
| Fundo da medalha | Shell Navy | `#111827` | Sempre como fundo base |
| Pelagem do mascote | Warm Cream | `#F5F3EC` / `#FFF5EC` | Corpo do ratinho e detalhes claros |
| Marca / Energia | Brand Orange | `#F4511E` | Cauda, chamas, café, ação principal |
| Raro / Prestígio | Gold | `#FBBF24` | Troféus, coroas, marcos de 30+ dias |
| Consistência / Meta | Emerald | `#10B981` | Metas cumpridas, semana perfeita, tecla Enter |
| Especial / Noturno | Grape Violet | `#7C3AED` | Polímata, Coruja de Código, marcos raros |
| Leitura / Estudo | Cobalt Blue | `#3B82F6` | Livros técnicos, estudos aprofundados |
| Dados / Engenharia | Teal | `#14B8A6` | Orbes temáticos e futuras badges de Dados |

---

## 4. Especificações Técnicas e Nomenclatura

- **Pasta destino:** `frontend/public/badges/`
- **Nome do arquivo:** `<badge_key>.png` (exatamente igual à chave em `BADGE_CATALOG` no arquivo `backend/app/services/badges.py`).
- **Proporção:** `1:1` (quadrada).
- **Resolução recomendada:** `512×512` px (mínimo `256×256` px; PNG ou WebP otimizado abaixo de `150 KB` por arquivo).
- **Fallback no frontend:** Caso alguma badge nova ainda não tenha imagem em `frontend/public/badges/<badge_key>.png`, o componente deve cair automaticamente para o ícone Lucide padrão sem quebrar o layout.

---

## 5. Template Reutilizável de Prompt (Gemini / Imagen)

Para criar qualquer **nova badge** no futuro, mantenha o bloco fixo (início e fim) e substitua apenas os trechos entre colchetes `[...]`:

```text
Circular enamel-pin style achievement badge icon, centered and filling 92% of a 1:1 square frame on a solid dark navy (#111827) background. Inside a crisp beveled [COR_PRINCIPAL_HEX] and [COR_SECUNDARIA_HEX] circular rim, a [EXPRESSAO] cream-white coder mouse mascot with subtle geometric brain-circuit markings [ACESSORIO_OU_ROUPA] is [ACAO_E_OBJETO_ICONICO_DA_CONQUISTA]. Clean bold vector outlines, flat modern game-badge cel shading, high contrast, readable at small icon size, cohesive esports/Duolingo achievement medallion aesthetic, no text, no letters, no numbers, no watermark.
```

---

## 6. Catálogo Oficial das Badges Atuais

| `badge_key` | Arquivo | Título | Critério | Aro (cores) | Cena do ratinho |
| --- | --- | --- | --- | --- | --- |
| `first_checkin` | `first_checkin.png` | Primeiro Passo | 1º estudo válido | `#F4511E` + `#FFF5EC` | Apertando tecla Enter verde brilhante com faíscas douradas |
| `streak_7` | `streak_7.png` | Semana em Chamas | 7 dias de ofensiva | `#F4511E` + `#FBBF24` | Correndo com faixa laranja cercado por chamas estilizadas |
| `streak_30` | `streak_30.png` | Constância de Ferro | 30 dias de ofensiva | Aço escovado + `#FBBF24` | Ombreiras de ferro, coroa dourada e troféu com gema laranja |
| `polymath_week` | `polymath_week.png` | Polímata | 5 categorias na semana | `#7C3AED` + `#FBBF24` | Óculos redondos fazendo malabarismo com 5 orbes das categorias |
| `first_hard_lc` | `first_hard_lc.png` | Domador de Hard | 1 LeetCode Hard | `#F4511E` + `#FBBF24` | Espada geométrica de colchetes diante de silhueta de dragão-puzzle |
| `bookworm_100p` | `bookworm_100p.png` | Leitor Técnico | 100+ páginas lidas | `#3B82F6` + `#FFF5EC` | Óculos grandes sobre pilha de livros lendo livro aberto brilhante |
| `night_owl` | `night_owl.png` | Coruja de Código | Estudo entre 00h–05h | `#7C3AED` + `#FBBF24` | Fones de ouvido, caneca de café laranja, notebook e lua crescente |
| `week_warrior` | `week_warrior.png` | Semana Perfeita | 5+ dias na semana | `#10B981` + `#FFF5EC` | Munhequeira laranja dando joinha ao lado de 5 checks verdes |

---

## 7. Checklist ao Adicionar uma Nova Badge

1. Registrar a chave e a regra de desbloqueio em `backend/app/services/badges.py` (`BADGE_CATALOG` + `evaluate_user_badges`).
2. Gerar a imagem `1:1` usando o template da seção 5 (anexando `frontend/public/mascot.png` como referência).
3. Conferir que a imagem não contém texto/números e continua legível reduzida a `32×32` px.
4. Salvar em `frontend/public/badges/<badge_key>.png` (otimizada) e adicionar a linha na tabela da seção 6 deste guia.
