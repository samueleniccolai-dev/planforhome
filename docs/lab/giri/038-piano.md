---
giro: 038
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: revisione
inizio: 2026-10-23T18:51:40Z
ricerca: sì
accettazione: fe0ea79
ripreso: no
---
# Piano del giro 038 — canale promemoria ad alta importanza

## Fetta e traguardo
T10, correzione del difetto maggiore trovato dal 037 (difetto del 033): il canale Android
«Promemoria» nasce con importanza `4`, che in `expo-notifications` 58.1.6 è `LOW` (`HIGH` = 6,
`node_modules/expo-notifications/build/NotificationChannelManager.types.d.ts:31-35`). Per questo le
notifiche arrivano senza suono, vibrazione e banner. Fonti: SPEC §8 (canale: push su Android, FCM),
rapporto 037.

### Scelta sull'id del canale (diversa dal suggerimento di PROGRESS)
PROGRESS suggerisce un id di canale nuovo, uguale nel `channel_id` del server. Non si può fare in
questo giro: tre test di accettazione già su `main` fissano l'id `"reminders"`
(`Giro033ChannelAcceptanceTest` c1, `Giro035NotificationTextAcceptanceTest` riga 73-75,
`giro-033-push-android.spec.ts` R1 e R2). Sono intoccabili (`progetto.yml`, METODO §4 «test di
accettazione già su `main` intatti»). Quindi:
- l'id resta `"reminders"`, nell'app e nel server (il server non cambia);
- cambia solo l'importanza: `registration.ts` scrive **6** (`AndroidImportance.HIGH` di
  `expo-notifications` 58.x) direttamente, con un commento che cita l'enum; niente opzione nuova
  di `createPushRegistration`, `push.native.ts` non cambia. Il valore non si prende dall'enum a
  tempo di esecuzione perché `registration.ts` non deve importare moduli expo (gli e2e 033 lo
  caricano in Node). La deriva è coperta dal test C2, che legge `AndroidImportance.HIGH` dal
  pacchetto installato;
- il telefono di prova ha già il canale creato con importanza bassa, e Android non alza
  l'importanza di un canale esistente: l'umano **disinstalla e reinstalla** l'APK prima della
  prova (passi sotto, nel «Fatto quando» del giro di verifica). In R0 c'è un solo telefono di prova.
- Se l'umano preferisce un id nuovo, serve una sua PR che aggiorni i tre test (idea per dopo).

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx playwright test e2e/acceptance/giro-038-*` → verde:
      C1 Anna collegata: `setNotificationChannelAsync("reminders", …)` riceve `importance` = 6
      (numero), nome «Promemoria», prima di `getPermissionsAsync`; un solo
      `POST /api/me/devices` con `fake-fcm-token-anna-033`;
      C2 l'importanza usata è uguale a `AndroidImportance.HIGH` letta da
      `node_modules/expo-notifications/build/NotificationChannelManager.types.js` (oggi 6).
- [ ] `grep -rnE "importance: *[0-57-9]\b|= *4\b" app/src/push/` → nessuna riga (nessuna
      importanza diversa da 6 nel modulo push).
- [ ] `cd app && npx playwright test e2e/acceptance/giro-033-*` → verde (id e nome invariati).
- [ ] `cd server && ./mvnw -q -Dtest='Giro033ChannelAcceptanceTest,Giro035NotificationTextAcceptanceTest' test` → verde (server invariato).
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verde.
- [ ] CI della PR: job `apk` verde (l'APK si costruisce).
- Dopo il merge, nel giro di verifica (non qui), sul telefono di prova:
  1. V6: `POST_NOTIFICATIONS` nel manifest dell'APK;
  2. disinstallare l'app, installare l'ultimo APK, accedere di nuovo come persona demo;
  3. controllare che arrivi un `POST /api/me/devices` col token nuovo (log del server, 204);
  4. Impostazioni › App › planforhome › Notifiche: la categoria «Promemoria» è ad alta
     importanza (suono e pop-up attivi);
  5. far scattare un promemoria → suono e banner.

## Fuori perimetro
- Id di canale nuovo e modifica dei test 033/035 (vedi sopra).
- V6 (`POST_NOTIFICATIONS` nel manifest): è un controllo del giro di verifica, non codice.
- Difetto `due_at > now` in `deletePending` (032), token FCM dopo il logout, query senza filtro
  di famiglia (dubbio 035): fette future.
- Suoni personalizzati, pattern di vibrazione, canali per criticità.
- `traguardi.json → fuori_perimetro`: template 730, calendario, accesso Google/Apple, iPhone e Play
  Store, email, sync in tempo reale e offline sul web, dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-038-channel-importance.spec.ts` C1 | Dato un finto `expo-notifications` e Anna collegata (persona demo di `giro-026-fake-sync-server.ts`, telefono `fake-fcm-token-anna-033`), quando `createPushRegistration` (con le sole opzioni di `push.native.ts`) fa `ensure()`, allora il canale `"reminders"` nasce con `importance` 6 e nome «Promemoria», prima di `getPermissionsAsync`, e il telefono è registrato una volta |
