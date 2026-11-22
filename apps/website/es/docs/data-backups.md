---
source-hash: a4089605567c
---

# Datos y copias de seguridad

- Tus datos son un archivo normal — y siguen siendo tuyos. Dóru no tiene
  cuentas, ni backend en la nube, ni telemetría. Nada se sube a ninguna parte a
  menos que *tú* configures un proveedor de IA remoto — e incluso entonces, los
  mensajes del chat y los datos del árbol que el asistente obtiene mediante sus
  herramientas se envían a ese proveedor. Si quieres mantenerlo todo en tu
  ordenador, los proveedores locales (Ollama, LM Studio) funcionan totalmente
  sin conexión.
- Para hacer una copia de seguridad: detén todos los procesos que puedan
  escribir en el proyecto — ciérralo en Dóru y detén los clientes MCP u otras
  herramientas — y luego copia el archivo `.doru` (y la carpeta `media/` junto a
  él, si tienes fotos). Eso es todo. Restaurar es volver a copiarlo.
- Las sesiones de chat se guardan en el directorio de datos de la aplicación, no
  dentro del archivo `.doru`; haz una copia de seguridad aparte si las
  necesitas.
- El archivo se lleva bien con el control de versiones: es un archivo binario
  estable — haz commit en git si quieres.

## Sincronizar entre máquinas

Dóru no tiene un motor de sincronización integrado — los proyectos son archivos
normales, y mantenerlos sincronizados es cosa tuya: iCloud Drive, Dropbox, rclone,
rsync, un lápiz USB, lo que prefieras.

Una advertencia: el archivo `.doru` es una base de datos SQLite, y sincronizar
en vivo un proyecto **abierto** con una herramienta de sincronización de
archivos puede copiar el archivo a medio escribir y corromperlo. La práctica
segura es: cierra el proyecto (o la app) y detén cualquier otro proceso que
escriba antes de sincronizar. Copiar un proyecto cerrado en el que nadie más
escribe siempre es seguro.
