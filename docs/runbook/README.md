# docs/runbook — integrazioni esterne

Un file per integrazione: `docs/runbook/<nome>.md`. Lo scrive un giro di tipo `runbook`, dal
modello `docs/lab/giri/_modello-runbook.md` (METODO §6).

1. Il giro `runbook` copre **una sola** integrazione: prerequisiti, passi numerati con una casella
   `minuti`, prova di riuscita, rollback.
2. L'umano lo esegue in una sessione Claude assistita e dichiarata. I minuti vanno in
   `metrics/tempo-umano.csv` con `riferimento = integrazione <nome>` (ESPERIMENTO P2).
3. Un giro `verifica-produzione` ripete la prova di riuscita. Solo allora il traguardo passa.

I segreti si nominano, mai si scrivono: stanno negli environment di GitHub e sul server.

| Integrazione | Traguardo | Runbook | Stato |
|---|---|---|---|
| Firebase Cloud Messaging | T10 | `fcm.md` | eseguito il 22/10/2026 (prova b passata; prova in produzione con il giro `verifica-produzione` di T10) |
