---
source-hash: 85c6a6b9acc6
---

# Temi

L'interfaccia è stilizzata interamente tramite proprietà personalizzate CSS,
applicate a livello dell'app — mai per progetto.

- **Tema integrato** — `doru`, un singolo file di palette JSON nella cartella
  `themes/` dell'app: un file per tema, nessun CSS. Il file contiene sia la
  palette `dark` sia quella `light`; l'aspetto del sistema operativo decide
  quale si applica — passa il sistema operativo alla modalità chiara e Dóru lo
  segue all'istante. Il nome del file è l'id del tema (`doru.json`); il campo
  `name` all'interno è il nome visualizzato.
- Scegli il tema in `settings.json` (vedi [Impostazioni](settings.md)) con una
  singola stringa, oppure dalla pagina **Impostazioni** dell'app (menu a
  tendina Tema); la scelta viene memorizzata in `settings.json` in entrambi i
  casi.
- I `colors` della palette attiva vengono risolti in proprietà personalizzate
  CSS `--doru-*` all'avvio.

## Temi utente

Metti un file `<id>.json` con le palette `dark` e `light` nella cartella `themes`
dentro la cartella dei dati dell'app (lo stesso posto in cui vive
`settings.json` — vedi [Impostazioni](settings.md)), poi scegliilo con
`"theme": "<id>"` in `settings.json`. Riavvia l'app dopo aver aggiunto un file
perché venga rilevato. La cartella viene creata al primo avvio; un tema utente
il cui id corrisponde a uno integrato lo sostituisce. Un file di tema
malformato o che non corrisponde allo schema viene ignorato (viene registrato
un avviso), come uno mancante, e non appare nell'elenco dei temi. I temi
integrati portano un riferimento `$schema`
(`https://doru.family/theme.json`) — aggiungi la stessa riga al tuo file per
ottenere completamento automatico e validazione negli editor che comprendono
JSON Schema.

Temi integrati, ognuno con palette scura e chiara:

| Id del tema | Nome visualizzato |
|---|---|
| `doru` (predefinito) | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

La palette predefinita di Dóru segue l'icona dell'app: un verde bosco profondo
con toni di carta calda. La palette scura stratifica le superfici da una tela
quasi nera con una sfumatura verde a elementi dell'interfaccia e popover più
chiari; la palette chiara usa carta calda e crema.

Variabili disponibili:

| Variabile | Significato |
|---|---|
| `--doru-bg-canvas` | sfondo dell'editor e striscia delle schede |
| `--doru-bg-chrome` | barra delle attività, barre laterali, superficie dei pannelli flottanti |
| `--doru-bg-raised` | schede, chip, input della chat |
| `--doru-bg-popover` | menu e selettori |
| `--doru-bg-input` | pulsanti, campi di input, selettori |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | testo principale, attenuato e tenue |
| `--doru-border` / `--doru-border-strong` | linee sottili e bordi più marcati |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | accento (verde bosco/salvia) |
| `--doru-on-accent` | testo sullo sfondo d'accento |
| `--doru-accent-alpha` | accento traslucido (chip, bolle della chat) |
| `--doru-focus` | colore dell'anello di focus |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | sovrapposizioni al passaggio/premuta |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | colori di stato |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | raggi di 4 / 6 / 8 px |
| `--doru-control-height` | altezza dei controlli (28px) |
| `--doru-panel-gutter` | spazio tra i pannelli flottanti e il bordo della finestra (4px) |
| `--doru-panel-radius` | raggio degli angoli dei pannelli flottanti (8px) |
