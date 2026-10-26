# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** esperimento 3 (fase UI) — traguardi T11–T19 di `docs/lab/traguardi.json`.
**Giro corrente:** 055 · **Tipo:** costruzione (T16 parte 1, tema scuro) · **Fase:** chiusura · **PR aperta:** #79 ·
**Blocchi:** nessuno

## Prossimo

Giro 056: costruzione di T16 parte 2 (stati V8, `LoadingState`, schermata `/` in scuro).

## Per l'umano

- Giro 055: PR #79 in revisione umana (`app/package.json`, lock: `expo-system-ui`). Nessuna ratifica. Prova dell'APK in tema scuro sul telefono non fatta; `"automatic"` su Android [DA VERIFICARE] (docs SDK 58 non raggiungibili). Il cloud ha negato `expo install` di una dipendenza già decisa: l'hai installata tu.
- Giro 054: T15 passato, 0 difetti. Prova sul telefono (TalkBack, fontScale 2.0, lingua nell'app) non fatta dalla catena. 6 account inventati di prova in produzione (decisione 42).
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

- 055 — costruzione T16 parte 1: tema scuro, `expo-system-ui`; 0 bloccanti, 3 dubbi, 3 mutazioni su 3 prese (PR #79).
- 054 — verifica-produzione T15: passato, 0 difetti, 0 bloccanti (PR #78).
- 053 — costruzione T15 parte 2: `ShoppingList` dal kit, `ListRow`, `Text.struck`; 0 bloccanti, 0 dubbi, 4 mutazioni su 4 prese (PR #77).

**ultimo aggiornamento:** 26/10/2026 — giro 055.
