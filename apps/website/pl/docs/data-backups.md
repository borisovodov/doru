---
source-hash: e207f75e832a
---

# Dane i kopie zapasowe

- Twoje dane to zwykły plik — i pozostają Twoje. Dóru nie ma kont, backendu w
  chmurze ani telemetrii. Nic nie jest nigdzie wysyłane, chyba że *Ty*
  skonfigurujesz dostawcę AI — a nawet wtedy Twój komputer opuszcza tylko
  treść, którą wysyłasz w czacie. Jeśli chcesz trzymać wszystko na swoim
  komputerze, lokalni dostawcy (Ollama, LM Studio) działają całkowicie offline.
- Aby zrobić kopię zapasową: skopiuj plik `.doru` (oraz folder `media/` obok
  niego, jeśli masz zdjęcia). To wszystko. Przywrócenie polega na skopiowaniu
  go z powrotem.
- Plik jest przyjazny dla kontroli wersji: to stabilny plik binarny — dodaj go
  do gita commitem, jeśli chcesz.

## Synchronizacja między komputerami

Dóru nie ma wbudowanego mechanizmu synchronizacji — projekty to zwykłe pliki, a
utrzymywanie ich w synchronizacji należy do Ciebie: iCloud Drive, Dropbox,
rclone, rsync, pendrive, cokolwiek wolisz.

Jedno zastrzeżenie: plik `.doru` to baza danych SQLite, a synchronizowanie na
żywo **otwartego** projektu narzędziem do synchronizacji plików może
skopiować plik w stanie połowicznego zapisu i uszkodzić go. Bezpieczna
praktyka: zamknij projekt (lub aplikację) przed synchronizacją. Kopiowanie
zamkniętego projektu jest zawsze bezpieczne.
