---
source-hash: e207f75e832a
---

# Daten und Backups

- Ihre Daten sind eine einfache Datei — und sie bleiben Ihre. Dóru hat keine
  Konten, kein Cloud-Backend und keine Telemetrie. Nichts wird irgendwohin
  hochgeladen, es sei denn *Sie* konfigurieren einen KI-Anbieter — und selbst
  dann verlässt nur der Inhalt, den Sie im Chat senden, Ihre Maschine. Wenn Sie
  alles auf Ihrem Computer behalten möchten, funktionieren lokale Anbieter
  (Ollama, LM Studio) vollständig offline.
- Zum Sichern: Kopieren Sie die `.doru`-Datei (und den `media/`-Ordner daneben,
  falls Sie Fotos haben). Das ist alles. Wiederherstellen heißt zurückkopieren.
- Die Datei eignet sich gut für die Versionskontrolle: Sie ist eine stabile Binärdatei —
  committen Sie sie nach Belieben in git.

## Synchronisierung zwischen Rechnern

Dóru hat keine eingebaute Sync-Engine — Projekte sind einfache Dateien, und sie
synchron zu halten ist Ihre Aufgabe: iCloud Drive, Dropbox, rclone, rsync, ein
USB-Stick, was Sie bevorzugen.

Eine Einschränkung: Die `.doru`-Datei ist eine SQLite-Datenbank, und ein
**offenes** Projekt live mit einem Dateisynchronisierungswerkzeug zu
synchronisieren kann die Datei in halb geschriebenem Zustand kopieren und
beschädigen. Die sichere Praxis ist: Schließen Sie das Projekt (oder die App) vor
dem Synchronisieren. Ein geschlossenes Projekt zu kopieren ist immer sicher.
