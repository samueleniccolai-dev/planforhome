---
giro: 017
traguardo: T7
tipo: verifica-produzione
esito: passato
inizio: 2026-10-21T05:50:55Z
fine: 2026-10-21T06:05:00Z
pr: 24
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 4
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 23
test_delta: 0
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Verifica del giro 017 — T7

<!-- Rapporto corto. Modelli e token: docs/lab/giri/017-agenti.json. -->

> **PR:** #24 · **Traguardo:** T7 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T7 passa: 23 controlli verdi in produzione (SHA bd1b337, `/api/health` uguale a inizio e fine), 0 bloccanti, 0 difetti.
- Playwright sul web di produzione eseguito con il Chromium 1194 già presente (il download di 1248 è bloccato dal proxy, decisione 53): dialogo, avviso prima della conferma, una sola POST `forward`.
- Da fare a mano: APK su telefono (TalkBack, avviso `role="alert"`). Il job `apk` della run 39551400218 era ancora in corso.
- Piano da correggere: la preparazione di P1 (membro che crea un task già assegnato) dà 403 per SPEC §5 P4; il revisore ha creato il task in coda e lo ha assegnato il gestore. Nessun difetto del prodotto.
- Osservazione O1: una serie DATETIME inoltrata da Roma a New York sposta l'ora di 6 ore (07:00Z → 13:00Z, `recurrence.time` 08:00 a New York): è il dubbio 1 del revisore 016, fetta per un giro di costruzione.
- Dati di prova `verifica017.*@example.com` restano in produzione (decisione 42).

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| T7.1 | CI run 39522349983 | verde | job server, app, apk, lab, build `success` |
| T7.2 | `Giro016*AcceptanceTest` su bd1b337 | verde | 19 test verdi |
| T7.3 | `playwright test e2e/acceptance/giro-016-*` | verde | F1–F7, 7 test verdi |
| T7.4 | consegna run 39551400218 | deploy verde | `deploy` success |
| S1–S2 | `/api/health`, chiamata senza token | sha bd1b337; 401 | ok |
| P0–P6 | inoltro gestore/membro, permessi e vietati, chi sta in una famiglia sola | secondo SPEC §5 | ok (P1 con preparazione corretta) |
| R1–R2 | ciclico DATE e DATETIME | regola e serie conservate; stesso istante | ok |
| V1–V3 | validazioni, `not_open`, replay | 400/409/200 idempotente | ok |
| I1–I2 | isolamento tra famiglie | 404 | ok |
| W1–W4 | Playwright su produzione | avviso prima della conferma, una POST | ok |

## Difetti trovati
Nessuno.

## Proposte al metodo
nessuna
