---
giro: 012
traguardo: T5
tipo: verifica-produzione
esito: passato
inizio: 2026-10-20T19:34:21Z
fine: 2026-10-20T19:58:00Z
pr: 19
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
test_totali: 38
test_delta: 0
decisioni_registro: 0
decisioni_ratifica: 0
porte_senso_unico: 1
riparazioni: 0
difetti: 012:maggiore
proposte_metodo: nessuna
---
# Verifica del giro 012 — T5

<!-- Rapporto corto. Modelli e token: docs/lab/giri/012-agenti.json. -->

> **PR:** #19 · **Traguardo:** T5 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T5 passa in produzione (`a3089bd`): 38 controlli verdi, 0 bloccanti. In più 71 test JUnit e 63 Playwright verdi in locale.
- Difetto maggiore (010): `app/app/family.tsx` non ha `ScrollView`; con circa 10 task a 1280x720 «Aggiungi task» esce dallo schermo e non si clicca. Fuori perimetro del piano, ma un utente vero su portatile resta bloccato: fetta di un giro di costruzione.
- Risposta A+ registrata (decisione 42): le scritture di prova valgono anche per i prossimi giri di verifica.
- Da te: provare l'APK `planforhome-0.1.0-a3089bd` su un telefono fisico (login su Android non c'è ancora).
- Revisione umana richiesta dal guard (`modello-inatteso`: in `012-agenti.json` mancano revisore e orchestratore, dovuto alla ripresa dopo la domanda).
- In produzione restano dati finti «Verifica 012»: 3 account, 3 famiglie, 1 risorsa, 16 task (epoch 1792525594).

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| T5.1–T5.4 | CI run 39481042928, test elencati, deploy 39483821490 | verdi | verdi |
| T5.2 | JUnit Giro008/010/011 su `a3089bd` | verde | 71 verdi (primo lancio: 429 di Docker Hub, esterno) |
| T5.3 | `expo export` + Playwright giro-010/011, it-IT e en-US | verde | 63/63 |
| S1–S2 | `/api/health`, 401, 200 | sha `a3089bd` | ok, anche a fine giro |
| P1–P9 | 18 casi API | permesso/vietato | 18/18 |
| I1–I3, M1–M4 | isolamento, `mutation_id`, `version` | come piano | ok; M4 `version:7` |
| Q1 | 5 task, `take` paralleli A/B | un 200 e un 409 | ok su 5/5, sovrapposizione reale |
| W1–W4 | Playwright su produzione, fuso Tokyo | come piano | ok; W1 solo con viewport alto |

Browser: `playwright install` bloccato dal proxy (403); usato il Chromium già presente in `/opt/pw-browsers`.

## Difetti trovati
| Difetto | Gravità | difetto_di | Prova (comando) |
|---|---|---|---|
| `/family` senza scroll: «Aggiungi task» irraggiungibile con molti task | maggiore | 010 | Playwright su produzione, viewport 1280x720, `/family?id=<F>` con 10 task, clic su «Aggiungi task»: timeout |

## Proposte al metodo
nessuna
