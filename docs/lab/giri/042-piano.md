---
giro: 042
traguardo: T11
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-24T21:20:03Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 042 — bonifica dei tre minori della caccia 040

## Fetta e traguardo
T11 intero (UI-0): tre difetti minori della caccia 040, piccoli e indipendenti; stanno in una
sessione. Primo giro dell'esperimento 3: si parte da una base pulita prima di toccare le schermate.
Fonti: SPEC §5 (permessi), §7 (sync e scritture), §8 (promemoria); `040-rapporto.md` righe 54-56;
semantica del PUT decisa in fase 0 (`docs/lab/fase0-decisioni-esp3.md`, n. 10).

Dove atterra:
- (1) `server/.../task/TaskController.java` (`PUT /api/families/{familyId}/tasks/{taskId}`) e
  `TaskService.update` / record `Edit`: oggi un campo assente vale `null` e azzera note e
  scadenza; la criticità assente diventa `NORMAL`.
- (2) `app/src/push/registration.ts`: se `getDevicePushTokenAsync()` non si risolve mai, la coda
  `tail` resta ferma e nessuna registrazione successiva parte (né il prossimo `ensure()`, né il
  token ruotato dal listener).
- (3) `server/.../push/PushService.sendReminder`: il `catch` finale chiama
  `settleReminder(rowId, attempt, "error:network")` anche quando la riga è già stata saldata con
  l'identificativo del messaggio FCM.

## Semantica decisa per il PUT (difetto 1)
| Campo nel corpo | Assente | `null` esplicito | Valore |
|---|---|---|---|
| `title` | conserva | 400 `title_invalid` | come oggi |
| `notes` | conserva | azzera (`null`) | come oggi |
| `dueKind` + `due` (coppia) | conserva entrambi | entrambi `null`: senza scadenza; su un task ricorrente 400 `recurrence_needs_due` (come oggi) | come oggi |
| `criticality` | conserva | torna a `NORMAL` (il valore di base) | come oggi |
| `version` | nessun controllo | nessun controllo | come oggi |

Solo uno dei due tra `dueKind` e `due` presente: 400 `due_invalid` (il codice che `dueAt` usa già). Presenza dei campi letta senza
dipendenze nuove (per esempio corpo come `JsonNode` di Jackson, già nel progetto, oppure un
indicatore di presenza nel record). Il replay della stessa `mutationId` resta idempotente.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro042*AcceptanceTest' test` → verde (casi A1-A7 sotto).
- [ ] `cd app && npx playwright test e2e/acceptance/giro-042-*` → verde (casi B1-B3).
- [ ] Test Jest del costruttore in `app/src/push/__tests__/registration.test.ts` per B1-B3, con
      orologio finto (`jest.useFakeTimers`) → `cd app && npm test` verde.
- [ ] Test del costruttore su `PushService` (riga già saldata non sovrascritta) → nel verify.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (tutti i test esistenti, isolamento compreso).
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi.
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Dati demo (inventati)
- Famiglia **Bruni** (fuso `Europe/Rome`): **Lia Bruni** `lia.bruni@demo.planforhome.test`
  (gestore), **Tommaso Bruni** `tommaso.bruni@demo.planforhome.test` (membro).
- Famiglia **Ferraro** (fuso `Europe/Rome`): **Ugo Ferraro** `ugo.ferraro@demo.planforhome.test`
  (gestore), non membro dei Bruni.
- Password demo di tutti: `Giro042-demo!`.
- Task dei Bruni creato da Lia: titolo «Pagare la bolletta del gas», note «Codice cliente 4471»,
  criticità `HIGH`, scadenza `DATE` `2026-11-03`.
- Task ricorrente dei Bruni creato da Lia: «Annaffiare il basilico», ogni settimana, scadenza
  `DATE` `2026-11-02`.
- Telefoni di Lia (difetto 3): token `fake-fcm-token-lia-042-a` e `fake-fcm-token-lia-042-b`; il
  falso FCM del giro 031 risponde 200 con `name` `projects/demo/messages/042-a`.
