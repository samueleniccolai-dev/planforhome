---
giro: 024
traguardo: T9
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-21T18:05:20Z
fine: 2026-10-21T18:42:00Z
pr: 34
ricerca_fonti: 0
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 1
revisore_dubbi: 5
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 4
mutazioni_prese: 4
verify_rossi_locali: 0
test_totali: 94
test_delta: 24
decisioni_registro: 4
decisioni_ratifica: 0
porte_senso_unico: 1
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 024 — T9 parte 2: motore di sync del client

> **PR:** #34 · **Branch:** `claude/giro-024-t9` · **Traguardo:** T9 — parziale: motore e archivio
> SQLite fatti, cablaggio nelle schermate e build APK con `expo-sqlite` ancora da provare
> **Domande che bloccano:** nessuna (la domanda su SQLite ha avuto risposta A, decisione 81)

## Per te, in 10 righe
- Nuovo motore di sync del client in `app/src/sync/`: coda locale con `mutation_id`, invio prima, lettura per `seq` poi, fotografia per famiglia nuova, pulizia di una famiglia persa (solo con 404), esiti definitivi e transitori distinti.
- Archivio in memoria (Jest) e archivio SQLite per Android (`expo-sqlite ~58.0.13`, decisione 81).
- Nessuna schermata cambia: il web resta online, l'utente non vede ancora differenze.
- **Revisione umana richiesta:** cambiano `app/package.json` e `app/package-lock.json` (dipendenza nuova). Il lockfile è stato aggiornato con npm 11 locale: va riletto.
- `npx expo install` non funziona dal sandbox (403 del proxy): versione fissata a mano, uguale a quella dell'SDK 58.
- Da provare: build APK in CI con `expo-sqlite` e `sqliteStore.ts` su telefono (nessun test lo copre).
- Il guard segnala anche «modello-inatteso: manca orchestratore in 024-agenti.json»: lo scrive lo script di chiusura, non va corretto a mano.
- Ratifiche: nessuna.

## Cosa funziona ora — con la prova
- 21 test di accettazione (Playwright in Node, `app/e2e/acceptance/giro-024-sync.spec.ts`): 21/21.
- Jest 88/88, `tsc` ed `eslint` verdi, Playwright completo 200/200, server `verify` 330 test (revisore).
- Un tocco durante una pagina che fallisce non perde la coda (test `touchDuringPage.test.ts`, sonda del revisore su memoria e SQLite finto).

## Cosa non funziona ancora
- `sqliteStore.ts` non ha test: una mutazione che usa `ops` invece di `opsOn(txn)` non è rilevata. Prova solo su dispositivo.
- Build APK in CI con `expo-sqlite` e `pr_guard` non verificati dal revisore (hook).
- Nessuna schermata legge da `LocalStore`; sessione su Android, intervallo di 60 s, logout con `clear()`: giro successivo.
- Il motore con pagina malformata rifiuta la promessa invece di `retry`; due motori sullo stesso archivio hanno ciascuno il proprio lucchetto; 400/403 in lettura danno `retry` per sempre (oggi il server risponde 404).

## Verdetto del revisore
- **BLOCCANTI:** 1 (coda persa se il tocco avviene durante una transazione fallita) — risolto con mutex `serialize.ts` e `withExclusiveTransactionAsync`; revisione mirata sul nuovo SHA: 0 bloccanti.
- **DUBBI:** 5 sul primo SHA, nessuno corretto; due nuovi sulla mirata (test su `sqliteStore`, commento sul deadlock). Nel rapporto.
- **PERIMETRO:** nessuna aggiunta oltre al piano; server non toccato.
- **CONCORRENZA:** doppio `sync()` coperto; idempotenza di `mutationId` ok con due motori.
- **MUTAZIONI:** provate 4, prese 4 (più 2 sulla correzione, 1 presa: quella su `sqliteStore`).

## Ricerca e critica
Nessuna ricerca. Critica: 5 punti, tutti accolti (esiti, famiglia persa, cascata voci, ordine invio/lettura, chiusura a metà ciclo).

## Proposte al metodo
nessuna

## Prossima fetta
T9 parte 3: cablaggio del motore su Android (sessione, schermate, logout con `clear()`), poi giro `verifica-produzione`.
