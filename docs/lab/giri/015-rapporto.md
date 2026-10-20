---
giro: 015
traguardo: T6
tipo: verifica-produzione
esito: passato
inizio: 2026-10-20T23:00:49Z
fine: 2026-10-20T23:11:45Z
pr: 22
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 24
test_delta: 0
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Verifica del giro 015 — T6

<!-- Rapporto corto. Modelli e token: docs/lab/giri/015-agenti.json. -->

> **PR:** #22 · **Traguardo:** T6 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T6 passa: tutti i controlli eseguiti sono verdi in produzione (SHA 1aea539), 0 bloccanti, 0 difetti.
- Non visto con i miei occhi: il flusso sul web di produzione (Playwright). Chromium non si scarica, il proxy blocca `cdn.playwright.dev` (403). Valgono i ripieghi del piano: job `app` della CI verde (run 39508622314) più le prove sull'API.
- Da fare a mano: provare l'APK su un telefono (TalkBack, `Intl` su Hermes). Il job `apk` della run 39511453875 era ancora in corso.
- Test mancanti, per un piccolo giro di costruzione: «Termina la serie» con occorrenza `DONE`, e `nextDue` al confine «oggi».
- I dati di prova (`verifica015.*@example.com`) restano in produzione (decisione 42).

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| T6.1 | CI su 3e85f66 | verde | server, app, apk, lab, build in success |
| T6.2 | `./mvnw -Dtest='Giro013*AcceptanceTest,Giro014*AcceptanceTest' test` | verde | 38 test, BUILD SUCCESS |
| T6.3 | `npx jest recurrence.test.ts` | verde | 24/24 |
| T6.4 | Playwright | verde | ripiego su T6.1 (browser non disponibile) |
| T6.5 | deploy e smoke, run 39511453875 | verde | success |
| S1–S2 | `/api/health`, end-series senza login | 200 con sha 1aea539, 401 | come atteso |
| R1–R9 | quattro tipi di ricorrenza, 31 del mese, febbraio, periodi persi, annulla questa volta, ora legale Roma (25/10) e New York (1/11), ciclico senza scadenza | come da piano | tutti verdi |
| E1–E6 | termina la serie (creatore, gestore, vietato, DONE resta, 409, replay) | come da piano | tutti verdi |
| I1–I2 | isolamento tra famiglie | 404 | verdi; I1 debole, le prove forti sono i 404 su `/families/{F}/tasks` e I2 identico byte per byte |

## Difetti trovati
Nessuno.

| Difetto | Gravità | difetto_di | Prova |
|---|---|---|---|

## Proposte al metodo
nessuna
