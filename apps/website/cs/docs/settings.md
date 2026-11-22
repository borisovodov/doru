---
source-hash: ecff58fa2a2c
---

# Nastavení

Globální nastavení jsou uložena v `settings.json` ve složce s daty aplikace:

| Operační systém | Cesta |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**Výchozí hodnoty žijí v aplikaci; soubor zaznamenává jen explicitní změny.**
Při prvním spuštění aplikace vytvoří soubor pouze s odkazem `$schema` — vše
ostatní se vrací k vestavěným výchozím hodnotám, takže nové výchozí hodnoty se
dostanou ke stávajícím uživatelům s aktualizacemi aplikace. Odkaz `$schema` je
jediným zdrojem dokumentace: editory s podporou JSON Schema (VS Code, Zed,
JetBrains) nabízejí automatické doplňování, validaci a popisy polí. Aplikace
zapisuje položky do souboru jen tehdy, když změníte nastavení v **Nastavení**;
vše ostatní zůstává nedotčeno.
Soubor je prostý JSON s povolenými komentáři — upravujte ho libovolným editorem;
změny se načítají za běhu aplikace. Aplikace soubor při načtení validuje proti
schématu; pokud se jej nepodaří analyzovat nebo neodpovídá schématu, je
nahrazen prázdnou šablonou (zaznamená se varování). Poskytovatel AI se
konfiguruje v sekci `ai` tohoto souboru — viz [AI a agenti](agents.md).

Úplná reference:

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

## Protokoly

Aplikace připisuje diagnostiku do `doru.log` ve složce s daty (vedle
`settings.json`). Soubor se otáčí při 5 MB — předchozí soubor zůstává jako
`doru.old.log`. Výchozí úroveň podrobnosti je `warn` (vývojové buildy logují na
`debug`); přepište ji nastavením
`DORU_LOG_LEVEL=trace|debug|info|warn|error`. Varování z validace schématu
(soubor nastavení nebo motivu, který neodpovídá svému schématu) se zaznamenávají
sem. Tlačítko **Otevřít soubor protokolu** v Nastavení vytvoří soubor na
vyžádání, pokud se ještě nic nezaznamenalo.
