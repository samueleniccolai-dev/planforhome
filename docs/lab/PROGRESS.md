# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 026 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #36 · **Blocchi:** nessuno

## Prossimo

Giro 027: T9 parte 4, schermate dei task su Android via coda (crea, assegna, prendi, fatto, inoltra) e avviso discreto; poi verifica-produzione.

## Per l'umano

- Giro 026: PR in revisione umana per `app/package.json` e lock (`expo-secure-store`, risposta A del 21/10). Nessuna ratifica.
- Provare l'APK su telefono: login, aereo, lista già aperta in aereo, spunta, rete su, compare sul web in 60 s. Job `apk` della CI. Reinstallazione = nuovo login. PR #34 (`expo-sqlite`), Dependabot #2 e #3.

## Ultimi giri

- 026 — costruzione T9 (3/4): sessione Android con token, ciclo di sync, lista della spesa offline; 109 test, 0 bloccanti finali (3 corretti).
- 025 — costruzione T9: correzioni del sync (contestazioni 83/84); 151 test, 0 bloccanti.
- 024 — costruzione T9 (2/3): motore di sync del client + archivio SQLite; 94 test, 0 bloccanti finali.

**Ultimo aggiornamento:** 2026-10-21 — giro 026.
