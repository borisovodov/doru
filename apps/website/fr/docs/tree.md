---
source-hash: bd745f4dc593
---

# Travailler avec l'arbre

L'arbre s'ouvre comme un canevas interactif. Tout ce qui suit se passe sur le
canevas lui-même ; la liste des personnes se trouve dans la vue **Personnes** de
la barre d'activité de gauche.

## Navigation

- **Panoramique** en faisant glisser l'arrière-plan, **zoom** avec la molette ou
  le trackpad ; les boutons de zoom se trouvent dans le coin du canevas.
- **Recentrer** sur une personne en double-cliquant sur sa carte. La barre
  d'outils tient un historique : flèches retour/avant et fil d'Ariane.
- **Graphiques** : basculez entre les vues *Ancêtres*, *Descendants*, *Sablier* et
  *Famille* dans la barre d'outils. La vue Famille montre le couple au centre, ses
  enfants et les parents des deux côtés.
- **Recherche** : saisissez un nom dans le champ de recherche de la barre d'outils
  et choisissez un résultat pour sauter à cette personne.
- **Replier** une branche avec le chevron d'une carte (ou replier/déplier toutes
  les branches depuis la barre d'outils).

## Cartes

Chaque carte affiche un avatar avec les initiales, le nom, les années de vie (avec
† pour les personnes décédées) et de petits badges affichant le nombre de notes,
de sources et de médias. Le bord gauche marque la ligne paternelle (bleue) et maternelle
(rose) dans les graphiques d'ancêtres ; le cadre d'accent marque la personne au
centre.

## Édition

Sélectionnez une carte pour révéler la barre d'actions :

- **Ajouter un enfant / conjoint / parent** — une nouvelle carte vide apparaît à
  côté de la personne ; saisissez le nom directement dans la carte et confirmez-le
  avec la coche (la croix l'annule).
- **Modifier** — ouvre l'éditeur complet de la personne en onglet : noms, sexe,
  dates de naissance/décès avec un marqueur de qualité (*Exacte / Environ / Avant
  / Après*) et un champ de texte libre (par exemple une date calendaire « 23 Nivôse » qui
  ne correspond pas au calendrier grégorien), familles, événements, sources,
  notes et médias.
- **Supprimer** — retire la personne de l'arbre et de toutes les familles.
- **Changer de parents** : faites glisser une carte sur la carte d'une autre
  personne pour déplacer la personne glissée comme enfant dans cette famille (la
  cible valide s'illumine pendant le glissement).

Un nouvel arbre (vide) affiche une carte vide : cliquez dessus, saisissez le nom,
confirmez avec la coche, et la première personne apparaît sur le canevas. Ensuite,
faites grandir l'arbre à partir des cartes elles-mêmes.

## Familles

Dans l'éditeur complet de la personne, ajoutez des parents, un partenaire ou des
enfants. Saisissez un nom pour choisir une personne existante ; des puces montrent
les membres de chaque famille. Retirer une personne d'une famille ou supprimer une
famille se fait en un clic.

## Sources et notes

- **Sources** : attachez des sources à une personne (avec un titre et un auteur) ou
  réutilisez une source existante. Chaque attachement est une citation et peut
  être supprimé.
- **Notes** : notes de recherche libres attachées à une personne. Chaque note appartient à un seul enregistrement : ajoutez-la, modifiez-la ou supprimez-la dans la section Notes de cet enregistrement. Une note partagée d'un fichier GEDCOM importé est copiée pour chaque enregistrement qui la référence.

## Adresses

La vue **Sources** comporte une section **Adresses**. Utilisez-la pour créer,
modifier et supprimer des adresses autonomes. Les adresses utilisées par des
faits, des dépôts ou des soumetteurs affichent leur nombre d'utilisations ; en
supprimer une la détache de ces enregistrements. Le sélecteur d'adresse d'un fait
propose aussi les actions **Nouvelle adresse** et **Modifier l'adresse** pour
modifier une adresse sur place.

## Tâches

Les tâches ont une date de création et une date de rappel. Fermer une tâche ne change que son statut ; aucune date d'achèvement distincte n'est enregistrée. La plupart des éditeurs ont une section **Tâches** : ajoutez-y une tâche et elle est automatiquement liée à cet enregistrement. Les éditeurs de tâche et de soumetteur font exception, et une ligne de lien multimédia n'a que la section Sources : la fiche d'une tâche conserve Notes et Médias, celle d'un soumetteur n'a pas de section Tâches, et un lien multimédia n'est pas une cible de tâches. Les faits, noms et citations portent leur propre section Tâches dans leur panneau de pièces jointes. **Lié à** relie une tâche à un ou plusieurs enregistrements de l'arbre — une personne, une famille, un événement, un nom, une source, une citation, un média, un lieu, un dépôt, une adresse ou une œuvre, mais pas une autre tâche, un soumetteur ou un lien multimédia ; laissez-le vide pour une tâche indépendante. Une tâche est partagée : la modifier n'importe où met à jour le même enregistrement, et supprimer un enregistrement lié laisse la tâche en place. Utilisez **Joindre une tâche existante** pour réutiliser une tâche partagée au lieu d'en créer une nouvelle.

Les œuvres, adresses, associations et liens partenaire/enfant d'une famille ont les mêmes sections Notes, Sources, Contributeurs et Tâches que les onglets de l'entité principale. Les contacts appartiennent à la personne, au fait, au dépôt ou au déclarant qu'ils décrivent, pas à une adresse. Les tâches conservent Notes et Médias, mais n'ont ni Sources, ni Contacts, ni Contributeurs, ni Tâches. Un lien multimédia n'a que Sources.

## Médias

Les photos sont des fichiers ordinaires dans le dossier `media/` à côté du projet.
Ajoutez-les depuis une personne, une famille, une source, un lieu, un dépôt, un
soumetteur, une œuvre, une tâche ou une adresse ; la section **Lié à** de l'onglet média permet d'attacher un enregistrement existant à d'autres cibles. Cliquez sur un aperçu
pour ouvrir l'onglet média, où vous pouvez modifier le titre, gérer les fichiers
et modifier les métadonnées de lien comme la légende, la séquence, l'indicateur
principal et l'indicateur d'exclusion.

Un enregistrement média peut être lié à plusieurs cibles. **Détacher de cet enregistrement** n'apparaît que lorsque le média est lié à plusieurs cibles ; il retire un lien. **Supprimer le média** supprime l'enregistrement et les copies de ses fichiers. Supprimer un enregistrement cible ne retire que ses liens, donc un enregistrement média peut rester sans liens.

## Ordre

Les listes dont l'ordre importe — noms, partenaires et enfants d'une famille, noms
de lieux, lignes d'adresse, participants d'un fait et champs de modèle — ont des
contrôles haut/bas. L'ordre est stocké comme position de ligne.
