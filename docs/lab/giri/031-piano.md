---
giro: 031
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: ricerca
inizio: 2026-10-22T21:42:30Z
ricerca: sì
accettazione:
ripreso: no
---
# Piano del giro 031 — sollecito (P12) con invio FCM HTTP v1 e segno «sollecitato» sul web

## Fetta e traguardo
T10, prima fetta di tre: il **sollecito** di un gestore, end-to-end sul server (registrazione del
token del dispositivo, invio FCM HTTP v1, esito in `reminder.result`, token rifiutato cancellato) e
il segno «sollecitato» con l'ora sul web. Adesso perché il runbook FCM è eseguito (segreto
`FCM_SERVICE_ACCOUNT_JSON` già passato al server come `FCM_SERVICE_ACCOUNT_BASE64`).
Il client FCM si scrive con il solo JDK (firma RS256 con `java.security`, `java.net.http`, Jackson
già presente): **nessuna dipendenza nuova**, `server/pom.xml` e `app/package.json` non si toccano.
Fonti: SPEC §2.2.9, §5 (P12), §8.

**Cosa resta di T10 dopo questo giro:**
1. Giro 032 — promemoria automatici: calcolo (anticipo `DATETIME`, 9:00 e 18:00 per `DATE`),
   silenzio notturno 22–7 con slittamento alle 7:00 o alle 21:45 della sera prima, ora legale,
   ricalcolo su scadenza/anticipo/assegnatario/famiglia/stato, task in coda scaduto ai gestori,
   lavoro periodico di invio. Usa lo stesso client FCM e la stessa tabella `reminder`.
2. Giro 033 — Android: permesso notifiche, token FCM e `POST /api/me/devices`, apertura del task dal
   tocco. Porte a senso unico attese: `expo-notifications` (plugin di Expo) e `google-services.json`
   nella build. Quel giro si aprirà con una DOMANDA.
3. Giro `verifica-produzione`: notifica a un dispositivo di prova e `reminder.result` con il `name`
   restituito da FCM.

## Dati della demo (inventati, da Appendice A; nessuno nuovo)
- Famiglia Principale (fuso `Europe/Rome`): Marco e Giulia gestori; Leo risorsa senza account,
  referente Giulia.
- Famiglia Mamma: Anna gestore; Luca e Paolo membri.
- Lingue: Giulia `it`; per la prova della lingua i test registrano un utente nuovo con locale `en`
  ed email inventata `kate.test@example.invalid`, aggiunto a Principale con un codice d'invito.
- Token dei dispositivi (stringhe inventate): `tok-giulia-1`, `tok-paolo-1`, `tok-kate-1`,
  `tok-dead-1`.
- Task creati dai test via API: «Comprare il pane» (Principale, assegnato a Giulia), «Zaino di Leo»
  (Principale, assegnato a Leo), «Lavare l'auto» (Principale, in coda), «Spesa per Anna» (Mamma,
  assegnato a Paolo).

## Contratto (lo usano i test; il costruttore non lo cambia)
- `POST /api/me/devices` `{ "token": "...", "platform": "ANDROID" }` → `204`. Stesso token di
  nuovo: nessuna riga doppia. Stesso token da un'altra persona: passa all'ultima (telefono che
  cambia utente). Token vuoto o più lungo di 4096 caratteri → `400`.
- `POST /api/families/{familyId}/tasks/{taskId}/nudge` `{ "mutationId": "<uuidv7>" }` → `200` con la
  vista del task, che ha un campo nuovo `lastNudgedAt` (ISO-8601 UTC, `null` se mai sollecitato,
  presente in tutte le viste del task e nella sincronizzazione).
  - membro → `403 forbidden`; task di un'altra famiglia o famiglia non propria → `404 not_found`;
  - task in coda → `409 not_assigned`; task `DONE` o `CANCELLED` → `409 not_open`;
  - secondo sollecito sullo stesso task entro 5 minuti (orologio iniettato) → `429 nudge_too_soon`
    con `Retry-After` in secondi; a 5 minuti esatti è permesso;
  - stesso `mutationId` ripetuto → stessa risposta `200`, nessun secondo invio, nessun `429`.
- Destinatario: l'assegnatario se ha un account; per una risorsa senza account, il referente.
  Tutti i token del destinatario.
- Messaggio FCM (`POST {base-url}/v1/projects/{project_id}/messages:send`, `Authorization: Bearer`):
  `message.token`, `message.data = { "taskId": "<uuid>" }` (solo questa chiave),
  `message.notification = { title, body }` generici nella lingua del destinatario
  (`it`: «planforhome» / «Hai un promemoria»; `en`: «planforhome» / «You have a reminder»),
  `message.android.priority = "high"`. Mai titolo, note o nomi del task.
