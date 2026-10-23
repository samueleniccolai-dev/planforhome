---
giro: 039
traguardo: T10
tipo: verifica-produzione
esito: passato
inizio: 2026-10-23T19:45:41Z
fine: 2026-10-23T20:20:00Z
pr: 55
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 20
test_delta: 0
decisioni_registro: 0
decisioni_ratifica: 0
porte_senso_unico: 1
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Verifica del giro 039 — T10

> **PR:** #55 · **Traguardo:** T10 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T10 passa: V1–V6, S1–S2, P0–P6, R1–R3 e F2 verdi su `5751800`.
- La tua prova (Android 14, 15') chiude V6 (finestra del permesso), F2, F3 e F5.
- Il difetto `037:maggiore` (canale a bassa importanza) è risolto sul telefono.
- Nessun difetto nuovo. Nulla da fare per te.
- Dubbio: la run `consegna` 40013172564 ha `headSha` `a3b2232` (antenato), ma artefatto e `/api/health` dicono `5751800`.

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| V1 | `gh run view 40010337327`; `git ls-tree 5751800` | job verdi, file di accettazione | verde (elenco 037 non confrontato riga per riga) |
| V2 | `./mvnw -Dtest='Giro031*…Giro036*AcceptanceTest' test` | verde | 85 test, verde |
| V3 | `npm test`, export web, Playwright 031/033/038 | verde | 114 + 24, verde |
| V4–V5 | run consegna 40013172564 | deploy, apk, apk-firma success | verde; artefatto 39.150.152 byte, non scaduto |
| V6 | commento dell'umano, passo 4 | finestra su Android 14 | comparsa e accettata (passo 2 non fatto; (a) bloccato dal guard) |
| S1–S2 | `curl` da fuori | sha 5751800; 401 senza token | verde |
| P0–P6 | account `revisione039.*` | 200/403/409/429/404 | verde, P5 entro 5 minuti |
| R1–R3 | lettura e cambio scadenza | 2 AUTO + 1 NUDGE; isolamento | verde |
| F2–F5 | commento dell'umano | `projects/…/messages/…`; testo §8; canale alto | verde; JSON senza token |

## Difetti trovati
Nessuno.

## Proposte al metodo
nessuna
