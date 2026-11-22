---
source-hash: cb76eaf45583
---

# Impostazioni

Le impostazioni globali vivono in `settings.json` nella cartella dei dati
dell'app:

| Sistema operativo | Percorso |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**I valori predefiniti vivono nell'app; il file registra solo le sostituzioni
esplicite.** Al primo avvio l'app crea il file con il solo riferimento a
`$schema` — tutto il resto ricade sui valori predefiniti integrati, così i nuovi
valori predefiniti arrivano agli utenti esistenti con gli aggiornamenti
dell'app. Il riferimento `$schema` è l'unica fonte di documentazione: gli
editor con supporto JSON Schema (VS Code, Zed, JetBrains) offrono
completamento automatico, validazione e descrizioni dei campi. L'app scrive le
voci nel file solo quando cambi un'impostazione in **Impostazioni**; tutto il
resto rimane intatto.
Il file è JSON semplice con commenti consentiti — modificalo con qualsiasi
editor; le modifiche vengono rilevate in tempo reale mentre l'app è in
esecuzione. L'app valida il file rispetto allo schema al caricamento; se non
viene analizzato o non corrisponde allo schema, viene sostituito con il modello
vuoto (viene registrato un avviso). Il provider IA si configura nella sezione
`ai` di questo file — vedi [IA e agenti](agents.md).

Riferimento completo:

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // Provider IA — imposta da Impostazioni (icona a ingranaggio) o qui direttamente.
  "ai": {
    // Il provider attivo: ollama | lmstudio | custom | acp
    // (i preset cloud tornano uno alla volta).
    "provider": "ollama",

    // Impostazioni per provider, indicizzate per id del provider. Viene usata
    // solo la voce del provider attivo; le altre mantengono i loro valori e
    // vengono ripristinate quando torni indietro.
    "providers": {
      "ollama": {
        "baseUrl": "", // sostituzione facoltativa dell'endpoint predefinito del provider
        "model": ""
      }
      // Solo per "acp": il binario dell'agente da avviare.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Tema: un file di palette con una sezione scura e una chiara. L'aspetto
  // del sistema operativo decide quale palette si applica.
  "theme": "doru"
}
```

## Log

L'app aggiunge diagnostica a `doru.log` nella cartella dei dati (accanto a
`settings.json`). Il file ruota a 5 MB — il file precedente viene conservato
come `doru.old.log`. Il livello di dettaglio predefinito è `warn` (le build di
sviluppo registrano a `debug`); imposta
`DORU_LOG_LEVEL=trace|debug|info|warn|error` per sostituirlo. Gli avvisi di
validazione dello schema (un file di impostazioni o tema che non corrisponde al
suo schema) vengono registrati qui. Il pulsante **Apri il file di log** nelle
Impostazioni crea il file su richiesta se non è ancora stato registrato nulla.
