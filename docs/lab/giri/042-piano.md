---
giro: 042
traguardo: T11
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-24T21:20:03Z
ricerca: no
accettazione: e0addad
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

Solo uno dei due tra `dueKind` e `due` presente (anche `dueKind: null` da solo): 400 `due_invalid`
(il codice che `dueAt` usa già). Presenza dei campi letta senza dipendenze nuove: il corpo arriva
come `JsonNode` di Jackson (già nel progetto) e da lì si sa quali campi ci sono. Un corpo con la
sola `mutationId` è valido: conserva tutto (version +1, una riga in `change_log`). Il replay della
stessa `mutationId` resta idempotente.

**Tipo di scadenza effettivo** (critica, n. 1): in `TaskService.update` il `dueKind` usato è quello
del corpo se la coppia c'è, altrimenti quello della riga. Vale in **entrambi** i punti: il calcolo
dell'orario della regola (`withTime`, oggi su `in.dueKind()`) e il `due_kind` scritto da
`tasks.replace` (oggi `dueAt == null ? null : in.dueKind()`). Altrimenti un PUT con il solo titolo
su un ricorrente `DATETIME` scrive `due_kind` nullo con `due_at` pieno e toglie `time` dalla regola.

**Difetto 3** (più semplice, accolto): in `sendReminder` un `boolean settled`, messo a `true` dopo il
`settleReminder` della prima riga; il `catch` salda `error:network` solo se `!settled`.

**Difetto 2, il timeout** (critica, n. 2 e 3): la chiamata del token corre contro un `setTimeout` di
`tokenTimeoutMs`; il timer si cancella sempre (`clearTimeout` nel `finally`), anche quando il token
arriva in tempo o la chiamata rifiuta: nessun timer resta attivo. Il token ruotato dal listener
entra in coda come oggi e aspetta che il `run` appeso scada: nessuno scavalcamento della coda. Il
token che arriva dopo il timeout è ignorato (nessun POST tardivo).

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro042*AcceptanceTest' test` → verde (casi A1-A7 sotto).
- [ ] `cd app && npx playwright test e2e/acceptance/giro-042-*` → verde (casi B1-B3).
- [ ] Test Jest del costruttore in `app/src/push/__tests__/registration.test.ts` per B1-B3, con
      orologio finto (`jest.useFakeTimers`), più: dopo un token arrivato in tempo e dopo un rifiuto
      `jest.getTimerCount()` è 0 (il timer è cancellato) → `cd app && npm test` verde.
- [ ] Test del costruttore su `PushService` (riga già saldata non sovrascritta) → nel verify.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (tutti i test esistenti, isolamento compreso).
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi.
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Dati demo (inventati)
- Famiglia **Bruni** (fuso `Europe/Rome`): **Lia** (gestore), **Tommaso** (membro).
- Famiglia **Ferraro** (fuso `Europe/Rome`): **Ugo** (gestore), non membro dei Bruni.
- Account: ogni test registra i propri, con indirizzi unici del supporto dei giri 006-008
  (`g008-<nome>-<uuid>@example.com`) e le credenziali di prova già nel supporto.
- Task dei Bruni creato da Lia, in coda: «Pagare la bolletta del gas», note «Codice cliente 4471»,
  criticità `HIGH`, scadenza `DATE` `2026-11-03`.
- Ricorrente `DATE` dei Bruni: «Annaffiare il basilico», ogni lunedì, scadenza `DATE` `2026-11-02`.
- Ricorrente `DATETIME` dei Bruni (critica, n. 1): «Ritirare i bambini», ogni lunedì alle 18:00
  `Europe/Rome` (prima scadenza `2026-11-02T17:00:00Z`), assegnato a Lia.
- Telefoni di Lia (difetto 3), su due sessioni: `tok-lia-042-a-<8 hex>` e `tok-lia-042-b-<8 hex>`
  (il falso FCM del giro 031 risponde 200 con `name` `projects/planforhome-test/messages/…`).
  Promemoria: il gas `DATETIME` alle 15:00 di Roma del 10 febbraio di un anno ≥ 2099, quindi righe
  alle 14:00 e alle 15:00.
