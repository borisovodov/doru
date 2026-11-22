---
source-hash: e207f75e832a
---

# Datos y copias de seguridad

- Tus datos son un archivo normal — y siguen siendo tuyos. Dóru no tiene cuentas,
  ni backend en la nube, ni telemetría. Nada se sube a ninguna parte a menos que
  *tú* configures un proveedor de IA — e incluso entonces, solo el contenido que
  envías en el chat sale de tu máquina. Si quieres mantenerlo todo en tu
  ordenador, los proveedores locales (Ollama, LM Studio) funcionan totalmente sin
  conexión.
- Para hacer una copia de seguridad: copia el archivo `.doru` (y la carpeta
  `media/` junto a él, si tienes fotos). Eso es todo. Restaurar es volver a
  copiarlo.
- El archivo se lleva bien con el control de versiones: es un archivo binario
  estable — haz commit en git si quieres.

## Sincronizar entre máquinas

Dóru no tiene un motor de sincronización integrado — los proyectos son archivos
normales, y mantenerlos sincronizados es cosa tuya: iCloud Drive, Dropbox, rclone,
rsync, un lápiz USB, lo que prefieras.

Una advertencia: el archivo `.doru` es una base de datos SQLite, y sincronizar en
vivo un proyecto **abierto** con una herramienta de sincronización de archivos
puede copiar el archivo a medio escribir y corromperlo. La práctica segura es:
cierra el proyecto (o la app) antes de sincronizar. Copiar un proyecto cerrado
siempre es seguro.
