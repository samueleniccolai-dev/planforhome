# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** esperimento 3 (fase UI) — traguardi T11–T19 di `docs/lab/traguardi.json`.
**Giro corrente:** 051 · **Tipo:** verifica-produzione · **Fase:** chiusura · **PR aperta:** #75 ·
**Blocchi:** nessuno

## Prossimo

Giro 052: costruzione di T15 (T14 passato).

## Per l'umano

- T14 passato (giro 051). Prova sul telefono (F1) non fatta dalla catena.
- Dubbio minore: `jest ForwardDialog` non prova la descrizione accessibile della conferma (coperta da `ConfirmDialog.test` e Playwright).
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

- 051 — verifica-produzione T14: passato, 0 difetti, 3 mutazioni su 3 prese (PR #75).
- 050 — costruzione T14 parte 2: `ConfirmDialog` e inoltro con la conseguenza scritta; 0 bloccanti, 3 dubbi (PR #74).
- 049 — costruzione T14 parte 1: kit form e nuovo task nello Sheet; 0 bloccanti, 3 dubbi (PR #73).

**ultimo aggiornamento:** 25/10/2026 — giro 051.
