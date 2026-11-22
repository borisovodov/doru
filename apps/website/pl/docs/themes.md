---
source-hash: 85c6a6b9acc6
---

# Motywy

Interfejs jest w całości stylizowany przez niestandardowe właściwości CSS,
stosowane na poziomie aplikacji — nigdy per projekt.

- **Motyw wbudowany** — `doru`, pojedynczy plik palety JSON w folderze
  `themes/` aplikacji: jeden plik na motyw, bez CSS. Plik zawiera zarówno paletę
  `dark`, jak i `light`; o tym, która obowiązuje, decyduje wygląd systemu
  operacyjnego — przełącz system na tryb jasny, a Dóru od razu za nim podąży.
  Nazwa pliku to identyfikator motywu (`doru.json`); pole `name` w środku to
  nazwa wyświetlana.
- Wybierz motyw w `settings.json` (zobacz [Ustawienia](settings.md)) pojedynczym
  ciągiem znaków albo na stronie **Ustawienia** w aplikacji (lista rozwijana
  Motyw); wybór i tak jest zapisywany w `settings.json`.
- `colors` aktywnej palety są przy uruchomieniu rozwiązywane na niestandardowe
  właściwości CSS `--doru-*`.

## Motywy użytkownika

Umieść plik `<id>.json` z paletami `dark` i `light` w folderze `themes` w
folderze danych aplikacji (tym samym, w którym żyje `settings.json` — zobacz
[Ustawienia](settings.md)), a następnie wybierz go przez `"theme": "<id>"` w
`settings.json`. Po dodaniu pliku uruchom aplikację ponownie, aby został
wczytany. Folder jest tworzony przy pierwszym uruchomieniu; motyw użytkownika,
którego identyfikator odpowiada wbudowanemu, zastępuje go. Plik motywu, który
jest uszkodzony lub nie pasuje do schematu, jest pomijany (zostaje zapisane
ostrzeżenie), podobnie jak brakujący, i nie pojawia się na liście motywów.
Wbudowane motywy zawierają odwołanie `$schema`
(`https://doru.family/theme.json`) — dodaj ten sam wiersz do własnego pliku, aby
uzyskać autouzupełnianie i walidację w edytorach rozumiejących JSON Schema.

Wbudowane motywy, każdy z ciemną i jasną paletą:

| Identyfikator motywu | Nazwa wyświetlana |
|---|---|
| `doru` (domyślny) | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

Domyślna paleta Dóru podąża za ikoną aplikacji: głęboka leśna zieleń z ciepłymi
tonami papieru. Ciemna paleta układa powierzchnie od niemal czarnego płótna o
zielonym odcieniu po jaśniejsze elementy interfejsu i popovery; jasna paleta
używa ciepłego papieru i kremu.

Dostępne zmienne:

| Zmienna | Znaczenie |
|---|---|
| `--doru-bg-canvas` | tło edytora i pasek kart |
| `--doru-bg-chrome` | pasek aktywności, paski boczne, powierzchnia pływających paneli |
| `--doru-bg-raised` | karty, chipy, pole czatu |
| `--doru-bg-popover` | menu i selektory |
| `--doru-bg-input` | przyciski, pola wejściowe, listy wyboru |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | tekst główny, przygaszony i słaby |
| `--doru-border` / `--doru-border-strong` | cienkie linie i mocniejsze obramowania |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | akcent (leśna/szałwiowa zieleń) |
| `--doru-on-accent` | tekst na tle akcentu |
| `--doru-accent-alpha` | półprzezroczysty akcent (chipy, dymki czatu) |
| `--doru-focus` | kolor pierścienia fokusu |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | nakładki po najechaniu/wciśnięciu |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | kolory stanów |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | promienie 4 / 6 / 8 px |
| `--doru-control-height` | wysokość kontrolek (28px) |
| `--doru-panel-gutter` | odstęp między pływającymi panelami a krawędzią okna (4px) |
| `--doru-panel-radius` | promień narożników pływającego panelu (8px) |
