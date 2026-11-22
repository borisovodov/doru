---
source-hash: 472083c37a73
---

# Rychlý start

1. Spusťte Dóru a na úvodní stránce klikněte na **Vytvořit nový projekt…**
   (nebo **Otevřít projekt nebo importovat GEDCOM…**).
2. **Vytvořit** se zeptá na umístění a název a vytvoří tam soubor `.doru`;
   **Otevřít projekt nebo importovat GEDCOM** otevře existující soubor `.doru`
   nebo soubor GEDCOM `.ged`/`.gdz` — soubor GEDCOM zahájí nový, dosud
   neuložený projekt s importovaným stromem; poté ho uložte jako `.doru`.
   Soubor *je* projekt — jeho název je název projektu:

```
My Family.doru      samotný strom (SQLite, označený ID aplikace)
media/              fotky a skeny, vytvářené podle potřeby (volitelné)
```

3. Zadejte data: nový strom zobrazuje jednu prázdnou kartu — klikněte na ni,
   napište jméno, potvrďte zaškrtnutím a na plátně se objeví první osoba;
   každá karta může stejným způsobem přidat děti, partnery a rodiče. Soubory
   GEDCOM se načítají přes **Otevřít projekt nebo importovat GEDCOM** (krok 2).
   Chcete-li exportovat, otevřete kartu **Exportovat GEDCOM**, vyberte
   **GEDCOM 7.0** (`.ged`) nebo **GEDZIP** (`.gdz` se spravovanými mediálními
   soubory) a potvrďte umístění uložení.

Každý projekt se otevírá ve **vlastním okně**; osoby, editor stromu a nastavení
se v něm otevírají jako karty. **Nové okno** (`⌘⇧N`, `Ctrl+Shift+N` na Linuxu a
Windows) otevře další úvodní stránku bez zavření aktuálního projektu, takže
můžete importovat soubor GEDCOM nebo vedle něj otevřít druhý strom. Naposledy
použité projekty jsou uvedeny na úvodní stránce a vaše otevřená okna projektů
se při příštím spuštění obnoví.
Dvojklikem na soubor `*.doru` (nebo otevřením odkazu
`doru://open?path=/…/family.doru`) se soubor otevře v běžící aplikaci.

## Otevírání projektů z odkazů

Aplikace registruje schéma URL `doru://`, takže odkaz `doru://open?path=…`
otevře projekt — nebo u `.ged`/`.gdz` importuje soubor — i když aplikace ještě
neběží:

- Cesta musí být **absolutní a URL-kódovaná** (`%20` pro mezery a tak dále),
  např. `doru://open?path=%2FUsers%2Fyou%2FFamily.doru`.
- Pokud aplikace neběží, odkaz ji spustí a projekt hned otevře.
- Pokud aplikace již běží, projekt se otevře v běžící instanci — druhá instance
  se nikdy nespustí, stávající okno získá fokus.
- Odkazy fungují jen pro typy souborů, které aplikace otevírá přímo: projekty
  `.doru` a soubory GEDCOM `.ged`/`.gdz`.

Na macOS odešle odkaz z terminálu nebo z jiných aplikací
`open "doru://open?path=…"`; na Linuxu totéž dělá `xdg-open`.

## Další kroky

- [Práce se stromem](tree.md) — osoby, rodiny, prameny, poznámky.
- [Nastavení](settings.md) — reference `settings.json`.
- [AI a agenti](agents.md) — nechte agenta číst a upravovat váš strom.
- [Motivy](themes.md) — jeden motiv se tmavou a světlou paletou, zvolený podle
  vzhledu OS.
