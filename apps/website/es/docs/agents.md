---
source-hash: b3dd07f80d43
---

# IA y agentes

## El chat de la app

El panel de chat está en la parte inferior de la ventana. Escribe una pregunta y
el agente podrá leer y editar el árbol con herramientas integradas: `tree_query`,
`tree_get`, `tree_stats`, `tree_edit`, `tree_add_relative`, `sources_add`,
`notes_write`.

Las conversaciones se guardan como **sesiones de chat**: el encabezado del panel
de chat enumera tus sesiones, y puedes cambiar entre ellas, iniciar un chat nuevo
o eliminarlas. Las sesiones se guardan por proyecto en el directorio de datos de la
app (no dentro del archivo `.doru`), el título proviene de tu primer mensaje y todo
sobrevive a los reinicios de la app. Cada respuesta tiene un botón de copiar que
pone su markdown sin formato en el portapapeles del sistema.

El proveedor se configura en la sección `ai` de `settings.json` (ver
[Ajustes](settings.md)):

- **Preajustes de proveedor**: Ollama, LM Studio, un punto de conexión
  personalizado compatible con OpenAI o un agente ACP. Los preajustes en la nube van volviendo
  uno a uno a medida que se reconstruyen sus integraciones. Define el id en
  `"provider"`; cada preajuste proporciona una URL base predeterminada, mientras
  que el modelo se elige en el asistente de ajustes — obtenido del proveedor para
  los puntos de conexión locales, seleccionado del catálogo incluido para los preajustes en
  la nube. Cada proveedor mantiene su propia configuración (modelo, URL base,
  razonamiento, clave) en `"providers"` — cambiar de proveedor restaura la
  configuración guardada de cada uno.
- **Las claves API** se guardan en `secrets.json` (modo 0600) en el directorio de
  datos de la app, indexadas por id de proveedor. La clave nunca aparece en el
  archivo de ajustes.

## Dóru AI (asistente sin conexión)

El proveedor predeterminado es **Dóru AI**: un asistente local que funciona
enteramente en tu ordenador. Descárgalo una vez en los ajustes de IA (un único
archivo, unos 3 GB); después, el chat funciona sin cuenta y sin conexión a
internet. Se selecciona por defecto en una instalación nueva y necesita al menos
8 GB de RAM.

El modelo descargado es Qwen3.5-4B (GGUF cuantizado Q4_K_M, licencia Apache-2.0 —
ver la [tarjeta del modelo](https://huggingface.co/Qwen/Qwen3.5-4B)). Los pesos
están fijados por SHA-256 en el manifiesto de la app y se verifican después de cada
descarga.

## Agentes ACP

Define `"ai": { "provider": "acp", "providers": { "acp": { "command": "…",
"args": [] } } }` para hablar con un agente que usa el Agent Client Protocol
(agentes estilo Zed). Dóru pasa el proyecto al agente como servidor MCP, así que el
agente puede consultar y editar el árbol igual que el chat integrado.

## Dóru como servidor MCP

Cualquier cliente MCP — Claude Desktop, Cursor, agentes de programación — puede
trabajar con tu árbol. Ejecuta Dóru en modo servidor, apuntando al archivo `.doru`:

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Ejemplo de configuración de Claude Desktop
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

Linux AppImage: la ruta al archivo AppImage. Windows:
`"command": "C:\\Program Files\\Doru\\doru.exe"`. Los nombres de las herramientas
permanecen en inglés independientemente del idioma de la interfaz.

El servidor es **sin interfaz y sin estado**: sin ventana, sin icono en el Dock,
sin sesiones de chat — lee y edita directamente el archivo del árbol y termina
cuando el cliente se desconecta. Cualquier número de clientes puede apuntar al
mismo archivo a la vez (Claude Desktop, Cursor, varios agentes de programación);
las escrituras concurrentes se ponen en cola de forma segura. Si un cliente no
puede iniciar el servidor, ejecuta el comando en una terminal — el asistente
registra los problemas en stderr y su perfil temporal se descarta al salir.

## Prompts de ejemplo

- *«Busca a todos los nacidos antes de 1850 y enumera sus fuentes.»*
- *«Añade a Ivan Ivanov, nacido hacia 1923, como hijo de Petr y Maria.»*
- *«Escribe una nota de investigación sobre Anna acerca del censo de 1901.»*
- *«Revisa mi árbol en busca de personas nacidas después de la muerte de sus
  padres.»*
