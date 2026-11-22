---
source-hash: 77b60fd904c7
---

# Dépannage

- **Un projet `.doru` d'un build plus ancien refuse de s'ouvrir** — avant 1.0,
  le schéma du projet change sans migrations, donc les fichiers écrits par un
  autre build ne sont pas compris. Ouvrez le projet dans le build qui l'a créé,
  exportez GEDCOM et importez ce fichier dans ce build.
- **« Le fournisseur d'IA n'est pas configuré »** — ouvrez les paramètres (icône
  d'engrenage dans la barre de gauche), choisissez un fournisseur et suivez
  l'assistant : récupérez la liste des modèles (ou choisissez un modèle) et
  enregistrez une clé si nécessaire.
- **La connexion à Ollama échoue** — sélectionnez le préréglage Ollama (URL de base
  `http://localhost:11434/v1`) ; aucune clé API n'est nécessaire. Appuyez sur
  « Récupérer les modèles depuis le fournisseur » — si le fournisseur est signalé
  comme inaccessible, vérifiez qu'Ollama tourne localement.
