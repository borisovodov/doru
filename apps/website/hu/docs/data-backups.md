---
source-hash: e207f75e832a
---

# Adatok és biztonsági mentések

- Az adatai egyszerű fájlok — és az Önéi maradnak. A Dórúnak nincs fiókja, nincs felhős háttere és nincs telemetriája. Semmi sem kerül feltöltésre sehová, hacsak *Ön* nem konfigurál egy MI-szolgáltatót — és még akkor is csak a csevegésben küldött tartalom hagyja el a gépét. Ha mindent a számítógépén szeretne tartani, a helyi szolgáltatók (Ollama, LM Studio) teljesen offline működnek.
- Biztonsági mentéshez: másolja a `.doru` fájlt (és a mellette lévő `media/` mappát, ha vannak fényképei). Ez minden. A visszaállítás visszamásolás.
- A fájl verziókezelés-barát: stabil bináris fájl — commitolhatja gitbe, ha szeretné.

## Szinkronizálás gépek között

A Dórúnak nincs beépített szinkronizáló motorja — a projektek egyszerű fájlok, és a szinkronban tartás az Ön feladata: iCloud Drive, Dropbox, rclone, rsync, USB-stick, amit csak szeret.

Egy figyelmeztetés: a `.doru` fájl SQLite-adatbázis, és egy **nyitott** projekt élő szinkronizálása fájlszinkronizáló eszközzel másolhatja a fájlt félig megírt állapotban, és korrumpálhatja. A biztonságos gyakorlat: zárja be a projektet (vagy az alkalmazást) a szinkronizálás előtt. A lezárt projekt másolása mindig biztonságos.
