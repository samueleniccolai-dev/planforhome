# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 004 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #11 · **Blocchi:** nessuno

## Prossimo

Dopo il merge di #11 (con il refresh spostato nel layout radice, DECISIONI n. 22): giro `verifica-produzione` di T3 (parte web) e poi `costruzione` per il token su Android, che chiederà `expo-secure-store` (porta a senso unico).

## Per l'umano

- Rivedere #11 (revisione umana: `infra/smoke.sh`).
- Ratifiche 004-a e 004-b lette (20/10). Richiesta: il refresh va chiamato all'avvio dell'app (layout radice), anche su Android.
- Aggiungere il segreto `DEMO_PASSWORD` al server (senza, nessun dato demo).
- Da verificare col deploy: `forward-headers-strategy=native`, `X-Forwarded-For` dietro Caddy, cookie `Secure` dietro Caddy.
- APK ancora da provare su telefono fisico. PR Dependabot #2 e #3.

## Ultimi giri

- 002 — verifica-produzione T2: T2 passato, 0 bloccanti.
- 003 — costruzione T3 (API): 59 test, 1 bloccante trovato e risolto.
- 004 — costruzione T3 (web): login/logout con cookie e CSRF, rinnovo, revoca al cambio password; 112 test, 0 bloccanti.

**Ultimo aggiornamento:** 2026-10-20 — giro 004.
