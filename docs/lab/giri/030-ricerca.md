# Ricerca giro 030 — FCM per il runbook

Nota: le pagine ufficiali non si sono aperte (DNS non risolve); tutto viene da riassunti di ricerca ed è [DA VERIFICARE] sulla pagina originale. Consultazione: 2026-10-22. Fonti: 10.

1. Token inventato: la documentazione Firebase indica HTTP 400 `INVALID_ARGUMENT` per token malformato; `validate_only` non confermato; 400 o 404 `UNREGISTERED` possibili. Il criterio «non 401/403» resta valido. Fonti: https://firebase.google.com/docs/cloud-messaging/error-codes, https://firebase.google.com/docs/cloud-messaging/send/v1-api
2. Ruolo minimo: ruolo personalizzato con solo `cloudmessaging.messages.create` su un account di servizio dedicato (fonte terza: https://support.twilio.com/hc/en-us/articles/20768292997147-Updating-Twilio-Push-Notifications-for-the-FCM-HTTP-v1-API); ripiego «Firebase Cloud Messaging API Admin» (https://firebase.google.com/docs/cloud-messaging/auth-server).
3. Policy `iam.disableServiceAccountKeyCreation`: di default sulle organizzazioni create dal 3 maggio 2024; eccezione con override sul solo progetto (https://docs.cloud.google.com/iam/docs/troubleshoot-org-policies, https://docs.cloud.google.com/resource-manager/docs/manage-baseline-constraints). Account personale senza organizzazione: di norma assente.
4. `google-services.json`: la chiave API Firebase non è un segreto ma va ristretta (consentire FCM Registration API e Firebase Installations API). Il progetto lo tiene comunque fuori dal repo (`GOOGLE_SERVICES_JSON`). Fonti: https://firebase.google.com/docs/projects/api-keys, https://docs.expo.dev/push-notifications/fcm-credentials/
5. Expo: `expo.android.googleServicesFile` in `app.json`, pacchetto coincidente; su Android 13+ serve un canale di notifica. Prebuild senza EAS su SDK 58 non verificato. Fonti: https://docs.expo.dev/versions/latest/sdk/notifications/, https://docs.expo.dev/push-notifications/push-notifications-setup/

Non risposto: corpo esatto di `messages:send` con `validate_only`, token d'accesso senza stamparlo, revoca della chiave, passi attuali della console.
Da evitare: servizio push di Expo/EAS (ADR-0001 R5); policy modificata a livello di organizzazione.
