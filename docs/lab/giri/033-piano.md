---
giro: 033
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: costruzione
inizio: 2026-10-23T08:09:21Z
ricerca: sì
accettazione: 4f70ec8
ripreso: sì
---
# Piano del giro 033 — registrazione del telefono Android e apertura del task dalla notifica

## DOMANDA (porta a senso unico) — libreria per ricevere le notifiche FCM sull'APK

**Contesto.** Il server invia già promemoria e solleciti con FCM HTTP v1 (giri 031–032) a ogni
`device.fcm_token` registrato con `POST /api/me/devices`. L'app Android oggi non chiede il permesso
delle notifiche, non legge il token FCM del telefono e non lo registra: nessuna notifica può
arrivare. Serve una libreria nativa (dipendenza npm nuova + plugin di Expo in `app.json`) e il file
`google-services.json` nella build dell'APK, letto dalla variabile `GOOGLE_SERVICES_JSON` (già
creata dall'umano, runbook `fcm.md` passo 3). Tutte e tre sono porte a senso unico (CLAUDE.md
regola 2) o percorsi protetti (`app/package.json`, `.github/workflows/`): la PR andrà comunque in
revisione umana.

| Opzione | Pro | Contro |
|---|---|---|
| **A. `expo-notifications`** (versione allineata a Expo SDK 58, `~58.0.x` come la sceglie `npx expo install expo-notifications` [DA VERIFICARE]) + suo plugin in `app.json` | Modulo ufficiale Expo, stessa linea di versioni del resto dell'app; `getDevicePushTokenAsync()` dà il token FCM nativo, quindi niente servizio push di Expo (coerente con ADR-0001 R5 e runbook); gestisce permesso Android 13+ (`POST_NOTIFICATIONS`), canale Android e tocco sulla notifica; su web basta non chiamarlo | Una dipendenza e un plugin nuovi; il comportamento ad app chiusa dipende dal blocco `notification` che il server già manda (da provare sul telefono, non in CI) |
| B. `@react-native-firebase/app` + `@react-native-firebase/messaging` | SDK Firebase diretto, gestori in background completi | Due dipendenze, plugin più invasivi (Gradle), notifica in primo piano richiede una terza libreria (notifee); fuori dalla linea Expo |
| C. Nessuna libreria: si passa a `verifica-produzione` con un token preso da un'altra app di prova | Zero dipendenze | Il «Fatto quando» di T10 chiede un dispositivo registrato che riceve: con l'APK di planforhome non è possibile; R0 promette push su Android (SPEC §8): T10 non si chiude davvero |

**Raccomandazione: A.** Una sola dipendenza, ufficiale, già nella famiglia di versioni di Expo 58;
nessun servizio push di terzi oltre FCM.

- **Dipendenza:** `expo-notifications`, `~58.0.x` (patch esatta da `npx expo install`), motivo:
  permesso, token FCM nativo, canale e tocco sulla notifica in un'app Expo senza EAS; alternativa:
  opzione B.
- **Workflow:** nei job `apk` di `ci.yml` e `consegna.yml`, un passo che scrive
  `app/google-services.json` da `vars.GOOGLE_SERVICES_JSON` prima di `expo prebuild`, e
  `android.googleServicesFile` in `app.json`. Il file resta in `.gitignore`. È una variabile, non
  un segreto (contiene solo la chiave API Android, già ristretta al pacchetto e allo SHA-1); in CI
  sulle PR, se la variabile manca, la build usa un segnaposto e l'APK si costruisce lo stesso.
- **Dopo «A»:** il giro riparte in FINALE con questo piano; PR in revisione umana (`package.json`,
  workflow). Poi giro `verifica-produzione` di T10.
- **Dopo «B»:** il piano si riscrive con due dipendenze e la terza (notifee) diventa una nuova
  domanda; il giro si allunga, probabilmente due fette.
- **Dopo «C»:** il giro 033 diventa `verifica-produzione` senza APK; T10 resta `in-corso` per la
  parte Android, che va nelle «Idee per dopo».

## Fetta e traguardo
T10, fetta 3/3: l'APK chiede il permesso, registra il token FCM sul server e apre il task toccando
la notifica. È l'ultimo pezzo prima della verifica in produzione. Fonti: SPEC §8, §6 (`device`),
§9, §2.2.9; runbook `docs/runbook/fcm.md`.

