---
source-hash: b3dd07f80d43
---

# IA e agenti

## La chat integrata

Il pannello della chat si trova in fondo alla finestra. Digita una domanda e
l'agente può leggere e modificare l'albero usando gli strumenti integrati:
`tree_query`, `tree_get`, `tree_stats`, `tree_edit`, `tree_add_relative`,
`sources_add`, `notes_write`.

Le conversazioni vengono salvate come **sessioni di chat**: l'intestazione del
pannello della chat elenca le tue sessioni e puoi passare dall'una all'altra,
avviare una nuova chat o eliminarle. Le sessioni sono archiviate per progetto
nella cartella dei dati dell'app (non dentro il file `.doru`), il titolo deriva
dal tuo primo messaggio e tutto sopravvive ai riavvii dell'app. Ogni risposta
ha un pulsante di copia che mette il suo markdown non elaborato negli appunti
di sistema.

Il provider si configura nella sezione `ai` di `settings.json` (vedi
[Impostazioni](settings.md)):

- **Preset dei provider**: Ollama, LM Studio, un endpoint personalizzato
  compatibile con OpenAI o un agente ACP. I preset cloud tornano uno alla volta
  man mano che le loro integrazioni vengono ricostruite. Imposta l'id in
  `"provider"`; ogni preset fornisce un URL di base predefinito, mentre il
  modello viene scelto nella procedura guidata delle Impostazioni — recuperato
  dal provider per gli endpoint locali, selezionato dal catalogo incluso per i
  preset cloud. Ogni provider mantiene la propria configurazione (modello, URL
  di base, ragionamento, chiave) sotto `"providers"` — cambiando provider si
  ripristina la configurazione salvata di ciascuno.
- **Le chiavi API** sono archiviate in `secrets.json` (modalità 0600) nella
  cartella dei dati dell'app, indicizzate per id del provider. La chiave non
  appare mai nel file delle impostazioni.

## Dóru AI (assistente offline)

Il provider predefinito è **Dóru AI**: un assistente locale che gira interamente
sul tuo computer. Scaricalo una volta nelle impostazioni IA (un singolo file,
circa 3 GB); dopodiché la chat funziona senza account e senza connessione a
internet. È selezionato per impostazione predefinita su un'installazione nuova
e richiede almeno 8 GB di RAM.

Il modello scaricato è Qwen3.5-4B (GGUF quantizzato Q4_K_M, licenza Apache-2.0
— vedi la [scheda del modello](https://huggingface.co/Qwen/Qwen3.5-4B)). I pesi
sono fissati tramite SHA-256 nel manifest dell'app e verificati dopo ogni
download.

## Agenti ACP

Imposta `"ai": { "provider": "acp", "providers": { "acp": { "command": "…",
"args": [] } } }` per parlare con un agente che parla l'Agent Client Protocol
(agenti in stile Zed). Dóru passa il progetto all'agente come server MCP, così
l'agente può interrogare e modificare l'albero proprio come la chat integrata.

## Dóru come server MCP

Qualsiasi client MCP — Claude Desktop, Cursor, agenti di programmazione — può
lavorare con il tuo albero. Avvia Dóru in modalità server, puntando al file
`.doru`:

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Esempio di configurazione di Claude Desktop
(`Claude → Settings → Developer → Edit Config`):

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

Linux AppImage: il percorso del file AppImage. Windows:
`"command": "C:\\Program Files\\Doru\\doru.exe"`. I nomi degli strumenti
restano in inglese indipendentemente dalla lingua dell'interfaccia.

Il server è **headless e stateless**: nessuna finestra, nessuna icona nel dock,
nessuna sessione di chat — legge e modifica direttamente il file dell'albero ed
esce quando il client si disconnette. Qualsiasi numero di client può puntare
allo stesso file contemporaneamente (Claude Desktop, Cursor, diversi agenti di
programmazione); le scritture concorrenti si accodano in sicurezza. Se un client
non riesce ad avviare il server, esegui il comando in un terminale — l'helper
registra i problemi su stderr e il suo profilo temporaneo viene scartato
all'uscita.

## Esempi di prompt

- *«Trova tutti i nati prima del 1850 ed elenca le loro fonti.»*
- *«Aggiungi Ivan Ivanov, nato circa nel 1923, come figlio di Petr e Maria.»*
- *«Scrivi una nota di ricerca su Anna riguardo al censimento del 1901.»*
- *«Controlla il mio albero per persone nate dopo la morte dei loro genitori.»*
