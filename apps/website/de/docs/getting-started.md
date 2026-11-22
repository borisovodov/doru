---
source-hash: 472083c37a73
---

# Schnellstart

1. Starten Sie Dóru und klicken Sie auf der Startseite auf **Neues Projekt
   erstellen…** (oder **Projekt öffnen oder GEDCOM importieren…**).
2. **Erstellen** fragt nach einem Speicherort und einem Namen und legt dort eine
   `.doru`-Datei an; **Projekt öffnen oder GEDCOM importieren** öffnet eine
   vorhandene `.doru`-Datei oder eine GEDCOM-Datei `.ged`/`.gdz` — eine
   GEDCOM-Datei startet ein neues, noch nicht gespeichertes Projekt mit dem
   importierten Stammbaum; speichern Sie es anschließend als `.doru`. Die Datei
   *ist* das Projekt — ihr Name ist der Name des Projekts:

   ```
   My Family.doru      der Stammbaum selbst (SQLite, mit einer App-ID versehen)
   media/              Fotos und Scans, bei Bedarf angelegt (optional)
   ```

3. Daten einpflegen: Ein neuer Stammbaum zeigt eine leere Karte — klicken Sie
   darauf, geben Sie den Namen ein, bestätigen Sie mit dem Häkchen, und die erste
   Person erscheint auf der Leinwand; jede Karte kann auf dieselbe Weise Kinder,
   Ehepartner und Eltern hinzufügen. GEDCOM-Dateien kommen über **Projekt öffnen
   oder GEDCOM importieren** (Schritt 2) herein. Zum Exportieren öffnen Sie den
   Tab **Export**, wählen **GEDCOM 7.0** (`.ged`) oder **GEDZIP** (`.gdz`, mit
   den verwalteten Mediendateien) und bestätigen den Speicherort.

Jedes Projekt öffnet sich in einem **eigenen Fenster**; Personen, der
Stammbaum-Editor und die Einstellungen öffnen sich als Tabs darin. **Neues
Fenster** (`⌘⇧N`, unter Linux und Windows `Ctrl+Shift+N`) öffnet eine weitere
Startseite, ohne das aktuelle Projekt zu schließen, sodass Sie eine GEDCOM-Datei
importieren oder einen zweiten Stammbaum daneben öffnen können. Zuletzt
verwendete Projekte werden auf der Startseite aufgelistet, und Ihre offenen
Projektfenster werden beim nächsten Start wiederhergestellt. Ein Doppelklick auf
eine `*.doru`-Datei (oder das Öffnen eines Links
`doru://open?path=/…/family.doru`) öffnet sie in der laufenden App.

## Projekte über Links öffnen

Die App registriert das URL-Schema `doru://`, sodass ein Link
`doru://open?path=…` das Projekt öffnet — bzw. die Datei importiert, bei
`.ged`/`.gdz` —, auch wenn die App noch nicht läuft:

- Der Pfad muss **absolut und URL-kodiert** sein (`%20` für Leerzeichen usw.),
  z. B. `doru://open?path=%2FUsers%2Fyou%2FFamily.doru`.
- Wenn die App nicht läuft, startet der Link sie und öffnet das Projekt sofort.
- Wenn die App bereits läuft, öffnet sich das Projekt in der laufenden Instanz —
  eine zweite Instanz wird niemals gestartet, das vorhandene Fenster erhält den
  Fokus.
- Links funktionieren nur für Dateitypen, die die App direkt öffnet:
  `.doru`-Projekte und GEDCOM-Dateien `.ged`/`.gdz`.

Unter macOS sendet `open "doru://open?path=…"` den Link aus dem Terminal oder aus
anderen Apps; unter Linux erledigt `xdg-open` dasselbe.

## Nächste Schritte

- [Arbeiten mit dem Stammbaum](tree.md) — Personen, Familien, Quellen, Notizen.
- [Einstellungen](settings.md) — die Referenz zu `settings.json`.
- [KI und Agenten](agents.md) — lassen Sie einen Agenten Ihren Stammbaum lesen
  und bearbeiten.
- [Themes](themes.md) — ein Theme mit dunkler und heller Palette, gewählt nach
  dem Erscheinungsbild des Betriebssystems.
