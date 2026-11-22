---
source-hash: 472083c37a73
---

# Gyors kezdés

1. Indítsa el a Dóru-t, és a kezdőlapon kattintson az **Új projekt létrehozása…** (vagy a **Projekt megnyitása vagy GEDCOM importálása…**) gombra.
2. A **Létrehozás** helyet és nevet kér, majd létrehoz egy `.doru` fájlt; a **Projekt megnyitása vagy GEDCOM importálása** megnyit egy meglévő `.doru` fájlt vagy egy `.ged`/`.gdz` GEDCOM fájlt — a GEDCOM fájl új, még nem mentett projektet indít az importált fával; utána mentse `.doru`-ként. A fájl *maga* a projekt — a neve a projekt neve:

```
My Family.doru      maga a fa (SQLite, alkalmazás-azonosítóval megjelölve)
media/              fényképek és szkennelések, igény szerint létrehozva (nem kötelező)
```

3. Adatok bevitele: egy új fa egyetlen üres kártyát mutat — kattintson rá, írja be a nevet, erősítse meg a pipával, és az első személy megjelenik a vásznon; minden kártyáról ugyanígy adhat hozzá gyermekeket, házastársakat és szülőket. A GEDCOM fájlok a **Projekt megnyitása vagy GEDCOM importálása** paranccsal (2. lépés) kerülnek be. Exportáláshoz nyissa meg az **Exportálás** lapot, válassza a **GEDCOM 7.0** (`.ged`) vagy a **GEDZIP** (`.gdz`, a kezelt médiafájlokkal) lehetőséget, és erősítse meg a mentési helyet.

Minden projekt a **saját ablakában** nyílik meg; a személyek, a faszerkesztő és a beállítások lapokként nyílnak meg benne. Az **Új ablak** (`⌘⇧N`, Linuxon és Windowson `Ctrl+Shift+N`) egy másik kezdőlapot nyit meg az aktuális projekt bezárása nélkül, így importálhat GEDCOM fájlt, vagy megnyithat egy második fát mellette. A legutóbb használt projektek a kezdőlapon jelennek meg, a nyitott projektablakok pedig a következő indításkor visszaállnak. Ha duplán kattint egy `*.doru` fájlra (vagy megnyit egy `doru://open?path=/…/family.doru` hivatkozást), az a futó alkalmazásban nyílik meg.

## Projektek megnyitása hivatkozásokból

Az alkalmazás regisztrálja a `doru://` URL-sémát, így a `doru://open?path=…` hivatkozás megnyitja a projektet — vagy importálja a fájlt `.ged`/`.gdz` esetén —, még akkor is, ha az alkalmazás még nem fut:

- Az útvonalnak **abszolútnak és URL-kódoltnak** kell lennie (szóközöknél `%20`, és így tovább), például `doru://open?path=%2FUsers%2Fyou%2FFamily.doru`.
- Ha az alkalmazás nem fut, a hivatkozás elindítja, és azonnal megnyitja a projektet.
- Ha az alkalmazás már fut, a projekt a futó példányban nyílik meg — soha nem indul második példány, a meglévő ablak kerül előtérbe.
- A hivatkozások csak azokhoz a fájltípusokhoz működnek, amelyeket az alkalmazás közvetlenül megnyit: `.doru` projektek és `.ged`/`.gdz` GEDCOM fájlok.

macOS-en az `open "doru://open?path=…"` parancs küldi a hivatkozást a terminálból vagy más alkalmazásokból; Linuxon az `xdg-open` teszi ugyanezt.

## További lépések

- [A családfa használata](tree.md) — személyek, családok, források, jegyzetek.
- [Beállítások](settings.md) — a `settings.json` referencia.
- [MI és ügynökök](agents.md) — hagyja, hogy egy ügynök olvassa és szerkessze a fáját.
- [Témák](themes.md) — egy téma sötét és világos palettával, az operációs rendszer megjelenése szerint választva.
