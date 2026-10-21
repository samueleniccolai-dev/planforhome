# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 024 · **Tipo:** costruzione · **Fase:** domanda · **PR aperta:** #34 · **Blocchi:** nessuno

## Prossimo

Giro 024: T9 parte 2, motore di sync del client (SQLite = dipendenza npm nuova, porta a senso unico).

## Per l'umano

- **DOMANDA (giro 024, PR #34):** dipendenza npm nuova per SQLite su Android. A (consigliata) `expo-sqlite` ~58.0.x; B `@op-sqlite/op-sqlite`; C nessuna dipendenza (solo motore in memoria). Dettagli in `docs/lab/giri/024-piano.md`.

- Nessuna ratifica da dichiarare letta nel giro 023 (decisioni 78–80 a registro). T8 passato nel 022.
- Provare l'APK su telefono fisico (fuoco dopo il riordino, TalkBack, Intl su Hermes). StrictMode in sviluppo non verificato. PR Dependabot #2 e #3.

## Ultimi giri

- 023 — costruzione T9 (1/2): API sync del server (snapshot, changes, `version` sul PUT); 334 test, 0 bloccanti.
- 022 — verifica-produzione T8: passato, 30 controlli, 0 difetti.
- 021 — costruzione T8: il fuoco dopo «Sposta» solo subito dopo il tocco (020-a); 577 test, 0 bloccanti.

**Ultimo aggiornamento:** 2026-10-21 — giro 023.
