---
source-hash: cb76eaf45583
---

# Ustawienia

Ustawienia globalne są przechowywane w `settings.json` w folderze danych
aplikacji:

| System operacyjny | Ścieżka |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**Wartości domyślne są w aplikacji; plik zapisuje tylko jawne nadpisania.** Przy
pierwszym uruchomieniu aplikacja tworzy plik tylko z odwołaniem `$schema` —
wszystko inne korzysta z wbudowanych wartości domyślnych, więc nowe wartości
domyślne trafiają do istniejących użytkowników wraz z aktualizacjami aplikacji.
Odwołanie `$schema` to jedyne źródło dokumentacji: edytory obsługujące JSON
Schema (VS Code, Zed, JetBrains) oferują z niego autouzupełnianie, walidację i
opisy pól. Aplikacja zapisuje wpisy w pliku tylko wtedy, gdy zmienisz ustawienie
w **Ustawieniach**; wszystko inne pozostaje nietknięte.
Plik to zwykły JSON z dozwolonymi komentarzami — edytuj go dowolnym edytorem;
zmiany są przechwytywane na bieżąco, gdy aplikacja działa. Aplikacja waliduje
plik względem schematu przy ładowaniu; jeśli nie da się go przeanalizować lub
nie pasuje do schematu, zostaje zastąpiony pustym szablonem (zostaje zapisane
ostrzeżenie). Dostawca AI jest konfigurowany w sekcji `ai` tego pliku — zobacz
[AI i agenci](agents.md).

Pełna dokumentacja:

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // Dostawcy AI — ustaw w Ustawieniach (ikona koła zębatego) lub bezpośrednio tutaj.
  "ai": {
    // Aktywny dostawca: ollama | lmstudio | custom | acp
    // (konfiguracje chmurowe wracają jedna po drugiej).
    "provider": "ollama",

    // Ustawienia poszczególnych dostawców, indeksowane identyfikatorem dostawcy.
    // Używany jest tylko wpis aktywnego dostawcy; pozostałe zachowują swoje
    // wartości i są przywracane po przełączeniu z powrotem.
    "providers": {
      "ollama": {
        "baseUrl": "", // opcjonalne nadpisanie domyślnego endpointu dostawcy
        "model": ""
      }
      // Tylko dla "acp": plik binarny agenta do uruchomienia.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Motyw: jeden plik palety z sekcją ciemną i jasną. O tym, która paleta
  // obowiązuje, decyduje wygląd systemu operacyjnego.
  "theme": "doru"
}
```

## Dzienniki

Aplikacja dopisuje diagnostykę do `doru.log` w folderze danych (obok
`settings.json`). Plik jest rotowany przy 5 MB — poprzedni plik jest zachowywany
jako `doru.old.log`. Domyślny poziom szczegółowości to `warn` (kompilacje
deweloperskie logują na `debug`); ustaw
`DORU_LOG_LEVEL=trace|debug|info|warn|error`, aby go nadpisać. Ostrzeżenia
walidacji schematu (plik ustawień lub motywu niezgodny ze swoim schematem) są tu
zapisywane. Przycisk **Otwórz plik dziennika** w Ustawieniach tworzy plik na
żądanie, jeśli nic jeszcze nie zostało zapisane.
