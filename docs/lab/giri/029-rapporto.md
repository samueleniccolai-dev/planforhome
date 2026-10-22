---
giro: 029
traguardo: T9
tipo: verifica-produzione
esito: passato
inizio: 2026-10-22T09:35:43Z
fine: 2026-10-22T09:55:14Z
pr: 40
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
test_totali: 26
test_delta: 0
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti: 029:minore
proposte_metodo: nessuna
---
# Verifica del giro 029 — T9

> **PR:** #40 · **Traguardo:** T9 — passato · **Codice:** 0 righe

## Per te, in 5 righe
- T9 passa: 26 controlli su 26 verdi contro `app.planforhome.com` (serve `1e813c4`), la CI, il deploy e l'APK `planforhome-0.1.0-1e813c4` (38,7 MB).
- Con gli attesi corretti dal giro 028 non c'è nessun bloccante: nessun effetto doppio, nessuna perdita di dati, nessuna falla di isolamento; due scritture in parallelo danno un solo vincitore (200 + 409).
- Test: 16 di accettazione del server, 111 Jest, 90 Playwright (motore di sync in Node, scostamento accettato da te il 22/10).
- Da te: provare l'APK sul telefono (aereo, coda, rete su entro 60 s, «Già preso da …», TalkBack). Non è stato provato e non conta nel verdetto.
- Da decidere: il PUT di un task con solo il titolo cancella la scadenza (dubbio sotto); e dopo il 401 per account disattivato il telefono non cancella i dati.

## Controlli eseguiti
| Controllo | Prova | Atteso | Ottenuto |
|---|---|---|---|
| T9.1 | run CI 39737327267; `git ls-tree 1e813c4` | job verdi, test di accettazione presenti | verde |
| T9.2 | `-Dtest='Giro023*AcceptanceTest'` | 7 metodi chiesti verdi | 16 test verdi |
| T9.3 | `npm test`; `npx playwright test` giro 024–027 | motore di sync provato | 111/111; 90/90 |
| T9.4 | run consegna 39756028912 | `deploy` success | verde |
| T9.5 | job `apk` e `apk-firma` | artefatto con versione e SHA | verde, scade 2027-01-20 |
| S1, S2 | `/api/health`; senza login | sha `1e813c4`; 401 | verde |
| Q1–Q4, K2, K3 | API in produzione | replay = stato corrente; 2xx senza effetto; stesso stato finale | verde |
| J2, J3, N, I1–I3, C1, C2 | API in produzione | accessi, ruoli, isolamento, 401 account disattivato, 409 | verde |

## Difetti trovati
| Difetto | Gravità | difetto_di | Prova |
|---|---|---|---|
| PUT di un task con solo il titolo azzera `dueKind`/`due` (`TaskService.update` ricalcola `dueAt` dal corpo); la SPEC non dice se i campi omessi restano | minore | 013 | Q1 m2: risposta con `due:null` dopo scadenza `2026-11-10` |

## Cosa non funziona ancora
- APK non provato sul telefono (spetta a te).
- Dopo il 401 per ultima famiglia tolta, il telefono non cancella i dati di quella famiglia.
- Il ripiego APK del piano (run 39745985968) aveva il job `apk` `skipped`: non è servito.
- Il revisore ha creato 3 account di prova (`verifica029.*@example.com`, uno disattivato): oltre il limite di 3 registrazioni del piano; dati inventati.

## Proposte al metodo
nessuna
