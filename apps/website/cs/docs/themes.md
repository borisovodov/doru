---
source-hash: 85c6a6b9acc6
---

# Motivy

Rozhraní je stylováno výhradně pomocí vlastních vlastností CSS, aplikovaných na
úrovni aplikace — nikdy pro jednotlivé projekty.

- **Vestavěný motiv** — `doru`, jediný soubor palety JSON ve složce `themes/`
  aplikace: jeden soubor na motiv, žádné CSS. Soubor obsahuje tmavou (`dark`) i
  světlou (`light`) paletu; o tom, která platí, rozhoduje vzhled operačního
  systému — přepněte OS do světlého režimu a Dóru ho okamžitě následuje. Název
  souboru je ID motivu (`doru.json`); pole `name` uvnitř je zobrazovaný název.
- Motiv vyberte v `settings.json` (viz [Nastavení](settings.md)) jediným
  řetězcem, nebo na stránce **Nastavení** v aplikaci (rozbalovací nabídka
  Motiv); volba se v obou případech uloží do `settings.json`.
- `colors` aktivní palety se při spuštění přeloží na vlastní vlastnosti CSS
  `--doru-*`.

## Uživatelské motivy

Vložte soubor `<id>.json` s paletami `dark` a `light` do složky `themes` ve
složce s daty aplikace (stejné místo, kde žije `settings.json` — viz
[Nastavení](settings.md)), poté ho vyberte pomocí `"theme": "<id>"` v
`settings.json`. Po přidání souboru aplikaci restartujte, aby se načetl. Složka
se vytvoří při prvním spuštění; uživatelský motiv, jehož ID odpovídá
vestavěnému, ho přepíše. Soubor motivu, který je poškozený nebo neodpovídá
schématu, se přeskočí (zaznamená se varování), stejně jako chybějící, a v
seznamu motivů se neobjeví. Vestavěné motivy nesou odkaz `$schema`
(`https://doru.family/theme.json`) — přidejte stejný řádek do svého souboru,
abyste získali automatické doplňování a validaci v editorech, které rozumí JSON
Schema.

Vestavěné motivy, každý s tmavou a světlou paletou:

| ID motivu | Zobrazovaný název |
|---|---|
| `doru` (výchozí) | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

Výchozí paleta Dóru sleduje ikonu aplikace: hluboká lesní zelená s teplými
papírovými tóny. Tmavá paleta vrství povrchy od téměř černého plátna se zeleným
nádechem po světlejší prvky rozhraní a popovery; světlá paleta používá teplý
papír a krém.

Dostupné proměnné:

| Proměnná | Význam |
|---|---|
| `--doru-bg-canvas` | pozadí editoru a pruh karet |
| `--doru-bg-chrome` | panel aktivit, postranní panely, povrch plovoucích panelů |
| `--doru-bg-raised` | karty, chipy, vstup chatu |
| `--doru-bg-popover` | nabídky a výběry |
| `--doru-bg-input` | tlačítka, vstupy, selecty |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | hlavní, tlumený a slabý text |
| `--doru-border` / `--doru-border-strong` | tenké linky a silnější ohraničení |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | akcent (lesní/šalvějová zelená) |
| `--doru-on-accent` | text na akcentním pozadí |
| `--doru-accent-alpha` | průsvitný akcent (chipy, bubliny chatu) |
| `--doru-focus` | barva kruhu fokusu |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | překryvy při najetí/stisknutí |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | barvy stavů |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | poloměry 4 / 6 / 8 px |
| `--doru-control-height` | výška ovládacích prvků (28px) |
| `--doru-panel-gutter` | mezera mezi plovoucími panely a okrajem okna (4px) |
| `--doru-panel-radius` | poloměr rohů plovoucího panelu (8px) |
