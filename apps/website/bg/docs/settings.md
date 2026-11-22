---
source-hash: ecff58fa2a2c
---

# Настройки

Глобалните настройки се намират в `settings.json` в папката с данни на приложението:

| ОС | Път |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**Стойностите по подразбиране живеят в приложението; файлът записва само изричните промени.** При първо стартиране приложението създава файла само с референцията `$schema` — всичко останало се връща към вградените стойности по подразбиране, така че новите стойности по подразбиране достигат до съществуващите потребители с актуализациите на приложението. Референцията `$schema` е единственият източник на документация: редакторите с поддръжка на JSON Schema (VS Code, Zed, JetBrains) предлагат автоматично довършване, валидиране и описания на полетата от нея. Приложението записва записи във файла само когато промените настройка в **Настройки**; всичко останало остава недокоснато.
Файлът е обикновен JSON с разрешени коментари — редактирайте го с произволен редактор; промените се възприемат на живо, докато приложението работи. Приложението валидира файла спрямо схемата при зареждане; ако не се анализира или не съответства на схемата, той се заменя с празния шаблон (записва се предупреждение). Доставчикът на ИИ се конфигурира в секцията `ai` на този файл — вижте [ИИ и агенти](agents.md).

Пълна справка:

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

## Дневници

Приложението добавя диагностика към `doru.log` в папката с данни (до `settings.json`). Файлът се сменя при 5 MB — предишният файл се запазва като `doru.old.log`. Подразбиращата се подробност е `warn` (развойните сборки пишат на `debug`); задайте `DORU_LOG_LEVEL=trace|debug|info|warn|error`, за да я замените. Предупрежденията за валидиране на схема (файл с настройки или тема, който не съответства на схемата си) се записват тук. Бутонът **Отваряне на лог файла** в Настройки създава файла при поискване, ако още нищо не е записано.
