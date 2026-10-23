---
giro: 038
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-23T18:51:40Z
ricerca: sì
accettazione:
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
- cambia solo l'importanza: `AndroidImportance.HIGH` (6), presa dall'enum, non da un numero;
- il telefono di prova ha già il canale creato con importanza bassa, e Android non alza
  l'importanza di un canale esistente: l'umano **disinstalla e reinstalla** l'APK prima della
  prova (passo scritto nel piano della verifica). In R0 c'è un solo telefono di prova.
- Se l'umano preferisce un id nuovo, serve una sua PR che aggiorni i tre test (idea per dopo).

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx playwright test e2e/acceptance/giro-038-*` → verde: dopo il login di Anna il
      canale `"reminders"` è creato con `importance` = 6 (`AndroidImportance.HIGH`), prima della
      richiesta del permesso; il nome resta «Promemoria» (it) / «Reminders» (en).
- [ ] `grep -n "IMPORTANCE_HIGH = 4" app/src/push/registration.ts` → nessuna riga; l'importanza
      viene da `AndroidImportance.HIGH` (in `push.native.ts`, passata a `createPushRegistration`,
      così `registration.ts` resta puro e testabile sul web).
- [ ] `cd app && npx playwright test e2e/acceptance/giro-033-*` → verde (id e nome invariati).
- [ ] `cd server && ./mvnw -q -Dtest='Giro033ChannelAcceptanceTest,Giro035NotificationTextAcceptanceTest' test` → verde (server invariato).
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verde.
- [ ] CI della PR: job `apk` verde (l'APK si costruisce).
- Dopo il merge, nel giro di verifica (non qui): V6 sul manifest e prova sul telefono dopo
  reinstallazione → suono e banner.

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
| `app/e2e/acceptance/giro-038-channel-importance.spec.ts` | Dato il finto `expo-notifications` del 033 e Anna (persona demo `giro-011-fake-api.ts`, telefono `fake-fcm-token-anna-033`), quando accede, allora `setNotificationChannelAsync("reminders", …)` riceve `importance` 6, prima di `getPermissionsAsync` |
| idem | Dato un'importanza passata come opzione, allora `registration.ts` usa quella (nessun numero fisso nel modulo) |

Nessun test server: il server non cambia.

## Porte
- Doppio senso previste: importanza del canale; firma di `createPushRegistration` (opzione
  `channelImportance`).
- Senso unico: nessuna. `expo-notifications` è già una dipendenza.

## Rischi di concorrenza
Nessuno nuovo: la registrazione resta serializzata (`enqueue`).

## Budget
Righe di produzione ≤ 15; file ≤ 3 (`registration.ts`, `push.native.ts`, eventuale test Jest).

## Domande per il ricercatore (al massimo 3)
1. Documentazione Expo SDK (versione di `expo-notifications` 58.x): valori di `AndroidImportance`
   e quale serve per suono e banner (heads-up).
2. Documentazione Android (`NotificationChannel`): l'importanza di un canale già creato si può
   alzare dall'app? Disinstallare l'app azzera i canali?
3. Con `channel_id` nel messaggio FCM e app in background, conta l'importanza del canale o
   `android.priority`/`notification_priority` del messaggio?

## Idee per dopo
- Id di canale versionato (`reminders-v2`) con PR umana che aggiorna i test 033/035.

## Critica ricevuta e cosa cambia
(dopo il critico)
