---
giro: 009
traguardo: T4
tipo: verifica-produzione
esito: passato
inizio: 2026-10-20T11:55:07Z
fine: 2026-10-20T13:03:51Z
pr: 16
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
test_totali: 28
test_delta: 0
decisioni_registro: 0
decisioni_ratifica: 0
porte_senso_unico: 1
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Verifica del giro 009 — T4

> **PR:** #16 · **Traguardo:** T4 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T4 passa: 28 controlli su 28 verdi in produzione (SHA `b92f3b4`), 0 bloccanti, 0 difetti.
- Hai autorizzato le scritture di prova (decisione 36): restano in produzione 4 account `verifica009.1792500919.*@example.com`, 3 famiglie e 2 task, tutti inventati.
- Da fare da te: provare l'APK `planforhome-0.1.0-b92f3b4` su un telefono fisico (non entra nel verdetto).
- Ambiente: Docker Hub ha risposto 429 (immagine `postgres:18` presa da `mirror.gcr.io`); Playwright usa il Chromium già installato.

## Controlli eseguiti
| Controllo | Prova | Atteso | Ottenuto |
|---|---|---|---|
| T4.1 | CI PR #15 (run 39409556560) | verde | verde |
| T4.2 | test server Giro003/004/006/008 in locale | verdi | 111 test, 0 errori |
| T4.3 | Playwright `giro-007-*`, it-IT ed en-US | verdi | 35 test verdi |
| T4.4 | deploy run 39417679689 | verde | verde |
| B1–N6 | sequenza in produzione (piano 009): famiglie, inviti, persone, ruoli, ultimo gestore, cambio famiglia, rimozione, ritorno in coda, isolamento | come da piano | tutti come attesi; 24 controlli |

Totale 28. Dati di prova: epoch 1792500919; famiglia 009 `01a15961-f69f-7e4f-9e44-efce1934bc93`.

## Difetti trovati
Nessuno.

## Proposte al metodo
nessuna
