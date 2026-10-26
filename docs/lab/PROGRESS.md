# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** esperimento 3 (fase UI) — traguardi T11–T19 di `docs/lab/traguardi.json`.
**Giro corrente:** 053 · **Tipo:** costruzione · **Fase:** chiusura · **PR aperta:** #77 ·
**Blocchi:** nessuno

## Prossimo

Giro 054: verifica-produzione di T15 (dopo il merge e il deploy di #77).

## Per l'umano

- Giro 053: nessuna ratifica. Prova sul telefono (TalkBack sulla voce tolta, fontScale 2.0) non fatta dalla catena.
- Dubbio minore (052): su 401 la lingua dell'account resta su `/login`.
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

- 053 — costruzione T15 parte 2: `ShoppingList` dal kit, `ListRow`, `Text.struck`; 0 bloccanti, 0 dubbi, 4 mutazioni su 4 prese (PR #77).
- 052 — costruzione T15 parte 1: lingua dell'account sul web, `LinkRow`, famiglia/profilo dal kit; 0 bloccanti, 2 dubbi (PR #76).
- 051 — verifica-produzione T14: passato, 0 difetti, 3 mutazioni su 3 prese (PR #75).

**ultimo aggiornamento:** 26/10/2026 — giro 053.
