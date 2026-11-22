---
source-hash: b3dd07f80d43
---

# IA et agents

## Le chat intégré

Le panneau de chat se trouve en bas de la fenêtre. Saisissez une question et
l'agent peut lire et modifier l'arbre à l'aide d'outils intégrés : `tree_query`,
`tree_get`, `tree_stats`, `tree_edit`, `tree_add_relative`, `sources_add`,
`notes_write`.

Les conversations sont enregistrées sous forme de **sessions de discussion** :
l'en-tête du panneau de chat liste vos sessions, et vous pouvez passer de l'une à
l'autre, démarrer une nouvelle discussion ou les supprimer. Les sessions sont
stockées par projet dans le répertoire de données de l'application (pas dans le
fichier `.doru`), le titre provient de votre premier message, et tout survit aux
redémarrages de l'application. Chaque réponse a un bouton de copie qui place son
markdown brut dans le presse-papiers du système.

Le fournisseur se configure dans la section `ai` de `settings.json` (voir
[Paramètres](settings.md)) :

- **Préréglages de fournisseur** : Ollama, LM Studio, un point de terminaison
  personnalisé compatible OpenAI, ou un agent ACP. Les préréglages cloud reviennent un par un au
  fur et à mesure que leurs intégrations sont reconstruites. Définissez l'id dans
  `"provider"` ; chaque préréglage fournit une URL de base par défaut, tandis que
  le modèle est choisi dans l'assistant des paramètres — récupéré auprès du
  fournisseur pour les points de terminaison locaux, sélectionné dans le catalogue fourni pour
  les préréglages cloud. Chaque fournisseur conserve sa propre configuration
  (modèle, URL de base, raisonnement, clé) sous `"providers"` — changer de
  fournisseur restaure la configuration enregistrée de chacun.
- **Les clés API** sont stockées dans `secrets.json` (mode 0600) dans le répertoire
  de données de l'application, indexées par id de fournisseur. La clé n'apparaît
  jamais dans le fichier de paramètres.

## Dóru AI (assistant hors ligne)

Le fournisseur par défaut est **Dóru AI** : un assistant local qui fonctionne
entièrement sur votre ordinateur. Téléchargez-le une fois dans les paramètres IA
(un seul fichier, environ 3 Go) ; ensuite, le chat fonctionne sans compte et sans
connexion internet. Il est sélectionné par défaut sur une installation neuve et
nécessite au moins 8 Go de RAM.

Le modèle téléchargé est Qwen3.5-4B (GGUF quantifié Q4_K_M, licence Apache-2.0 —
voir la [carte du modèle](https://huggingface.co/Qwen/Qwen3.5-4B)). Les poids sont
épinglés par SHA-256 dans le manifeste de l'application et vérifiés après chaque
téléchargement.

## Agents ACP

Définissez `"ai": { "provider": "acp", "providers": { "acp": { "command": "…",
"args": [] } } }` pour dialoguer avec un agent qui parle l'Agent Client Protocol
(agents de style Zed). Dóru transmet le projet à l'agent en tant que serveur MCP,
afin que l'agent puisse interroger et modifier l'arbre comme le chat intégré.

## Dóru en tant que serveur MCP

N'importe quel client MCP — Claude Desktop, Cursor, agents de codage — peut
travailler avec votre arbre. Lancez Dóru en mode serveur en pointant vers le
fichier `.doru` :

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Exemple de configuration Claude Desktop
(`Claude → Settings → Developer → Edit Config`) :

```json
{
  "mcpServers": {
    "doru": {
      "command": "/Applications/Doru.app/Contents/MacOS/doru",
      "args": ["--mcp-server", "/Users/you/FamilyHistory/family.doru"]
    }
  }
}
```

Linux AppImage : le chemin du fichier AppImage. Windows :
`"command": "C:\\Program Files\\Doru\\doru.exe"`. Les noms des outils restent en
anglais quelle que soit la langue de l'interface.

Le serveur est **sans interface et sans état** : pas de fenêtre, pas d'icône dans
le Dock, pas de sessions de chat — il lit et modifie directement le fichier de
l'arbre et se termine lorsque le client se déconnecte. Un nombre quelconque de
clients peuvent pointer simultanément vers le même fichier (Claude Desktop,
Cursor, plusieurs agents de codage) ; les écritures concurrentes sont mises en
file d'attente en toute sécurité. Si un client ne parvient pas à démarrer le
serveur, exécutez la commande dans un terminal — l'assistant journalise les
problèmes sur stderr et son profil temporaire est supprimé à la sortie.

## Exemples de prompts

- *« Trouve toutes les personnes nées avant 1850 et liste leurs sources. »*
- *« Ajoute Ivan Ivanov, né vers 1923, comme enfant de Petr et Maria. »*
- *« Rédige une note de recherche sur Anna à propos du recensement de 1901. »*
- *« Vérifie mon arbre pour les personnes nées après la mort de leurs parents. »*
