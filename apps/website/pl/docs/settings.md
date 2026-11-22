---
source-hash: ecff58fa2a2c
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

  // AI providers — set from Settings (gear icon) or here directly.
  "ai": {
    // The active provider: ollama | lmstudio | custom | acp
    // (cloud presets return one by one).
    "provider": "ollama",

    // Per-provider settings, keyed by provider id. Only the entry of the
    // active provider is used; the others keep their values and are
    // restored when you switch back.
    "providers": {
      "ollama": {
        "baseUrl": "", // optional override of the provider's default endpoint
        "model": ""
      }
      // For "acp" only: the agent binary to spawn. Add a comma after the
      // "ollama" object above when you enable it.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Theme: one palette file with a dark and a light section. The OS
  // appearance decides which palette applies.
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
