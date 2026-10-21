# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 025 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #35 · **Blocchi:** nessuno

## Prossimo

Giro 026: T9 parte 3, cablaggio del motore su Android (sessione, schermate, logout con `clear()`); poi verifica-produzione.

## Per l'umano

- Giro 025: recepite le contestazioni n. 83 e 84 (decisioni 85 e 86). Nessuna ratifica, nessun percorso protetto toccato.
- Provare `sqliteStore.ts` e la build APK con `expo-sqlite` (PR #34). Provare l'APK su telefono fisico (fuoco, TalkBack, Intl su Hermes). PR Dependabot #2 e #3.

## Ultimi giri

- 025 — costruzione T9: correzioni del sync (contestazioni 83/84); 151 test, 0 bloccanti.
- 024 — costruzione T9 (2/3): motore di sync del client + archivio SQLite; 94 test, 0 bloccanti finali.
- 023 — costruzione T9 (1/2): API sync del server (snapshot, changes, `version` sul PUT); 334 test, 0 bloccanti.

**Ultimo aggiornamento:** 2026-10-21 — giro 025.
