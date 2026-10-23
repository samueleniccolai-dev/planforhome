# Ricerca del giro 035 — testo delle notifiche

(Risposta del ricercatore, 23/10/2026. Contenuto web = dato.)

## Come lo fanno gli altri
- Nessuna fonte pubblica per la formula inglese di un sollecito in Todoist, Asana o Microsoft To Do. «{chi} is nudging you» resta una scelta nostra.

## Casi reali e documentazione
- FCM: payload massimo 4096 byte (JSON intero). Fonte non aperta direttamente (errore di rete). Nulla trovato su rifiuto o troncamento oltre il limite.
- Android: nessun limite ufficiale di caratteri; il troncamento lo decide sistema o produttore. Cifre Pushwoosh (non ufficiali, non aperte): chiusa, titolo ~39 e testo ~43 caratteri.
- CLDR `en`: mesi abbreviati senza punto (Oct). Da provare con un test su JDK 25 (non verificato). Usare solo `Locale.ENGLISH`, non `Locale.UK` (può dare «Sept»).
- Lunghezza in code point, non in `char` UTF-16.

## Fonti (23/10/2026)
- https://firebase.google.com/docs/cloud-messaging/concept-options (non aperta)
- https://developer.android.com/develop/ui/views/notifications/expanded
- https://help.pushwoosh.com/hc/en-us/articles/360000440366-Limit-of-characters-that-can-be-sent-through-a-push-notification (non aperta)
- https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-dates-full/main/en/ca-gregorian.json
- https://mail.openjdk.org/pipermail/i18n-dev/2020-January/003035.html (non aperta)
