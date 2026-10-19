# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 003 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #10 · **Blocchi:** nessuno

## Prossimo

Dopo il merge di #10: giro `costruzione` per T3 parte 2 (login/logout web, Playwright, smoke login, token su Android).

## Per l'umano

- Rivedere #10 (revisione umana: `infra/smoke.sh`, `application.properties`).
- Aggiungere il segreto `DEMO_PASSWORD` al server prima del deploy (senza, nessun dato demo).
- Ratifiche da dichiarare lette: 003-a, 003-b.
- Da verificare col deploy: `forward-headers-strategy=native` e `X-Forwarded-For` dietro Caddy.
- T3 parte 2 probabilmente chiederà `expo-secure-store` (porta a senso unico).
- APK ancora da provare su telefono fisico. PR Dependabot #2 e #3.

## Ultimi giri

- 001 — verifica-produzione T1: T1 passato, 1 difetto minore.
- 002 — verifica-produzione T2: T2 passato, 0 bloccanti.
- 003 — costruzione T3 (API): 59 test, 1 bloccante trovato e risolto; web da fare.

**Ultimo aggiornamento:** 2026-10-19 — giro 003.
