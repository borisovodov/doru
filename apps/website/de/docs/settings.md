---
source-hash: ecff58fa2a2c
---

# Einstellungen

Globale Einstellungen liegen in `settings.json` im Datenverzeichnis der App:

| Betriebssystem | Pfad |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**Standardwerte liegen in der App; die Datei zeichnet nur ausdrückliche
Überschreibungen auf.** Beim ersten Start legt die App die Datei nur mit der
`$schema`-Referenz an — alles andere fällt auf eingebaute Standardwerte zurück,
sodass neue Standardwerte mit App-Updates zu bestehenden Nutzern gelangen. Die
`$schema`-Referenz ist die einzige Dokumentationsquelle: Editoren mit
JSON-Schema-Unterstützung (VS Code, Zed, JetBrains) bieten daraus
Autovervollständigung, Validierung und Feldbeschreibungen. Die App schreibt nur
dann Einträge in die Datei, wenn Sie eine Einstellung in den **Einstellungen**
ändern; alles andere bleibt unberührt. Die Datei ist reines JSON, Kommentare sind
erlaubt — bearbeiten Sie sie mit einem beliebigen Editor; Änderungen werden live
übernommen, während die App läuft. Die App validiert die Datei beim Laden gegen
das Schema; wenn sie nicht geparst werden kann oder nicht zum Schema passt, wird
sie durch die leere Vorlage ersetzt (eine Warnung wird protokolliert). Der
KI-Anbieter wird im Abschnitt `ai` dieser Datei konfiguriert — siehe
[KI und Agenten](agents.md).

Vollständige Referenz:

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

## Protokolle

Die App hängt Diagnosedaten an `doru.log` im Datenverzeichnis an (neben
`settings.json`). Die Datei wird bei 5 MB rotiert — die vorherige Datei bleibt als
`doru.old.log` erhalten. Die Standardausführlichkeit ist `warn`
(Entwicklungsbuilds protokollieren auf `debug`); setzen Sie
`DORU_LOG_LEVEL=trace|debug|info|warn|error`, um sie zu überschreiben. Warnungen
zur Schema-Validierung (eine Einstellungs- oder Theme-Datei, die nicht zu ihrem
Schema passt) werden hier protokolliert. Die Schaltfläche **Protokolldatei
öffnen** in den Einstellungen legt die Datei bei Bedarf an, wenn noch nichts
protokolliert wurde.
