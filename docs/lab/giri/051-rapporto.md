---
giro: 051
traguardo: T14
tipo: verifica-produzione
esito: passato
inizio: 2026-10-25T22:44:36Z
fine: 2026-10-25T23:07:00Z
pr: 75
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 5
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 27
test_delta: 0
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Verifica del giro 051 — T14

> **PR:** #75 · **Traguardo:** T14 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T14 (form e sheet, inoltro con conseguenza scritta, conferme) verificato in produzione sullo SHA `9c6e826`: tutto verde, 0 difetti.
- CI delle PR #73 e #74, deploy e APK (39188967 byte, firmato) verdi; 198 test Jest, 41 Playwright locali verdi.
- 3 mutazioni su 3 prese.
- Da te, sul telefono (F1): griglia data, tasto Indietro di Sheet e ConfirmDialog, `accessibilityHint` con TalkBack, fontScale 2.0.
- Dubbio: `jest ForwardDialog` da solo non prova la descrizione accessibile della conferma; la copre `ConfirmDialog.test` e Playwright.

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| V1 | CI run 40225726160, 40237562473 | verdi | verdi |
| V2 | `TZ=Europe/Rome npm test`, tsc, eslint, grep stili | verdi | 35 suite, 198 test verdi |
| V3 | export web + Playwright 049/050 | verdi | 41 su 41 |
| V4–V5 | run consegna 40241289934: deploy, apk | success | success, artefatto valido |
| S1–S2 | `/api/health`, `/gallery` | sha 9c6e826, galleria spenta | ok |
| N1–N10, I1–I3, I5, C1–C3 | prova in produzione, 390×844 e 1280×800 | verdi | verdi |
| X1 | isolamento tra famiglie, API e UI | 404 / non visibile | ok |
| F1 | prova su telefono | — | all'umano |

Atteso del piano corretto: N8(a) (regola settimanale senza giorno) e P0 (risorsa senza referente → 400): errori del piano, non difetti.

## Difetti trovati
Nessuno.

## Proposte al metodo
nessuna
