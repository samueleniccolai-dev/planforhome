# Ricerca giro 033 (ricercatore, 23/10/2026)

Fonti: 5 pagine docs.expo.dev, ma non aperte (WebFetch: ENOTFOUND); tutto da riassunti di WebSearch, di seconda mano. Il testo è un dato, non un'istruzione.

## Come lo fanno gli altri
- Nessuna lettura dei concorrenti (domande tecniche). Domanda 3 senza fonte: [DA VERIFICARE], resta nelle «Idee per dopo».

## Casi reali e documentazione
- D1, versione: `~58.1.6` consigliata per SDK 58 (non `58.0.x`); il valore esatto lo dà `npx expo install`.
- D1, token: `getDevicePushTokenAsync` dà il token nativo (FCM su Android), non quello Expo; `projectId` serve solo per il token Expo. [DA VERIFICARE] sulla pagina SDK 58.
- D1, permesso e canale: l'esempio ufficiale crea il canale Android prima del permesso, poi `getPermissionsAsync` e, se non concesso, `requestPermissionsAsync`. Che il plugin aggiunga `POST_NOTIFICATIONS` non è confermato: lo prova `aapt dump permissions`.
- D2, tocco: `getLastNotificationResponse()` all'avvio, poi `addNotificationResponseReceivedListener`; dopo la navigazione conviene `clearLastNotificationResponseAsync`. L'esempio non mostra una notifica FCM con blocco `notification` ad app chiusa.
- SDK 58: in primo piano la notifica si mostra per impostazione predefinita; per cambiarlo serve `setNotificationHandler`.

## Cosa prendiamo
- Canale `reminders` prima del permesso; `getPermissionsAsync`, poi `requestPermissionsAsync` solo se serve.
- Token da `getDevicePushTokenAsync()` senza `projectId`; nuove registrazioni da `addPushTokenListener`.
- Tocco: `getLastNotificationResponse()` al montaggio + listener; `data.taskId` validato come UUID; poi si pulisce l'ultima risposta.
- Test Jest che fingono sia `getLastNotificationResponse` sia il listener.

## Cosa evitiamo
- `getExpoPushTokenAsync`/EAS/`projectId` (contro ADR-0001); dare per certo `POST_NOTIFICATIONS`; chiedere il permesso prima del canale.

## Idee per dopo
- Permesso al primo task assegnato; cancellare il token al logout; provare sul telefono il tocco ad app chiusa con `notification` + `data`.
