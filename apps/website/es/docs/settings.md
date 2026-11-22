---
source-hash: cb76eaf45583
---

# Ajustes

Los ajustes globales se encuentran en `settings.json` en el directorio de datos de la app:

| Sistema operativo | Ruta |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**Los valores predeterminados están integrados en la app; el archivo solo registra
las anulaciones explícitas.** En el primer inicio, la app crea el archivo solo con la
referencia `$schema` — todo lo demás recurre a los valores predeterminados
integrados, así que los nuevos valores predeterminados llegan a los usuarios
existentes con las actualizaciones de la app. La referencia `$schema` es la única
fuente de documentación: los editores compatibles con JSON Schema (VS Code, Zed,
JetBrains) ofrecen autocompletado, validación y descripciones de campos. La app
escribe entradas en el archivo solo cuando cambias un ajuste en **Ajustes**; todo
lo demás queda intacto. El archivo es JSON simple con comentarios permitidos —
edítalo con cualquier editor; los cambios se recogen en vivo mientras la app está
en ejecución. La app valida el archivo contra el esquema al cargarlo; si no se
analiza o no coincide con el esquema, se reemplaza por la plantilla vacía (se
registra una advertencia). El proveedor de IA se configura en la sección `ai` de
este archivo — ver [IA y agentes](agents.md).

Referencia completa:

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // Proveedores de IA — se definen en Ajustes (icono de engranaje) o aquí directamente.
  "ai": {
    // El proveedor activo: ollama | lmstudio | custom | acp
    // (los preajustes en la nube van volviendo uno a uno).
    "provider": "ollama",

    // Ajustes por proveedor, indexados por id de proveedor. Solo se usa la
    // entrada del proveedor activo; las demás conservan sus valores y se
    // restauran al volver a ellas.
    "providers": {
      "ollama": {
        "baseUrl": "", // anulación opcional del punto de conexión predeterminado del proveedor
        "model": ""
      }
      // Solo para "acp": el binario del agente que se va a iniciar.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Tema: un archivo de paleta con una sección oscura y una clara. La
  // apariencia del sistema decide qué paleta se aplica.
  "theme": "doru"
}
```

## Registros

La app añade diagnósticos a `doru.log` en el directorio de datos (junto a
`settings.json`). El archivo rota a los 5 MB — el archivo anterior se conserva como
`doru.old.log`. La verbosidad predeterminada es `warn` (las compilaciones de
desarrollo registran en `debug`); define
`DORU_LOG_LEVEL=trace|debug|info|warn|error` para anularla. Las advertencias de
validación del esquema (un archivo de ajustes o de tema que no coincide con su
esquema) se registran aquí. El botón **Abrir archivo de registro** en Ajustes crea
el archivo cuando hace falta si aún no se ha registrado nada.
