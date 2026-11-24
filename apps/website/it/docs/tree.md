---
source-hash: f6a2e6136547
---

# Lavorare con l'albero

L'albero si apre come una tela interattiva. Tutto ciò che segue avviene sulla
tela stessa; l'elenco delle persone vive nella vista **Persone** della barra
delle attività a sinistra.

## Navigazione

- **Panoramica** trascinando lo sfondo, **zoom** con la rotellina del mouse o
  il trackpad; i pulsanti dello zoom si trovano nell'angolo della tela.
- **Ricentra** una persona con un doppio clic sulla sua scheda. La barra degli
  strumenti mantiene una cronologia: frecce indietro/avanti e un percorso di
  navigazione.
- **Diagrammi**: passa tra le viste *Antenati*, *Discendenti*, *Clessidra* e
  *Famiglia* nella barra degli strumenti. La vista famiglia mostra la coppia in
  focus, i loro figli ed entrambi i lati dei genitori.
- **Ricerca**: digita un nome nella casella di ricerca della barra degli
  strumenti e scegli un risultato per passare a quella persona.
- **Comprimi** un ramo con il chevron su una scheda (oppure comprimi/espandi
  tutti i rami dalla barra degli strumenti).

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
- **Cambia genitori**: trascina una scheda su quella di un'altra persona per
  spostare la persona trascinata come figlio in quella famiglia (il bersaglio
  valido si illumina durante il trascinamento).

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
- **Note**: note di ricerca libere collegate a una persona. Una nota può essere
  collegata a più record: usa **Collega una nota esistente** nella sezione Note
  di un altro record, poi scegli se una modifica deve aggiornare il testo
  condiviso ovunque o solo il record corrente. **Scollega da questo record**
  rimuove un collegamento; **Elimina ovunque** rimuove la nota.
- Eventi e nomi hanno le proprie sezioni Fonti, Note, Etichette, Identificativi,
  Contatti e Restrizioni all'interno dell'editor della persona.

## Indirizzi

La vista **Fonti** ha una sezione **Indirizzi**. Usala per creare, modificare
ed eliminare indirizzi autonomi. Gli indirizzi usati da eventi, archivi o
mittenti mostrano il numero di utilizzi; eliminarne uno lo scollega da quei
record. Il selettore di indirizzo di un evento ha anche le azioni **Nuovo
indirizzo** e **Modifica indirizzo** per modificare un indirizzo sul posto.

## Attività

Le attività hanno date di creazione e chiusura oltre alle date pianificate e di
promemoria. Ogni editor ha una sezione **Attività**: aggiungi un'attività lì e
viene collegata automaticamente a quel record. Eventi, nomi, citazioni e note
hanno la propria sezione Attività nel loro pannello degli allegati.
**Collegato a** collega un'attività a qualsiasi record dell'albero — una
persona, famiglia, evento, nome, fonte, citazione, nota, file media, luogo,
archivio, mittente, indirizzo, opera o persino un'altra attività; lascialo
vuoto per un'attività indipendente.

Opere, attività, indirizzi, associazioni e collegamenti partner/figlio delle
famiglie hanno le stesse sezioni Note, Fonti, Etichette, Identificativi,
Contatti, Restrizioni, Contributori e Attività delle schede delle entità
principali.

## Media

Le foto sono normali file nella cartella `media/` accanto al progetto.
Aggiungile da una persona, famiglia, fonte, luogo, archivio, mittente, opera,
attività o indirizzo; la sezione media consente anche di collegare un record
esistente a un'altra destinazione. Fai clic su un'anteprima per aprire la scheda
media, dove puoi modificare il titolo, gestire i file e modificare i metadati
del collegamento come la didascalia, la sequenza, il contrassegno principale e
quello di esclusione.

Un record media può essere collegato a più destinazioni. **Scollega da questo
record** rimuove un collegamento; **Elimina media** rimuove il record e le
copie dei suoi file. Un record senza collegamenti rimanenti viene rimosso
automaticamente.

## Ordinamento

Gli elenchi in cui l'ordine conta — nomi, partner e figli di una famiglia, nomi
dei luoghi, righe di indirizzo, partecipanti agli eventi e campi dei modelli —
hanno controlli su/giù. L'ordine è memorizzato come posizione della riga.
