# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** esperimento 3 (fase UI) — traguardi T11–T19 di `docs/lab/traguardi.json`.
**Giro corrente:** 056 · **Tipo:** costruzione (T16 parte 2, stati V8 e `/` in scuro) · **Fase:** chiusura · **PR aperta:** #80 ·
**Blocchi:** nessuno

## Prossimo

Giro 057: verifica-produzione di T16 (il «Fatto quando» è verde, da verificare dopo merge e deploy).

## Per l'umano

- Giro 056: PR #80, nessuna ratifica, nessuna porta. Da provare sul telefono: annuncio TalkBack del «Caricamento…» e APK in tema scuro (giro 055 incluso). Rischio dichiarato: `aria-live` montata già piena.
- Dubbi 056: `me()` non distingue 401 da errore (rete caduta su `/api/me` porta a `/login`); spinner Android senza timeout se il sync non diventa pronto; manca un test di `/me` con famiglie abortite.
- Per Playwright serve prima `npx expo export --platform web`.
- Giro 054: T15 passato. Prova sul telefono (TalkBack, fontScale 2.0, lingua nell'app) non fatta dalla catena. 6 account inventati in produzione (decisione 42).
- Prove sul telefono rimaste: T11–T14 (APK, fontScale 2.0, TalkBack, griglia data, tasto Indietro).
- Id dei promemoria AUTO instabili a ogni PUT: SPEC §8, se li vuoi stabili.
- Spec di T18 e T19 quando vorrai (PR tua che riempie `spec`).
- Dependabot #60 e #61: rimandate.

## Ultimi giri

- 056 — costruzione T16 parte 2: `LoadingState`, stati V8 su 5 schermate, `/` in scuro; 0 bloccanti, 3 dubbi, 3 mutazioni su 3 prese (PR #80).
- 055 — costruzione T16 parte 1: tema scuro, `expo-system-ui` (PR #79).
- 054 — verifica-produzione T15: passato, 0 difetti (PR #78).

**ultimo aggiornamento:** 26/10/2026 — giro 056.