- App (difetto 2): Anna del finto server del giro 026, `fake-fcm-token-anna-042`; quello tardivo
  `fake-fcm-token-anna-042-late` non deve mai essere registrato.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/src/test/java/com/planforhome/acceptance/Giro042PartialUpdateAcceptanceTest.java` | A1: il task del gas; Lia fa PUT con solo `mutationId` e `title` «Pagare la bolletta della luce» → 200; note «Codice cliente 4471», criticità `HIGH`, scadenza `DATE 2026-11-03` invariate, anche rilette con GET della lista; `version` 2 e due righe in `change_log` |
| idem | A1 sync (critica): Tommaso fa il pull `GET /api/sync/families/{f}/changes?after=<seq di prima>` → la riga `UPSERT` del task porta il titolo nuovo, note, criticità, `dueKind` `DATE` e `dueAt` conservati, `version` 2 |
| idem | A2: PUT con `notes: null` → note `null`; titolo, criticità e scadenza invariati |
| idem | A3: PUT con `dueKind: null, due: null` → senza scadenza; note e criticità invariate |
| idem | A4: PUT con `criticality: null` → `NORMAL`; il resto invariato. PUT con `title: null` → 400 `title_invalid`, nulla cambia |
| idem | A3 bis: solo `due`, solo `dueKind`, oppure `dueKind: null` da solo → 400 `due_invalid`, nulla cambia |
| idem | A5: sul basilico, PUT con solo `title` → 200, scadenza e ricorrenza conservate; PUT con `dueKind: null, due: null` → 400 `recurrence_needs_due` |
| idem | A5 bis (critica, n. 1): «Ritirare i bambini», PUT con solo `title` → 200, `dueKind` `DATETIME`, scadenza e `recurrence.time` «18:00» conservati; dopo il completamento la nuova occorrenza è alle 18:00 di Roma, con `time` «18:00» |
| idem | A6: replay dello stesso PUT parziale (stessa `mutationId`) → stessa risposta, `version` incrementata una volta sola |
| idem | A7 (isolamento parametrico): Ugo fa PUT parziale (solo titolo, `notes: null`, coppia nulla) sul task dei Bruni con l'`id` nell'URL della famiglia Bruni e con l'URL della propria famiglia → 404 `not_found` in tutti i casi; task, `version` e mutazioni invariati |
| `server/src/test/java/com/planforhome/acceptance/Giro042ReminderNetworkErrorAcceptanceTest.java` | A8: Lia ha due telefoni, il task del gas con promemoria dovuto; il primo invio riesce, poi un errore inatteso sul secondo token (`PushRepository.saveAutoReminder` che lancia, con `@MockitoSpyBean`: unica deroga alla scatola chiusa, perché `FcmClient.send` non lancia mai) → GET `/reminders` mostra una sola riga a quell'istante, con `result` `projects/planforhome-test/messages/…` e `sentAt` valorizzato, non `error:network`; nessuna seconda riga a metà; nessun token nel log |
| idem | A9: errore prima di ogni saldo (`tokensOf` che lancia) → la riga resta saldata `error:network` come oggi (non regressione, già verde: la riga non resta `sending`); nessun token nel log |
| `Giro011EditCancelAcceptanceTest.java`, `Giro013EndSeriesAcceptanceTest.java` (già su `main`) | Adeguati alla nuova semantica nel commit `test(acceptance)`: «la PUT sostituisce tutto» diventa PUT con i `null` espliciti (stessi attesi); il corpo con la sola `mutationId` diventa `title: null` (400 `title_invalid`); sul ricorrente, coppia nulla esplicita (400 `recurrence_needs_due`). Verdi prima e dopo la correzione |
| `app/e2e/acceptance/giro-042-push-registration.spec.ts` (Node, senza pagina, come il 038) | B1: `getDevicePushTokenAsync` non si risolve mai alla prima chiamata e restituisce il token alla seconda; due `ensure()` (due avvii) senza attendere il primo → entro 3 s un POST `/api/me/devices` con `fake-fcm-token-anna-042` (opzione `tokenTimeoutMs: 200`) |
| idem | B1 (seguito): la chiamata appesa si risolve dopo il POST con `fake-fcm-token-anna-042-late` → nessun POST con quel valore |
| idem | B2: con `tokenTimeoutMs: 200` la prima chiamata resta appesa; il listener `addPushTokenListener` consegna il token → il POST parte entro 3 s ma non prima di 100 ms dalla consegna: il token ruotato aspetta il timeout del `run` appeso (nessuno scavalcamento della coda) |
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
  starter), nessuna migrazione. Unico percorso protetto toccato: due test di accettazione già su
  `main`, adeguati dal pianificatore (PR in revisione umana, vedi sotto).

## Revisione umana
Il commit `test(acceptance)` adegua due test di accettazione già su `main` (`Giro011EditCancel…`,
`Giro013EndSeries…`), scritti sulla vecchia semantica che la decisione n. 10 della fase 0 cambia.
Il guard lo segnala e la PR va in revisione umana, come nel giro 013. Porta a doppio senso: tre
corpi di richiesta cambiati, stessi attesi.

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
| Punto | Esito | Perché |
|---|---|---|
| DA CORREGGERE 1: `dueKind` effettivo in `withTime` e nel `due_kind` scritto; ricorrente `DATETIME` «Ritirare i bambini» in A5 | accolto | il PUT con il solo titolo perdeva `time` della regola e scriveva `due_kind` nullo; aggiunto A5 bis |
| DA CORREGGERE 2: B2 con `tokenTimeoutMs: 200`, il token ruotato aspetta il timeout | accolto | B2 misura il ritardo del POST rispetto alla consegna (≥ 100 ms) |
| DA CORREGGERE 3: `clearTimeout` nel `finally` | accolto | scritto nel piano; lo prova il test Jest del costruttore (`jest.getTimerCount()` 0), non Playwright |
| Più semplice: `boolean settled` (difetto 3), `JsonNode` per i campi presenti (difetto 1) | accolti | scritti nella semantica |
| Test: pull di sync con campi conservati e `version` +1 | accolto | A1 sync; nel pull la scadenza si chiama `dueAt` (istante), non `due` |
| Facoltativo A8: seconda riga non a metà, token non nel log | accolto | in A8 e A9 |

Emerso scrivendo i test: tre punti di test già su `main` contraddicevano la nuova semantica;
adeguati (vedi «Revisione umana»). I dati demo cambiano dove il falso FCM e il supporto lo
impongono (prefisso dei token, indirizzi unici, promemoria nel 2099 per non incrociare i job degli
altri contesti). Verifica: con una correzione di prova, poi scartata, i 413 test di accettazione
del server e B1-B3 sono verdi; senza, 10 rossi per asserzione (A1-A6, A8) e B1-B2 rossi.

## Idee per dopo
- Un form «Modifica task» nell'app che usi il PUT parziale (solo i campi cambiati).
