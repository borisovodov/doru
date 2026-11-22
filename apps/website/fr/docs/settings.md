---
source-hash: ecff58fa2a2c
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

  // AI providers — set from Settings (gear icon) or here directly.
  "ai": {
    // The active provider: ollama | lmstudio | custom | acp
    // (cloud presets return one by one).
    "provider": "ollama",

    // Per-provider settings, keyed by provider id. Only the entry of the
    // active provider is used; the others keep their values and are
    // restored when you switch back.
    "providers": {
      "ollama": {
        "baseUrl": "", // optional override of the provider's default endpoint
        "model": ""
      }
      // For "acp" only: the agent binary to spawn. Add a comma after the
      // "ollama" object above when you enable it.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Theme: one palette file with a dark and a light section. The OS
  // appearance decides which palette applies.
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