| idem C2 | Dato `AndroidImportance.HIGH` del pacchetto installato, allora l'importanza usata è quella |

Nessun test server: il server non cambia. Nessun test Jest di accettazione: il guard considera
accettazione solo `app/e2e/acceptance/` e `server/.../acceptance/`; un test Jest in
`app/src/push/__tests__/` non sarebbe protetto. Il costruttore può aggiungerne uno suo.

## Porte
- Doppio senso previste: importanza del canale (costante in `registration.ts`).
- Senso unico: nessuna. `expo-notifications` è già una dipendenza.

## Rischi di concorrenza
Nessuno nuovo: la registrazione resta serializzata (`enqueue`).

## Budget
Righe di produzione ≤ 5; file 1 (`registration.ts`).

## Domande per il ricercatore (al massimo 3)
1. Documentazione Expo SDK (versione di `expo-notifications` 58.x): valori di `AndroidImportance`
   e quale serve per suono e banner (heads-up).
2. Documentazione Android (`NotificationChannel`): l'importanza di un canale già creato si può
   alzare dall'app? Disinstallare l'app azzera i canali?
3. Con `channel_id` nel messaggio FCM e app in background, conta l'importanza del canale o
   `android.priority`/`notification_priority` del messaggio?

## Idee per dopo
- Id di canale versionato (`reminders-v2`) con PR umana che aggiorna i test 033/035.
- Un collegamento nell'app alle impostazioni del canale (se l'importanza è bassa, invitare la
  persona ad alzarla), per i telefoni che hanno già il canale vecchio.
- Includere `app/src/**/__tests__/` tra le cartelle di accettazione del guard (proposta di metodo).

## Critica ricevuta e cosa cambia
Accolti 4 punti su 4 (più l'alternativa e l'idea facoltativa), uno in forma diversa:
1. **e2e che non prova la correzione** — accolto con l'alternativa più semplice: l'importanza la
   scrive `registration.ts`, senza opzione; il test e2e passa solo le opzioni di `push.native.ts`,
   quindi prova davvero il valore. Non scelto il test Jest come accettazione: il guard non lo
   protegge (non è in `ACCEPTANCE_DIRS`), il costruttore potrebbe cambiarlo.
2. **`channelImportance` obbligatoria** — superato: l'opzione non esiste più.
3. **grep debole** — accolto: grep negativa su `app/src/push/` per importanze diverse da 6, più C2
   che confronta col valore di `AndroidImportance.HIGH` installato.
4. **verifica dopo reinstallazione** — accolto: passi 2-5 nel «Fatto quando» del giro di verifica.
- Facoltativo (impostazioni del canale) — in «Idee per dopo».
