---
source-hash: 85c6a6b9acc6
---

# Temas

La interfaz se define por completo mediante propiedades personalizadas de CSS,
aplicadas a nivel de la app — nunca por proyecto.

- **Tema integrado** — `doru`, un único archivo de paleta JSON en el directorio
  `themes/` de la app: un archivo por tema, sin CSS. El archivo contiene tanto la
  paleta `dark` como la `light`; la apariencia del sistema operativo decide cuál
  se aplica — cambia tu sistema al modo claro y Dóru se adapta al instante. El
  nombre del archivo es el id del tema (`doru.json`); el campo `name` dentro es el
  nombre visible.
- Elige el tema en `settings.json` (ver [Ajustes](settings.md)) con una sola
  cadena, o desde la página **Ajustes** de la app (lista desplegable Tema); la
  elección se guarda en `settings.json` en cualquier caso.
- Los `colors` de la paleta activa se resuelven en propiedades personalizadas de
  CSS `--doru-*` al iniciar.

## Temas personalizados

Coloca un archivo `<id>.json` con paletas `dark` y `light` en el directorio
`themes` dentro del directorio de datos de la app (el mismo lugar donde vive
`settings.json` — ver [Ajustes](settings.md)), y luego elígelo con
`"theme": "<id>"` en `settings.json`. Reinicia la app después de añadir un archivo
para que se recoja. El directorio se crea en el primer inicio; un tema de usuario
cuyo id coincida con uno incluido lo anula. Un archivo de tema malformado o que no
coincida con el esquema se omite (se registra una advertencia), igual que uno
ausente, y no aparece en la lista de temas. Los temas incluidos llevan una
referencia `$schema` (`https://doru.family/theme.json`) — añade la misma línea a
tu propio archivo para obtener autocompletado y validación en los editores que
entienden JSON Schema.

Temas incluidos, cada uno con paleta oscura y clara:

| Id del tema | Nombre visible |
|---|---|
| `doru` (predeterminado) | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

La paleta Dóru predeterminada sigue al icono de la app: un verde bosque profundo
con tonos de papel cálidos. La paleta oscura apila superficies desde un lienzo casi
negro con tinte verde hasta un chrome más claro y elementos emergentes; la paleta
clara usa papel cálido y crema.

Variables disponibles:

| Variable | Significado |
|---|---|
| `--doru-bg-canvas` | fondo del editor y franja de pestañas |
| `--doru-bg-chrome` | barra de actividad, barras laterales, superficie de paneles flotantes |
| `--doru-bg-raised` | tarjetas, chips, la entrada del chat |
| `--doru-bg-popover` | menús y selectores |
| `--doru-bg-input` | botones, campos de entrada, selectores |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | texto principal, atenuado y tenue |
| `--doru-border` / `--doru-border-strong` | líneas finas y bordes más marcados |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | acento (verde bosque/salvia) |
| `--doru-on-accent` | texto sobre el fondo de acento |
| `--doru-accent-alpha` | acento translúcido (chips, burbujas del chat) |
| `--doru-focus` | color del anillo de foco |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | superposiciones al pasar el ratón/pulsar |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | colores de estado |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | radios de 4 / 6 / 8 px |
| `--doru-control-height` | altura del control (28px) |
| `--doru-panel-gutter` | separación entre los paneles flotantes y el borde de la ventana (4px) |
| `--doru-panel-radius` | radio de las esquinas de los paneles flotantes (8px) |
