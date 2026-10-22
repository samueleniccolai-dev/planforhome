---
giro: 028
traguardo: T9
tipo: verifica-produzione
esito: non-passato
inizio: 2026-10-22T07:21:27Z
fine: 2026-10-22T07:45:58Z
pr: 38
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 5
revisore_dubbi: 5
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 25
test_delta: 0
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti: 028:bloccante, 028:bloccante, 028:bloccante, 028:bloccante, 028:bloccante
proposte_metodo: nessuna
---
# Verifica del giro 028 — T9

> **PR:** #38 · **Traguardo:** T9 — non passato · **Codice:** 0 righe

## Per te, in 5 righe
- Produzione serve `32a0e1b`; CI, deploy e APK (`planforhome-0.1.0-32a0e1b`) verdi; 111 test Jest e 90 Playwright verdi; 16 test di accettazione del server verdi.
- 5 controlli rossi su 25, **tutti per attesi sbagliati del piano**, non per difetti del server: nessun effetto doppio, nessuna perdita di dati, nessuna falla di isolamento.
- T9 resta `in-corso`. Serve un giro 029 di verifica con gli attesi corretti (elenco sotto).
- Da te: provare l'APK su telefono (aereo, spunte e azioni in coda, rete su entro 60 s, «Già preso da …», TalkBack).
- Da decidere: il «Fatto quando» dice «test Jest» sul motore di sync, ma quasi tutti i test girano in Node sotto Playwright (Jest copre il resto). Ratificare lo scostamento o chiedere test Jest.

## Controlli eseguiti
| Controllo | Prova | Atteso | Ottenuto |
|---|---|---|---|
| T9.1–T9.5 | CI #37, test locali, deploy, APK | verdi | verdi |
| S1, S2, P0 | health, 401 senza login, famiglie | ok | ok |
| Q1, Q3 | coda ripetuta | effetto unico | ok (seq 174) |
| Q2 | risposte ripetute | stessa version della prima | tutte version 4 (stato corrente) |
| Q4 | stesso mutationId, corpo diverso | 409 | 200, nessun effetto |
| K1, K2 | lettura per seq | creazioni, modifiche, cancellazioni | ok |
| K3 | pagine con limit=1 | unione = K2 | 5 righe contro 3 (stesso stato finale) |
| J1–J3 | fotografia a chi entra | completa | ok |
| C1 | PUT paralleli A e B | 200 e 409 | 200 e 403 (B è MEMBER) |
| C1bis, C2 | PUT A/A, take paralleli | uno vince | 200/409, 200/409 |
| N1–N3 | modifica non più permessa | 403, poi stato vero | ok |
| I1 | isolamento | 404 identico | ok |
| I2 | inoltro | DELETE per le voci | solo DELETE del task; il client cancella le voci |
| I3 | rimozione dell'ultima famiglia | 404 | 401 (account disattivato, SPEC §5) |

## Difetti trovati
Tutti e 5 sono attesi del piano da correggere; il server si comporta secondo SPEC.

| Difetto | Gravità | difetto_di | Prova |
|---|---|---|---|
| Q4: il corpo non è confrontato nel replay (`TaskService.replay`) | bloccante (regola di verifica) | 028 | PUT con stesso mutationId → 200 |
| K3: le pagine accorpano per entità, righe ripetute | bloccante (regola di verifica) | 028 | `changes?limit=1` + diff |
| C1: B è MEMBER, 403 prima del controllo version | bloccante (regola di verifica) | 028 | due PUT paralleli |
| I2: nessun DELETE per le voci dopo l'inoltro | bloccante (regola di verifica) | 028 | `CH(F,187)` di B |
| I3: 401 invece di 404 | bloccante (regola di verifica) | 028 | `SN(F)` di B |

**Dubbio da seguire (non provato):** alla perdita dell'ultima famiglia il server risponde 401 e il motore del telefono non cancella nulla (test giro-024 «a network error or 401 is not a lost family»): il punto «dopo la perdita di un'appartenenza il DB locale non contiene più dati» potrebbe restare scoperto per l'ultima famiglia. Possibile difetto maggiore di 024/027.

## Proposte al metodo
nessuna.
