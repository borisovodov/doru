---
source-hash: 13cfab1dc709
---

# Praca z drzewem

Drzewo otwiera się jako interaktywne płótno. Wszystko poniżej dzieje się na
samym płótnie; lista osób znajduje się w widoku **Osoby** na lewym pasku
aktywności.

## Nawigacja

- **Przesuwaj** przeciągając tło, **powiększaj** kółkiem myszy lub trackpadem;
  przyciski powiększenia znajdują się w rogu płótna.
- **Wyśrodkuj** osobę dwukrotnym kliknięciem jej karty. Pasek narzędzi
  zachowuje historię: strzałki wstecz/dalej i ścieżka fokusu.
- **Wykresy**: przełączaj między widokami *Przodkowie*, *Potomkowie*,
  *Klepsydra* i *Rodzina* na pasku narzędzi. Widok rodziny pokazuje parę w
  centrum, jej dzieci i obie strony rodziców.
- **Wyszukiwanie**: wpisz imię w polu wyszukiwania na pasku narzędzi i wybierz
  wynik, aby przejść do tej osoby.
- **Zwiń** gałąź strzałką na karcie (albo zwiń/rozwiń wszystkie gałęzie z
  paska narzędzi).

## Karty

Każda karta pokazuje awatar z inicjałami, imię i nazwisko, lata życia (z † przy
osobach zmarłych) oraz małe plakietki z liczbą notatek, źródeł i multimediów.
Lewa krawędź oznacza linię ojca (niebieską) i matki (różową) na wykresach
przodków; ramka wyróżnienia oznacza osobę w centrum.

## Edycja

Wybierz kartę, aby pokazać pasek narzędzi akcji:

- **Dodaj dziecko / małżonka / rodzica** — obok osoby pojawia się nowa pusta
  karta; wpisz imię bezpośrednio w karcie i zatwierdź je znacznikiem wyboru
  (krzyżyk ją odrzuca).
- **Edytuj** — otwiera pełny edytor osoby jako kartę: imiona, płeć, daty
  urodzenia/śmierci ze wskaźnikiem jakości (*Dokładnie / Około / Przed / Po*) i
  pole tekstu swobodnego dla daty (np. data kalendarzowa „23 Nivôse”, która
  nie odpowiada gregoriańskiej), rodziny, wydarzenia, źródła, notatki i
  multimedia.
- **Usuń** — usuwa osobę z drzewa i z każdej rodziny.
- **Zmień rodziców**: przeciągnij kartę na kartę innej osoby, aby przenieść
  przeciąganą osobę jako dziecko do tej rodziny (prawidłowy cel podświetla się
  podczas przeciągania).

Nowe (puste) drzewo pokazuje jedną pustą kartę: kliknij ją, wpisz imię i
nazwisko, zatwierdź znacznikiem wyboru, a pierwsza osoba pojawi się na płótnie.
Potem rozwijaj drzewo z samych kart.

## Rodziny

W pełnym edytorze osoby dodaj rodziców, partnera lub dzieci. Wpisz imię, aby
wybrać istniejącą osobę; chipy pokazują członków każdej rodziny. Usunięcie
osoby z rodziny albo usunięcie rodziny to jedno kliknięcie.

## Źródła i notatki

- **Źródła**: dołączaj źródła do osoby (z tytułem i autorem) lub używaj
  ponownie istniejącego źródła. Każde dołączenie to cytat i można je usunąć.
- **Notatki**: swobodne notatki badawcze dołączone do osoby. Notatkę można
  dołączyć do kilku rekordów: użyj **Dołącz istniejącą notatkę** w sekcji
  Notatki innego rekordu, a następnie wybierz, czy edycja ma zaktualizować
  wspólny tekst wszędzie, czy tylko bieżący rekord. **Odłącz od tego rekordu**
  usuwa jedno powiązanie; **Usuń wszędzie** usuwa notatkę.
- Wydarzenia i imiona mają własne sekcje Źródła, Notatki i Identyfikatory w edytorze osoby; wydarzenia mają także Kontakty.

## Adresy

Widok **Źródła** ma sekcję **Adresy**. Użyj jej do tworzenia, edytowania i
usuwania samodzielnych adresów. Adresy używane przez wydarzenia, repozytoria
lub nadawców pokazują liczbę użyć; usunięcie adresu odłącza go od tych
rekordów. Selektor adresu wydarzenia ma też akcje **Nowy adres** i **Edytuj
adres** do edycji adresu na miejscu.

## Zadania

Zadania mają daty utworzenia i zamknięcia oprócz dat zaplanowanych i
przypomnień. Każdy edytor ma sekcję **Zadania**: dodaj tam zadanie, a zostanie
automatycznie powiązane z tym rekordem. Wydarzenia, imiona, cytaty i notatki
mają własną sekcję Zadania w swoim panelu załączników. **Powiązane z** łączy zadanie z jednym lub kilkoma rekordami w drzewie — osobą, rodziną, wydarzeniem, imieniem, cytatem, notatką, multimediami, miejscem, repozytorium, adresem lub dziełem; pozostaw puste dla samodzielnego zadania. Zadanie jest współdzielone: edycja w dowolnym miejscu aktualizuje ten sam rekord, a usunięcie powiązanego rekordu pozostawia zadanie na miejscu.

Dzieła, adresy, powiązania i relacje partner/dziecko w rodzinach mają te same sekcje Notatki, Źródła, Identyfikatory, Współtwórcy i Zadania co karty głównych encji. Adresy mają także Kontakty. Zadania zachowują sekcje Notatki, Identyfikatory, Współtwórcy oraz dotychczasową sekcję Zadania, ale nie mają Źródeł ani Kontaktów.

## Multimedia

Zdjęcia to zwykłe pliki w folderze `media/` obok projektu. Dodawaj je z osoby,
rodziny, źródła, miejsca, repozytorium, nadawcy, dzieła, zadania lub adresu;
w sekcji **Powiązane z** na karcie multimediów możesz dołączyć istniejący rekord do innych celów.
Kliknij podgląd, aby otworzyć kartę multimediów, gdzie możesz edytować tytuł,
zarządzać plikami i edytować metadane powiązania, takie jak podpis, kolejność,
znacznik główny i znacznik wykluczenia.

Rekord multimediów można powiązać z kilkoma celami. **Odłącz od tego rekordu** usuwa jedno powiązanie i usuwa rekord, jeśli było ostatnie; **Usuń multimedia** usuwa rekord i kopie jego plików. Usunięcie rekordu docelowego usuwa tylko jego powiązania, więc współdzielony rekord multimediów może pozostać bez powiązań.

## Kolejność

Listy, w których kolejność ma znaczenie — imiona, partnerzy i dzieci rodziny,
nazwy miejsc, wiersze adresu, uczestnicy wydarzeń i pola szablonów — mają
kontrolki w górę/w dół. Kolejność jest zapisywana jako pozycja wiersza.
