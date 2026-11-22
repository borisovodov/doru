---
source-hash: e207f75e832a
---

# Dati e backup

- I tuoi dati sono un file semplice — e restano tuoi. Dóru non ha account, né
  backend cloud, né telemetria. Nulla viene caricato da nessuna parte a meno
  che *tu* non configuri un provider IA — e anche in quel caso solo il
  contenuto che invii in chat lascia la tua macchina. Se vuoi tenere tutto sul
  tuo computer, i provider locali (Ollama, LM Studio) funzionano completamente
  offline.
- Per il backup: copia il file `.doru` (e la cartella `media/` accanto, se hai
  foto). Non c'è altro. Il ripristino consiste nel ricopiarlo.
- Il file è adatto al controllo di versione: è un file binario stabile — fai un
  commit in git se vuoi.

## Sincronizzazione tra macchine

Dóru non ha un motore di sincronizzazione integrato — i progetti sono file
semplici e mantenerli sincronizzati è compito tuo: iCloud Drive, Dropbox,
rclone, rsync, una chiavetta USB, quello che preferisci.

Un'avvertenza: il file `.doru` è un database SQLite e sincronizzare in tempo
reale un progetto **aperto** con uno strumento di sincronizzazione file può
copiare il file in uno stato di scrittura incompleta e corromperlo. La pratica
sicura è: chiudi il progetto (o l'app) prima di sincronizzare. Copiare un
progetto chiuso è sempre sicuro.
