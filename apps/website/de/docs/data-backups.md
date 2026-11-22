---
source-hash: fbf10a17cf6e
---

# Daten und Backups

- Ihre Daten sind eine einfache Datei — und sie bleiben Ihre. Dóru hat keine
  Konten, kein Cloud-Backend und keine Telemetrie. Nichts wird irgendwohin
  hochgeladen, es sei denn *Sie* konfigurieren einen entfernten KI-Anbieter —
  und selbst dann werden die Chat-Nachrichten und die Baumdaten, die der
  Assistent über seine Werkzeuge abruft, an diesen Anbieter gesendet. Wenn Sie
  alles auf Ihrem Computer behalten möchten, funktionieren lokale Anbieter
  (Ollama, LM Studio) vollständig offline.
- Zum Sichern: Beenden Sie jeden Prozess, der in das Projekt schreiben kann —
  schließen Sie es in Dóru und beenden Sie alle MCP-Clients oder anderen
  Werkzeuge — und kopieren Sie dann die `.doru`-Datei (und den `media/`-Ordner
  daneben, falls Sie Fotos haben). Das ist alles. Wiederherstellen heißt, sowohl
  die `.doru`-Datei als auch den `media/`-Ordner zurückzukopieren, während das
  Projekt geschlossen ist und keine anderen Prozesse schreiben. Öffnen Sie das
  Projekt nach einem Absturz einmal in Dóru, damit SQLite ein verbliebenes
  Journal wiederherstellen kann, und schließen Sie es dann vor dem Kopieren oder
  Wiederherstellen. Wenn sich das Projekt nicht öffnen lässt, verschieben Sie
  die beschädigte `.doru`-Datei und ein eventuell verbliebenes Journal an
  einen anderen Ort, bevor Sie wiederherstellen.
- Chat-Sitzungen liegen im Datenverzeichnis der App, nicht in der `.doru`-Datei;
  sichern Sie sie bei Bedarf separat.
- Die Datei eignet sich gut für die Versionskontrolle: Sie ist eine stabile Binärdatei —
  committen Sie sie nach Belieben in git.

## Synchronisierung zwischen Rechnern

Dóru hat keine eingebaute Sync-Engine — Projekte sind einfache Dateien, und sie
synchron zu halten ist Ihre Aufgabe: iCloud Drive, Dropbox, rclone, rsync, ein
USB-Stick, was Sie bevorzugen.

Eine Einschränkung: Die `.doru`-Datei ist eine SQLite-Datenbank, und ein
**offenes** Projekt live mit einem Dateisynchronisierungswerkzeug zu
synchronisieren kann die Datei in halb geschriebenem Zustand kopieren und
beschädigen. Die sichere Praxis ist: Schließen Sie das Projekt (oder die App)
und beenden Sie alle anderen Schreibprozesse, bevor Sie synchronisieren. Ein
sauber geschlossenes Projekt, in das niemand sonst schreibt, kann sicher kopiert
werden. Öffnen Sie das Projekt nach einem Absturz einmal in Dóru, damit
SQLite ein verbliebenes Journal zurückrollen kann, und schließen Sie es dann vor
dem Kopieren. Wenn sich das Projekt nicht öffnen lässt, verschieben Sie die
beschädigte Datei und ein eventuell verbliebenes Journal an einen anderen
Ort, bevor Sie ein Backup wiederherstellen.
