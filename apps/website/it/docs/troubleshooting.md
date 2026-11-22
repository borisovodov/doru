---
source-hash: 77b60fd904c7
---

# Risoluzione dei problemi

- **Un progetto `.doru` di una build precedente rifiuta di aprirsi** — prima
  della 1.0 lo schema del progetto cambia senza migrazioni, quindi i file
  scritti da un'altra build non vengono compresi. Apri il progetto nella build
  che l'ha creato, esporta in GEDCOM e importa quel file in questa build.
- **«Il provider IA non è configurato»** — apri le Impostazioni (icona a
  ingranaggio nella barra a sinistra), scegli un provider e segui la procedura
  guidata: recupera l'elenco dei modelli (o scegli un modello) e salva una
  chiave dove richiesto.
- **La connessione a Ollama non riesce** — seleziona il preset Ollama (URL di
  base `http://localhost:11434/v1`); non serve una chiave API. Premi «Recupera
  i modelli dal provider» — se segnala che il provider non è raggiungibile,
  assicurati che Ollama sia in esecuzione localmente.
