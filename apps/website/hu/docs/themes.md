---
source-hash: 85c6a6b9acc6
---

# Témák

A felület teljes egészében CSS egyéni tulajdonságokkal van stilizálva, az alkalmazás szintjén alkalmazva — soha nem projektenként.

- **Beépített téma** — `doru`, egyetlen JSON-palettafájl az alkalmazás `themes/` könyvtárában: témánként egy fájl, CSS nélkül. A fájl a `dark` és a `light` palettát is tartalmazza; az operációs rendszer megjelenése dönti el, melyik érvényes — váltson az operációs rendszert világos módra, és a Dóru azonnal követi. A fájlnév a téma azonosítója (`doru.json`); a benne lévő `name` mező a megjelenített név.
- Válassza ki a témát a `settings.json`-ban (lásd [Beállítások](settings.md)) egyetlen karakterlánccal, vagy az alkalmazás **Beállítások** oldalán (Téma legördülő menü); a választás mindkét esetben a `settings.json`-ban tárolódik.
- Az aktív paletta `colors` értékei indításkor `--doru-*` CSS egyéni tulajdonságokra oldódnak fel.

## Felhasználói témák

Helyezzen egy `<id>.json` fájlt `dark` és `light` palettákkal az alkalmazás adatkönyvtárán belüli `themes` könyvtárba (ugyanoda, ahol a `settings.json` él — lásd [Beállítások](settings.md)), majd válassza ki a `"theme": "<id>"` beállítással a `settings.json`-ban. Indítsa újra az alkalmazást egy fájl hozzáadása után, hogy az felismerésre kerüljön. A könyvtár az első indításkor jön létre; egy felhasználói téma, amelynek azonosítója egy beépítettel egyezik, felülírja azt. A hibás vagy a sémának nem megfelelő témafájl kimarad (figyelmeztetés kerül a naplóba), akárcsak egy hiányzó, és nem jelenik meg a témalistában. A beépített témák `$schema` hivatkozást tartalmaznak (`https://doru.family/theme.json`) — adja hozzá ugyanezt a sort a saját fájljához, hogy automatikus kiegészítést és ellenőrzést kapjon a JSON Schema-t értő szerkesztőkben.

Beépített témák, mindegyik sötét és világos palettával:

| Téma azonosítója | Megjelenített név |
|---|---|
| `doru` (alapértelmezett) | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

A beépített Dóru-paletta az alkalmazás ikonját követi: mély erdei zöld meleg papírtónusokkal. A sötét paletta a közel fekete, zöldes tónusú vászonról világosabb keretre és előbukkanó panelekre rétegezi a felületeket; a világos paletta meleg papírt és krémszínt használ.

Elérhető változók:

| Változó | Jelentés |
|---|---|
| `--doru-bg-canvas` | szerkesztő háttér és lapsáv |
| `--doru-bg-chrome` | tevékenységsáv, oldalsávok, lebegő panel felülete |
| `--doru-bg-raised` | kártyák, chipek, a csevegésbevitel |
| `--doru-bg-popover` | menük és választók |
| `--doru-bg-input` | gombok, beviteli mezők, választómezők |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | fő, halvány és nagyon halvány szöveg |
| `--doru-border` / `--doru-border-strong` | hajszálvonalak és erősebb szegélyek |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | kiemelés (erdei/zsályazöld) |
| `--doru-on-accent` | szöveg a kiemelő háttéren |
| `--doru-accent-alpha` | áttetsző kiemelés (chipek, csevegőbuborékok) |
| `--doru-focus` | fókuszgyűrű színe |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | rámutatás/lenyomás átfedései |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | állapotszínek |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | 4 / 6 / 8 px sugarak |
| `--doru-control-height` | vezérlő magassága (28px) |
| `--doru-panel-gutter` | a lebegő panelek és az ablak széle közötti hézag (4px) |
| `--doru-panel-radius` | lebegő panel saroklekerekítése (8px) |
