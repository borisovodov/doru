---
source-hash: 6953c7a55202
---

# Fehlerbehebung

- **Ein `.doru`-Projekt aus einem älteren Build lässt sich nicht öffnen** — vor
  1.0 ändert sich das Projektschema ohne Migrationen, daher werden Dateien, die
  ein anderer Build geschrieben hat, nicht verstanden. Öffnen Sie das Projekt in
  dem Build, der es erstellt hat, exportieren Sie GEDCOM und importieren Sie diese
  Datei in den aktuellen Build.
- **„Der KI-Anbieter ist nicht eingerichtet“** — öffnen Sie die Einstellungen
  (Zahnradsymbol in der linken Leiste), wählen Sie einen Anbieter und folgen Sie
  dem Assistenten: Modellliste abrufen (oder ein Modell wählen) und, falls
  erforderlich, einen Schlüssel speichern.
- **Ollama-Verbindung schlägt fehl** — wählen Sie das Ollama-Preset (Basis-URL
  `http://localhost:11434/v1`); kein API-Schlüssel erforderlich. Klicken Sie auf
  „Modelle vom Anbieter abrufen“ — wenn gemeldet wird, dass der Anbieter nicht
  erreichbar ist, stellen Sie sicher, dass Ollama lokal läuft.
