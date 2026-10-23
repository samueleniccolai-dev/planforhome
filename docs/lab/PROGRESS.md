# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** traguardi T1–T10 di `docs/lab/traguardi.json` — demo R0 con dati finti, web su
`app.planforhome.com` e APK Android, poi la caccia finale.
**Giro corrente:** 040 · **Tipo:** caccia · **Fase:** chiusura · **PR aperta:** #56 · **Blocchi:** nessuno

## Prossimo

Un giro di costruzione per il **bloccante 040** (replay di `POST …/tasks` dopo l'inoltro, difetto del 016); poi la caccia si può richiudere con la verifica e il giro di chiusura dell'esperimento.

## Per l'umano

- Giro 040: nessuna ratifica. Bloccante: replay della creazione dopo inoltro restituisce il task di un'altra famiglia (`TaskService.java:170-174`). Maggiore: token FCM dopo il logout (SPEC §9) e `032:maggiore` (`deletePending`).
- Minori: PUT parziale di un task, registrazione device ferma, `error:network` sovrascritto; P16–P18 senza etichetta nei test.
- PR #34 (`expo-sqlite`), Dependabot #2 e #3, PR #44.

## Ultimi giri

- 040 — caccia: 1 bloccante (replay dopo inoltro, 016), 1 maggiore, 3 minori; 601 test.
- 039 — verifica T10: tutto verde, prova sul telefono ok, difetto 037 chiuso; T10 `passato`.
- 038 — canale Promemoria con importanza ALTA (6): 0 bloccanti, 555 test.

**Ultimo aggiornamento:** 2026-10-23 — giro 040.
