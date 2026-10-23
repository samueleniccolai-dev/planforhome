---
giro: 031
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: chiusura
inizio: 2026-10-22T21:42:30Z
ricerca: sì
accettazione: 6e93446
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
- Famiglia Principale (fuso `Europe/Rome`): Giulia e Marco gestori; Leo risorsa senza account,
  referente Giulia.
- Famiglia Mamma: Anna gestore; Luca e Paolo membri.
- Lingue: tutti `it`; per la prova della lingua i test registrano Kate, locale `en`, email
  inventata `g031-kate-<uuid>@example.com`, aggiunta a Principale con un codice d'invito.
- Token dei dispositivi (stringhe inventate, con un suffisso casuale per test perché il token è
  univoco): `tok-giulia-1`, `tok-paolo-1`, `tok-kate-1`, `tok-dead-1`; per gli esiti di FCM anche
  `tok-badtok-1`, `tok-badreq-1`, `tok-boom-1`, `tok-slow-1`.
- Task creati dai test via API: «Comprare il pane» (Principale, assegnato a Giulia), «Zaino di Leo»
  (Principale, assegnato a Leo, note «Quaderno a quadretti e astuccio blu»), «Lavare l'auto»
  (Principale, in coda), «Spesa per Anna» (Mamma, assegnato a Paolo).
- Account di servizio di prova: `project_id` `planforhome-test`, `client_email`
  `fcm-test@planforhome-test.iam.gserviceaccount.com`, chiave RSA generata dal test a ogni avvio.

## Contratto (lo usano i test; il costruttore non lo cambia)
- `POST /api/me/devices` `{ "token": "...", "platform": "ANDROID" }` → `204`. Tabella `device` di
  SPEC §6 (`id`, `person_id`, `fcm_token` univoco, `platform`, `last_seen_at`), scritta con
  `insert … on conflict (fcm_token) do update` (persona e `last_seen_at` = orologio). Stesso token di
  nuovo: una riga, `last_seen_at` aggiornato. Stesso token da un'altra persona: passa all'ultima.
  Token vuoto o di soli spazi, più lungo di 4096 caratteri (4096 va bene), senza token, o
  `platform` diverso da `ANDROID` → `400 invalid_request`. Senza sessione → `401`.
