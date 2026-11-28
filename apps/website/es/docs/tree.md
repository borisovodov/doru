---
source-hash: ef244a894dd8
---

# Trabajar con el árbol

El árbol se abre como un lienzo interactivo. Todo lo siguiente ocurre en el propio
lienzo; la lista de personas está en la vista **Personas** de la barra de
actividad izquierda.

## Navegación

- **Desplazamiento** arrastrando el fondo, **zoom** con la rueda del ratón o el
  trackpad; los botones de zoom están en la esquina del lienzo.
- **Recentrar** en una persona haciendo doble clic en su tarjeta. Los botones Atrás/Adelante de la ventana vuelven a pestañas y posiciones anteriores del árbol.
- **Antepasados y descendientes** se muestran siempre juntos: padres y abuelos encima del
  foco, hijos debajo.
- **Buscar**: escribe un nombre en el cuadro de búsqueda de la barra de
  herramientas y elige un resultado para saltar a esa persona.

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
- **Notas**: notas de investigación de formato libre adjuntas a una persona. Cada nota pertenece a un solo registro: añádela, edítala o elimínala en la sección Notas de ese registro. Una nota compartida de un archivo GEDCOM importado se copia a cada registro que la referencia.

## Direcciones

La vista **Fuentes** tiene una sección **Direcciones**. Úsala para crear, editar y
eliminar direcciones independientes. Las direcciones usadas por hechos,
repositorios o remitentes muestran su número de usos; eliminar una la desvincula
de esos registros. El selector de dirección de un hecho también tiene las acciones
**Nueva dirección** y **Editar dirección** para editar una dirección en el sitio.

## Tareas

Las tareas tienen una fecha de creación y una fecha de recordatorio. Cerrar una tarea solo cambia su estado; no se guarda una fecha de finalización aparte. La mayoría de los editores tiene una sección **Tareas**: añade allí una tarea y se vincula automáticamente a ese registro. Las excepciones son el editor de tareas y el editor de remitentes: la tarjeta de una tarea conserva Notas y Multimedia, la de un remitente no tiene sección Tareas, y un vínculo multimedia no es destino de tareas. Los hechos, nombres y citas llevan su propia sección Tareas en su panel de elementos adjuntos. **Relacionado con** vincula una tarea con uno o varios registros del árbol — una persona, familia, evento, nombre, fuente, cita, multimedia, lugar, repositorio, dirección u obra, pero no con otra tarea, un remitente o un vínculo multimedia; déjalo vacío para una tarea independiente. Una tarea es compartida: editarla en cualquier lugar actualiza el mismo registro y eliminar un registro relacionado deja la tarea en su sitio. Usa **Adjuntar una tarea existente** para reutilizar una tarea compartida en lugar de crear una nueva.

Las obras, direcciones, asociaciones y enlaces de pareja/hijo de una familia tienen las mismas secciones Notas, Fuentes y Tareas que las pestañas de la entidad principal. Los contactos pertenecen a la persona, el hecho, el repositorio o el remitente que describen, no a una dirección. Las tareas conservan Notas y Multimedia, pero no tienen Fuentes, Contactos, Contribuyentes ni Tareas. Un vínculo multimedia no es un destino de adjuntos. Los contribuyentes solo están disponibles en las tarjetas de persona y familia.

## Multimedia

Las fotos son archivos normales en la carpeta `media/` junto al proyecto. Añádelas desde una persona, familia, fuente, lugar, repositorio, remitente, obra, tarea o dirección; la sección **Relacionado con** de la pestaña multimedia gestiona los registros a los que está vinculado este multimedia. Cada tarjeta multimedia contiene exactamente un archivo. Haz clic en una vista previa para abrir la pestaña multimedia, donde puedes editar el título y la fecha. Usa la estrella en la sección Multimedia de un destino para elegir su foto principal.

Un registro multimedia puede estar vinculado a varios destinos o a ninguno. **Desvincular de este registro** elimina un vínculo y está disponible para cada vínculo, incluido el último; el multimedia permanece en la biblioteca. **Eliminar multimedia** elimina el registro y la copia de su archivo. Eliminar un registro de destino solo elimina sus vínculos, por lo que un registro multimedia puede quedar sin vínculos. Un multimedia importado desde un `OBJE` GEDCOM con varios archivos se convierte en una tarjeta por archivo; los formatos alternativos `TRAN` no se importan.

## Orden

Las listas cuyo orden importa — nombres, parejas e hijos de una familia, nombres de
lugares, líneas de dirección, participantes de un hecho y campos de plantilla —
tienen controles arriba/abajo. El orden se guarda como la posición de la fila.
