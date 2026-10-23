---
giro: 040
traguardo: caccia
tipo: caccia
esito: chiusa
inizio: 2026-10-23T20:53:03Z
fine: 2026-10-23T21:12:00Z
pr: 56
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 1
revisore_dubbi: 5
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 601
test_delta: 0
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti: 040:bloccante, 040:maggiore, 040:minore, 040:minore, 040:minore
proposte_metodo: nessuna
---
# Verifica del giro 040 — caccia

> **PR:** #56 · **Traguardo:** caccia — chiusa · **Codice:** 0 righe

## Per te, in 5 righe
- La caccia sul codice di `main` (da3d019) ha trovato **1 bloccante**: il replay di `POST …/tasks` con la stessa `mutationId`, dopo che il task è stato inoltrato in un'altra famiglia, restituisce il task (titolo e note) a chi non è membro di quella famiglia. Difetto del giro 016.
- Maggiore: i token FCM restano in `device` dopo il logout (SPEC §9). Il `032:maggiore` (`deletePending`) è già noto.
- Minori: PUT parziale che azzera i campi, registrazione device ferma se il token non risolve, `error:network` che sovrascrive una riga già inviata.
- Il bloccante non si corregge qui (0 righe di codice): è la fetta di un giro di costruzione. La PR va in revisione umana.
- Nulla da provare sul telefono.

## Controlli eseguiti
| Controllo | Comando o prova | Atteso | Ottenuto |
|---|---|---|---|
| Verde di partenza | `./mvnw -B -ntp verify`; jest, tsc, eslint | verde | 420 test server, 114 jest, tipi e lint puliti |
| Permessi P1–P18 | sonde esplorative locali | 403/409 attesi | ok (P16–P18 senza etichetta nei test) |
| Isolamento | sonde su id, corpo, sync | nessuna fuga | **replay dopo inoltro: fuga** |
| Concorrenza | 7 sonde | un solo vincitore | ok, salvo `032:maggiore` |
| Ora legale | serie 2032 | ora locale costante | ok |
| Mutazioni | M1, M2, M3 | prese | 3 su 3 |

## Difetti trovati
| Difetto | Gravità | difetto_di | Prova (comando) |
|---|---|---|---|
| 040:bloccante replay create dopo inoltro (`TaskService.java:170-174`, `:663-671`) | bloccante | 016 | `Hunt040ProbeTest#h1_createReplayAfterForwardLeaksTaskOfForeignFamily` (sonda locale, non committata) |
| 040:maggiore token FCM dopo logout | maggiore | 031 | sonda `h6` |
| 040:minore PUT parziale azzera note, criticità e scadenza | minore | 011 | sonda `h7` |
| 040:minore registrazione device ferma se il token non risolve | minore | 033 | sonda jest `hunt040` |
| 040:minore `error:network` sovrascrive una riga inviata | minore | 032 | lettura di `PushService.java` |

Correzione proposta del bloccante: nel replay di `task.create`, se il task non sta più in `familyId`, rispondere come `replayForward`; aggiungere il caso al test di isolamento.

## Proposte al metodo
nessuna
