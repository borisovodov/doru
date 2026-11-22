---
source-hash: 472083c37a73
---

# Démarrage rapide

1. Lancez Dóru et cliquez sur **Créer un nouveau projet…** (ou **Ouvrir un projet
   ou importer un GEDCOM…**) sur la page de démarrage.
2. **Créer** demande un emplacement et un nom et crée un fichier `.doru` à cet
   endroit ; **Ouvrir un projet ou importer un GEDCOM** ouvre un fichier `.doru`
   existant, ou un fichier GEDCOM `.ged`/`.gdz` — un fichier GEDCOM démarre un
   nouveau projet pas encore enregistré avec l'arbre importé ; enregistrez-le
   ensuite au format `.doru`. Le fichier *est* le projet — son nom est le nom du
   projet :

   ```
   My Family.doru      l'arbre lui-même (SQLite, marqué par un identifiant d'application)
   media/              photos et scans, créé à la demande (facultatif)
   ```

3. Faites entrer les données : un nouvel arbre affiche une carte vide — cliquez
   dessus, saisissez le nom, confirmez avec la coche, et la première personne
   apparaît sur le canevas ; chaque carte peut ajouter des enfants, des conjoints
   et des parents de la même façon. Les fichiers GEDCOM entrent via **Ouvrir un
   projet ou importer un GEDCOM** (étape 2). Pour exporter, ouvrez l'onglet
   **Exporter**, choisissez **GEDCOM 7.0** (`.ged`) ou **GEDZIP** (`.gdz`, avec
   les fichiers multimédias gérés), et confirmez l'emplacement d'enregistrement.

Chaque projet s'ouvre dans sa **propre fenêtre** ; les personnes, l'éditeur
d'arbre et les paramètres s'ouvrent en onglets à l'intérieur. **Nouvelle
fenêtre** (`⌘⇧N`, `Ctrl+Shift+N` sous Linux et Windows) ouvre une autre page de
démarrage sans fermer le projet actuel, pour importer un fichier GEDCOM ou ouvrir
un second arbre à côté. Les projets récemment utilisés sont listés sur la page de
démarrage, et vos fenêtres de projets ouvertes sont restaurées au prochain
lancement. Un double-clic sur un fichier `*.doru` (ou l'ouverture d'un lien
`doru://open?path=/…/family.doru`) l'ouvre dans l'application en cours
d'exécution.

## Ouvrir des projets depuis des liens

L'application enregistre le schéma d'URL `doru://`, de sorte qu'un lien
`doru://open?path=…` ouvre le projet — ou importe le fichier, pour `.ged`/`.gdz` —
même lorsque l'application n'est pas encore lancée :

- Le chemin doit être **absolu et encodé pour l'URL** (`%20` pour les espaces,
  etc.), par exemple `doru://open?path=%2FUsers%2Fyou%2FFamily.doru`.
- Si l'application n'est pas lancée, le lien la démarre et ouvre le projet
  immédiatement.
- Si l'application est déjà lancée, le projet s'ouvre dans l'instance en cours —
  une seconde instance n'est jamais démarrée, la fenêtre existante reçoit le
  focus.
- Les liens ne fonctionnent que pour les types de fichiers que l'application
  ouvre directement : les projets `.doru` et les fichiers GEDCOM `.ged`/`.gdz`.

Sous macOS, `open "doru://open?path=…"` envoie le lien depuis le terminal ou
d'autres applications ; sous Linux, `xdg-open` fait de même.

## Étapes suivantes

- [Travailler avec l'arbre](tree.md) — personnes, familles, sources, notes.
- [Paramètres](settings.md) — la référence de `settings.json`.
- [IA et agents](agents.md) — laissez un agent lire et modifier votre arbre.
- [Thèmes](themes.md) — un thème avec palettes sombre et claire, choisi selon
  l'apparence du système.
