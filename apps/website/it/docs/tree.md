---
source-hash: fc4f60af6671
---

# Lavorare con l'albero

L'albero si apre come una tela interattiva. Tutto ciò che segue avviene sulla
tela stessa; l'elenco delle persone vive nella vista **Persone** della barra
delle attività a sinistra.

## Navigazione

- **Panoramica** trascinando lo sfondo, **zoom** con la rotellina del mouse o
  il trackpad; i pulsanti dello zoom si trovano nell'angolo della tela.
- **Ricentra** una persona con un doppio clic sulla sua scheda. I pulsanti Indietro/Avanti della finestra riportano alle schede e alle posizioni precedenti dell'albero.
- **Antenati e discendenti** sono sempre mostrati insieme: genitori e nonni sopra il focus,
  figli sotto.
- **Ricerca**: digita un nome nella casella di ricerca della barra degli
  strumenti e scegli un risultato per passare a quella persona.

## Schede

Ogni scheda mostra un avatar con le iniziali, il nome, gli anni di vita (con †
per le persone defunte) e piccoli badge con il numero di note, fonti e media.
Il bordo sinistro segna la linea del padre (blu) e della madre (rosa) nei
diagrammi degli antenati; la cornice colorata segna la persona in focus.

## Modifica

Seleziona una scheda per mostrare la barra degli strumenti delle azioni:

- **Aggiungi figlio / coniuge / genitore** — una nuova scheda vuota appare
  accanto alla persona; digita il nome direttamente nella scheda e confermalo
  con il segno di spunta (la croce la scarta).
- **Modifica** — apre l'editor completo della persona come scheda: nomi,
  sesso, date di nascita/morte con un indicatore di qualità (*Esatta / Circa /
  Prima / Dopo*) e un campo di testo libero per la data (ad es. una data del
  calendario «23 Nivôse» che non corrisponde al gregoriano), famiglie, eventi,
  fonti, note e media.
- **Elimina** — rimuove la persona dall'albero e da ogni famiglia.

Un albero nuovo (vuoto) mostra una scheda vuota: fai clic, digita il nome,
conferma con il segno di spunta e la prima persona appare sulla tela.
Dopodiché, fai crescere l'albero dalle schede stesse.

## Famiglie

Nell'editor completo della persona, aggiungi genitori, un partner o figli.
Digita un nome per scegliere una persona esistente; le chip mostrano i membri
di ogni famiglia. Rimuovere una persona da una famiglia o eliminare una
famiglia è un clic.

## Fonti e note

- **Fonti**: collega fonti a una persona (con titolo e autore) o riutilizza una
  fonte esistente. Ogni collegamento è una citazione e può essere rimosso.
- **Note**: note di ricerca libere collegate a una persona. Ogni nota appartiene a un solo record: aggiungila, modificala o eliminala nella sezione Note di quel record. Una nota condivisa da un file GEDCOM importato viene copiata per ogni record che la referenzia.

## Indirizzi

La vista **Fonti** ha una sezione **Indirizzi**. Usala per creare, modificare
ed eliminare indirizzi autonomi. Gli indirizzi usati da eventi, archivi o
mittenti mostrano il numero di utilizzi; eliminarne uno lo scollega da quei
record. Il selettore di indirizzo di un evento ha anche le azioni **Nuovo
indirizzo** e **Modifica indirizzo** per modificare un indirizzo sul posto.

## Attività

Le attività hanno una data di creazione e una data di promemoria. Chiudere un'attività cambia solo il suo stato; non viene salvata una data di completamento separata. La maggior parte degli editor ha una sezione **Attività**: aggiungi un'attività lì e viene collegata automaticamente a quel record. Fanno eccezione l'editor delle attività e quello dei mittenti: la scheda di un'attività conserva Note e Media, quella di un mittente non ha la sezione Attività, e un collegamento multimediale non è una destinazione per le attività. Eventi e nomi hanno la propria sezione Attività nel loro pannello degli allegati. Una citazione ha solo Note, quindi allega le attività relative alle prove alla sua fonte. **Collegato a** collega un'attività a uno o più record dell'albero — una persona, famiglia, evento, nome, fonte, media, luogo, archivio, indirizzo o opera, ma non un'altra attività, un mittente, una citazione o un collegamento multimediale; lascialo vuoto per un'attività indipendente. Un'attività è condivisa: modificarla ovunque aggiorna lo stesso record e l'eliminazione di un record collegato lascia l'attività al suo posto. Usa **Allega un'attività esistente** per riutilizzare un'attività condivisa invece di crearne una nuova.

Opere, indirizzi, associazioni e collegamenti partner/figlio delle famiglie hanno le stesse sezioni Note, Fonti e Attività delle schede delle entità principali. I contatti appartengono alla persona, all'evento, all'archivio o al mittente che descrivono, non a un indirizzo. Le attività mantengono Note e Media, ma non hanno Fonti, Contatti, Contributori o Attività. Un collegamento multimediale non è una destinazione di allegati. I contributori sono disponibili solo sulle schede di persona e famiglia.

## Media

Le foto sono normali file nella cartella `media/` accanto al progetto. Aggiungile da una persona, famiglia, fonte, luogo, archivio, mittente, opera, attività o indirizzo; la sezione **Correlato a** della scheda media gestisce i record a cui è collegato questo media. Ogni scheda media contiene esattamente un file. Fai clic su un’anteprima per aprire la scheda media, dove puoi modificare il titolo e la data. Usa la stella nella sezione Media di un destinatario per scegliere la sua foto principale.

Un record media può essere collegato a più destinatari o a nessuno. **Scollega da questo record** rimuove un collegamento ed è disponibile per ogni collegamento, incluso l’ultimo; il media resta nella libreria. **Elimina media** rimuove il record e la copia del file. L’eliminazione di un record di destinazione rimuove solo i suoi collegamenti, quindi un record media può restare senza collegamenti. Un media importato da un `OBJE` GEDCOM con più file diventa una scheda per ogni file; i formati alternativi `TRAN` non vengono importati.

## Ordinamento

Gli elenchi in cui l'ordine conta — nomi, partner e figli di una famiglia, nomi
dei luoghi, righe di indirizzo e partecipanti agli eventi —
hanno controlli su/giù. L'ordine è memorizzato come posizione della riga.
