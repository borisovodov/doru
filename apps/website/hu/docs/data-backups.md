---
source-hash: 0feae5711b39
---

# Adatok és biztonsági mentések

- Az adatai egyszerű fájlok — és az Önéi maradnak. A Dórúnak nincs fiókja, nincs felhős háttere és nincs telemetriája. Semmi sem kerül feltöltésre sehová, hacsak *Ön* nem konfigurál egy távoli MI-szolgáltatót — és még akkor is a csevegőüzenetek, valamint az asszisztens által az eszközein keresztül lekért faadatok elküldésre kerülnek a szolgáltatónak. Ha mindent a számítógépén szeretne tartani, a helyi szolgáltatók (Ollama, LM Studio) teljesen offline működnek.
- Biztonsági mentéshez: állítson le minden folyamatot, amely írhat a projektbe — zárja be a Dóruban, és állítsa le az MCP-klienseket vagy más eszközöket —, majd másolja a `.doru` fájlt (és a mellette lévő `media/` mappát, ha vannak fényképei). Ez minden. A visszaállítás azt jelenti, hogy a fájlt visszamásolja, miközben a projekt zárva van, és más folyamat sem ír bele.
- A csevegési munkamenetek az alkalmazás adatkönyvtárában, nem a `.doru` fájlban találhatók; ha szüksége van rájuk, készítsen róluk külön biztonsági mentést.
- A fájl verziókezelés-barát: stabil bináris fájl — commitolhatja gitbe, ha szeretné.

## Szinkronizálás gépek között

A Dórúnak nincs beépített szinkronizáló motorja — a projektek egyszerű fájlok, és a szinkronban tartás az Ön feladata: iCloud Drive, Dropbox, rclone, rsync, USB-stick, amit csak szeret.

Egy figyelmeztetés: a `.doru` fájl SQLite-adatbázis, és egy **nyitott** projekt élő szinkronizálása fájlszinkronizáló eszközzel másolhatja a fájlt félig megírt állapotban, és korrumpálhatja. A biztonságos gyakorlat: zárja be a projektet (vagy az alkalmazást), és állítson le minden más író folyamatot a szinkronizálás előtt. Egy lezárt projekt, amelybe más nem ír, mindig biztonságosan másolható. Összeomlás után nyissa meg a projektet egyszer a Dóruban, hogy az SQLite visszagörgethesse az esetleg megmaradt naplót, majd zárja be a másolás előtt.