## Risposta dell'umano (23/10/2026)
**A**: `expo-notifications`, versione scelta da `npx expo install` per Expo 58. Il passo nei
workflow (`ci.yml`, `consegna.yml`, job `apk`: `google-services.json` da `vars.GOOGLE_SERVICES_JSON`,
segnaposto se manca) lo fa l'umano con una PR sua: **il giro non tocca `.github/`**. Al giro:
`app.json` (`android.googleServicesFile`), codice e test. Di conseguenza il controllo «CI job `apk`
con `google-services.json`» qui sotto non è del giro: resta dell'umano.

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx playwright test e2e/acceptance/giro-033-*` → tutti verdi (R1–R9, O1–O4, A1,
  W1–W5; W1 e W4 sono guardie di non regressione, verdi già oggi).
- [ ] `cd server && ./mvnw -q -Dtest='Giro033*AcceptanceTest' test` → verde: ogni messaggio FCM
  porta `android.notification.channel_id = "reminders"` (una riga in `FcmClient.send`).
- [ ] `cd server && ./mvnw -q -Dtest='Giro031*AcceptanceTest,Giro032*AcceptanceTest' test` → verdi
  (registrazione del token e invii invariati).
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` puliti; `cd server && ./mvnw -B -ntp verify` verde.
- [ ] `cd app && npx expo prebuild --platform android --no-install` con un `google-services.json`
  segnaposto → `android/app/src/main/AndroidManifest.xml` contiene `POST_NOTIFICATIONS` [DA VERIFICARE:
  lo aggiunge il plugin?]; se manca, il costruttore lo aggiunge in `app.json → android.permissions`.
- Umano, non del giro: passo dei workflow (`google-services.json` da `vars.GOOGLE_SERVICES_JSON`,
  segnaposto sulle PR) e `aapt dump permissions` nel job `apk`. **Ordine dei merge: prima la PR
  umana dei workflow, poi questa** (con `android.googleServicesFile` il prebuild cerca il file).
- Sul telefono (umano, dopo il merge): APK installato, accesso come utente demo, permesso concesso
  → riga in `device`; un sollecito arriva nel canale «Promemoria»; il tocco ad app chiusa e ad app
  aperta apre `/tasks?task=<id>` con il task nella regione «Aperto dalla notifica».

## Contratti per i test
- `src/push/registration.ts` (nessun import di react-native o expo al caricamento):
  `createPushRegistration({ notifications, auth, channelName })` → `{ ensure(), dispose() }`.
  `notifications` ha la forma di `expo-notifications` (`setNotificationChannelAsync`,
  `getPermissionsAsync`, `requestPermissionsAsync`, `getDevicePushTokenAsync`,
  `addPushTokenListener`); `auth` è il `TokenSession` (la POST passa da `auth.http`, quindi Bearer).
  `ensure()`: senza credenziali non fa nulla; crea il canale `reminders` (nome tradotto,
  `push.channel`) **prima** di leggere il permesso; chiede il permesso al più una volta per
  esecuzione dell'app e solo se non concesso; negato → nessun token, nessuna POST; prende il token
  dentro un `try` (un errore non arriva mai alla persona: si ritenta al prossimo `ensure()`);
  `POST /api/me/devices {token, platform:"ANDROID"}`; ricorda la coppia (persona, token) solo dopo
  un 2xx e non ripete; un `ensure()` chiamato mentre un altro è in volo si ripete **dopo** che il
  primo è finito (mai due POST in parallelo, l'ultima è dell'ultimo utente). Il listener del token
  registra il token nuovo.
- `createSyncSession` riceve `push?: { ensure(): Promise<unknown> }`: lo chiama, senza attenderlo e
  ingoiando gli errori, dopo che `start()` ha trovato credenziali valide (vale per la sessione già
  salvata e per `signIn`) e dopo ogni ciclo con esito `ok` (così si ritenta quando la rete torna).
- `src/push/open.ts`: `createNotificationOpener({ notifications, navigate })` → `{ ready(), dispose() }`.
  Si iscrive subito a `addNotificationResponseReceivedListener`; prima di `ready()` (router montato)
  non naviga, accumula; `ready()` legge `getLastNotificationResponse()` (o la sua versione Async);
  una risposta per `notification.request.identifier` → una navigazione `/tasks?task=<uuid>`; poi
  `clearLastNotificationResponseAsync()`; `taskId` assente o non UUID → niente.
