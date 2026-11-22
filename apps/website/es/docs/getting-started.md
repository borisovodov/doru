---
source-hash: 472083c37a73
---

# Inicio rápido

1. Inicia Dóru y haz clic en **Crear nuevo proyecto…** (o **Abrir proyecto o
   importar GEDCOM…**) en la página de inicio.
2. **Crear** pide una ubicación y un nombre y crea allí un archivo `.doru`;
   **Abrir proyecto o importar GEDCOM** abre un archivo `.doru` existente, o un
   archivo GEDCOM `.ged`/`.gdz` — un archivo GEDCOM inicia un proyecto nuevo aún
   no guardado con el árbol importado; guárdalo como `.doru` después. El archivo
   *es* el proyecto: su nombre es el nombre del proyecto:

   ```
   My Family.doru      el árbol en sí (SQLite, marcado con un id de aplicación)
   media/              fotos y escaneos, creada cuando hace falta (opcional)
   ```

3. Introduce datos: un árbol nuevo muestra una tarjeta vacía — haz clic en ella,
   escribe el nombre, confirma con la marca de verificación y la primera persona
   aparece en el lienzo; cada tarjeta puede añadir hijos, cónyuges y padres de la
   misma forma. Los archivos GEDCOM entran mediante **Abrir proyecto o importar
   GEDCOM** (paso 2). Para exportar, abre la pestaña **Exportar**, elige **GEDCOM
   7.0** (`.ged`) o **GEDZIP** (`.gdz`, con los archivos multimedia gestionados) y
   confirma la ubicación de guardado.

Cada proyecto se abre en su **propia ventana**; las personas, el editor del árbol
y los ajustes se abren como pestañas dentro de ella. **Nueva ventana** (`⌘⇧N`,
`Ctrl+Shift+N` en Linux y Windows) abre otra página de inicio sin cerrar el
proyecto actual, para que puedas importar un archivo GEDCOM o abrir un segundo
árbol junto a él. Los proyectos usados recientemente se listan en la página de
inicio, y las ventanas de proyectos abiertas se restauran en el siguiente inicio.
Al hacer doble clic en un archivo `*.doru` (o abrir un enlace
`doru://open?path=/…/family.doru`) se abre en la app en ejecución.

## Abrir proyectos desde enlaces

La app registra el esquema de URL `doru://`, así que un enlace
`doru://open?path=…` abre el proyecto — o importa el archivo, en el caso de
`.ged`/`.gdz` — incluso cuando la app aún no está en ejecución:

- La ruta debe ser **absoluta y estar codificada para URL** (`%20` para espacios,
  etc.), por ejemplo `doru://open?path=%2FUsers%2Fyou%2FFamily.doru`.
- Si la app no está en ejecución, el enlace la inicia y abre el proyecto de
  inmediato.
- Si la app ya está en ejecución, el proyecto se abre en la instancia activa —
  nunca se inicia una segunda instancia, la ventana existente recibe el foco.
- Los enlaces solo funcionan con los tipos de archivo que la app abre
  directamente: proyectos `.doru` y archivos GEDCOM `.ged`/`.gdz`.

En macOS, `open "doru://open?path=…"` envía el enlace desde la terminal o desde
otras apps; en Linux, `xdg-open` hace lo mismo.

## Siguientes pasos

- [Trabajar con el árbol](tree.md) — personas, familias, fuentes y notas.
- [Ajustes](settings.md) — la referencia de `settings.json`.
- [IA y agentes](agents.md) — deja que un agente lea y edite tu árbol.
- [Temas](themes.md) — un tema con paletas oscura y clara, elegido según la
  apariencia del sistema.
