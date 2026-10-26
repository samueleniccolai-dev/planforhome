---
giro: 054
traguardo: T15
tipo: verifica-produzione
esito: passato
inizio: 2026-10-26T05:39:54Z
fine: 2026-10-26T05:55:00Z
pr: 78
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 5
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
# Verifica del giro 054 — T15

> **PR:** #78 · **Traguardo:** T15 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T15 (lingua dell'account sul web, famiglia e profilo dal kit, lista della spesa) verificato in produzione sullo SHA `ec02a80`: tutto verde, 0 difetti.
- CI, deploy e APK (`planforhome-0.1.0-ec02a80`, firmato) verdi; 208 test Jest e 40 Playwright locali verdi; isolamento tra famiglie ok.
- Atteso di P0 sbagliato nel piano (serve `referentPersonId`): corretto, non è un difetto.
- Da te, sul telefono (F1): TalkBack sulla voce tolta e sulla spunta, fontScale 2.0, lingua dell'account nell'app.
- Sulla produzione restano 6 account inventati di prova (`verifica054.*`, `revisione054.*`), coperti dalla decisione 42.

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| V1 | CI run 40250791206, 40272939507 | verdi | verdi |
| V2 | `TZ=Europe/Rome npm test`, tsc, eslint, grep statiche | verdi | 39 suite, 208 test verdi |
| V3 | export web + Playwright 052/053 | verdi | 40 su 40 |
| V4–V5 | run consegna 40274965561: deploy, apk | success | success, artefatto di `ec02a80` |
| S1–S2 | `/api/health`, `/gallery` | sha ec02a80, galleria spenta | ok |
| P0–P1 | preparazione via API | 2xx | 2xx (dopo la correzione del referente) |
| L1–L4 | lingua dell'account, browser `en-US`/`it-IT` | segue l'account | ok |
| K1–K3, D1–D5, Q1 | famiglia, profilo, spesa; 390/1280 px, fs 1 e 2; 16 screenshot | verdi | verdi |
| X1 | isolamento tra famiglie, API e UI | 404 / non visibile | ok |
| F1 | prova su telefono | — | all'umano |

## Difetti trovati
Nessuno.

## Proposte al metodo
nessuna.