- Token d'accesso: JWT RS256 dell'account di servizio (`iss` = `client_email`, `scope`
  `https://www.googleapis.com/auth/firebase.messaging`, `aud` = `token_uri`, durata ≤ 1 h) scambiato
  a `token_uri` (`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`); tenuto in memoria fino a
  1 minuto prima della scadenza. Mai nei log.
- Proprietà: `planforhome.fcm.service-account-base64=${FCM_SERVICE_ACCOUNT_BASE64:}` (vuota = push
  spente) e `planforhome.fcm.base-url=https://fcm.googleapis.com`. `project_id` e `token_uri`
  dal JSON dell'account di servizio.
- Tabella `reminder` (migrazione `V6__reminders_devices.sql`, solo aggiunte): una riga per
  destinatario e invio, `kind` tra `BEFORE`, `DUE`, `QUEUE_OVERDUE`, `NUDGE` (i primi tre per il giro
  032), `result` = `name` restituito da FCM (`projects/.../messages/...`), oppure `no_device`,
  `push_disabled`, `token_rejected`, `error:<codice HTTP>`. Tabella `device_token`
  (`token` univoco, `person_id`, `platform`, istanti `timestamptz`).
- Esiti FCM: `404 UNREGISTERED` o `400 INVALID_ARGUMENT` sul token → il token si cancella; `5xx` o
  rete → `error:<codice>`, il token resta, il sollecito resta valido (nessun ritentativo in questo
  giro). L'invio avviene dopo il commit della transazione del sollecito.
- Evento `NUDGED` in `task_event` (tipo già ammesso da V3), `version` del task +1 e riga in
  `change_log`, così il segno arriva agli altri client con la sincronizzazione.
- Web: nella riga del task, per un gestore, pulsante con etichetta «Sollecita» / «Nudge» (chiave di
  traduzione) solo su task aperti e assegnati; il segno è un testo con etichetta accessibile
  «Sollecitato alle HH:MM» / «Nudged at HH:MM», ora nel fuso della famiglia. Il pulsante resta
  visibile anche se l'ultimo sollecito è recente: decide il server, il `429` si mostra come
  messaggio «Sollecito già inviato da poco» / «Already nudged recently».

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro031*AcceptanceTest' test` → tutti verdi. I test usano un
      **FCM finto** (server HTTP del JDK, `com.sun.net.httpserver`, porta casuale) che fa anche da
      `token_uri`, e una chiave RSA generata nel test, passati con `@DynamicPropertySource`:
  - [ ] P12 permesso: Marco sollecita «Comprare il pane» → `200`, `lastNudgedAt` = ora
        dell'orologio; l'FCM finto riceve 1 messaggio per `tok-giulia-1` con `Bearer` ottenuto dal
        finto `token_uri`, `data` = solo `taskId`, testo «Hai un promemoria»; in `reminder` una riga
        `NUDGE` con `result` = `name` restituito dal finto.
  - [ ] P12 vietato: Luca (membro di Mamma) sollecita «Spesa per Anna» → `403 forbidden`; 0
        messaggi; nessun `NUDGED`.
  - [ ] Task in coda → `409 not_assigned`; task segnato fatto → `409 not_open`.
  - [ ] Secondo sollecito dopo 4 min 59 s → `429 nudge_too_soon` con `Retry-After: 1`; dopo 5 min
        → `200` e secondo messaggio.
  - [ ] Stesso `mutationId` ripetuto → `200`, sempre 1 messaggio, 1 evento `NUDGED`.
  - [ ] Risorsa senza account: «Zaino di Leo» → il messaggio va a `tok-giulia-1` (referente).
  - [ ] Lingua: task assegnato a Kate (`en`) → testo «You have a reminder».
  - [ ] Payload: il corpo inviato non contiene il titolo né le note del task né nomi di persone.
  - [ ] Token rifiutato: il finto risponde `404 UNREGISTERED` per `tok-dead-1` → `result`
        `token_rejected`, riga cancellata da `device_token`; il sollecito successivo (dopo 5 min)
        non invia più a quel token (`result` `no_device` se non ce ne sono altri).
  - [ ] Push spente (proprietà vuota, contesto separato) → sollecito `200`, `result` `push_disabled`.
  - [ ] `POST /api/me/devices`: `204`; ripetuto → 1 riga; lo stesso token registrato da Paolo
        passa a Paolo; token vuoto → `400`; senza sessione → `401`.
  - [ ] Isolamento parametrico (regola 1): Marco sollecita «Spesa per Anna» con l'URL di Mamma e
        con l'URL di Principale → `404` in entrambi; Paolo non vede `lastNudgedAt` né l'evento di
        un task di Principale nella sincronizzazione; nessun messaggio inviato.
  - [ ] Sincronizzazione: dopo il sollecito, `GET` delle modifiche di Giulia contiene il task con
        `version` aumentata e `lastNudgedAt`.
