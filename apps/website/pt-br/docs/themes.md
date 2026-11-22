---
source-hash: 85c6a6b9acc6
---

# Temas

A interface é estilizada inteiramente por propriedades personalizadas de CSS,
aplicadas no nível do aplicativo — nunca por projeto.

- **Tema integrado** — `doru`, um único arquivo de paleta JSON na pasta
  `themes/` do aplicativo: um arquivo por tema, sem CSS. O arquivo contém as
  paletas `dark` e `light`; a aparência do sistema operacional decide qual se
  aplica — mude seu sistema operacional para o modo claro e o Dóru acompanha na
  hora. O nome do arquivo é o id do tema (`doru.json`); o campo `name` dentro
  dele é o nome de exibição.
- Escolha o tema em `settings.json` (veja [Configurações](settings.md)) com uma
  única string, ou na página **Configurações** do aplicativo (menu suspenso
  Tema); a escolha é armazenada em `settings.json` de qualquer forma.
- As `colors` da paleta ativa são resolvidas em propriedades personalizadas de
  CSS `--doru-*` na inicialização.

## Temas do usuário

Coloque um arquivo `<id>.json` com paletas `dark` e `light` na pasta `themes`
dentro da pasta de dados do aplicativo (o mesmo lugar onde `settings.json` fica
— veja [Configurações](settings.md)), depois escolha-o com `"theme": "<id>"` em
`settings.json`. Reinicie o aplicativo após adicionar um arquivo para que ele
seja detectado. A pasta é criada na primeira execução; um tema do usuário cujo
id corresponde a um integrado o substitui. Um arquivo de tema malformado ou que
não corresponde ao esquema é ignorado (um aviso é registrado), assim como um
ausente, e não aparece na lista de temas. Os temas integrados trazem uma
referência `$schema` (`https://doru.family/theme.json`) — adicione a mesma
linha ao seu próprio arquivo para obter preenchimento automático e validação em
editores que entendem JSON Schema.

Temas integrados, cada um com paleta escura e clara:

| Id do tema | Nome de exibição |
|---|---|
| `doru` (padrão) | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

A paleta padrão do Dóru segue o ícone do aplicativo: um verde-floresta profundo
com tons de papel quente. A paleta escura distribui as superfícies em camadas,
de uma tela quase preta com tons esverdeados até elementos de interface e
popovers mais claros; a paleta clara usa papel quente e creme.

Variáveis disponíveis:

| Variável | Significado |
|---|---|
| `--doru-bg-canvas` | fundo do editor e faixa de abas |
| `--doru-bg-chrome` | barra de atividades, barras laterais, superfície dos painéis flutuantes |
| `--doru-bg-raised` | cartões, chips, o campo do chat |
| `--doru-bg-popover` | menus e seletores |
| `--doru-bg-input` | botões, campos de entrada, seletores |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | texto principal, atenuado e esmaecido |
| `--doru-border` / `--doru-border-strong` | linhas finas e bordas mais fortes |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | destaque (verde-floresta/sálvia) |
| `--doru-on-accent` | texto sobre o fundo de destaque |
| `--doru-accent-alpha` | destaque translúcido (chips, balões do chat) |
| `--doru-focus` | cor do anel de foco |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | sobreposições de passar o mouse/pressionado |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | cores de estado |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | raios de 4 / 6 / 8 px |
| `--doru-control-height` | altura dos controles (28px) |
| `--doru-panel-gutter` | espaço entre os painéis flutuantes e a borda da janela (4px) |
| `--doru-panel-radius` | raio dos cantos dos painéis flutuantes (8px) |
