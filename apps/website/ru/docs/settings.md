---
source-hash: ecff58fa2a2c
---

# Настройки

Глобальные настройки хранятся в `settings.json` в каталоге данных приложения:

| ОС | Путь |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**Значения по умолчанию живут в приложении; файл хранит только явные
переопределения.** При первом запуске приложение создаёт файл только со ссылкой
`$schema` — всё остальное берётся из встроенных значений по умолчанию, поэтому
новые значения по умолчанию доставляются существующим пользователям с
обновлениями приложения. Ссылка `$schema` — единственный источник документации:
редакторы с поддержкой JSON Schema (VS Code, Zed, JetBrains) предлагают
автодополнение, проверку и описания полей. Приложение добавляет записи в файл,
только когда вы меняете настройку в **Настройках**; всё остальное остаётся
нетронутым. Файл — обычный JSON с разрешёнными комментариями — редактируйте его
любым редактором; изменения подхватываются на лету, пока приложение запущено.
При загрузке приложение проверяет файл по схеме; если он не разбирается или не
соответствует схеме, он заменяется пустым шаблоном (в лог записывается
предупреждение). ИИ-провайдер настраивается в разделе `ai` этого файла — см.
[ИИ и агенты](agents.md).

Полный справочник:

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

## Логи

Приложение дописывает диагностику в `doru.log` в каталоге данных (рядом с
`settings.json`). Файл ротируется при достижении 5 МБ — предыдущий файл
сохраняется как `doru.old.log`. Уровень подробности по умолчанию — `warn` (в
dev-сборках логи пишутся на уровне `debug`); переопределите его с помощью
`DORU_LOG_LEVEL=trace|debug|info|warn|error`. Предупреждения о проверке схемы
(файл настроек или темы, не соответствующий схеме) записываются сюда. Кнопка
**Открыть файл логов** в «Настройках» создаёт файл по запросу, если до этого
ничего не логировалось.
