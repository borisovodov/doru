---
source-hash: ecff58fa2a2c
---

# Beállítások

A globális beállítások az alkalmazás adatkönyvtárában lévő `settings.json` fájlban találhatók:

| Operációs rendszer | Útvonal |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**Az alapértelmezések az alkalmazásban élnek; a fájl csak a kifejezett felülírásokat rögzíti.** Első indításkor az alkalmazás csak a `$schema` hivatkozással hozza létre a fájlt — minden más a beépített alapértelmezésekre esik vissza, így az új alapértelmezések alkalmazásfrissítésekkel jutnak el a meglévő felhasználókhoz. A `$schema` hivatkozás az egyetlen dokumentációs forrás: a JSON Schema-t támogató szerkesztők (VS Code, Zed, JetBrains) automatikus kiegészítést, ellenőrzést és mezőleírásokat kínálnak belőle. Az alkalmazás csak akkor ír bejegyzéseket a fájlba, amikor a **Beállítások** alatt módosít egy beállítást; minden más érintetlen marad.
A fájl egyszerű JSON, megjegyzésekkel — szerkessze bármelyik szerkesztővel; a változtatásokat az alkalmazás futása közben azonnal felismeri. Az alkalmazás betöltéskor ellenőrzi a fájlt a séma alapján; ha nem értelmezhető vagy nem felel meg a sémának, az üres sablonnal helyettesíti (figyelmeztetés kerül a naplóba). Az MI-szolgáltató e fájl `ai` szakaszában konfigurálható — lásd [MI és ügynökök](agents.md).

Teljes referencia:

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // AI providers — set from Settings (gear icon) or here directly.
  "ai": {
    // The active provider: ollama | lmstudio | custom | acp
    // (cloud presets return one by one).
    "provider": "ollama",

    // Per-provider settings, keyed by provider id. Only the entry of the
    // active provider is used; the others keep their values and are
    // restored when you switch back.
    "providers": {
      "ollama": {
        "baseUrl": "", // optional override of the provider's default endpoint
        "model": ""
      }
      // For "acp" only: the agent binary to spawn. Add a comma after the
      // "ollama" object above when you enable it.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Theme: one palette file with a dark and a light section. The OS
  // appearance decides which palette applies.
  "theme": "doru"
}
```

## Naplók

Az alkalmazás diagnosztikai bejegyzéseket fűz az adatkönyvtárban lévő `doru.log` fájlhoz (a `settings.json` mellett). A fájl 5 MB-nál váltódik — az előző fájl `doru.old.log` néven marad meg. Az alapértelmezett részletesség `warn` (a fejlesztői buildek `debug` szinten naplóznak); a felülíráshoz állítsa be a `DORU_LOG_LEVEL=trace|debug|info|warn|error` értéket. A sémaérvényesítési figyelmeztetések (egy beállítás- vagy témafájl, amely nem felel meg a sémájának) ide kerülnek. A Beállítások **Naplófájl megnyitása** gombja igény szerint létrehozza a fájlt, ha még semmit nem naplóztak.
