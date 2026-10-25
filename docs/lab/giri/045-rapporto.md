---
giro: 045
traguardo: T12
tipo: verifica-produzione
esito: passato
inizio: 2026-10-25T08:18:05Z
fine: 2026-10-25T08:40:00Z
pr: 69
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
test_totali: 15
test_delta: 0
decisioni_registro: 0
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Verifica del giro 045 — T12

<!-- Rapporto corto. Modelli e token: docs/lab/giri/045-agenti.json. -->

> **PR:** #69 · **Traguardo:** T12 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T12 è verificato in produzione su `0c943dc`: kit, galleria, login e test sui colori sono verdi; nessun difetto.
- La galleria non è raggiungibile in produzione (rinvio a `/`, nessun testo nell'HTML).
- Il login in produzione (it/en, 390 e 1280) ha etichette, bottone da 56px, nessun overflow e una sola richiesta sul tentativo sbagliato.
- Da te: la prova a fontScale 2.0 sul telefono Android e l'installazione dell'APK (F1), che la catena non può fare.
- Scritture in produzione: un solo login sbagliato con email inventata `verifica045.*@example.com`; nessun account creato.

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| V1 | CI del run 40172884784, file in `0c943dc` | job verdi, 7 file | verde |
| V2 | `npm test`, `tsc`, `eslint` su `0c943dc` + mutazione a mano | tutto verde; colore letterale → rosso | 24 suite, 130 test verdi; la mutazione è presa |
| V3 | `playwright test giro-044-kit.spec.ts` | 17/17, 4 screenshot | verde (Chromium 1243 locale) |
| V4 | job `deploy` | success | success |
| V5 | artefatto APK `planforhome-0.1.0-0c943dc` | presente, firmato | 39.167.492 byte, valido fino al 2027-01-23 |
| S1 | `/api/health` all'inizio e alla fine | sha `0c943dc` | 200, sha corretto |
| S2 | `/gallery` e `/gallery?fs=2` | rinvio a `/`, 0 testi | verde |
| L1–L5 | `/login` it/en, 390/1280, `?fs=2`, un login sbagliato | etichette, 56px, alert, una POST, no overflow | verde |
| F1 | fontScale 2.0 su telefono | prova umana | dichiarata, non fatta |

## Difetti trovati
Nessuno.

| Difetto | Gravità (bloccante / maggiore / minore) | difetto_di | Prova (comando) |
|---|---|---|---|

Note del revisore (dubbi): il browser Playwright non si scarica dal proxy (403), usato il Chromium locale; F1 e APK sul telefono sono prove umane; gli screenshot a fs 2 mostrano solo la parte visibile.

## Proposte al metodo
nessuna
