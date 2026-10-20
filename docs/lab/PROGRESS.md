# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 006 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #13 · **Blocchi:** nessuno

## Prossimo

T4 parte 2 (schermate e Playwright per Luca e Giulia) oppure il login su Android (`expo-secure-store`, porta a senso unico; DECISIONI n. 22). Il ritorno dei task in coda è in T5.

## Per l'umano

- Rivedere #12 se arriva in revisione umana (modifica a `docs/lab/` e `metrics/`).
- Difetto minore 004: `Max-Age` del cookie 2591999 invece di 2592000.
- In produzione restano account e famiglie «Famiglia Verifica 005» (dati finti, nessuna API per cancellarli).
- APK `planforhome-0.1.0-c3538cd` ancora da provare su telefono fisico. PR Dependabot #2 e #3.

## Ultimi giri

- 004 — costruzione T3 (web): login/logout con cookie e CSRF; 112 test, 0 bloccanti.
- 005 — verifica-produzione T3: T3 passato, 0 bloccanti, 1 difetto minore.
- 006 — costruzione T4 (server): 34 test di accettazione, 109 totali, 1 bloccante trovato e risolto.

**Ultimo aggiornamento:** 2026-10-20 — giro 006.
