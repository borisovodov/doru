---
source-hash: 85c6a6b9acc6
---

# Themes

Die Oberfläche wird vollständig über CSS-Custom-Properties gestaltet, die auf
App-Ebene angewendet werden — niemals pro Projekt.

- **Eingebautes Theme** — `doru`, eine einzelne JSON-Palettendatei im Verzeichnis
  `themes/` der App: eine Datei pro Theme, kein CSS. Die Datei enthält sowohl die
  `dark`- als auch die `light`-Palette; das Erscheinungsbild des Betriebssystems
  entscheidet, welche gilt — wechseln Sie Ihr System in den hellen Modus, und Dóru
  folgt sofort. Der Dateiname ist die Theme-ID (`doru.json`); das Feld `name`
  darin ist der Anzeigename.
- Wählen Sie das Theme in `settings.json` (siehe [Einstellungen](settings.md)) mit
  einem einzelnen String oder auf der **Einstellungen**-Seite in der App
  (Theme-Auswahlliste); die Wahl wird in beiden Fällen in `settings.json` gespeichert.
- Die `colors` der aktiven Palette werden beim Start in CSS-Custom-Properties
  `--doru-*` aufgelöst.

## Eigene Themes

Legen Sie eine Datei `<id>.json` mit `dark`- und `light`-Paletten im Verzeichnis
`themes` innerhalb des Datenverzeichnisses der App ab (dort, wo auch
`settings.json` liegt — siehe [Einstellungen](settings.md)), und wählen Sie sie
dann mit `"theme": "<id>"` in `settings.json`. Starten Sie die App nach dem
Hinzufügen einer Datei neu, damit sie übernommen wird. Das Verzeichnis wird beim
ersten Start angelegt; ein eigenes Theme, dessen ID mit einem mitgelieferten
übereinstimmt, überschreibt dieses. Eine Theme-Datei, die fehlerhaft ist oder
nicht zum Schema passt, wird übersprungen (eine Warnung wird protokolliert),
ebenso wie eine fehlende, und erscheint nicht in der Theme-Liste. Mitgelieferte
Themes enthalten eine `$schema`-Referenz (`https://doru.family/theme.json`) —
fügen Sie dieselbe Zeile zu Ihrer eigenen Datei hinzu, um Autovervollständigung
und Validierung in Editoren zu erhalten, die JSON Schema verstehen.

Mitgelieferte Themes, jeweils mit dunkler und heller Palette:

| Theme-ID | Anzeigename |
|---|---|
| `doru` (Standard) | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

Die Standardpalette von Dóru folgt dem App-Symbol: ein tiefes Waldgrün mit warmen
Papiertönen. Die dunkle Palette schichtet Oberflächen von einer fast schwarzen,
grün getönten Leinwand zu hellerem Chrome und Popovers; die helle Palette
verwendet warmes Papier und Creme.

Verfügbare Variablen:

| Variable | Bedeutung |
|---|---|
| `--doru-bg-canvas` | Editor-Hintergrund und Tab-Leiste |
| `--doru-bg-chrome` | Aktivitätsleiste, Seitenleisten, Oberfläche schwebender Panels |
| `--doru-bg-raised` | Karten, Chips, die Chat-Eingabe |
| `--doru-bg-popover` | Menüs und Auswahlfelder |
| `--doru-bg-input` | Schaltflächen, Eingabefelder, Auswahlfelder |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | Haupt-, gedämpfter und schwacher Text |
| `--doru-border` / `--doru-border-strong` | Haarlinien und stärkere Rahmen |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | Akzent (Wald-/Salbeigrün) |
| `--doru-on-accent` | Text auf dem Akzenthintergrund |
| `--doru-accent-alpha` | durchscheinender Akzent (Chips, Chat-Blasen) |
| `--doru-focus` | Farbe des Fokusrings |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | Überlagerungen beim Hovern/Drücken |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | Statusfarben |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | Radien 4 / 6 / 8 px |
| `--doru-control-height` | Steuerelementhöhe (28px) |
| `--doru-panel-gutter` | Abstand zwischen schwebenden Panels und Fensterrand (4px) |
| `--doru-panel-radius` | Eckenradius schwebender Panels (8px) |
