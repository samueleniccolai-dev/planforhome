# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** esperimento 3 (fase UI) — traguardi T11–T19 di `docs/lab/traguardi.json`.
**Giro corrente:** 050 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #74 ·
**Blocchi:** nessuno

## Prossimo

Giro 051: verifica-produzione di T14 (`ConfirmDialog`, `ForwardDialog`, Sheet); poi T15.

## Per l'umano

- PR #74 in revisione umana: test di accettazione vecchi 011, 014, 047 adattati al dialogo (decisione 152).
- Prova sul telefono di `accessibilityHint` (TalkBack) e tasto Indietro del `ConfirmDialog`.
- Prova sul telefono di griglia data e tasto Indietro dello Sheet (Android).
- Dubbio minore: `role="textbox"` su `<input type="date">` (DateField.web).
- Prova sul telefono di T13 (APK, fontScale 2.0): non fatta dalla catena.
- Dubbio aperto: manca un test per la guardia sincrona di `TasksSection` (due clic nello stesso tick).
- Prova dell'APK di T11 e prova a fontScale 2.0 di T12 sul telefono (F1): non fatte dalla catena.
- Id dei promemoria AUTO instabili a ogni PUT: SPEC §8, se li vuoi stabili.
- Spec di T18 e T19 quando vorrai (PR tua che riempie `spec`).
- Dependabot #60 e #61: rimandate.

## Ultimi giri

- 050 — costruzione T14 parte 2: `ConfirmDialog` e inoltro con la conseguenza scritta; 0 bloccanti, 3 dubbi (PR #74).
- 049 — costruzione T14 parte 1: kit form e nuovo task nello Sheet; 0 bloccanti, 3 dubbi (PR #73).
- 048 — verifica-produzione T13: passato, 0 difetti (PR #72).

**ultimo aggiornamento:** 25/10/2026 — giro 050.
