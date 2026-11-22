---
source-hash: 77b60fd904c7
---

# Hibaelhárítás

- **Egy régebbi buildből származó `.doru` projekt nem nyílik meg** — 1.0 előtt a projektséma migrációk nélkül változik, így a más builddel írt fájlokat nem érti. Nyissa meg a projektet az azt létrehozó buildben, exportáljon GEDCOM-ot, és importálja azt a fájlt ebbe a buildbe.
- **„Az AI-szolgáltató nincs beállítva”** — nyissa meg a Beállításokat (fogaskerék ikon a bal sávban), válasszon szolgáltatót, és kövesse a varázslót: kérje le a modelllistát (vagy válasszon modellt), és ahol szükséges, mentse el a kulcsot.
- **Az Ollama kapcsolata sikertelen** — válassza az Ollama előbeállítást (alap URL `http://localhost:11434/v1`); nem szükséges API-kulcs. Nyomja meg a „Modellek lekérése a szolgáltatótól” gombot — ha azt jelzi, hogy a szolgáltató nem érhető el, győződjön meg róla, hogy az Ollama helyben fut.