- `src/push/push.native.ts` collega il modulo vero (come `vault.native.ts`) e `runtime.native.ts`;
  `src/push/push.ts` per il web esporta un `createPush()` che restituisce `undefined`.
- `app/tasks.tsx` legge `task` dai parametri: UUID tra i task della persona → regione
  `task.fromNotification` («Aperto dalla notifica» / «Opened from the notification») con il task;
  UUID assente → alert `task.notAvailable` («Questo task non è più disponibile» / «This task is no
  longer available»); non UUID → schermata solita. Il task resta anche nell'elenco.
- `i18n`: `push.channel` = «Promemoria» / «Reminders».
- `app.json`: plugin `expo-notifications`, `android.googleServicesFile: "./google-services.json"`;
  il file è già in `.gitignore` (radice). `package.json`: `expo-notifications` `~58.x` da
  `npx expo install`.

## Fuori perimetro
- **Server**: registrazione del token, upsert e indice unico esistono già (V6, giro 031): nessuna
  migrazione, nessun cambio in `PushRepository`. Del server si tocca solo la riga di `channel_id`.
- `.github/` (decisione dell'umano): passo di `google-services.json` e controllo `aapt`.
- Cancellazione del token al logout (rischio aperto, SPEC §9: va scritto nel rapporto), più
  profili sullo stesso telefono oltre il passaggio del token, impostazioni di notifica, anticipo
  modificabile, apertura del task offline (la schermata `/tasks` legge dal server).
- Correzione `due_at > now` in `deletePending` (difetto maggiore 032); testo nel payload (SPEC §8
  condizione 6): restano come oggi.
- iPhone, Play Store, accesso con Google (`traguardi.json → fuori_perimetro`); push sul web.
- Template 730, calendario, verifica email, sync in tempo reale, offline sul web, dati reali.
- Browser key Firebase: decisione dell'umano, nessuna azione.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Prova |
|---|---|
| `server/.../acceptance/Giro033ChannelAcceptanceTest.java` | C1: Anna (gestore di Mamma) sollecita «Spesa per Anna» assegnato a Luca, che ha un telefono → il messaggio ha `android.notification.channel_id = "reminders"`, `priority high`, `data.taskId`, titolo generico |
| `app/e2e/acceptance/giro-033-push-android.spec.ts` (solo Node) | R1 login e una sola POST col Bearer; canale prima del permesso · R2 nome del canale tradotto · R3 sessione già salvata · R4 permesso negato · R5 token che lancia, poi ritento · R6 offline all'avvio, poi ritento · R7 token ruotato · R8 corsa Anna→Luca sullo stesso telefono, il token finisce a Luca · R9 lato web vuoto · O1 tocco ad app chiusa dopo `ready()` e pulizia · O2 risposta doppia → una navigazione · O3 tocchi ad app aperta e `dispose()` · O4 `taskId` non valido · A1 `app.json`, `.gitignore`, dipendenza |
| `app/e2e/acceptance/giro-033-push-web.spec.ts` | W1 guardia web: niente `/api/me/devices`, niente dialoghi, niente errori in pagina o console · W2 `/tasks?task=` di Anna → regione con il task · W3 task di una famiglia altrui → alert tradotto, il task non si vede · W4 non UUID → schermata solita (guardia) · W5 inglese |

Dati demo (inventati): server, quelli di `Giro031AcceptanceSupport` — Famiglia Mamma con Anna
gestore e Luca membro, token `fake-fcm-token-luca-033-<suffisso>`. App Node, il finto server del
giro 026 — Anna e Luca sullo stesso telefono, token `fake-fcm-token-anna-033` e
`fake-fcm-token-anna-033-b`. App web, il finto API del giro 031 — Anna di Famiglia Mamma,
«Spesa per Anna» (suo), «Comprare il pane» (di Famiglia Principale, non suo).

## Porte
- Doppio senso: struttura di `app/src/push/`, rotta `/tasks?task=<id>` con evidenza nella
  schermata, nome del canale `reminders`, `channel_id` nel messaggio FCM, momento della richiesta
  del permesso (al primo avvio con sessione).
- Senso unico: `expo-notifications` + plugin e `google-services.json` nella build — **risolta**
  dall'umano (opzione A). Nessuno schema nuovo.

## Rischi di concorrenza
- Due `ensure()` (avvio + ciclo + listener): mai due POST in parallelo, una sola registrazione (R1).
- Cambio utente durante la registrazione (R8): la POST di Anna in volo viene scartata
  (`invalidate`), quella di Luca parte dopo; l'ultima applicata sul server è di Luca.
- Tocco ad app chiusa: nessuna navigazione prima che il router sia pronto; risposta doppia (ultima
  + listener) → una navigazione (O1, O2).
- Token passato da Anna a Luca mentre `runDue()` invia ad Anna: al più un invio in più, accettato.

## Budget
Righe di produzione ≤ 230 (app ≈ 220, server 1); file ≤ 10; una sessione.

## Domande per il ricercatore (al massimo 3)
1. `expo-notifications` per SDK 58: versione, configurazione del plugin, `getDevicePushTokenAsync`
   senza EAS né `projectId`, richiesta di `POST_NOTIFICATIONS` su Android 13+ (doc ufficiale Expo).
2. Ad app chiusa, una notifica FCM con blocco `notification` + `data.taskId`: come la consegna
   `expo-notifications` al tocco (`getLastNotificationResponseAsync` / listener)?
3. Come le app di task per famiglie chiedono il permesso delle notifiche (al primo avvio o al primo
   task assegnato) senza disturbare.

## Critica ricevuta e cosa cambia
| Punto | Esito | Motivo e cambiamento |
|---|---|---|
| 1. Server già fatto (V6, upsert, Giro031) | **Accolto** | Verificato su `main`. Tolti `Giro033DeviceAcceptanceTest`, V8 e i cambi al repository: il giro è app, più una riga di server per il punto 5. |
| 2. «Apre il task» senza rotta | **Accolto, opzione (c)** | `tasks.tsx` legge `?task=` ed evidenzia il task in una regione; task assente → alert tradotto. Niente `familyId` nel payload (meno dati nel messaggio) e niente lettura dal SQLite (il task può non esserci ancora). Provato a schermo (W2–W5). Limite: offline la schermata non carica, scritto fuori perimetro. |
| 3. Sessione già salvata e offline | **Accolto** | `ensure()` a ogni `start()` con credenziali e dopo ogni ciclo `ok`; POST via `auth.http` (Bearer). R3, R6. |
| 4. `googleServicesFile` e token che lancia | **Accolto** | Ordine dei merge scritto nel «Fatto quando» (prima la PR umana dei workflow, che mette un segnaposto); il token si prende in un `try`, R5. |
| 5. Canale non usato | **Accolto, opzione server** | Una riga in `FcmClient.send`: `android.notification.channel_id = "reminders"`, provata da C1; niente `defaultChannel` del plugin (non verificato). Nome tradotto (R2). |
| Più semplice: `push.native.ts` + `push.ts` vuoto | **Accolto** | Contratto e R9. La logica sta in `registration.ts` e `open.ts`, puri, così si provano in Node. |
| Concorrenza: epoch, router pronto, risposta doppia, `clearLast…` | **Accolto** | Serializzazione di `ensure()` invece di un epoch a parte (stesso effetto, R8); `ready()`, deduplica per `identifier`, pulizia (O1–O2). |
| Perimetro: CI apk/aapt dell'umano | **Accolto** | Tolto dal giro; resta come voce dell'umano. |
| Accettazione: web solo guardia, test su tocco, famiglia altrui, sessione, token, corsa | **Accolto** | W1 con errori di pagina e console; W4 guardia; nuovi R3, R5, R8, O1–O4, W3. |
| Dati demo non allineati | **Accolto** | Server: Mamma con Anna gestore e Luca; niente Bruno. App: i finti dei giri 026 e 031. |
| Rischio logout non toglie il token | **Accolto** | Fuori perimetro, da scrivere nel rapporto come rischio aperto (SPEC §9). |

Scartato: nulla. Unico scostamento dalla lettera: al posto dell'epoch della sessione, la serializzazione
delle registrazioni (il `TokenSession` scarta già le risposte dopo `invalidate`).

## Idee per dopo
- Chiedere il permesso al primo task assegnato invece che al login.
- Cancellare il token al logout.
- Aprire il task anche offline dal SQLite locale.
- `familyId` nel payload per aprire direttamente la famiglia.
