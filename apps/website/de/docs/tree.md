---
source-hash: 13cfab1dc709
---

# Arbeiten mit dem Stammbaum

Der Stammbaum öffnet sich als interaktive Leinwand. Alles Folgende geschieht auf
der Leinwand selbst; die Personenliste befindet sich in der Ansicht **Personen**
der linken Aktivitätsleiste.

## Navigation

- **Schwenken** durch Ziehen des Hintergrunds, **Zoomen** mit dem Mausrad oder
  Trackpad; die Zoom-Schaltflächen befinden sich in der Ecke der Leinwand.
- **Neu zentrieren** auf eine Person durch Doppelklick auf ihre Karte. Die
  Symbolleiste führt einen Verlauf: Pfeile zurück/vorwärts und eine
  Breadcrumb-Navigation.
- **Diagramme**: Wechseln Sie in der Symbolleiste zwischen den Ansichten
  *Vorfahren*, *Nachkommen*, *Sanduhr* und *Familie*. Die Familienansicht zeigt
  das Fokuspaar, ihre Kinder und beide Elternseiten.
- **Suche**: Geben Sie einen Namen in das Suchfeld der Symbolleiste ein und
  wählen Sie ein Ergebnis, um zu dieser Person zu springen.
- **Einklappen** eines Zweigs über das Chevron an einer Karte (oder alle Zweige
  über die Symbolleiste ein-/ausklappen).

## Karten

Jede Karte zeigt einen Avatar mit Initialen, den Namen, die Lebensjahre (mit †
für Verstorbene) und kleine Badges, die die Anzahl von Notizen, Quellen und
Medien anzeigen. Der linke Rand markiert in Vorfahrendiagrammen die väterliche
(blaue) und mütterliche (rosa) Linie; der Akzentrahmen markiert die Fokusperson.

## Bearbeiten

Wählen Sie eine Karte aus, um die Aktionsleiste einzublenden:

- **Kind / Ehepartner / Elternteil hinzufügen** — neben der Person erscheint eine
  neue leere Karte; geben Sie den Namen direkt in der Karte ein und bestätigen Sie
  mit dem Häkchen (das Kreuz verwirft sie).
- **Bearbeiten** — öffnet den vollständigen Personen-Editor als Tab: Namen,
  Geschlecht, Geburts-/Sterbedaten mit einer Qualitätsmarkierung (*Genaue /
  Ungefähr / Vor / Nach*) und einer Freitextform (z. B. ein Kalenderdatum
  „23 Nivôse“, das sich nicht in den gregorianischen Kalender übertragen lässt), Familien,
  Ereignisse, Quellen, Notizen und Medien.
- **Löschen** — entfernt die Person aus dem Stammbaum und allen Familien.
- **Eltern ändern**: Ziehen Sie eine Karte auf die Karte einer anderen Person, um
  die gezogene Person als Kind in diese Familie zu verschieben (das gültige Ziel
  leuchtet während des Ziehens auf).

Ein neuer (leerer) Stammbaum zeigt eine leere Karte: Klicken Sie darauf, geben Sie
den Namen ein, bestätigen Sie mit dem Häkchen, und die erste Person erscheint auf
der Leinwand. Danach wächst der Stammbaum aus den Karten selbst.

## Familien

Fügen Sie im vollständigen Personen-Editor Eltern, einen Partner oder Kinder
hinzu. Geben Sie einen Namen ein, um eine vorhandene Person auszuwählen; Chips
zeigen die Mitglieder jeder Familie. Eine Person aus einer Familie zu entfernen
oder eine Familie zu löschen ist ein Klick.

## Quellen und Notizen

- **Quellen**: Hängen Sie Quellen an eine Person an (mit Titel und Autor) oder
  verwenden Sie eine vorhandene Quelle. Jede Verknüpfung ist ein Zitat
  und kann entfernt werden.