- App (difetto 2): Anna del finto server del giro 026, token `fake-fcm-token-anna-042`.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/src/test/java/com/planforhome/acceptance/Giro042PartialUpdateAcceptanceTest.java` | A1: il task del gas; Lia fa PUT con solo `mutationId` e `title` «Pagare la bolletta della luce» → 200; note «Codice cliente 4471», criticità `HIGH`, scadenza `DATE 2026-11-03` invariate, anche rilette con GET della lista |
| idem | A2: PUT con `notes: null` → note `null`; titolo, criticità e scadenza invariati |
| idem | A3: PUT con `dueKind: null, due: null` → senza scadenza; note e criticità invariate |
| idem | A4: PUT con `criticality: null` → `NORMAL`; il resto invariato. PUT con `title: null` → 400 `title_invalid`, nulla cambia |
| idem | A5: sul basilico, PUT con solo `title` → 200, scadenza e ricorrenza conservate; PUT con `dueKind: null, due: null` → 400 `recurrence_needs_due` |
| idem | A6: replay dello stesso PUT parziale (stessa `mutationId`) → stessa risposta, `version` incrementata una volta sola |
| idem | A7 (isolamento parametrico): Ugo fa PUT parziale sul task dei Bruni con l'`id` nell'URL della famiglia Bruni e con l'URL della propria famiglia → 404 in entrambi; il task non cambia |
| `server/src/test/java/com/planforhome/acceptance/Giro042ReminderNetworkErrorAcceptanceTest.java` | A8: Lia ha due telefoni, il task del gas con promemoria dovuto; il primo invio riesce, poi un errore inatteso sul secondo token (`PushRepository.saveAutoReminder` che lancia, con `@MockitoSpyBean`: unica deroga alla scatola chiusa, perché `FcmClient.send` non lancia mai) → GET `/reminders` mostra la riga con `result` `projects/demo/messages/042-a` e `sentAt` valorizzato, non `error:network` |
| idem | A9: errore prima di ogni saldo (`tokensOf` che lancia) → la riga resta saldata `error:network` come oggi (non regressione: la riga non resta `sending`) |
| `app/e2e/acceptance/giro-042-push-registration.spec.ts` (Node, senza pagina, come il 038) | B1: `getDevicePushTokenAsync` non si risolve mai alla prima chiamata e restituisce il token alla seconda; due `ensure()` (due avvii) senza attendere il primo → entro 3 s un POST `/api/me/devices` con `fake-fcm-token-anna-042` (opzione `tokenTimeoutMs: 200`) |
| idem | B2: la prima chiamata resta appesa; il listener `addPushTokenListener` consegna il token → entro 3 s il POST parte |
| idem | B3: la prima chiamata rifiuta (errore); al secondo `ensure()` il POST parte una volta sola (non regressione, può essere già verde) |

Il costruttore aggiunge a `createPushRegistration` l'opzione `tokenTimeoutMs` (predefinita 10 000
ms): oltre quel tempo la chiamata del token è abbandonata, la coda procede e il prossimo
`ensure()` ritenta. `push.native.ts` non la passa.

## Fuori perimetro
- Il bloccante e il maggiore della caccia 040 (già corretti fuori catena, PR #64) e il
  `032:maggiore` (`deletePending`).
- Un form di modifica del task nell'app: oggi l'app non chiama il PUT del task; nessun cambio lato
  app per il difetto 1.
- Cambiare il ricalcolo dei promemoria dopo un PUT, oltre a ciò che serve a non perdere la scadenza.
- Ogni ritocco di interfaccia (T12-T19, `docs/DESIGN.md`).
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni»; set di icone
  come dipendenza; accesso con Google o Apple, iPhone, Play Store; verifica email e recupero
  password; sync in tempo reale e offline sul web; dati reali.

## Porte
- Doppio senso previste: semantica del PUT (decisa in fase 0, n. 10; nessun client la usa oggi in
  altro modo); opzione `tokenTimeoutMs` interna; condizione di saldo in `PushService`.
- Senso unico: nessuna. Nessuna dipendenza nuova (Jackson e Mockito già presenti tramite gli
  starter), nessuna migrazione, nessun percorso protetto.

## Rischi di concorrenza
- PUT parziale contro scrittura concorrente: il task è letto sotto `lockTask` (lock di riga) e i
  campi omessi si prendono da quella riga, nella stessa transazione: nessun valore vecchio scritto
  sopra uno nuovo. `version` facoltativa resta il controllo ottimistico.
- Replay della `mutationId`: la validazione dei campi presenti va fatta come oggi prima del
  replay; i campi omessi non vanno validati (nessun 400 spurio sul replay). Provato da A6.
- Registrazione: un solo `run` alla volta resta garantito dalla coda; il `run` abbandonato per
  timeout non deve fare un POST tardivo con credenziali di un'altra sessione (il costruttore
  ignora l'esito del token arrivato dopo il timeout).
- Promemoria: il saldo della prima riga è già committato quando il secondo token fallisce; il
  `catch` salda solo se nessuna riga è stata ancora saldata.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`) ≤ 120; file ≤ 6 di produzione;
deve stare in una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna: correzioni interne, nulla che una persona veda o faccia di diverso.

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Un form «Modifica task» nell'app che usi il PUT parziale (solo i campi cambiati).
