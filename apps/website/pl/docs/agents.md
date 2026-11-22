---
source-hash: b3dd07f80d43
---

# AI i agenci

## Czat w aplikacji

Panel czatu znajduje się na dole okna. Wpisz pytanie, a agent może czytać i
edytować drzewo za pomocą wbudowanych narzędzi: `tree_query`, `tree_get`,
`tree_stats`, `tree_edit`, `tree_add_relative`, `sources_add`, `notes_write`.

Rozmowy są zapisywane jako **sesje czatu**: nagłówek panelu czatu wymienia Twoje
sesje, a Ty możesz przełączać się między nimi, rozpocząć nowy czat lub je
usunąć. Sesje są przechowywane dla każdego projektu w folderze danych aplikacji
(nie w pliku `.doru`), tytuł pochodzi z Twojej pierwszej wiadomości, a wszystko
przetrwa restarty aplikacji. Każda odpowiedź ma przycisk kopiowania, który
umieszcza jej surowy markdown w schowku systemowym.

Dostawca jest konfigurowany w sekcji `ai` pliku `settings.json` (zobacz
[Ustawienia](settings.md)):

- **Presety dostawców**: Ollama, LM Studio, własny endpoint zgodny z OpenAI lub
  agent ACP. Presety chmurowe wracają jeden po drugim w miarę odbudowywania ich
  integracji. Ustaw id w `"provider"`; każdy preset ma domyślny bazowy URL, a
  model wybiera się w kreatorze w Ustawieniach — pobierany od dostawcy dla
  endpointów lokalnych, wybierany z dołączonego katalogu dla presetów
  chmurowych. Każdy dostawca zachowuje własną konfigurację (model, bazowy URL,
  rozumowanie, klucz) w `"providers"` — przełączenie dostawcy przywraca
  zapisaną konfigurację każdego z nich.
- **Klucze API** są przechowywane w `secrets.json` (tryb 0600) w folderze
  danych aplikacji, indeksowane identyfikatorem dostawcy. Klucz nigdy nie
  pojawia się w pliku ustawień.

## Dóru AI (asystent offline)

Domyślnym dostawcą jest **Dóru AI**: lokalny asystent działający w całości na
Twoim komputerze. Pobierz go raz w ustawieniach AI (pojedynczy plik, około
3 GB); potem czat działa bez konta i bez połączenia z internetem. Jest
wybierany domyślnie przy nowej instalacji i wymaga co najmniej 8 GB RAM.

Pobrany model to Qwen3.5-4B (skwantyzowany GGUF Q4_K_M, licencja Apache-2.0 —
zobacz [kartę modelu](https://huggingface.co/Qwen/Qwen3.5-4B)). Wagi są
przypięte przez SHA-256 w manifeście aplikacji i weryfikowane po każdym
pobraniu.

## Agenci ACP

Ustaw `"ai": { "provider": "acp", "providers": { "acp": { "command": "…",
"args": [] } } }`, aby rozmawiać z agentem mówiącym Agent Client Protocol
(agenci w stylu Zed). Dóru przekazuje projekt agentowi jako serwer MCP, więc
agent może odpytywać i edytować drzewo tak jak wbudowany czat.

## Dóru jako serwer MCP

Dowolny klient MCP — Claude Desktop, Cursor, agenci programistyczni — może
pracować z Twoim drzewem. Uruchom Dóru w trybie serwera, wskazując plik
`.doru`:

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Przykładowa konfiguracja Claude Desktop
(`Claude → Settings → Developer → Edit Config`):

```json
{
  "mcpServers": {
    "doru": {
      "command": "/Applications/Doru.app/Contents/MacOS/doru",
      "args": ["--mcp-server", "/Users/you/FamilyHistory/family.doru"]
    }
  }
}
```

Linux AppImage: ścieżka do pliku AppImage. Windows:
`"command": "C:\\Program Files\\Doru\\doru.exe"`. Nazwy narzędzi pozostają po
angielsku niezależnie od języka interfejsu.

Serwer jest **bezgłowy i bezstanowy**: bez okna, bez ikony w docku, bez sesji
czatu — czyta i edytuje plik drzewa bezpośrednio i kończy działanie, gdy klient
się rozłączy. Dowolna liczba klientów może jednocześnie wskazywać ten sam plik
(Claude Desktop, Cursor, kilku agentów programistycznych); równoległe zapisy są
bezpiecznie kolejkowane. Jeśli klient nie może uruchomić serwera, wykonaj
polecenie w terminalu — pomocnik zapisuje problemy na stderr, a jego tymczasowy
profil jest odrzucany przy wyjściu.

## Przykładowe prompty

- *„Znajdź wszystkich urodzonych przed 1850 rokiem i wypisz ich źródła.”*
- *„Dodaj Iwana Iwanowa, urodzonego około 1923 roku, jako dziecko Petra i
  Marii.”*
- *„Napisz notatkę badawczą o Annie dotyczącą spisu ludności z 1901 roku.”*
- *„Sprawdź moje drzewo pod kątem osób urodzonych po śmierci ich rodziców.”*