- **Notizen**: Freie Forschungsnotizen, die an eine Person angehängt werden. Eine
  Notiz kann an mehrere Datensätze angehängt werden: Verwenden Sie **Vorhandene
  Notiz anhängen** im Abschnitt Notizen eines anderen Datensatzes und wählen Sie
  dann, ob eine Bearbeitung den gemeinsamen Text überall oder nur im aktuellen
  Datensatz aktualisieren soll. **Von diesem Datensatz lösen** entfernt eine
  Verknüpfung; **Überall löschen** entfernt die Notiz.
- Fakten und Namen tragen ihre eigenen Abschnitte Quellen, Notizen und Kennungen im Personen-Editor; Fakten haben außerdem Kontakte.

## Adressen

Die Ansicht **Quellen** hat einen Abschnitt **Adressen**. Verwenden Sie ihn, um
eigenständige Adressen zu erstellen, zu bearbeiten und zu löschen. Adressen, die
von Fakten, Archiven oder Einsendern verwendet werden, zeigen ihre
Verwendungszahl; beim Löschen wird eine Adresse von diesen Datensätzen gelöst. Die
Adressauswahl eines Fakts bietet außerdem die Aktionen **Neue Adresse** und
**Adresse bearbeiten**, um eine Adresse direkt zu bearbeiten.

## Aufgaben

Aufgaben haben zusätzlich zu den geplanten und Erinnerungsdaten ein Erstellungs-
und ein Abschlussdatum. Jeder Editor hat einen Abschnitt **Aufgaben**: Fügen Sie
dort eine Aufgabe hinzu, wird sie automatisch mit diesem Datensatz verknüpft.
Fakten, Namen, Zitate und Notizen tragen ihren eigenen Abschnitt Aufgaben
in ihrem Anhängebereich. **Verknüpft mit** verbindet eine Aufgabe mit einem oder mehreren Datensätzen im Stammbaum — einer Person, Familie, einem Ereignis, Namen, einer Quelle, einem Zitat, einer Notiz, einem Medium, einem Ort, einem Archiv, einer Adresse oder einem Werk; lassen Sie es leer für eine freistehende Aufgabe. Eine Aufgabe ist geteilt: Eine Bearbeitung an beliebiger Stelle aktualisiert denselben Datensatz, und das Löschen eines verknüpften Datensatzes lässt die Aufgabe bestehen.

Werke, Adressen, Assoziationen und Partner-/Kind-Verknüpfungen von Familien haben dieselben Abschnitte Notizen, Quellen, Kennungen, Beiträger und Aufgaben wie die Tabs der Hauptentität. Adressen haben außerdem Kontakte. Aufgaben behalten Notizen, Kennungen, Beiträger und den bisherigen Aufgaben-Abschnitt, haben aber keine Quellen oder Kontakte.

## Medien

Fotos sind gewöhnliche Dateien im Ordner `media/` neben dem Projekt. Fügen Sie sie
von einer Person, Familie, Quelle, einem Ort, einem Archiv, einem Einsender, einem Werk,
einer Aufgabe oder Adresse hinzu; im Abschnitt **Related to** des Medien-Tabs
können Sie einen vorhandenen Datensatz an weitere Ziele anhängen. Klicken Sie auf eine
Vorschau, um den Medien-Tab zu öffnen, in dem Sie den Titel bearbeiten, Dateien
verwalten und Link-Metadaten wie Bildunterschrift, Reihenfolge, Primärmarkierung
und Ausschlussmarkierung bearbeiten können.

Ein Mediendatensatz kann mit mehreren Zielen verknüpft werden. **Von diesem Datensatz lösen** entfernt eine Verknüpfung und löscht den Datensatz, wenn es die letzte war; **Medien löschen** entfernt den Datensatz und seine Dateikopien. Das Löschen eines Ziel-Datensatzes entfernt nur seine Verknüpfungen, sodass ein geteilter Mediendatensatz ohne Verknüpfungen bestehen bleiben kann.

## Reihenfolge

Listen, deren Reihenfolge wichtig ist — Namen, Familienpartner und -kinder,
Ortsnamen, Adresszeilen, Teilnehmer von Fakten und Vorlagenfelder — haben
Auf-/Ab-Steuerelemente. Die Reihenfolge wird als Zeilenposition gespeichert.
