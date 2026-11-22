---
source-hash: 85c6a6b9acc6
---

# Thèmes

L'interface est entièrement mise en forme via des propriétés personnalisées CSS,
appliquées au niveau de l'application — jamais par projet.

- **Thème intégré** — `doru`, un seul fichier de palette JSON dans le répertoire
  `themes/` de l'application : un fichier par thème, pas de CSS. Le fichier
  contient à la fois la palette `dark` et la palette `light` ; l'apparence du
  système d'exploitation décide laquelle s'applique — passez votre système en mode
  clair et Dóru suit instantanément. Le nom du fichier est l'id du thème
  (`doru.json`) ; le champ `name` à l'intérieur est le nom affiché.
- Choisissez le thème dans `settings.json` (voir [Paramètres](settings.md)) avec
  une seule chaîne, ou depuis la page **Paramètres** de l'application (liste
  déroulante Thème) ; le choix est stocké dans `settings.json` dans les deux cas.
- Les `colors` de la palette active sont résolues en propriétés personnalisées CSS
  `--doru-*` au démarrage.

## Thèmes personnalisés

Déposez un fichier `<id>.json` avec des palettes `dark` et `light` dans le
répertoire `themes` du répertoire de données de l'application (là où se trouve
`settings.json` — voir [Paramètres](settings.md)), puis choisissez-le avec
`"theme": "<id>"` dans `settings.json`. Redémarrez l'application après avoir
ajouté un fichier pour qu'il soit pris en compte. Le répertoire est créé au
premier lancement ; un thème personnel dont l'id correspond à un thème intégré le
remplace. Un fichier de thème malformé ou ne correspondant pas au schéma est ignoré
(un avertissement est journalisé), comme un fichier absent, et n'apparaît pas dans
la liste des thèmes. Les thèmes intégrés portent une référence `$schema`
(`https://doru.family/theme.json`) — ajoutez la même ligne à votre propre fichier
pour obtenir l'autocomplétion et la validation dans les éditeurs qui comprennent
JSON Schema.

Thèmes intégrés, chacun avec une palette sombre et une palette claire :

| Id du thème | Nom affiché |
|---|---|
| `doru` (par défaut) | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

La palette Dóru par défaut suit l'icône de l'application : un vert forêt profond
avec des tons papier chaleureux. La palette sombre superpose les surfaces d'un
canevas presque noir teinté de vert vers un chrome plus clair et des popovers ; la
palette claire utilise un papier chaleureux et de la crème.

Variables disponibles :

| Variable | Signification |
|---|---|
| `--doru-bg-canvas` | arrière-plan de l'éditeur et bande d'onglets |
| `--doru-bg-chrome` | barre d'activité, barres latérales, surface des panneaux flottants |
| `--doru-bg-raised` | cartes, puces, la saisie du chat |
| `--doru-bg-popover` | menus et sélecteurs |
| `--doru-bg-input` | boutons, champs de saisie, listes déroulantes |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | texte principal, atténué et discret |
| `--doru-border` / `--doru-border-strong` | filets et bordures plus marquées |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | accent (vert forêt/sauge) |
| `--doru-on-accent` | texte sur le fond d'accent |
| `--doru-accent-alpha` | accent translucide (puces, bulles de chat) |
| `--doru-focus` | couleur de l'anneau de focus |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | superpositions de survol/appui |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | couleurs d'état |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | rayons 4 / 6 / 8 px |
| `--doru-control-height` | hauteur des contrôles (28px) |
| `--doru-panel-gutter` | espace entre les panneaux flottants et le bord de la fenêtre (4px) |
| `--doru-panel-radius` | rayon des coins des panneaux flottants (8px) |
