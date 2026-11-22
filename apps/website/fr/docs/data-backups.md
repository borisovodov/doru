---
source-hash: a4089605567c
---

# Données et sauvegardes

- Vos données sont un simple fichier — et elles restent les vôtres. Dóru n'a ni
  comptes, ni backend cloud, ni télémétrie. Rien n'est téléversé nulle part sauf
  si *vous* configurez un fournisseur d'IA distant — et même alors, les messages
  du chat et les données de l'arbre que l'assistant récupère via ses outils sont
  envoyés à ce fournisseur. Si vous voulez tout garder sur votre ordinateur, les
  fournisseurs locaux (Ollama, LM Studio) fonctionnent entièrement hors ligne.
- Pour sauvegarder : arrêtez tout processus susceptible d'écrire dans le projet
  — fermez-le dans Dóru et arrêtez les clients MCP ou autres outils — puis
  copiez le fichier `.doru` (et le dossier `media/` à côté, si vous avez des
  photos). C'est tout. Restaurer, c'est le recopier.
- Les sessions de chat sont stockées dans le répertoire de données de
  l'application, pas dans le fichier `.doru` ; sauvegardez-les séparément si
  vous en avez besoin.
- Le fichier se prête bien au contrôle de version : c'est un fichier binaire
  stable — versionnez-le dans git si vous le souhaitez.

## Synchroniser entre machines

Dóru n'a pas de moteur de synchronisation intégré — les projets sont de simples
fichiers, et les garder synchronisés est votre affaire : iCloud Drive, Dropbox,
rclone, rsync, une clé USB, ce que vous préférez.

Une mise en garde : le fichier `.doru` est une base de données SQLite, et
synchroniser en direct un projet **ouvert** avec un outil de synchronisation de
fichiers peut copier le fichier dans un état à moitié écrit et le corrompre. La
pratique sûre consiste à fermer le projet (ou l'application) et à arrêter tout
autre processus écrivant avant de synchroniser. Copier un projet fermé dans
lequel personne d'autre n'écrit est toujours sûr.
