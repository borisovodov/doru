---
source-hash: e207f75e832a
---

# Données et sauvegardes

- Vos données sont un simple fichier — et elles restent les vôtres. Dóru n'a ni
  comptes, ni backend cloud, ni télémétrie. Rien n'est téléversé nulle part sauf
  si *vous* configurez un fournisseur d'IA — et même alors, seul le contenu que
  vous envoyez dans le chat quitte votre machine. Si vous voulez tout garder sur
  votre ordinateur, les fournisseurs locaux (Ollama, LM Studio) fonctionnent
  entièrement hors ligne.
- Pour sauvegarder : copiez le fichier `.doru` (et le dossier `media/` à côté, si
  vous avez des photos). C'est tout. Restaurer, c'est le recopier.
- Le fichier se prête bien au contrôle de version : c'est un fichier binaire
  stable — versionnez-le dans git si vous le souhaitez.

## Synchroniser entre machines

Dóru n'a pas de moteur de synchronisation intégré — les projets sont de simples
fichiers, et les garder synchronisés est votre affaire : iCloud Drive, Dropbox,
rclone, rsync, une clé USB, ce que vous préférez.

Une mise en garde : le fichier `.doru` est une base de données SQLite, et
synchroniser en direct un projet **ouvert** avec un outil de synchronisation de
fichiers peut copier le fichier dans un état à moitié écrit et le corrompre. La
pratique sûre consiste à fermer le projet (ou l'application) avant de
synchroniser. Copier un projet fermé est toujours sûr.
