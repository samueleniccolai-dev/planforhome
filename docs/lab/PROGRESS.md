# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 024 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #34 · **Blocchi:** nessuno

## Prossimo

Giro 025: T9 parte 3, cablaggio del motore su Android (sessione, schermate, logout con `clear()`); poi verifica-produzione.

## Per l'umano

- PR #34 in revisione umana: `app/package.json`/lockfile (expo-sqlite ~58.0.13, decisione 81; lockfile da npm 11 locale). Provare `sqliteStore.ts` e build APK in CI.

- Nessuna ratifica da dichiarare letta nel giro 023 (decisioni 78–80 a registro). T8 passato nel 022.
- Provare l'APK su telefono fisico (fuoco dopo il riordino, TalkBack, Intl su Hermes). StrictMode in sviluppo non verificato. PR Dependabot #2 e #3.

## Ultimi giri

- 024 — costruzione T9 (2/3): motore di sync del client + archivio SQLite; 94 test, 0 bloccanti finali.
- 023 — costruzione T9 (1/2): API sync del server (snapshot, changes, `version` sul PUT); 334 test, 0 bloccanti.
- 022 — verifica-produzione T8: passato, 30 controlli, 0 difetti.

**Ultimo aggiornamento:** 2026-10-21 — giro 024.
