---
giro: 022
traguardo: T8
tipo: verifica-produzione
esito: passato
inizio: 2026-10-21T16:04:01Z
fine: 2026-10-21T16:24:49Z
pr: 32
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 1
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 30
test_delta: 0
decisioni_registro: 0
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Verifica del giro 022 — T8

<!-- Rapporto corto. Modelli e token: docs/lab/giri/022-agenti.json. -->

> **PR:** #32 · **Traguardo:** T8 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T8 (lista della spesa) passa: 30 controlli verdi contro `https://app.planforhome.com` (SHA `24e9f1d`), più 70 test server e 35 Playwright in locale.
- Nessun difetto, nessun bloccante.
- Da te resta la prova dell'APK `planforhome-0.1.0-24e9f1d` su telefono fisico (fuoco dopo «Sposta», TalkBack, `Intl` su Hermes): non è nel verdetto.
- Ho creato in produzione account e liste di prova inventati (`verifica022.*@example.com`), coperti dalla decisione 42.
- Il revisore ha notato che «Apri la lista» sul web è un link, non un pulsante come dice il piano: nessun effetto sul traguardo.

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| T8.1–T8.5 | CI `ci` 39628243749, test 018–021 in locale, job `deploy` e `apk` | verdi | verdi |
| S1–S2 | `/api/health`, lettura senza login | 200 con SHA; 401 | come atteso |
| L1–L5 | aggiungi, spunta, riordina, togli le spuntate | come da piano | come atteso (403 per membro semplice) |
| R1–R3 | togli e rigatura | come da piano | come atteso |
| C1–C3 | spunte, riordini e aggiunte in parallelo | nessuna voce persa, vince l'ultimo | come atteso |
| Y1–Y3 | lista ciclica | passano le voci non spuntate | come atteso |
| I1–I3 | isolamento tra famiglie | 404 identici | come atteso |
| W1–W5 | Playwright sul web di produzione | azioni riuscite | come atteso |

## Difetti trovati
Nessuno.

## Proposte al metodo
nessuna
