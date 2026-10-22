# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 030 · **Tipo:** runbook · **Fase:** chiusura · **PR aperta:** #42 · **Blocchi:** nessuno

## Prossimo

T10 è `in-corso`: il runbook FCM (`docs/runbook/fcm.md`) è scritto ma non eseguito. Dopo l'esecuzione, giro di costruzione di T10 (porte attese: libreria Maven FCM, `expo-notifications`, `google-services.json` nella build); poi verifica-produzione. Il difetto minore del PUT (scadenza azzerata se omessa) aspetta una decisione sulla semantica.

## Per l'umano

- **Eseguire il runbook FCM** in una sessione Claude assistita (l'agente non legge mai il file della chiave), segnando i minuti in `metrics/tempo-umano.csv` (`integrazione FCM`). Nomi di console, API e comandi gcloud sono [DA VERIFICARE]: le pagine ufficiali non erano raggiungibili.
- Dubbi del revisore sul runbook (rollback con `gh secret delete`, effetto di `workflow_dispatch` sul job `avanti`, `gcloud auth application-default revoke`): vedi rapporto 030.
- Provare l'APK `planforhome-0.1.0-1e813c4` su telefono (login, aereo, coda, avviso entro 60 s, TalkBack).
- Decidere: PUT parziale di un task (campi omessi restano o si cancellano?) e dati locali dopo il 401 per ultima famiglia tolta.
- PR #34 (`expo-sqlite`), Dependabot #2 e #3.

## Ultimi giri

- 030 — runbook FCM scritto (T10 in-corso): 5/5 punti della critica accolti, 0 bloccanti, 5 dubbi nel rapporto.
- 029 — verifica T9 passata: 26/26 controlli verdi in produzione, 0 bloccanti, 1 difetto minore (PUT azzera la scadenza).
- 028 — verifica T9 non passata: 5 attesi del piano sbagliati su 25 controlli, nessun difetto di dati o isolamento.

**Ultimo aggiornamento:** 2026-10-22 — giro 030.
