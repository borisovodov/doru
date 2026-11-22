---
source-hash: 70e5c9243679
---

# Dane i kopie zapasowe

- Twoje dane to zwykły plik — i pozostają Twoje. Dóru nie ma kont, backendu w
  chmurze ani telemetrii. Nic nie jest nigdzie wysyłane, chyba że *Ty*
  skonfigurujesz zdalnego dostawcę AI — a nawet wtedy wiadomości czatu i dane
  drzewa, które asystent pobiera za pomocą swoich narzędzi, są wysyłane do tego
  dostawcy. Jeśli chcesz trzymać wszystko na swoim komputerze, lokalni dostawcy
  (Ollama, LM Studio) działają całkowicie offline.
- Aby zrobić kopię zapasową: zatrzymaj każdy proces, który może zapisywać w
  projekcie — zamknij go w Dóru i zatrzymaj klientów MCP lub inne narzędzia — a
  następnie skopiuj plik `.doru` (oraz folder `media/` obok niego, jeśli masz
  zdjęcia). To wszystko. Przywrócenie polega na skopiowaniu z powrotem zarówno
  pliku `.doru`, jak i folderu `media/`, gdy projekt jest zamknięty i nie
  działają żadne inne procesy zapisujące. Po awarii otwórz projekt raz w Dóru,
  aby SQLite mógł odzyskać ewentualny pozostały dziennik, a następnie zamknij go
  przed skopiowaniem lub przywróceniem.
- Sesje czatu są przechowywane w katalogu danych aplikacji, a nie w pliku
  `.doru`; w razie potrzeby wykonaj ich osobną kopię zapasową.
- Plik jest przyjazny dla kontroli wersji: to stabilny plik binarny — dodaj go
  do gita commitem, jeśli chcesz.

## Synchronizacja między komputerami

Dóru nie ma wbudowanego mechanizmu synchronizacji — projekty to zwykłe pliki, a
utrzymywanie ich w synchronizacji należy do Ciebie: iCloud Drive, Dropbox,
rclone, rsync, pendrive, cokolwiek wolisz.

Jedno zastrzeżenie: plik `.doru` to baza danych SQLite, a synchronizowanie na
żywo **otwartego** projektu narzędziem do synchronizacji plików może skopiować
plik w stanie połowicznego zapisu i uszkodzić go. Bezpieczna praktyka: zamknij
projekt (lub aplikację) i zatrzymaj wszystkie inne procesy zapisujące przed
synchronizacją. Projekt prawidłowo zamknięty, do którego nikt inny nie
zapisuje, można bezpiecznie skopiować. Po awarii otwórz projekt raz w Dóru, aby
SQLite mógł wycofać ewentualny pozostały dziennik, a następnie zamknij go przed
skopiowaniem.
