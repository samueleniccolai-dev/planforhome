# Runbook — Firebase Cloud Messaging (FCM)

**Giro:** 030 · **Traguardo:** T10 · **Integrazione:** FCM · **Ultima verifica:** 22/10/2026 (pagine ufficiali non raggiungibili dal giro: ogni nome di console e di API è [DA VERIFICARE] mentre si esegue)

## A cosa serve
Il server invia i promemoria e i solleciti ai telefoni tramite FCM HTTP v1 (SPEC §8, ADR-0001 R5), senza il servizio push di Expo. Chi usa l'app Android riceve la notifica anche ad app chiusa.

Avvisi:
- La creazione del progetto Firebase e della chiave sono atti dell'umano, fuori dal repository (repository pubblico).
- Un agente non legge, non apre e non stampa mai il file della chiave. La prova (b) la esegue l'umano.
- Vietati: `echo` o `cat` della chiave o del token d'accesso, `curl -v`, `curl -i`.

## Prerequisiti
- [ ] Account Google personale dell'umano; piano Firebase gratuito Spark, **nessuna carta**. Nessuna spesa.
- [ ] `gh` autenticato sul repository, `gcloud` e `jq` installati.
- [ ] Segreto da creare: `FCM_SERVICE_ACCOUNT_JSON`, **segreto** dell'environment `produzione` (nome già usato da `consegna`, non cambia).
- [ ] Variabile da creare: `GOOGLE_SERVICES_JSON`, **variabile di repository** (letta come `vars.GOOGLE_SERVICES_JSON`). Perché non un segreto: il job `apk` di `consegna` non ha environment né segreti. Il file identifica il progetto, non autorizza a inviare; la chiave API che contiene però **va ristretta** (passo 5). Il file non entra mai nel repository.
- [ ] Pacchetto Android: `com.planforhome.app`. Impronta SHA-1 della chiave di firma dell'APK a portata di mano (`keytool -list -v -keystore <FILE>` oppure `apksigner verify --print-certs <APK>`).
- [ ] Nessun giro di costruzione presupposto: il server oggi non legge ancora il segreto.

## Passi
Dove si clicca o quale comando si lancia, e cosa si deve vedere. Segna i minuti a fine passo.

