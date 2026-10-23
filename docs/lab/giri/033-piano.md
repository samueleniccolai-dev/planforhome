---
giro: 033
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-23T08:09:21Z
ricerca: sì
accettazione:
ripreso: no
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
- [ ] `cd app && npm test` → test Jest del modulo `app/src/push/` (con `expo-notifications` finto):
  dopo il login su Android, permesso concesso → `POST /api/me/devices` con `{token, platform:"ANDROID"}`
  una volta; permesso negato → nessuna chiamata, nessun errore all'utente; token cambiato
  (`addPushTokenListener`) → nuova registrazione; su web → nessuna chiamata a `expo-notifications`.
- [ ] Jest: il tocco su una notifica con `data.taskId` apre `/tasks?task=<id>` (o la rotta del
  dettaglio esistente); `taskId` assente o non UUID → nessuna navigazione.
- [ ] Server, `Giro033DeviceAcceptanceTest`: lo stesso token registrato
  prima da Anna e poi da Bruno appartiene solo a Bruno (un sollecito ad Anna non lo usa più: dubbio
  del revisore 032); ripetere la registrazione dello stesso token per lo stesso utente non crea
  doppioni; isolamento parametrico: il corpo non accetta `personId` altrui (ignorato).
- [ ] `cd app && npx playwright test e2e/acceptance/giro-033-*` → sul web, dopo il login, nessuna
  richiesta a `/api/me/devices` e nessun dialogo di permesso.
- [ ] CI job `apk` verde con `google-services.json` scritto dalla variabile (o segnaposto sulle PR);
  `aapt dump permissions` sull'APK mostra `android.permission.POST_NOTIFICATIONS`.
- [ ] `cd app && npx tsc --noEmit && npx eslint .` puliti; `cd server && ./mvnw -B -ntp verify` verde.
- Sul telefono (umano, dopo il merge): installato l'APK, accesso come utente demo, permesso
  concesso → riga in `device`; un sollecito arriva e il tocco apre il task. Lo dichiara l'umano.

## Fuori perimetro
- Correzione `due_at > now` in `deletePending` (difetto maggiore 032): giro a parte.
- Testo nel payload vs testo scaricato dal client (SPEC §8 condizione 6): resta come oggi.
- Cancellazione del token al logout, gestione di più profili sullo stesso telefono oltre il
  passaggio del token, impostazioni di notifica nell'app, anticipo modificabile.
- iPhone, Play Store, accesso con Google (traguardi.json → fuori_perimetro); push sul web.
- Template 730, calendario, verifica email, sync in tempo reale, offline sul web, dati reali.
- Browser key Firebase: decisione dell'umano, nessuna azione.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/.../acceptance/Giro033DeviceAcceptanceTest.java` | Anna registra il token T, poi Bruno (altra famiglia) registra T → un sollecito a un task di Anna non produce `reminder` verso T; Bruno sì |
| idem | Anna registra T due volte → una sola riga `device` (contata tramite un sollecito: un solo `reminder`) |
| idem | corpo con `personId` di Bruno da Anna → il token è di Anna |
| `app/e2e/acceptance/giro-033-push-web.spec.ts` | login web di Anna → nessuna richiesta a `/api/me/devices` |

Dati demo: quelli dei giri 031–032 — famiglia «Rossi» (Anna Rossi gestore, `anna@demo.planforhome.test`),
famiglia «Bianchi» (Bruno Bianchi, `bruno@demo.planforhome.test`); token finti
`fake-fcm-token-anna-033`, `fake-fcm-token-shared-033`; FCM finto del contesto di test.

## Porte
- Doppio senso previste: struttura di `app/src/push/`, rotta aperta dal tocco, nome del canale
  Android (`reminders`), riassegnazione del token all'ultimo utente (upsert per `fcm_token`).
- Senso unico: **DOMANDA** (in testa): `expo-notifications` + plugin, `google-services.json` nella
  build. Uno schema nuovo non serve; se serve un indice unico su `device.fcm_token`, migrazione V8
  solo additiva (prima si tolgono i doppioni con una `DELETE`: dato finto, ma va detto nella PR).

## Rischi di concorrenza
- Due registrazioni dello stesso token insieme (riavvio app + listener): l'upsert per `fcm_token`
  deve essere atomico (`INSERT … ON CONFLICT`); prova con due richieste parallele → una riga.
- Registrazione durante un invio: il token passa da Anna a Bruno mentre `runDue()` invia ad Anna →
  al più un invio in più ad Anna, accettato e scritto nel rapporto.

## Budget
Righe di produzione ≤ 250 (app ≈ 170, server ≈ 40, migrazione ≈ 10); file ≤ 10; una sessione.

## Domande per il ricercatore (al massimo 3)
1. `expo-notifications` per SDK 58: versione, configurazione del plugin, `getDevicePushTokenAsync`
   senza EAS né `projectId`, richiesta di `POST_NOTIFICATIONS` su Android 13+ (doc ufficiale Expo).
2. Ad app chiusa, una notifica FCM con blocco `notification` + `data.taskId`: come la consegna
   `expo-notifications` al tocco (`getLastNotificationResponseAsync` / listener)?
3. Come le app di task per famiglie chiedono il permesso delle notifiche (al primo avvio o al primo
   task assegnato) senza disturbare.

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Chiedere il permesso al primo task assegnato invece che al login.
- Cancellare il token al logout.
