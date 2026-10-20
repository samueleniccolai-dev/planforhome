# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 008 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #15 · **Blocchi:** nessuno

## Prossimo

T5 parte 2 (P7–P9, schermate, Playwright, task demo); poi verifica-produzione di T4 e T5. Login su Android (`expo-secure-store`) resta porta a senso unico.

## Per l'umano

- **DOMANDA giro 008 (PR #15):** T4 non è «Fatto quando verde» (manca il ritorno dei task in coda, serve la tabella `task`). Opzioni: A) giro 008 = T5 parte 1 server, poi verifica di T4 (raccomandata); B) tabella `task` ridotta sotto T4; C) verifica parziale in produzione. Dettagli in `docs/lab/giri/008-piano.md`.

- Rivedere #12 se arriva in revisione umana (modifica a `docs/lab/` e `metrics/`).
- Difetto minore 004: `Max-Age` del cookie 2591999 invece di 2592000.
- In produzione restano account e famiglie «Famiglia Verifica 005» (dati finti, nessuna API per cancellarli).
- APK `planforhome-0.1.0-c3538cd` ancora da provare su telefono fisico. PR Dependabot #2 e #3.

## Ultimi giri

- 008 — costruzione T5 parte 1 (server): task, coda, ritorno in coda; 32 test di accettazione, 147 totali, 0 bloccanti.
- 007 — costruzione T4 (app): scelta e cambio famiglia sul web; 35 test di accettazione, 82 totali, 0 bloccanti.
- 006 — costruzione T4 (server): 34 test di accettazione, 109 totali, 1 bloccante trovato e risolto.

**Ultimo aggiornamento:** 2026-10-20 — giro 008.
