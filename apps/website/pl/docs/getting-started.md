---
source-hash: 472083c37a73
---

# Szybki start

1. Uruchom Dóru i kliknij **Utwórz nowy projekt…** (albo **Otwórz projekt lub
   zaimportuj GEDCOM…**) na stronie startowej.
2. **Utwórz** pyta o lokalizację i nazwę i tworzy tam plik `.doru`; **Otwórz
   projekt lub zaimportuj GEDCOM** otwiera istniejący plik `.doru` albo plik
   GEDCOM `.ged`/`.gdz` — plik GEDCOM rozpoczyna nowy, jeszcze niezapisany
   projekt z zaimportowanym drzewem; zapisz go później jako `.doru`. Plik
   *jest* projektem — jego nazwa to nazwa projektu:

```
My Family.doru      samo drzewo (SQLite, oznaczone identyfikatorem aplikacji)
media/              zdjęcia i skany, tworzone w razie potrzeby (opcjonalne)
```

3. Wprowadź dane: nowe drzewo pokazuje jedną pustą kartę — kliknij ją, wpisz
   imię i nazwisko, zatwierdź znacznikiem wyboru, a pierwsza osoba pojawi się
   na płótnie; każda karta może w ten sam sposób dodawać dzieci, małżonków i
   rodziców. Pliki GEDCOM trafiają do aplikacji przez **Otwórz projekt lub
   zaimportuj GEDCOM** (krok 2). Aby wyeksportować, otwórz kartę **Eksportuj
   GEDCOM**, wybierz **GEDCOM 7.0** (`.ged`) lub **GEDZIP** (`.gdz`, z
   zarządzanymi plikami multimedialnymi), i potwierdź lokalizację zapisu.

Każdy projekt otwiera się w **własnym oknie**; osoby, edytor drzewa i
ustawienia otwierają się w nim jako karty. **Nowe okno** (`⌘⇧N`,
`Ctrl+Shift+N` na Linuksie i Windowsie) otwiera kolejną stronę startową bez
zamykania bieżącego projektu, więc możesz zaimportować plik GEDCOM lub otworzyć
obok drugie drzewo. Ostatnio używane projekty są wymienione na stronie
startowej, a otwarte okna projektów są przywracane przy następnym uruchomieniu.
Dwukrotne kliknięcie pliku `*.doru` (lub otwarcie linku
`doru://open?path=/…/family.doru`) otwiera go w działającej aplikacji.

## Otwieranie projektów z linków

Aplikacja rejestruje schemat URL `doru://`, więc link `doru://open?path=…`
otwiera projekt — albo importuje plik, w przypadku `.ged`/`.gdz` — nawet gdy
aplikacja jeszcze nie działa:

- Ścieżka musi być **bezwzględna i zakodowana w URL** (`%20` dla spacji itd.),
  np. `doru://open?path=%2FUsers%2Fyou%2FFamily.doru`.
- Jeśli aplikacja nie działa, link ją uruchamia i od razu otwiera projekt.
- Jeśli aplikacja już działa, projekt otwiera się w działającej instancji —
  druga instancja nigdy nie jest uruchamiana, istniejące okno otrzymuje fokus.
- Linki działają tylko dla typów plików, które aplikacja otwiera bezpośrednio:
  projektów `.doru` i plików GEDCOM `.ged`/`.gdz`.

Na macOS `open "doru://open?path=…"` wysyła link z terminala lub z innych
aplikacji; na Linuksie robi to `xdg-open`.

## Następne kroki

- [Praca z drzewem](tree.md) — osoby, rodziny, źródła, notatki.
- [Ustawienia](settings.md) — dokumentacja `settings.json`.
- [AI i agenci](agents.md) — pozwól agentowi czytać i edytować Twoje drzewo.
- [Motywy](themes.md) — jeden motyw z jasną i ciemną paletą, wybierany według
  wyglądu systemu.
