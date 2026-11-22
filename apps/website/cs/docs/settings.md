---
source-hash: cb76eaf45583
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

  // Poskytovatelé AI — nastavte v Nastavení (ikona ozubeného kola) nebo přímo zde.
  "ai": {
    // Aktivní poskytovatel: ollama | lmstudio | custom | acp
    // (cloudové předvolby se postupně vracejí).
    "provider": "ollama",

    // Nastavení jednotlivých poskytovatelů podle ID poskytovatele. Používá se
    // jen položka aktivního poskytovatele; ostatní si zachovávají své hodnoty
    // a obnoví se, když se k nim vrátíte.
    "providers": {
      "ollama": {
        "baseUrl": "", // volitelné přepsání výchozího endpointu poskytovatele
        "model": ""
      }
      // Jen pro "acp": binárka agenta, která se má spustit.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Motiv: jeden soubor palety s tmavou a světlou sekcí. O tom, která paleta
  // platí, rozhoduje vzhled OS.
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
