# PROGRESS — letto all'avvio di ogni giro, aggiornato alla fine (≤ 1 pagina)

**Obiettivo:** esperimento 3 (fase UI) — traguardi T11–T19 di `docs/lab/traguardi.json`.
**Giro corrente:** 058 · **Tipo:** verifica-produzione (T17, solo web: passato) · **Fase:** chiusura · **PR aperta:** #82 ·
**Blocchi:** nessuno

## Prossimo

T18 e T19 partono solo quando la loro spec è sul repository (PR umana). Poi la caccia finale.

## Per l'umano

- Giro 058: T17 passato per il web, 0 difetti sev. 3–4. Da te: i 5 job sull'APK (meglio chi non l'ha mai visto) e D5 (formato data «mm/dd/yyyy») su un browser vero. Rapporto: `docs/lab/ux/2026-10-26-walkthrough-giro-058.md`. Proposta di metodo: tipo `ux`.
- Giro 057: T16 passato, nessuna ratifica. Da provare sul telefono (F1): APK in tema scuro, TalkBack sul «Caricamento…», note offline/conflitto. S5: `/me` fa sempre `POST /api/auth/refresh` (atteso del piano sbagliato, non un difetto).
- Giro 056: PR #80, nessuna ratifica, nessuna porta. Da provare sul telefono: annuncio TalkBack del «Caricamento…» e APK in tema scuro (giro 055 incluso). Rischio dichiarato: `aria-live` montata già piena.
- Dubbi 056: `me()` non distingue 401 da errore (rete caduta su `/api/me` porta a `/login`); spinner Android senza timeout se il sync non diventa pronto; manca un test di `/me` con famiglie abortite.
- Per Playwright serve prima `npx expo export --platform web`.
- Giro 054: T15 passato. Prova sul telefono (TalkBack, fontScale 2.0, lingua nell'app) non fatta dalla catena. 6 account inventati in produzione (decisione 42).
- Prove sul telefono rimaste: T11–T14 (APK, fontScale 2.0, TalkBack, griglia data, tasto Indietro).
- Id dei promemoria AUTO instabili a ogni PUT: SPEC §8, se li vuoi stabili.
- Spec di T18 e T19 quando vorrai (PR tua che riempie `spec`).
- Dependabot #60 e #61: rimandate.

## Ultimi giri

- 058 — verifica-produzione T17 (web): passato, D1–D5 in «idee per dopo» (PR #82).
- 057 — verifica-produzione T16: passato, 0 difetti, 24 controlli (PR #81).
- 056 — costruzione T16 parte 2: `LoadingState`, stati V8 su 5 schermate, `/` in scuro; 0 bloccanti, 3 dubbi, 3 mutazioni su 3 prese (PR #80).

**ultimo aggiornamento:** 26/10/2026 — giro 058.
