---
giro: 030
traguardo: T10
tipo: runbook
esito: pr-aperta
inizio: 2026-10-22T12:35:15Z
fine: 2026-10-22T12:45:00Z
pr: 42
ricerca_fonti: 10
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 5
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 0
test_delta: 0
decisioni_registro: 2
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 030 — runbook di Firebase Cloud Messaging

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/030-agenti.json. -->

> **PR:** #42 · **Branch:** `claude/giro-030-t10` · **Traguardo:** T10 — parziale (runbook scritto, da eseguire; il codice di T10 non c'è ancora)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Nuovo runbook `docs/runbook/fcm.md` (74 righe, 11 passi con casella dei minuti): progetto Firebase, app `com.planforhome.app`, chiave API ristretta, account di servizio dedicato, segreto `FCM_SERVICE_ACCOUNT_JSON`, variabile `GOOGLE_SERVICES_JSON`.
- **Da eseguire tu**, in una sessione Claude assistita: l'agente non deve mai leggere il file della chiave. Segna i minuti in `metrics/tempo-umano.csv` (`integrazione FCM`).
- Le pagine ufficiali Firebase/Google Cloud non si sono aperte (DNS): nomi di console, API e comandi `gcloud` sono **[DA VERIFICARE]** mentre esegui; annota gli scostamenti nelle note.
- Nessun codice, nessuna porta a senso unico. Nessuna ratifica.
- Revisione umana: `docs/lab/giri/030-agenti.json` è un percorso protetto presente in ogni giro.

## Cosa funziona ora — con la prova
- Struttura completa del modello, parole chiave richieste, 11 caselle `☐ __`, nessun segreto nel testo; diff solo in `docs/` (prova: revisore, SHA 7a258f7).

## Cosa non funziona ancora
- Il runbook non è stato eseguito: la prova `validate_only` e i segreti non esistono ancora.
- Dubbi del revisore non corretti, per il giro che esegue o ritocca il runbook: (1) `gh secret set --body ''` può chiedere il valore a video, meglio `gh secret delete`; (2) `workflow_dispatch` di `consegna` con `LAB_ATTIVO` avvia anche il job `avanti`; (3) `gcloud auth application-default revoke` con una chiave di servizio può non fare nulla (conta la cancellazione del file); (4) il guard dà `revisione-umana` per il registro agenti; (5) fonti in `030-ricerca.md`.
- Poi servono il codice di T10 e un giro `verifica-produzione`.

## Verdetto del revisore
- **BLOCCANTI:** nessuno
- **DUBBI:** 5, nessuno corretto (vedi sopra)
- **PERIMETRO:** nessuna aggiunta
- **CONCORRENZA:** n/a (solo documenti)
- **MUTAZIONI:** provate 0, prese 0

## Ricerca e critica
Ricerca: 10 fonti, solo da riassunti di ricerca. Critica: 5 punti su 5 accolti (variabile al posto del segreto, ordine delle prove, token senza stampa, restrizione chiave, rollback ordinato).

## Proposte al metodo
nessuna

## Prossima fetta
Esecuzione del runbook da parte dell'umano, poi giro di costruzione di T10 (porte attese: libreria Maven FCM, `expo-notifications`, `google-services.json` nella build).
