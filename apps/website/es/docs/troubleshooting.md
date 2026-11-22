---
source-hash: 77b60fd904c7
---

# Solución de problemas

- **Un proyecto `.doru` de una compilación anterior se niega a abrirse** — antes
  de 1.0 el esquema del proyecto cambia sin migraciones, así que los archivos
  escritos por otra compilación no se entienden. Abre el proyecto en la
  compilación que lo creó, exporta GEDCOM e importa ese archivo en esta
  compilación.
- **«El proveedor de IA no está configurado»** — abre Ajustes (icono de engranaje
  en la barra izquierda), elige un proveedor y sigue el asistente: obtén la lista
  de modelos (o elige un modelo) y guarda una clave cuando sea necesario.
- **Falla la conexión con Ollama** — selecciona el preajuste Ollama (URL base
  `http://localhost:11434/v1`); no se necesita clave API. Pulsa «Obtener modelos
  del proveedor» — si informa que el proveedor no está accesible, asegúrate de que
  Ollama se esté ejecutando en local.
