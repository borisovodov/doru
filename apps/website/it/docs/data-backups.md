---
source-hash: fbf10a17cf6e
---

# Dati e backup

- I tuoi dati sono un file semplice — e restano tuoi. Dóru non ha account, né
  backend cloud, né telemetria. Nulla viene caricato da nessuna parte a meno che
  *tu* non configuri un provider IA remoto — e anche in quel caso i messaggi
  della chat e i dati dell'albero recuperati dall'assistente tramite i suoi
  strumenti vengono inviati a quel provider. Se vuoi tenere tutto sul tuo
  computer, i provider locali (Ollama, LM Studio) funzionano completamente
  offline.
- Per il backup: ferma ogni processo che può scrivere nel progetto — chiudilo in
  Dóru e ferma eventuali client MCP o altri strumenti — poi copia il file
  `.doru` (e la cartella `media/` accanto, se hai foto). Non c'è altro. Il
  ripristino consiste nel ricopiare sia il file `.doru` sia la cartella `media/`
  con il progetto chiuso e nessun altro processo in scrittura. Dopo un crash,
  apri il progetto una volta in Dóru così che SQLite possa recuperare eventuali
  journal rimasti, poi chiudilo prima di copiare o ripristinare. Se il progetto
  non può essere aperto, metti da parte il file `.doru` danneggiato e
  l'eventuale journal rimasto prima di ripristinare.
- Le sessioni di chat si trovano nella directory dati dell'app, non nel file
  `.doru`; eseguine un backup separato se ti servono.
- Il file è adatto al controllo di versione: è un file binario stabile — fai un
  commit in git se vuoi.

## Sincronizzazione tra macchine

Dóru non ha un motore di sincronizzazione integrato — i progetti sono file
semplici e mantenerli sincronizzati è compito tuo: iCloud Drive, Dropbox,
rclone, rsync, una chiavetta USB, quello che preferisci.

Un'avvertenza: il file `.doru` è un database SQLite e sincronizzare in tempo
reale un progetto **aperto** con uno strumento di sincronizzazione file può
copiare il file in uno stato di scrittura incompleta e corromperlo. La pratica
sicura è: chiudi il progetto (o l'app) e ferma ogni altro processo che scrive
prima di sincronizzare. Un progetto chiuso correttamente e in cui nessun altro
scrive può essere copiato in sicurezza. Dopo un crash, apri il progetto una
volta in Dóru così che SQLite possa annullare eventuali journal rimasti, poi
chiudilo prima di copiare. Se il progetto non può essere aperto, metti da
parte il file danneggiato e l'eventuale journal rimasto prima di ripristinare
un backup.
