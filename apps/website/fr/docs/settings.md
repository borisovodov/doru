---
source-hash: cb76eaf45583
---

# Paramètres

Les paramètres globaux se trouvent dans `settings.json` dans le répertoire de
données de l'application :

| Système | Chemin |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**Les valeurs par défaut sont intégrées à l'application ; le fichier n'enregistre
que les remplacements explicites.** Au premier lancement, l'application crée le
fichier avec seulement la référence `$schema` — tout le reste retombe sur les
valeurs par défaut intégrées, de sorte que les nouvelles valeurs par défaut
arrivent aux utilisateurs existants avec les mises à jour. La référence `$schema`
est l'unique source de documentation : les éditeurs prenant en charge JSON Schema
(VS Code, Zed, JetBrains) offrent l'autocomplétion, la validation et les
descriptions de champs. L'application n'écrit des entrées dans le fichier que
lorsque vous modifiez un paramètre dans **Paramètres** ; tout le reste reste
intact. Le fichier est du JSON simple avec commentaires autorisés — modifiez-le
avec n'importe quel éditeur ; les modifications sont prises en compte à chaud
pendant que l'application tourne. L'application valide le fichier par rapport au
schéma au chargement ; s'il ne s'analyse pas ou ne correspond pas au schéma, il
est remplacé par le modèle vide (un avertissement est journalisé). Le fournisseur
d'IA se configure dans la section `ai` de ce fichier — voir
[IA et agents](agents.md).

Référence complète :

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // Fournisseurs d'IA — à définir dans les paramètres (icône d'engrenage) ou ici directement.
  "ai": {
    // Le fournisseur actif : ollama | lmstudio | custom | acp
    // (les préréglages cloud reviennent un par un).
    "provider": "ollama",

    // Paramètres par fournisseur, indexés par id de fournisseur. Seule l'entrée
    // du fournisseur actif est utilisée ; les autres conservent leurs valeurs et
    // sont restaurées lorsque vous revenez à eux.
    "providers": {
      "ollama": {
        "baseUrl": "", // remplacement facultatif du point de terminaison par défaut du fournisseur
        "model": ""
      }
      // Pour "acp" uniquement : le binaire de l'agent à lancer.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Thème : un fichier de palette avec une section sombre et une section claire.
  // L'apparence du système décide quelle palette s'applique.
  "theme": "doru"
}
```

## Journaux

L'application ajoute des diagnostics à `doru.log` dans le répertoire de données (à
côté de `settings.json`). Le fichier est renouvelé à 5 Mo — le fichier précédent
est conservé sous `doru.old.log`. La verbosité par défaut est `warn` (les builds
de développement journalisent en `debug`) ; définissez
`DORU_LOG_LEVEL=trace|debug|info|warn|error` pour la remplacer. Les avertissements
de validation de schéma (un fichier de paramètres ou de thème qui ne correspond
pas à son schéma) sont journalisés ici. Le bouton **Ouvrir le fichier journal**
dans les paramètres crée le fichier à la demande si rien n'a encore été
journalisé.
