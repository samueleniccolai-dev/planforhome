# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 005 · **Tipo:** verifica-produzione · **Fase:** chiusura · **PR aperta:** #12 · **Blocchi:** nessuno

## Prossimo

T3 è passato. Prossimo giro: `costruzione` del login su Android (token in archivio cifrato, refresh all'avvio nel layout radice, DECISIONI n. 22), che chiederà `expo-secure-store` (porta a senso unico). Poi T4.

## Per l'umano

- Rivedere #12 se arriva in revisione umana (modifica a `docs/lab/` e `metrics/`).
- Difetto minore 004: `Max-Age` del cookie 2591999 invece di 2592000.
- In produzione restano account e famiglie «Famiglia Verifica 005» (dati finti, nessuna API per cancellarli).
- APK `planforhome-0.1.0-c3538cd` ancora da provare su telefono fisico. PR Dependabot #2 e #3.

## Ultimi giri

- 003 — costruzione T3 (API): 59 test, 1 bloccante trovato e risolto.
- 004 — costruzione T3 (web): login/logout con cookie e CSRF; 112 test, 0 bloccanti.
- 005 — verifica-produzione T3: T3 passato, 0 bloccanti, 1 difetto minore.

**Ultimo aggiornamento:** 2026-10-20 — giro 005.