- [ ] `cd app && npx playwright test e2e/acceptance/giro-031-*` → verde: Marco sul web, task
      assegnato a Giulia, pulsante «Sollecita» → compare «Sollecitato alle 09:00» (orologio finto,
      fuso della famiglia); al secondo tocco con risposta `429` compare «Sollecito già inviato da
      poco». API servita da un server finto, come nei giri 024–027.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi (test Jest della
      formattazione dell'ora, anche nel giorno del cambio dell'ora legale, 25/10/2026).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde.
- [ ] `git diff --name-only origin/main` non contiene `server/pom.xml`, `app/package.json`,
      `app/package-lock.json`, `app/app.json`.

## Fuori perimetro
- Promemoria automatici, silenzio notturno, ricalcolo, task in coda scaduto ai gestori, lavoro
  periodico (giro 032).
- Android: `expo-notifications`, permesso, token, `google-services.json`, apertura del task dal
  tocco (giro 033, con DOMANDA). Nessuna push sul web (SPEC §8).
- Cancellazione esplicita dei token al logout, ritentativi su `5xx`, statistiche di consegna.
- Nome della risorsa nel testo della notifica per il referente (§8 «con il nome della risorsa»):
  il payload resta generico; il nome lo mostra l'app. Da decidere nel giro 032.
- Il difetto del PUT parziale (aspetta la decisione dell'umano).
- `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica email e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/src/test/java/com/planforhome/acceptance/Giro031NudgeAcceptanceTest.java` | gestore/membro, coda, fatto, 5 min, `mutationId`, referente, lingua, payload, isolamento, sync |
| `server/src/test/java/com/planforhome/acceptance/Giro031DeviceTokenAcceptanceTest.java` | registrazione, doppio, passaggio di persona, `400`, `401`, token rifiutato cancellato |
| `server/src/test/java/com/planforhome/acceptance/Giro031PushDisabledAcceptanceTest.java` | proprietà vuota → `push_disabled` |
| `server/src/test/java/com/planforhome/acceptance/Giro031FakeFcm.java` | supporto: FCM e `token_uri` finti, chiave RSA del test |
| `app/e2e/acceptance/giro-031-nudge.spec.ts` (+ `giro-031-fake-server.ts`) | pulsante «Sollecita», segno con l'ora, `429` |

## Porte
- Doppio senso previste: migrazione `V6__reminders_devices.sql` (solo tabelle nuove); campo
  `lastNudgedAt` nelle viste; endpoint nuovi; proprietà `planforhome.fcm.*`; client FCM scritto con
  il JDK (si può sostituire con una libreria in futuro); testi i18n nuovi.
- Senso unico: nessuna in questo giro. L'integrazione FCM è già decisa (runbook 030 eseguito); le
  dipendenze FCM non servono. `expo-notifications` e `google-services.json` arrivano nel giro 033
  con una DOMANDA.

## Rischi di concorrenza
- Due gestori sollecitano lo stesso task nello stesso istante: il limite di 5 minuti si controlla
  con il task bloccato (`select … for update` o `version`); un test lancia 2 solleciti in parallelo
  con `mutationId` diversi → esattamente un `200` e un `429`, 1 messaggio.
- Replay dello stesso `mutationId` (rete instabile): risposta salvata, nessun secondo invio.
- Invio fuori dalla transazione: se FCM è lento il sollecito è già registrato; se il commit fallisce
  non parte nulla.
- Token d'accesso in cache condiviso tra thread: rinnovo protetto, al più una richiesta a
  `token_uri` alla volta.
- Lo stesso token registrato da due persone di fila: vincolo di unicità sul token, `upsert`.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`) ≤ 650; file ≤ 18; una sessione.

## Domande per il ricercatore (al massimo 3)
1. FCM HTTP v1 `messages:send`: quali risposte d'errore indicano un token da cancellare
   (`UNREGISTERED` 404, `INVALID_ARGUMENT` 400 e i dettagli `FcmError`) e il formato del `name` di
   risposta. Documentazione ufficiale Firebase.
2. OAuth 2.0 per account di servizio senza libreria Google: claims del JWT (`iss`, `scope`, `aud`,
   `iat`, `exp`), endpoint `token_uri`, durata massima, formato della risposta.
3. Messaggio Android con `notification` + `data` e `android.priority: high`: arriva ad app chiusa
   e il tocco consegna `data.taskId` all'app (per il giro 033)? E come mostrare sul web, in modo
   accessibile, un segno con l'ora (etichetta e lettura dello screen reader).

## Critica ricevuta e cosa cambia
(dopo il critico)
