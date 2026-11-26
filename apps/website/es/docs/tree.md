---
source-hash: b425b67199c0
---

# Trabajar con el árbol

El árbol se abre como un lienzo interactivo. Todo lo siguiente ocurre en el propio
lienzo; la lista de personas está en la vista **Personas** de la barra de
actividad izquierda.

## Navegación

- **Desplazamiento** arrastrando el fondo, **zoom** con la rueda del ratón o el
  trackpad; los botones de zoom están en la esquina del lienzo.
- **Recentrar** en una persona haciendo doble clic en su tarjeta. La barra de
  herramientas guarda un historial: flechas atrás/adelante y una ruta de
  navegación.
- **Gráficos**: cambia entre las vistas *Antepasados*, *Descendientes*, *Reloj de
  arena* y *Familia* en la barra de herramientas. La vista Familia muestra la
  pareja central, sus hijos y los padres de ambos lados.
- **Buscar**: escribe un nombre en el cuadro de búsqueda de la barra de
  herramientas y elige un resultado para saltar a esa persona.
- **Contraer** una rama con el chevron de una tarjeta (o contraer/expandir todas
  las ramas desde la barra de herramientas).

## Tarjetas

Cada tarjeta muestra un avatar con las iniciales, el nombre, los años de vida (con
† para las personas fallecidas) e insignias pequeñas que muestran el número de
notas, fuentes y elementos multimedia. El borde izquierdo marca la línea paterna (azul) y materna
(rosa) en los gráficos de antepasados; el marco de acento marca a la persona
central.

## Edición

Selecciona una tarjeta para mostrar la barra de acciones:

- **Añadir hijo / cónyuge / progenitor** — aparece una nueva tarjeta vacía junto a
  la persona; escribe el nombre directamente en la tarjeta y confírmalo con la
  marca de verificación (la cruz la descarta).
- **Editar** — abre el editor completo de la persona como pestaña: nombres, sexo,
  fechas de nacimiento/fallecimiento con un marcador de calidad (*Exacta /
  Aproximada / Antes / Después*) y un campo de texto libre (por ejemplo, una
  fecha de calendario «23 Nivôse» que no se corresponde con el gregoriano),
  familias, eventos, fuentes, notas y multimedia.
- **Eliminar** — quita a la persona del árbol y de todas las familias.
- **Cambiar de progenitores**: arrastra una tarjeta sobre la tarjeta de otra
  persona para mover a la persona arrastrada como hijo a esa familia (el destino
  válido se ilumina durante el arrastre).

Un árbol nuevo (vacío) muestra una tarjeta vacía: haz clic en ella, escribe el
nombre, confirma con la marca de verificación y la primera persona aparece en el
lienzo. Después, haz crecer el árbol desde las propias tarjetas.

## Familias

Dentro del editor completo de la persona, añade progenitores, una pareja o hijos.
Escribe un nombre para elegir a una persona existente; los chips muestran los
miembros de cada familia. Quitar a una persona de una familia o eliminar una
familia es un clic.

## Fuentes y notas

- **Fuentes**: adjunta fuentes a una persona (con un título y un autor) o
  reutiliza una fuente existente. Cada vínculo es una cita y se puede eliminar.
- **Notas**: notas de investigación de formato libre adjuntas a una persona. Una
  nota puede estar adjunta a varios registros: usa **Adjuntar nota existente** en
  la sección Notas de otro registro y luego elige si una edición debe actualizar
  el texto compartido en todas partes o solo en el registro actual. **Desvincular
  de este registro** elimina un enlace; **Eliminar en todas partes** elimina la
  nota.
- Los hechos y los nombres llevan sus propias secciones de Fuentes y Notas dentro del editor de la persona; los hechos también tienen Contactos.

## Direcciones

La vista **Fuentes** tiene una sección **Direcciones**. Úsala para crear, editar y
eliminar direcciones independientes. Las direcciones usadas por hechos,
repositorios o remitentes muestran su número de usos; eliminar una la desvincula
de esos registros. El selector de dirección de un hecho también tiene las acciones
**Nueva dirección** y **Editar dirección** para editar una dirección en el sitio.

## Tareas

Las tareas tienen una fecha de creación y una fecha de recordatorio. Cerrar una tarea solo cambia su estado; no se guarda una fecha de finalización aparte. La mayoría de los editores tiene una sección **Tareas**: añade allí una tarea y se vincula automáticamente a ese registro. Las excepciones son el editor de tareas y el editor de remitentes, y una fila de vínculo multimedia solo tiene la sección Fuentes: la tarjeta de una tarea conserva Notas y Multimedia, la de un remitente no tiene sección Tareas, y un vínculo multimedia no es destino de tareas. Los hechos, nombres y citas llevan su propia sección Tareas en su panel de elementos adjuntos. **Relacionado con** vincula una tarea con uno o varios registros del árbol — una persona, familia, evento, nombre, fuente, cita, multimedia, lugar, repositorio, dirección u obra, pero no con otra tarea, un remitente o un vínculo multimedia; déjalo vacío para una tarea independiente. Una tarea es compartida: editarla en cualquier lugar actualiza el mismo registro y eliminar un registro relacionado deja la tarea en su sitio. Usa **Adjuntar una tarea existente** para reutilizar una tarea compartida en lugar de crear una nueva.

Las obras, direcciones, asociaciones y enlaces de pareja/hijo de una familia tienen las mismas secciones Notas, Fuentes, Contribuyentes y Tareas que las pestañas de la entidad principal. Las direcciones también tienen Contactos. Las tareas conservan Notas y Multimedia, pero no tienen Fuentes, Contactos, Contribuyentes ni Tareas. Un vínculo multimedia solo tiene Fuentes.

## Multimedia

Las fotos son archivos normales en la carpeta `media/` junto al proyecto. Añádelas
desde una persona, familia, fuente, lugar, repositorio, remitente, obra, tarea o
dirección; en la sección **Relacionado con** de la pestaña multimedia puedes adjuntar
un registro existente a destinos adicionales. Haz clic en una vista previa para abrir la pestaña multimedia, donde
puedes editar el título, gestionar archivos y editar metadatos del enlace como la
leyenda, la secuencia, la marca de principal y la marca de exclusión.

Un registro multimedia puede estar vinculado a varios destinos. **Desvincular de este registro** elimina un enlace y borra el registro cuando era el último; **Eliminar multimedia** elimina el registro y sus copias de archivos. Eliminar un registro de destino elimina solo sus enlaces, así que un registro multimedia compartido puede quedar sin enlaces.

## Orden

Las listas cuyo orden importa — nombres, parejas e hijos de una familia, nombres de
lugares, líneas de dirección, participantes de un hecho y campos de plantilla —
tienen controles arriba/abajo. El orden se guarda como la posición de la fila.
