---
giro: 036
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: chiusura
inizio: 2026-10-23T16:03:02Z
ricerca: no
accettazione: e76dc65
ripreso: no
---
# Piano del giro 036 — lettura dei promemoria di un task, per i gestori

## Fetta e traguardo
T10, parte finale di costruzione: `GET /api/families/{familyId}/tasks/{taskId}/reminders`, solo
per i gestori della famiglia dove il task sta ora, con test di isolamento. Serve al giro 037
(`verifica-produzione`) per leggere `reminder.result` da fuori, senza comandi sul server
(decisione 111, opzione B scelta dall'umano sulla PR #49).
Fonti: SPEC §5 (P1, P12), §8 («L'esito di ogni invio si registra in `reminder.result`»), §9;
`traguardi.json` → T10; rapporti 034 e 035; CLAUDE.md regola 1.

Resta di T10 dopo questo giro: il giro 037 `verifica-produzione`.

### Contratto dell'endpoint (deciso qui, porta a doppio senso)
- `GET /api/families/{familyId}/tasks/{taskId}/reminders`, autenticato (bearer o cookie
  `pfh_session`; una GET con cookie non chiede `X-CSRF-Token`, come le altre letture).
- **200** al gestore della famiglia `familyId`, se il task sta ora in quella famiglia: un array
  JSON, ordinato per `dueAt` crescente, poi `sentAt` (null in fondo), poi `id`. Ogni elemento ha
  **esattamente** le chiavi `id`, `kind` (`AUTO` | `NUDGE`), `dueAt`, `sentAt` (ISO-8601 UTC o
  `null`), `result` (il testo così com'è in `reminder.result`: `pending`, `sending`, `no_device`,
  `push_disabled`, `token_rejected`, `stale`, `error:…`, oppure il `name` restituito da FCM).
  Nessun token, nessun destinatario, nessun testo della notifica.
- **403** `forbidden` a un membro (non gestore) della famiglia, anche se è l'assegnatario, purché
  il task esista in quella famiglia.
- **404** se chi chiama non appartiene a `familyId`, se `familyId` o `taskId` non esistono, o se il
  task non sta in `familyId` (anche se chi chiama è gestore della famiglia dove il task sta).
  Mai 403 a chi è fuori famiglia: non si rivela che il task esiste. Ordine dei controlli come il
  sollecito (giro 031): prima famiglia e task (404), poi ruolo (403); un membro con `taskId`
  inesistente riceve 404.
- **401** senza autenticazione.
- Dopo un inoltro, le righe restano del task: le vedono i gestori della famiglia di arrivo; i
  gestori della famiglia di partenza ricevono 404.
- Sola lettura: nessuna riga in `change_log`, nessun cambio di `version`, nessun `mutation_id`.
  I promemoria non entrano nella sincronizzazione (SPEC §7 non li elenca).
- Forma consigliata (più semplice): il ruolo con `FamilyRepository.roleIn` (vuoto: 404); poi
  **una sola istruzione SQL** `from task t left join reminder r on r.task_id = t.id where t.id = ?
  and t.family_id = ?`: 0 righe → 404; una riga con `r.id` nullo → `[]`; poi, se il ruolo non è
  `MANAGER`, 403. Il filtro di famiglia sta nel `where` della query sul task, non solo nel servizio:
  risponde anche al dubbio del 035 sulle query per id senza famiglia, per la parte nuova.
- Nota: il `name` restituito da FCM contiene il `project_id` di Firebase. Non è un segreto (sta
  anche nella configurazione pubblica dell'app), e lo vedono solo i gestori.

## Fatto quando — controlli eseguibili

Dati demo (inventati; i supporti 031/032 li creano già o li creano allo stesso modo):
- **Famiglia Principale** (Europe/Rome): Marco e Giulia gestori, Kate membro (locale `en`),
  Leo risorsa senza account con referente Giulia.
- **Famiglia Babbo** (Europe/Rome): Rosa e Franco gestori, Marco membro.
- Dispositivi registrati sul FCM finto (`Giro031FakeFcm`), con `deviceToken(base)` del supporto
  031 (suffisso casuale): Kate `tok-ok-036-kate-…`, Giulia `tok-dead-036-giulia-…`, Franco
  `tok-ok-036-franco-…`; Marco nessun dispositivo.
- Task in Principale: «Comprare il pane» (assegnato a Kate, senza scadenza); «Pagare la mensa»
  (assegnato a Kate, `DATETIME` il 12/03 dell'anno dopo l'orologio alle 10:00 di Roma, anticipo
  60); «Annaffiare le piante» (assegnato a Giulia, senza scadenza); «Ritirare il pacco» (assegnato
  a Marco, senza scadenza); «Lista della spesa» (in coda, senza scadenza).
- Task in Babbo: «Rinnovare la carta d'identità di Franco» (assegnato a Franco).
- Orologio iniettato, come nei giri 031–035.

| # | Controllo | Atteso |
|---|---|---|
| C1 | Marco sollecita «Comprare il pane»; poi Marco fa la GET | 200; 1 elemento: `kind` `NUDGE`, `sentAt` = istante dell'orologio, `dueAt` = `sentAt`, `result` che inizia con `projects/planforhome-test/messages/` ed è uguale al `name` restituito dal FCM finto |
| C2 | Stessa GET fatta da Giulia (altra gestore) | 200, stesso array di C1 |
| C3 | Stessa GET fatta da Kate (membro, assegnataria) | 403 |
| C4 | GET su «Pagare la mensa» (nessun invio ancora) | 200; 2 elementi `AUTO`, `result` `pending`, `sentAt` `null`, `dueAt` 09:00 e 10:00 di Roma di quel giorno, in quest'ordine |
| C5 | Marco sollecita «Annaffiare le piante» (token `tok-dead-`), Giulia sollecita «Ritirare il pacco» (assegnato a Marco, nessun dispositivo: chi sollecita non è l'assegnatario); GET di Marco su ciascuno | `result` `token_rejected` con `sentAt` valorizzato; `result` `no_device` con `sentAt` `null` |
| C6 | GET su «Lista della spesa» (in coda, senza scadenza) | 200, `[]` |
| C7 | Ogni elemento di C1–C5; Marco sollecita un task assegnato a Leo (referente Giulia) e fa la GET | chiavi esattamente `id`, `kind`, `dueAt`, `sentAt`, `result`; il corpo non contiene `tok-`; il corpo di C1 non contiene il `personId` di Kate; quello del task di Leo non contiene il `personId` di Giulia |
| C7b | Marco porta Giulia da gestore a membro; GET di Giulia su «Comprare il pane» | prima 200, dopo 403 |
| C7c | Kate entra anche in Babbo (membro), poi Giulia la toglie da Principale; GET di Kate su «Comprare il pane» | prima 403, dopo 404 |
| C8 | Isolamento, test parametrico (CLAUDE.md regola 1). Prima Marco sollecita «Comprare il pane» e Rosa sollecita «Rinnovare la carta d'identità di Franco», così ogni famiglia ha una riga da non far trapelare. Casi: Rosa e Franco (gestori Babbo) con `familyId` Principale e task Principale; Rosa con `familyId` Babbo e `taskId` di «Comprare il pane»; Marco (gestore di Principale) con `familyId` Principale e `taskId` del task di Babbo; Marco con `familyId` Babbo e task di Babbo (lì è membro); Marco con `familyId` Babbo e `taskId` casuale; `familyId` o `taskId` casuali | 404, 404, 404, 404, 403, 404, 404, 404; il corpo non contiene l'`id` né il `result` di nessuna riga `reminder` |
| C9 | Senza autenticazione | 401 |
| C10 | Login web di Marco (cookie `pfh_session`), GET con il cookie e senza `X-CSRF-Token` | 200, stesso array di C1 (è il modo dell'umano nel giro 037) |
| C11 | Marco inoltra «Ritirare il pacco» (assegnato a sé) a Babbo; GET di Marco con `familyId` Principale; GET di Rosa con `familyId` Babbo | 404; 200 con la riga `no_device` di C5 |
| C12 | Sola lettura: `version` di «Comprare il pane», la risposta di `GET /api/sync/families/{Principale}/changes?after=0` di Marco e `max(seq)` di `change_log` di Principale, prima e dopo tre GET dei promemoria (200) | uguali |

Comandi:
- [ ] `cd server && ./mvnw -q -Dtest='Giro036*AcceptanceTest' test` → verde (C1–C12).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde, nessun test di accettazione precedente cambiato.
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun percorso
      protetto toccato; nessuna migrazione nuova.

## Fuori perimetro
- Qualunque schermata dell'app: niente lista dei promemoria nell'app, niente Playwright.
- Destinatario, testo o token nella risposta; filtri, paginazione, lettura per i membri.
- Il difetto del 032 (`due_at > now` in `deletePending`) e i dubbi minori del 033.
- Aggiungere il filtro di famiglia a `titleOf`, `nameOf`, `words` (dubbio del 035): solo la query
  nuova filtra; le vecchie restano per un giro futuro.
- Token FCM dopo il logout, PUT parziale, dati locali dopo il 401, Browser key Firebase.
- Il giro 037 (verifica in produzione) e la prova sul telefono dell'umano.
- Migrazioni (l'indice `reminder_task_idx` basta), dipendenze nuove.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica email e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/src/test/java/com/planforhome/acceptance/Giro036ReminderReadAcceptanceTest.java` | C1–C12, C7b, C7c come in tabella; C8 come `@ParameterizedTest` (8 casi); contesto del giro 032 (`Giro032AcceptanceSupport`) |

## Porte
- Doppio senso previste: endpoint nuovo e forma della risposta (si possono aggiungere chiavi
  dopo); scelta di non esporre il destinatario; 404 invece di 403 fuori famiglia (come il resto
  dell'API).
- Senso unico: nessuna. Nessuna dipendenza, nessuna migrazione, nessuna integrazione nuova; i
  `result` non contengono dati personali (sono codici o il `name` del messaggio FCM).

## Rischi di concorrenza
Sola lettura. Una GET durante l'invio del `ReminderJob` può vedere una riga `sending`: è giusto,
è lo stato vero; nessun rischio, il test non dipende da questo. Una GET durante un inoltro: task e
righe si leggono in **una sola istruzione SQL con il filtro di famiglia sul task**
(`t.family_id = ?` nel `where`), quindi o 404 o righe del task nella famiglia giusta, mai righe
senza controllo. Nessun lock: la lettura non deve bloccare il job.

## Budget
Righe di produzione (`server/src/main`) ≤ 90; file di produzione ≤ 3 (controller e servizio nel
package `reminder`, query nel `ReminderRepository`); nessun file dell'app. Una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`: API di sola lettura per la verifica, nessuna schermata cambia).

## Critica ricevuta e cosa cambia
Nessun «DA CORREGGERE». Accolto:
- PIÙ SEMPLICE: una query da `task` con `left join reminder`, `where t.id = ? and t.family_id = ?`
  (0 righe 404, `r.id` nullo `[]`), ruolo con `FamilyRepository.roleIn`: scritto nel contratto
  come forma consigliata.
- CONCORRENZA: detto esplicitamente «una sola istruzione SQL con filtro di famiglia sul task».
- TEST: C7 rafforzato (nessun `personId` di Kate in C1, nessun `personId` di Giulia sul task di
  Leo); token con `deviceToken(base)` invece di letterali; aggiunti C7b (Giulia da gestore a membro
  → 403) e C7c (Kate tolta da Principale → 404; Kate entra prima in Babbo, perché togliere l'ultima
  appartenenza disattiva l'account e darebbe 401); C8 con il sollecito del task di Babbo prima delle
  chiamate; C12 con `max(seq)` di `change_log`.
- FACOLTATIVI: `stale` tra i valori di `result`; ordine 404 prima di 403 come il sollecito (caso
  in più in C8: Marco membro di Babbo con `taskId` casuale → 404); nota sul `project_id` nel
  `name` FCM.
Scartato: niente.

## Idee per dopo
- Una vista «Invii» nel dettaglio del task per i gestori, se servirà nella caccia.
- Filtro di famiglia su `titleOf`/`nameOf`/`words` (dubbio del 035).
