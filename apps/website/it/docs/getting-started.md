---
source-hash: 472083c37a73
---

# Avvio rapido

1. Avvia Dóru e fai clic su **Crea nuovo progetto…** (o **Apri progetto o
   importa GEDCOM…**) nella pagina iniziale.
2. **Crea** chiede una posizione e un nome e crea lì un file `.doru`; **Apri
   progetto o importa GEDCOM** apre un file `.doru` esistente, oppure un file
   GEDCOM `.ged`/`.gdz` — un file GEDCOM avvia un nuovo progetto non ancora
   salvato con l'albero importato; salvalo in `.doru` in seguito. Il file *è*
   il progetto — il suo nome è il nome del progetto:

```
My Family.doru      l'albero stesso (SQLite, contrassegnato con un ID dell'app)
media/              foto e scansioni, create su richiesta (facoltative)
```

3. Inserisci i dati: un nuovo albero mostra una scheda vuota — fai clic, digita
   il nome, conferma con il segno di spunta e la prima persona appare sulla
   tela; ogni scheda può aggiungere figli, coniugi e genitori allo stesso modo.
   I file GEDCOM si importano tramite **Apri progetto o importa GEDCOM**
   (passaggio 2). Per esportare, apri la scheda **Esporta GEDCOM**, scegli
   **GEDCOM 7.0** (`.ged`) o **GEDZIP** (`.gdz`, con i file media gestiti), e
   conferma la posizione di salvataggio.

Ogni progetto si apre nella **propria finestra**; le persone, l'editor
dell'albero e le impostazioni si aprono come schede al suo interno. **Nuova
finestra** (`⌘⇧N`, `Ctrl+Shift+N` su Linux e Windows) apre un'altra pagina
iniziale senza chiudere il progetto corrente, così puoi importare un file
GEDCOM o aprire un secondo albero accanto ad esso. I progetti usati di recente
sono elencati nella pagina iniziale e le finestre dei progetti aperti vengono
ripristinate al successivo avvio.
Un doppio clic su un file `*.doru` (o l'apertura di un link
`doru://open?path=/…/family.doru`) lo apre nell'app in esecuzione.

## Apertura dei progetti dai link

L'app registra lo schema URL `doru://`, quindi un link `doru://open?path=…`
apre il progetto — o importa il file, per `.ged`/`.gdz` — anche quando l'app
non è ancora in esecuzione:

- Il percorso deve essere **assoluto e codificato per URL** (`%20` per gli
  spazi e così via), ad es. `doru://open?path=%2FUsers%2Fyou%2FFamily.doru`.
- Se l'app non è in esecuzione, il link la avvia e apre subito il progetto.
- Se l'app è già in esecuzione, il progetto si apre nell'istanza in esecuzione
  — non viene mai avviata una seconda istanza, la finestra esistente riceve il
  focus.
- I link funzionano solo per i tipi di file che l'app apre direttamente:
  progetti `.doru` e file GEDCOM `.ged`/`.gdz`.

Su macOS, `open "doru://open?path=…"` invia il link dal terminale o da altre
app; su Linux, `xdg-open` fa lo stesso.

## Prossimi passi

- [Lavorare con l'albero](tree.md) — persone, famiglie, fonti, note.
- [Impostazioni](settings.md) — il riferimento di `settings.json`.
- [IA e agenti](agents.md) — lascia che un agente legga e modifichi il tuo
  albero.
- [Temi](themes.md) — un tema con palette chiara e scura, scelto in base
  all'aspetto del sistema operativo.