- `POST /api/families/{familyId}/tasks/{taskId}/nudge` `{ "mutationId": "<uuidv7>" }` → `200` con la
  vista del task, che ha un campo nuovo `lastNudgedAt` (ISO-8601 UTC, `null` se mai sollecitato,
  presente in tutte le viste del task, nella fotografia e nelle modifiche della sincronizzazione).
  `lastNudgedAt` è `max(at)` degli eventi `NUDGED` del task in `task_event`: nessuna colonna nuova.
  Ordine dei controlli: replay del `mutationId`, poi famiglia e task (`404`), ruolo (`403`), stato
  (`409`), 5 minuti (`429`).
  - stesso `mutationId` ripetuto (anche dopo 1 minuto, anche in parallelo) → stessa risposta `200`,
    nessun secondo invio, nessun `429`;
  - task di un'altra famiglia o famiglia non propria → `404 not_found`;
  - membro → `403 forbidden`;
  - task in coda → `409 not_assigned`; task `DONE` o `CANCELLED` → `409 not_open`;
  - secondo sollecito sullo stesso task entro 5 minuti (orologio iniettato) → `429 nudge_too_soon`
    con `Retry-After` in secondi arrotondati per eccesso; a 5 minuti esatti è permesso. Il limite si
    controlla con la riga del task bloccata (l'aggiornamento di `version` basta: nessun lock nuovo).
- Il sollecito è una scrittura come le altre: evento `NUDGED`, `version` +1, riga in `change_log`.
  **Decisione:** un `PUT` successivo con la `version` di prima del sollecito riceve
  `409 version_conflict` con `current` (che ha `lastNudgedAt`), come per ogni altra scrittura; il
  client sa già gestirlo (giri 023–025).
- Destinatario: l'assegnatario se ha un account; per una risorsa senza account, il referente.
  Tutti i token `device` del destinatario.
- Invio: **dopo il commit**, dentro la stessa richiesta, prima della risposta (così `reminder.result`
  è scritto quando arriva il `200`). Timeout `planforhome.fcm.timeout` (predefinito `PT10S`, nei
  test `PT1S`) come `connectTimeout` del client e come timeout di ogni richiesta, sia a FCM sia a
  `token_uri`. Nessun ritentativo.
- Messaggio FCM (`POST {base-url}/v1/projects/{project_id}/messages:send`, `Authorization: Bearer`):
  `message.token`, `message.data = { "taskId": "<uuid>" }` (solo questa chiave),
  `message.notification = { title, body }` generici nella lingua del destinatario
  (`it`: «planforhome» / «Hai un promemoria»; `en`: «planforhome» / «You have a reminder»),
  `message.android.priority = "high"`. Mai titolo, note o nomi.
- Token d'accesso: JWT RS256 dell'account di servizio (`iss` = `client_email`, `scope`
  `https://www.googleapis.com/auth/firebase.messaging`, `aud` = `token_uri`, `iat` dal `Clock`
  iniettato, `exp - iat ≤ 3600`) mandato a `token_uri` in `application/x-www-form-urlencoded`
  (`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`, `assertion`). In memoria fino a
  `expires_in - 60` secondi dall'ottenimento, misurati con il `Clock`; il rinnovo è uno alla volta
  (due solleciti insieme → una sola chiamata a `token_uri`).
- Proprietà: `planforhome.fcm.service-account-base64=${FCM_SERVICE_ACCOUNT_BASE64:}`,
  `planforhome.fcm.base-url=https://fcm.googleapis.com`, `planforhome.fcm.timeout=PT10S`.
  `project_id`, `client_email`, `private_key` e `token_uri` dal JSON dell'account di servizio.
  La chiave PEM si legge togliendo le righe `-----BEGIN/END …-----` con un'espressione regolare:
  la guardia dei segreti rifiuta l'intestazione PEM letterale nel diff, anche nei test.
- Push spente: segreto vuoto → `push_disabled`. Segreto presente ma inutilizzabile (base64 o JSON
  non validi, chiave che non si legge) → il server parte lo stesso, scrive **una volta**
  all'avvio l'avviso fisso `FCM disabled: the service account is not usable` e ogni sollecito è
  `push_disabled`. Nessuna chiamata a FCM né a `token_uri`.
- Log: mai il segreto, la chiave, il JWT, il token d'accesso, i token dei dispositivi, né il
  messaggio originale di un'eccezione o di una risposta di FCM. Si scrivono solo lo stato HTTP e
  l'`errorCode` di FCM (per esempio `FCM send failed: 404 UNREGISTERED`).
- Tabella `reminder` di SPEC §6 (migrazione `V6__reminders_devices.sql`, solo aggiunte): `id`,
  `task_id`, `recipient_person_id`, `kind` tra `AUTO` e `NUDGE` (`AUTO` per il giro 032), `due_at`,
  `sent_at`, `result`. **Una riga per ogni token provato**; una sola riga se non se ne prova
  nessuno. `due_at` = istante del sollecito; `sent_at` = istante del tentativo, `null` per
  `no_device` e `push_disabled`. `result`: il `name` restituito da FCM
  (`projects/.../messages/...`), `no_device`, `push_disabled`, `token_rejected`,
  `error:<codice HTTP>`, `error:timeout`, `error:network`.
- Esiti FCM: `404` con `FcmError` `UNREGISTERED`, oppure `400` con un `BadRequest` la cui
  `fieldViolations[].field` è `message.token` → `token_rejected` e la riga `device` si cancella.
  Ogni altro `400` (per esempio sul payload), `404` senza `UNREGISTERED`, `401`, `403`, `429` e
  `5xx` → `error:<codice>`, il token resta. Timeout → `error:timeout`; rete → `error:network`. In
  ogni caso il sollecito resta valido (`200`).
- Web: nella riga del task, per un gestore, pulsante con etichetta «Sollecita «<titolo>»» /
  «Nudge «<titolo>»» (chiave di traduzione), solo su task aperti e assegnati; il segno è il testo
  visibile «Sollecitato alle HH:MM» / «Nudged at HH:MM» (24 ore), nel fuso della **famiglia**, non
  del browser. Ogni tocco è un `mutationId` nuovo. Il pulsante resta visibile anche dopo un sollecito
  recente: decide il server, il `429` si mostra nell'avviso della sezione (`role="alert"`)
  «Sollecito già inviato da poco» / «Already nudged recently».

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro031*AcceptanceTest' test` → tutti verdi (27 test). FCM e
      `token_uri` finti (`Giro031FakeFcm`, server HTTP del JDK su porta casuale, chiave RSA generata
      nel test), passati con `@DynamicPropertySource`:
  - [ ] P12 permesso: Marco sollecita «Comprare il pane» → `200`, `lastNudgedAt` = orologio,
        `version` +1, 1 riga in `change_log`, 1 `NUDGED`; il finto riceve 1 messaggio per
        `tok-giulia-1` con il `Bearer` del finto `token_uri`, `data` = solo `taskId`, «Hai un
        promemoria», priorità `high`; il JWT supera i controlli del finto (firma RS256, `iss`,
        `scope`, `aud`, `exp - iat ≤ 3600`, `grant_type`, form-urlencoded) e `iat` = orologio; una
        riga `reminder` `NUDGE` con `result` = `name`, `due_at` = `sent_at` = orologio.
  - [ ] P12 vietato: Luca (membro di Mamma) → `403 forbidden`, 0 messaggi, nessun `NUDGED`.
  - [ ] Coda → `409 not_assigned`; fatto o annullato → `409 not_open`.
  - [ ] Dopo 4 min 59 s → `429 nudge_too_soon`, `Retry-After: 1`; a 5 min → `200`, 2° messaggio.
  - [ ] Replay dopo 1 minuto → `200` con la stessa risposta, 1 messaggio; poi un `mutationId` nuovo
        → `429`.
  - [ ] «Zaino di Leo» → messaggio a `tok-giulia-1` (referente); il corpo non contiene titolo,
        note, «Leo», «Giulia», «Marco».
  - [ ] Kate (`en`) → «You have a reminder».
  - [ ] Giulia con `tok-giulia-1` e `tok-dead-1` → 2 messaggi, 2 righe (`name` e
        `token_rejected`), `tok-dead-1` cancellato; dopo 5 min → 1 solo messaggio.
  - [ ] Solo `tok-dead-1` → `token_rejected`; dopo 5 min → `no_device`, `sent_at` nullo.
  - [ ] `400` su `message.token` → `token_rejected`, token cancellato; `400` sul payload →
        `error:400`, token conservato; `503` → `error:503`, token conservato, nessun ritentativo.
  - [ ] FCM lento 5 s, timeout 1 s → `200` in meno di 4 s, `error:timeout`.
  - [ ] Nessun token → `no_device`, `sent_at` nullo.
  - [ ] Cache: due solleciti → 1 chiamata a `token_uri`; a `+3539 s` ancora 1; a `+3540 s` 2.
  - [ ] Concorrenza: due gestori insieme, `mutationId` diversi → un `200` e un `429`, 1 messaggio
        (5 giri); stesso `mutationId` insieme → due `200`, 1 messaggio (5 giri); due task insieme
        → 1 chiamata a `token_uri`.
  - [ ] Dopo il sollecito un `PUT` con la `version` di prima → `409 version_conflict`, `current`
        con `lastNudgedAt`.
  - [ ] Isolamento (regola 1): Marco su «Spesa per Anna» con l'URL di Mamma e di Principale →
        `404`; Anna (gestore di Mamma) su «Comprare il pane» con i due URL → `404`; 0 messaggi.
  - [ ] Sync: Giulia riceve il task con `version` +1 e `lastNudgedAt` nelle modifiche e nella
        fotografia; Paolo: `404` sulle modifiche di Principale, nulla nelle modifiche di Mamma e in
        `GET /api/tasks`.
  - [ ] Log (`OutputCaptureExtension`): nessun token di dispositivo, token d'accesso, JWT, frammento
        della chiave, segreto o messaggio d'errore di FCM.
  - [ ] Dispositivi: `204`, ripetuto → 1 riga con `last_seen_at` nuovo; preso da Paolo → passa a
        Paolo e Giulia risulta `no_device`; vuoto, spazi, 4097 caratteri, `IOS`, senza token →
        `400`; 4096 caratteri → `204`; senza sessione → `401`.
  - [ ] Segreto vuoto → `push_disabled`, 0 chiamate. Segreto con chiave rotta → `push_disabled`,
        0 chiamate, avviso fisso nei log, nessun frammento del segreto.
- [ ] `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-031-*` →
      verde (3 test, browser in un fuso diverso da quello della famiglia, orologio fisso):
      Marco vede «Sollecitato alle 08:15» su «Zaino di Leo», nessun pulsante su «Lavare l'auto»,
      tocca «Sollecita «Comprare il pane»» → «Sollecitato alle 09:00»; al secondo tocco (nuovo
      `mutationId`) → avviso «Sollecito già inviato da poco»; Anna vede il pulsante su «Spesa per
      Anna», Luca no; lo stesso in inglese.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi (test Jest della
      formattazione dell'ora nel fuso della famiglia, anche il 25/10/2026, cambio dell'ora legale).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde.
- [ ] `git diff --name-only origin/main` non contiene `server/pom.xml`, `app/package.json`,
      `app/package-lock.json`, `app/app.json`.

## Fuori perimetro
- Promemoria automatici (`kind` `AUTO`), silenzio notturno, ricalcolo, task in coda scaduto ai
  gestori, lavoro periodico (giro 032).
- Android: `expo-notifications`, permesso, token, `google-services.json`, apertura del task dal
  tocco (giro 033, con DOMANDA). Nessuna push sul web (SPEC §8).
- Cancellazione dei token al logout, ritentativi, statistiche di consegna, svuotare la cache del
  token d'accesso su un `401` di FCM.
- Nome della risorsa nel testo della notifica per il referente (§8 «con il nome della risorsa»):
  il payload resta generico; il nome lo mostra l'app. Da decidere nel giro 032.
- La data nel segno quando il sollecito non è di oggi.
- Il difetto del PUT parziale (aspetta la decisione dell'umano).
- `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica email e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Commit `6e93446`. Oggi tutti rossi per asserzione (27 sul server, 3 sul web).

| File | Dato … quando … allora … |
|---|---|
| `server/src/test/java/com/planforhome/acceptance/Giro031NudgeAcceptanceTest.java` | 21 casi: permesso, membro, coda/fatto/annullato, 5 min, replay, referente, lingua, esiti FCM, timeout, cache, concorrenza, `version_conflict`, isolamento, sync, log |
| `server/src/test/java/com/planforhome/acceptance/Giro031DeviceTokenAcceptanceTest.java` | registrazione, doppio, passaggio di persona, `400`, `401` |
| `server/src/test/java/com/planforhome/acceptance/Giro031PushDisabledAcceptanceTest.java` | segreto vuoto → `push_disabled` |
| `server/src/test/java/com/planforhome/acceptance/Giro031MalformedSecretAcceptanceTest.java` | chiave rotta → `push_disabled`, avviso fisso, niente segreto nei log |
| `server/src/test/java/com/planforhome/acceptance/Giro031AcceptanceSupport.java`, `Giro031FakeFcm.java` | supporto: famiglie, letture di `reminder`/`device`, FCM e `token_uri` finti |
| `app/e2e/acceptance/giro-031-nudge.spec.ts` (+ `giro-031-fake-api.ts`) | pulsante, segno nel fuso della famiglia, `429`, membro senza pulsante, inglese |

## Porte
- Doppio senso previste: migrazione `V6__reminders_devices.sql` (solo tabelle nuove); campo
  `lastNudgedAt` nelle viste; endpoint nuovi; proprietà `planforhome.fcm.*` (anche `timeout`); client FCM scritto con
  il JDK (si può sostituire con una libreria in futuro); testi i18n nuovi.
- Senso unico: nessuna in questo giro. L'integrazione FCM è già decisa (runbook 030 eseguito); le
  dipendenze FCM non servono. `expo-notifications` e `google-services.json` arrivano nel giro 033
  con una DOMANDA.

## Rischi di concorrenza
- Due gestori sullo stesso task nello stesso istante: il limite si controlla con la riga del task
  bloccata dall'aggiornamento di `version` (nessun lock nuovo) → un `200` e un `429`, 1 messaggio.
- Stesso `mutationId` in parallelo: la seconda richiesta è un replay → due `200`, 1 messaggio, 1
  `NUDGED` (un conflitto sulla chiave di `applied_mutation` si risolve rileggendo la risposta).
- Il sollecito alza `version`: un `PUT` offline con la `version` di prima riceve
  `409 version_conflict` (decisione sopra).
- Invio dopo il commit: se FCM è lento il sollecito è già registrato e la risposta arriva entro il
  timeout; se il commit fallisce non parte nulla.
- Token d'accesso in cache condiviso tra thread: rinnovo uno alla volta, una sola chiamata a
  `token_uri` per due solleciti insieme.
- Lo stesso token registrato da due persone di fila: `on conflict (fcm_token) do update`.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`) ≤ 700; file ≤ 18; una sessione.

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
Accolto:
1. Token cancellato solo su `404 UNREGISTERED` o su `400` con violazione su `message.token`;
   ogni altro `400` → `error:400`, token conservato (test con `400` sul payload). Coincide con la
   ricerca, punto 1.
2. Nomi di SPEC §6: tabella `device` (`fcm_token`, `platform`, `last_seen_at`) e `reminder.kind`
   `AUTO`/`NUDGE` con `due_at` e `sent_at`. I tre tipi automatici non servono a questo giro: il
   giro 032 userà `AUTO`; se gli servirà distinguerli, lo proporrà lì. Nessuna DOMANDA.
3. Timeout su FCM e `token_uri` (`planforhome.fcm.timeout`, connessione e richiesta),
   `error:timeout` ed `error:network`; test con il finto lento.
4. Una riga `reminder` per token provato; caso `tok-dead-1` numerato (casi 8 e 9).
5. Segreto inutilizzabile → `push_disabled` con avviso fisso; nei log solo stato HTTP ed
   `errorCode`; test con `OutputCaptureExtension` (caso 21 e classe `MalformedSecret`).
- Più semplice: `lastNudgedAt` da `max(at)` dei `NUDGED`; nessun lock nuovo; `on conflict`.
- Concorrenza: decisa la `409 version_conflict` dopo un sollecito; stesso `mutationId` in
  parallelo → 1 messaggio; una sola chiamata a `token_uri` per due solleciti.
- Test: controlli del finto `token_uri` (firma, claims, `grant_type`, form); cache con il `Clock`
  (`expires_in - 60 s`); Playwright con `timezoneId` fissato e diverso dal fuso della famiglia;
  replay prima del `429`; isolamento con task di altra famiglia → `404`.

Scartato (in «Fuori perimetro» e in «Idee per dopo»): il `401` di FCM che svuota la cache e la data
nel segno se non è oggi, facoltativi; il `401` è raro con un token rinnovato un minuto prima.

Aggiunto da me: il pulsante ha il titolo nell'etichetta («Sollecita «<titolo>»»), come «Inoltra
«<titolo>»», perché nella lista ce ne sono molti; ogni tocco è un `mutationId` nuovo; email di Kate
su `example.com` come gli altri test; suffisso casuale ai token dei test.

## Idee per dopo
- Su un `401` di FCM svuotare la cache del token d'accesso e riprovare una volta.
- Nel segno, la data quando il sollecito non è di oggi («Sollecitato ieri alle 18:30»).
- Ritentativi con backoff su `5xx` e `429` di FCM, nel lavoro periodico del giro 032.