| # | Passo | Cosa si deve vedere | Minuti |
|---|---|---|---|
| 1 | Console Firebase (console.firebase.google.com) → «Aggiungi progetto». Nome a scelta (es. `planforhome`). Google Analytics: disattivalo (consigliato). Piano Spark. | Il progetto si apre sulla pagina «Panoramica», piano «Spark», nessuna richiesta di carta. | ☐ __ |
| 2 | Impostazioni progetto → Generali → «Le tue app» → icona Android. Nome pacchetto `com.planforhome.app`; SHA-1 facoltativo ora. Registra l'app. | L'app Android compare con il pacchetto `com.planforhome.app`. | ☐ __ |
| 3 | Scarica `google-services.json` (stessa pagina, scheda dell'app). Salvalo fuori dal repository. Poi `gh variable set GOOGLE_SERVICES_JSON < google-services.json` (dalla cartella del file). | `gh variable list` mostra `GOOGLE_SERVICES_JSON`. Nessun `google-services.json` in `git status`. | ☐ __ |
| 4 | Google Cloud Console → stesso progetto → API e servizi → Libreria → «Firebase Cloud Messaging API» (V1) → Abilita. Se già «Gestisci», ok. | Stato «API abilitata». | ☐ __ |
| 5 | **Restringi la chiave API Android.** Google Cloud → API e servizi → Credenziali → la chiave API creata da Firebase per Android. Restrizione per applicazione: «Android», pacchetto `com.planforhome.app` + impronta SHA-1 della chiave di firma dell'APK. Restrizione per API: solo «Firebase Cloud Messaging API»/«FCM Registration API» e «Firebase Installations API» (nomi esatti [DA VERIFICARE]). Salva. | La chiave mostra «Applicazioni Android» e 2 API; nessuna chiave «Nessuna restrizione» sul progetto. | ☐ __ |
| 6 | IAM e amministrazione → Ruoli → «Crea ruolo»: nome `fcm-sender`, con la sola autorizzazione `cloudmessaging.messages.create`. Ripiego, solo se il ruolo personalizzato non si può creare: «Firebase Cloud Messaging API Admin». | Ruolo `fcm-sender` con 1 autorizzazione. | ☐ __ |
| 7 | IAM → Account di servizio → «Crea account di servizio» **dedicato** (es. `fcm-sender`, indirizzo `<NOME>@<PROGETTO>.iam.gserviceaccount.com`). Assegnagli il ruolo del passo 6 sul progetto. **Vietato** generare la chiave dall'account `firebase-adminsdk` creato da Firebase (ruoli ampi). | L'account compare in IAM con un solo ruolo. | ☐ __ |
| 8 | Sull'account dedicato → Chiavi → «Aggiungi chiave» → JSON. Il file scende in locale (es. `fcm-key.json`, fuori dal repository). Se la creazione è bloccata dalla policy `iam.disableServiceAccountKeyCreation` (default sulle organizzazioni create dal 3 maggio 2024): eccezione (override) sul **solo progetto**, mai sull'organizzazione. | Un file JSON in locale; la chiave è elencata nell'account. | ☐ __ |
| 9 | Prova (b) qui sotto, **prima** di cancellare il file. | Codice 400 o 404, vedi «Prova di riuscita». | ☐ __ |
| 10 | `gh secret set FCM_SERVICE_ACCOUNT_JSON --env produzione < fcm-key.json` | `gh secret list --env produzione` elenca `FCM_SERVICE_ACCOUNT_JSON`. | ☐ __ |
| 11 | Pulizia: `gcloud auth application-default revoke`, poi cancella il file locale della chiave (e, se vuoi, `google-services.json`). | Nessun file di chiave sul disco; `history` senza chiavi. | ☐ __ |

## Prova di riuscita
Due controlli, in quest'ordine.

**(b) Credenziale e API vive, eseguita dall'umano, prima di cancellare il file** (un solo comando; stampa solo codice HTTP ed `error.status`; sostituisci `<PROGETTO>`):

```
GOOGLE_APPLICATION_CREDENTIALS=fcm-key.json; export GOOGLE_APPLICATION_CREDENTIALS; code=$(curl -s -o risposta.json -w '%{http_code}' -X POST -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json' -d '{"validate_only":true,"message":{"token":"token-inventato-0000","notification":{"title":"prova","body":"prova"}}}' https://fcm.googleapis.com/v1/projects/<PROGETTO>/messages:send); echo "$code $(jq -r .error.status risposta.json)"; rm -f risposta.json
```

Atteso: `400 INVALID_ARGUMENT` oppure `404 UNREGISTERED` = credenziale e API funzionano. Diagnosi:

| Risultato | Significato |
|---|---|
| 401 | chiave sbagliata o revocata |
| 403 `SERVICE_DISABLED` | API FCM v1 non attiva (passo 4) |
| 403 `PERMISSION_DENIED` | ruolo mancante sull'account di servizio (passi 6-7) |

Il comando `gcloud auth application-default print-access-token` con `GOOGLE_APPLICATION_CREDENTIALS` e `validate_only` sono [DA VERIFICARE]. Poi la pulizia (passo 11).

**(a) Segreto e variabile presenti** (lo ripete il giro `verifica-produzione`, il file della chiave a quel punto non esiste più):
`gh secret list --env produzione` → elenca `FCM_SERVICE_ACCOUNT_JSON`; `gh variable list` → elenca `GOOGLE_SERVICES_JSON`.

**Prova in produzione:** il «Fatto quando» di T10 in `docs/lab/traguardi.json` (lo esegue il giro `verifica-produzione` di T10, non questo runbook).

## Rollback
In quest'ordine, con il momento in cui agisce ciascun passo:
1. **Revoca** (cancellazione) della chiave dell'account di servizio in Google Cloud → effetto immediato sugli invii (le chiamate successive ricevono 401; un token d'accesso già emesso può durare fino alla scadenza, al più un'ora [DA VERIFICARE]).
2. Svuota il segreto `FCM_SERVICE_ACCOUNT_JSON` (`gh secret set FCM_SERVICE_ACCOUNT_JSON --env produzione --body ''`) → nessun effetto finché non c'è un deploy.
3. Deploy manuale: `gh workflow run consegna -f deploy=true` → il server riparte con push spente (segreto vuoto, come previsto da `infra/README.md`).
4. Facoltativi: cancella la variabile `GOOGLE_SERVICES_JSON` (`gh variable delete GOOGLE_SERVICES_JSON`; effetto alla prossima build dell'APK); togli l'app Android o cancella il progetto Firebase (irreversibile, per ultimo).

## Dopo l'esecuzione
- Minuti totali in `metrics/tempo-umano.csv`, `riferimento = integrazione FCM`, `da_gerio` compilato.
- Un passo andato diversamente da qui si annota sotto, con la data: lo corregge un giro successivo.
- In `docs/runbook/README.md` lo stato passa a «eseguito».

## Note di esecuzione
