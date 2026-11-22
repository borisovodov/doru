---
source-hash: b3dd07f80d43
---

# KI und Agenten

## Der Chat in der App

Das Chat-Panel sitzt unten im Fenster. Geben Sie eine Frage ein, und der Agent
kann den Stammbaum mit eingebauten Werkzeugen lesen und bearbeiten: `tree_query`,
`tree_get`, `tree_stats`, `tree_edit`, `tree_add_relative`, `sources_add`,
`notes_write`.

Unterhaltungen werden als **Chat-Sitzungen** gespeichert: Der Kopf des
Chat-Panels listet Ihre Sitzungen auf, und Sie können zwischen ihnen wechseln,
einen neuen Chat beginnen oder sie löschen. Sitzungen werden pro Projekt im
Datenverzeichnis der App gespeichert (nicht in der `.doru`-Datei), der Titel
stammt aus Ihrer ersten Nachricht, und alles überlebt App-Neustarts. Jede Antwort
hat eine Kopierschaltfläche, die ihr rohes Markdown in die Systemzwischenablage
legt.

Der Anbieter wird im Abschnitt `ai` von `settings.json` konfiguriert (siehe
[Einstellungen](settings.md)):

- **Anbieter-Presets**: Ollama, LM Studio, ein benutzerdefinierter
  OpenAI-kompatibler Endpunkt oder ein ACP-Agent. Cloud-Presets kehren nach und
  nach zurück, während ihre Integrationen neu aufgebaut werden. Setzen Sie die ID
  in `"provider"`; jedes Preset liefert eine Standard-Basis-URL, während das
  Modell im Einstellungsassistenten gewählt wird — für lokale Endpunkte vom
  Anbieter abgerufen, für Cloud-Presets aus dem mitgelieferten Katalog
  ausgewählt. Jeder Anbieter behält seine eigene Konfiguration (Modell,
  Basis-URL, Reasoning, Schlüssel) unter `"providers"` — beim Wechseln der
  Anbieter wird die gespeicherte Einrichtung jedes einzelnen wiederhergestellt.
- **API-Schlüssel** werden in `secrets.json` (Modus 0600) im Datenverzeichnis der
  App gespeichert, benannt nach der Anbieter-ID. Der Schlüssel erscheint nie in
  der Einstellungsdatei.

## Dóru AI (Offline-Assistent)

Der Standardanbieter ist **Dóru AI**: ein lokaler Assistent, der vollständig auf
Ihrem Computer läuft. Laden Sie ihn einmal in den KI-Einstellungen herunter (eine
einzelne Datei, etwa 3 GB); danach funktioniert der Chat ohne Konto und ohne
Internetverbindung. Bei einer Neuinstallation ist er standardmäßig ausgewählt und
benötigt mindestens 8 GB RAM.

Das heruntergeladene Modell ist Qwen3.5-4B (Q4_K_M-quantisiertes GGUF,
Apache-2.0-Lizenz — siehe [Modellkarte](https://huggingface.co/Qwen/Qwen3.5-4B)).
Die Gewichte sind per SHA-256 im App-Manifest fixiert und werden nach jedem
Download überprüft.

## ACP-Agenten

Setzen Sie `"ai": { "provider": "acp", "providers": { "acp": { "command": "…",
"args": [] } } }`, um mit einem Agenten zu sprechen, der das Agent Client Protocol
spricht (Agenten im Zed-Stil). Dóru übergibt dem Agenten das Projekt als
MCP-Server, sodass der Agent den Stammbaum genauso abfragen und bearbeiten kann
wie der eingebaute Chat.

## Dóru als MCP-Server

Jeder MCP-Client — Claude Desktop, Cursor, Coding-Agenten — kann mit Ihrem
Stammbaum arbeiten. Führen Sie Dóru im Servermodus aus und zeigen Sie auf die
`.doru`-Datei:

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Beispielkonfiguration für Claude Desktop
(`Claude → Settings → Developer → Edit Config`):

```json
{
  "mcpServers": {
    "doru": {
      "command": "/Applications/Doru.app/Contents/MacOS/doru",
      "args": ["--mcp-server", "/Users/you/FamilyHistory/family.doru"]
    }
  }
}
```

Linux AppImage: der Pfad zur AppImage-Datei. Windows:
`"command": "C:\\Program Files\\Doru\\doru.exe"`. Werkzeugnamen bleiben unabhängig
von der Oberflächensprache auf Englisch.

Der Server ist **ohne Oberfläche und zustandslos**: kein Fenster, kein Dock-Symbol, keine
Chat-Sitzungen — er liest und bearbeitet die Stammbaumdatei direkt und beendet
sich, wenn der Client die Verbindung trennt. Beliebig viele Clients können
gleichzeitig auf dieselbe Datei zeigen (Claude Desktop, Cursor, mehrere
Coding-Agenten); gleichzeitige Schreibvorgänge werden sicher in eine Warteschlange
gestellt. Wenn ein Client den Server nicht starten kann, führen Sie den Befehl in
einem Terminal aus — der Helfer protokolliert Probleme auf stderr, und sein
temporäres Profil wird beim Beenden verworfen.

## Beispiel-Prompts

- *„Finde alle, die vor 1850 geboren wurden, und liste ihre Quellen auf.“*
- *„Füge Ivan Ivanov, geboren um 1923, als Kind von Petr und Maria hinzu.“*
- *„Schreibe eine Forschungsnotiz über Anna zur Volkszählung von 1901.“*
- *„Prüfe meinen Stammbaum auf Personen, die nach dem Tod ihrer Eltern geboren
  wurden.“*
