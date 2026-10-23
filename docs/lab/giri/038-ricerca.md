# Ricerca giro 038 — importanza del canale Android

Fonti consultate il 2026-10-23 (7 voci; docs.expo.dev e firebase.google.com non raggiungibili, errore DNS).

- Q1: in `expo-notifications` 58.x `AndroidImportance`: UNKNOWN 0, UNSPECIFIED 1, NONE 2, MIN 3, LOW 4, DEFAULT 5, HIGH 6, MAX 7 (`app/node_modules/expo-notifications/build/NotificationChannelManager.types.d.ts`, righe 24-36). 4 è LOW, HIGH è 6. Nativo Android: `IMPORTANCE_HIGH` fa suono e heads-up; DEFAULT solo suono; LOW nessun suono (developer.android.com, guida ai canali).
- Q2: l'importanza di un canale già creato non si alza dal codice; solo l'utente dalle impostazioni. Ricreare con lo stesso id non cambia nulla. Reinstallare l'app o cancellarne i dati azzera i canali di prova (guida ai canali). Il testo di `NotificationChannel` sulla cancellazione con l'app non è stato verificato di persona.
- Q3: da Android 8.0 conta l'importanza del canale, non la priorità della notifica (developer.android.com, build-notification). La priorità FCM `high` riguarda solo la puntualità di consegna (fonte debole: solo risultato di ricerca, pagina non aperta).

Si prende: `AndroidImportance.HIGH` dall'enum, id `reminders` invariato, reinstallazione dell'APK sul telefono di prova, server invariato.
Si evita: cambiare solo `android.priority` FCM; cancellare e ricreare il canale con lo stesso id; numeri fissi in `registration.ts`.
Idee per dopo: id versionato `reminders-v2` con PR umana sui test 033/035; aprire le impostazioni del canale dall'app; `high` FCM per la puntualità in Doze.
