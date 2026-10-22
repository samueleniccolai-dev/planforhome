# Ricerca giro 031 — FCM v1, OAuth, sollecito

Consultazione del 2026-10-22. Fonti: 8 tra ricerche e letture; le pagine ufficiali (firebase.google.com, developers.google.com) non si sono aperte (errore DNS), quindi i punti [DA VERIFICARE] restano da ricontrollare.

## Cosa prendiamo
1. Cancellare il token su `404 UNREGISTERED`. Su `400 INVALID_ARGUMENT` solo se i `details` puntano al token (`BadRequest` su `message.token`); altrimenti `error:400` e token conservato. Test con finto FCM: 400 da payload, token conservato. [DA VERIFICARE]
2. `reminder.result` salva il `name` restituito (atteso `projects/{id}/messages/{id}`) senza interpretarlo. [DA VERIFICARE]
3. JWT: `iss`, `scope`, `aud` = `token_uri`, `iat`, `exp` ≤ 1 ora, RS256, grant `urn:ietf:params:oauth:grant-type:jwt-bearer`, `assertion`; cache secondo `expires_in`. [DA VERIFICARE]
4. Messaggio `notification` + `data.taskId`, priorità alta; il tocco passa i `data` come extra dell'intent (la lettura in Expo è del giro 033). [DA VERIFICARE]
5. Segno web: testo visibile «Sollecitato alle HH:MM», senza `aria-label` diverso (suggerimento senza fonte).

## Cosa evitiamo
Cancellare il token su ogni 400; fidarsi di blog per i dettagli OAuth.

## Fonti
- https://firebase.google.com/docs/cloud-messaging/error-codes (snippet, 2026-10-22)
- https://google.aip.dev/auth/4111 (snippet, 2026-10-22)
- https://hookdeck.com/blog/call-google-cloud-service-account-authorization-without-oauth (secondaria)
- https://docs.bird.com/pusher/beams/beams/publishing/why-dont-fcm-notifications-trigger-onmessagereceived-when-in-the-background-state (secondaria)
- https://gurubase.io/g/android/retrieve-notification-data-from-intent-android (secondaria)
