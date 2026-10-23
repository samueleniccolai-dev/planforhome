---
giro: 036
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-23T16:03:02Z
ricerca: no
accettazione:
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
  `push_disabled`, `token_rejected`, `error:…`, oppure il `name` restituito da FCM).
  Nessun token, nessun destinatario, nessun testo della notifica.
- **403** `forbidden` a un membro (non gestore) della famiglia, anche se è l'assegnatario.
- **404** se chi chiama non appartiene a `familyId`, se `familyId` o `taskId` non esistono, o se il
  task non sta in `familyId` (anche se chi chiama è gestore della famiglia dove il task sta).
  Mai 403 a chi è fuori famiglia: non si rivela che il task esiste.
- **401** senza autenticazione.
- Dopo un inoltro, le righe restano del task: le vedono i gestori della famiglia di arrivo; i
  gestori della famiglia di partenza ricevono 404.
- Sola lettura: nessuna riga in `change_log`, nessun cambio di `version`, nessun `mutation_id`.
  I promemoria non entrano nella sincronizzazione (SPEC §7 non li elenca).
- La query filtra per famiglia nel `where` (join `task.family_id = ?`), non solo nel servizio:
  risponde anche al dubbio del 035 sulle query per id senza famiglia, per la parte nuova.

## Fatto quando — controlli eseguibili

Dati demo (inventati; i supporti 031/032 li creano già o li creano allo stesso modo):
- **Famiglia Principale** (Europe/Rome): Marco e Giulia gestori, Kate membro (locale `en`),
  Leo risorsa senza account con referente Giulia.
- **Famiglia Babbo** (Europe/Rome): Rosa e Franco gestori, Marco membro.
- Dispositivi registrati sul FCM finto (`Giro031FakeFcm`): Kate `tok-ok-036-kate`, Giulia
  `tok-dead-036-giulia`; Marco nessun dispositivo.
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
| C5 | Marco sollecita «Annaffiare le piante» (token `tok-dead-`) e «Ritirare il pacco» (nessun dispositivo); GET su ciascuno | `result` `token_rejected` con `sentAt` valorizzato; `result` `no_device` con `sentAt` `null` |
| C6 | GET su «Lista della spesa» (in coda, senza scadenza) | 200, `[]` |
| C7 | Ogni elemento di C1–C5 | chiavi esattamente `id`, `kind`, `dueAt`, `sentAt`, `result`; il corpo non contiene `tok-` |
| C8 | Isolamento, test parametrico (CLAUDE.md regola 1): Rosa e Franco (gestori Babbo) con `familyId` Principale e task Principale; Rosa con `familyId` Babbo e `taskId` di «Comprare il pane»; Marco (gestore di Principale) con `familyId` Principale e `taskId` del task di Babbo; Marco con `familyId` Babbo e task di Babbo (lì è membro); `familyId` o `taskId` casuali | 404, 404, 404, 403, 404; nessun elemento di un'altra famiglia nel corpo |
| C9 | Senza autenticazione | 401 |
| C10 | Login web di Marco (cookie `pfh_session`), GET con il cookie e senza `X-CSRF-Token` | 200, stesso array di C1 (è il modo dell'umano nel giro 037) |
| C11 | Marco inoltra «Ritirare il pacco» (assegnato a sé) a Babbo; GET di Marco con `familyId` Principale; GET di Rosa con `familyId` Babbo | 404; 200 con la riga `no_device` di C5 |
| C12 | Sola lettura: `version` di «Comprare il pane» e la risposta di `GET /api/sync/families/{Principale}/changes` di Marco prima e dopo tre GET dei promemoria | uguali |

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
| `server/src/test/java/com/planforhome/acceptance/Giro036ReminderReadAcceptanceTest.java` | C1–C12 come in tabella; C8 come `@ParameterizedTest` |

## Porte
- Doppio senso previste: endpoint nuovo e forma della risposta (si possono aggiungere chiavi
  dopo); scelta di non esporre il destinatario; 404 invece di 403 fuori famiglia (come il resto
  dell'API).
- Senso unico: nessuna. Nessuna dipendenza, nessuna migrazione, nessuna integrazione nuova; i
  `result` non contengono dati personali (sono codici o il `name` del messaggio FCM).

## Rischi di concorrenza
Sola lettura. Una GET durante l'invio del `ReminderJob` può vedere una riga `sending`: è giusto,
è lo stato vero; il test non dipende da questo. Una GET durante un inoltro: la query legge il task
e le righe nella stessa istruzione con il filtro di famiglia, quindi o 404 o righe del task nella
famiglia giusta, mai righe senza controllo. Nessun lock: la lettura non deve bloccare il job.

## Budget
Righe di produzione (`server/src/main`) ≤ 90; file di produzione ≤ 3 (controller e servizio nel
package `reminder`, query nel `ReminderRepository`); nessun file dell'app. Una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`: API di sola lettura per la verifica, nessuna schermata cambia).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Una vista «Invii» nel dettaglio del task per i gestori, se servirà nella caccia.
- Filtro di famiglia su `titleOf`/`nameOf`/`words` (dubbio del 035).
