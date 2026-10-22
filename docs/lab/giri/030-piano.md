---
giro: 030
traguardo: T10
tipo: runbook
fase: costruzione
inizio: 2026-10-22T12:35:15Z
ricerca: sì
accettazione:
ripreso: no
---
# Piano del giro 030 — runbook di Firebase Cloud Messaging

## Fetta e traguardo
T10 ha `integrazioni: ["FCM"]` e `docs/runbook/fcm.md` non esiste: il giro è `runbook` (METODO §6,
V6). Prepara **solo** l'integrazione FCM, così l'umano può crearla mentre i giri di costruzione di T10
scrivono il codice con un FCM finto. Fonti: SPEC §8, §2.2.9, §10; ADR-0001 (R5: FCM con
`expo-notifications`, token del dispositivo inviato al nostro server, senza il servizio push di Expo);
`infra/README.md` (segreto `FCM_SERVICE_ACCOUNT_JSON` già cablato in `consegna` → `deploy.sh` →
`FCM_SERVICE_ACCOUNT_BASE64` nel `.env` del server); ESPERIMENTO §4 (progetto Firebase e
`google-services.json` contano come `integrazione FCM`).

Fatti già noti su cui il runbook si appoggia:
- pacchetto Android: `com.planforhome.app` (`app/app.json`); Expo SDK 58, React Native 0.88;
- environment GitHub dei segreti di produzione: `produzione` (job `deploy` e `apk-firma` di
  `consegna`); il job `apk`, che costruisce l'APK, **non ha environment né segreti**
  (`.github/workflows/consegna.yml`, righe 25 e 494): ciò che serve alla build arriva da una
  variabile di repository (`vars.`);
- `FCM_SERVICE_ACCOUNT_JSON` vuoto = notifiche spente: oggi il server non lo legge ancora.

## Fatto quando — controlli eseguibili
- [ ] `test -f docs/runbook/fcm.md` → esiste, segue `docs/lab/giri/_modello-runbook.md`: sezioni «A cosa
  serve», «Prerequisiti», «Passi», «Prova di riuscita», «Rollback», «Dopo l'esecuzione», «Note di
  esecuzione».
- [ ] `grep -c '☐ __' docs/runbook/fcm.md` → ≥ 6: ogni passo numerato ha la sua casella dei minuti.
  I passi coprono almeno: progetto Firebase (piano gratuito Spark, nessuna carta), app Android
  `com.planforhome.app`, download di `google-services.json`, API «Firebase Cloud Messaging API (V1)»
  attiva, **restrizione della chiave API Android**, account di servizio **dedicato** con ruolo
  personalizzato, chiave JSON, segreto e variabile GitHub.
- [ ] Parole chiave presenti, ciascuna con almeno una riga:
  `for k in com.planforhome.app cloudmessaging.messages.create validate_only 'gh secret set' 'gh variable set' revoca; do grep -qF "$k" docs/runbook/fcm.md || echo "MANCA $k"; done`
  → nessuna riga stampata.
- [ ] Nessun segreto o identificativo di chiave nel runbook:
  `grep -nE '"private_key"|private_key_id"? *: *"[0-9a-f]|AIza[0-9A-Za-z_-]{20,}|BEGIN PRIVATE KEY|[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com' docs/runbook/fcm.md`
  → nessuna riga (gli indirizzi degli account di servizio si scrivono con segnaposto, per esempio
  `<NOME>@<PROGETTO>.iam.gserviceaccount.com`, che la regex non prende).
- [ ] Dove stanno le credenziali, **solo nominate**:
  - `FCM_SERVICE_ACCOUNT_JSON`: **segreto** dell'environment `produzione` (nome già usato da
    `consegna`, non si cambia), con `gh secret set FCM_SERVICE_ACCOUNT_JSON --env produzione < file`;
  - `GOOGLE_SERVICES_JSON`: **variabile di repository** (`gh variable set GOOGLE_SERVICES_JSON < file`,
    letta come `vars.GOOGLE_SERVICES_JSON`), perché il job `apk` non ha segreti. Il runbook spiega
    perché: per Firebase il file non è un segreto (identifica il progetto, non autorizza a inviare),
    ma la chiave API che contiene **va ristretta** (passo dedicato, sotto); non entra comunque nel
    repository pubblico, e lo scrive nel progetto Android la build dell'APK in un giro di costruzione.
- [ ] Passo di **restrizione della chiave API Android** in Google Cloud → Credenziali: restrizione
  per applicazione Android (pacchetto `com.planforhome.app` + impronta SHA-1 della chiave di firma
  dell'APK, presa con `apksigner`/`keytool` dall'umano) e per API (solo «Firebase Cloud Messaging
  API»/«FCM Registration API» e «Firebase Installations API»). Nomi esatti delle API [DA VERIFICARE].
- [ ] Account di servizio: il runbook **vieta** di generare la chiave dall'account
  `firebase-adminsdk` creato da Firebase (ha ruoli ampi) e impone un account dedicato con un
  **ruolo personalizzato** che contiene solo `cloudmessaging.messages.create`; ripiego, solo se il
  ruolo personalizzato non si può creare: «Firebase Cloud Messaging API Admin». Nota sulla policy
  `iam.disableServiceAccountKeyCreation` (organizzazioni create dal 3 maggio 2024): eccezione sul solo
  progetto.
- [ ] «Prova di riuscita» falsificabile, eseguibile **oggi**, senza codice di T10 e senza stampare
  segreti, in quest'ordine:
  - (b) **prima** di cancellare il file locale della chiave: una chiamata FCM HTTP v1
    `messages:send` con `"validate_only": true` a un token di registrazione inventato. Il token
    d'accesso si ottiene con `GOOGLE_APPLICATION_CREDENTIALS=<file> gcloud auth application-default
    print-access-token` [DA VERIFICARE] dentro una sostituzione `$(…)`, in **un solo comando** che
    non usa `-v` né `-i` di `curl` e stampa **solo** il codice HTTP e `error.status` (per esempio con
    `curl -s -o risposta -w '%{http_code}'` e `jq -r .error.status`). Atteso: 400 `INVALID_ARGUMENT`
    o 404 `UNREGISTERED` = credenziale e API funzionano. Diagnosi scritte nel runbook: 401 = chiave
    sbagliata o revocata; 403 `SERVICE_DISABLED` = API FCM v1 non attiva; 403 `PERMISSION_DENIED` =
    ruolo mancante sull'account di servizio. Pulizia subito dopo: `gcloud auth application-default
    revoke` [DA VERIFICARE], poi cancellazione del file locale della chiave.
  - (a) `gh secret list --env produzione` → elenca `FCM_SERVICE_ACCOUNT_JSON`;
    `gh variable list` → elenca `GOOGLE_SERVICES_JSON`.
  - Il giro `verifica-produzione` ripete **solo** (a): il file della chiave a quel punto non esiste più.
  - Il runbook avverte: un agente non legge, non apre e non stampa mai il file della chiave; la
    prova (b) la esegue l'umano.
- [ ] «Prova in produzione»: una riga che rimanda al «Fatto quando» di T10 in `docs/lab/traguardi.json`
  (lo esegue il giro `verifica-produzione` di T10, non questo runbook).
- [ ] «Rollback» in quest'ordine, con **quando** ha effetto ciascun passo:
  1. revoca (cancellazione) della chiave dell'account di servizio in Google Cloud → effetto immediato
     sugli invii (le chiamate successive ricevono 401; un token d'accesso già emesso può durare fino
     alla sua scadenza, al più un'ora [DA VERIFICARE]);
  2. svuotamento del segreto `FCM_SERVICE_ACCOUNT_JSON` → nessun effetto finché non c'è un deploy;
  3. deploy manuale (`gh workflow run consegna -f deploy=true`, input già presente nel workflow) → il server riparte con push spente
     (`FCM_SERVICE_ACCOUNT_JSON` vuoto, già previsto da `infra/README.md`);
  4. facoltativi: variabile `GOOGLE_SERVICES_JSON` cancellata (effetto alla prossima build dell'APK),
     app Android tolta o progetto Firebase cancellato (irreversibile, ultimo).
- [ ] `docs/runbook/README.md`: riga FCM → runbook `fcm.md`, stato «da eseguire».
- [ ] `git diff --name-only origin/main...HEAD` → solo file in `docs/runbook/`, `docs/lab/`, `metrics/`;
  `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessuna violazione del tipo
  `runbook`.
- [ ] Ogni punto preso dalla documentazione ufficiale di Firebase/Google Cloud/Expo ha la fonte e la
  data nel rapporto del giro (CLAUDE.md regola 6); i passi incerti sono marcati [DA VERIFICARE].

## Fuori perimetro
- Qualsiasi codice: niente in `server/`, `app/`, `infra/`, `.github/`. Niente dipendenze.
- Eseguire il runbook, creare il progetto Firebase o i segreti: lo fa l'umano, dopo il merge.
- Scrivere `google-services.json` o una chiave nel repository, anche finta.
- La costruzione di T10 (promemoria, solleciti, silenzio notturno, token dei dispositivi, segno
  «sollecitato» sul web) e la sua verifica in produzione.
- Ogni altra integrazione (Play Store, servizio push di Expo/EAS, email).
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, pubblicazione su Play Store; email di verifica e
  recupero password; sincronizzazione in tempo reale e offline sul web; dati reali (porta R1).
- I difetti aperti di T9 (PUT parziale, dati locali dopo il 401): aspettano la decisione dell'umano.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: giro `runbook` (METODO §6). I controlli sopra li ripete il revisore.

## Porte
- Doppio senso previste: nome del file `docs/runbook/fcm.md`; nome e collocazione della nuova
  variabile di repository `GOOGLE_SERVICES_JSON` (si sposta in un segreto se un giro futuro dà
  segreti al job `apk`); ordine dei passi; ruolo IAM personalizzato (si cambia in console).
- Senso unico in questo giro: nessuna. Il giro scrive solo documenti; FCM come canale è già deciso
  (ADR-0001 R5, `traguardi.json` T10), ed è gratuito. Il runbook deve avvisare che, quando l'umano lo
  esegue, la creazione del progetto Firebase e della chiave sono atti suoi, fuori dal repository.
- Senso unico **attese nei giri di costruzione di T10** (da porre allora, non qui): libreria Maven
  per FCM (`firebase-admin` oppure solo `google-auth-library-oauth2-http` + client HTTP di Spring);
  `expo-notifications` (npm e plugin di Expo); scrittura di `google-services.json` nella build
  dell'APK (tocca `.github/`, revisione umana).

## Rischi di concorrenza
Nessuno nel codice. Rischio operativo: la chiave dell'account di servizio finisce in chiaro (terminale,
cronologia della shell, log). Il runbook impone `gh secret set … < file`, la prova (b) in un solo
comando che stampa solo codice HTTP e `error.status`, poi `gcloud auth application-default revoke` e
la cancellazione del file locale; vieta `echo`/`cat` della chiave o del token d'accesso e `curl -v/-i`.
Un agente non legge mai il file della chiave. Secondo rischio: la chiave API dentro
`GOOGLE_SERVICES_JSON` (variabile, visibile in chiaro a chi ha accesso al repository) usata da altri:
mitigato dalla restrizione per pacchetto, SHA-1 e API.

## Budget
0 righe di codice. Un file nuovo (`docs/runbook/fcm.md`, ≤ 200 righe) più la riga del README dei
runbook e i documenti del giro. Una sessione.

## Domande per il ricercatore (al massimo 3)
1. Passi attuali (ottobre 2026) nella console Firebase e Google Cloud per: progetto sul piano Spark
   senza carta, app Android `com.planforhome.app`, API FCM HTTP v1 attiva, account di servizio con
   il **ruolo minimo** per `messages:send` e creazione della chiave JSON (la policy
   `iam.disableServiceAccountKeyCreation` blocca i progetti nuovi? come si aggira in modo pulito?).
   Fonti ufficiali, con data.
2. FCM HTTP v1: richiesta esatta di `messages:send` con `validate_only: true`, e risposta attesa per
   un token inventato quando la credenziale è valida (codice HTTP e `errorCode`); come ottenere il
   token d'accesso da un file di account di servizio senza stamparlo (gcloud o oauth2l); come si
   revoca una chiave.
3. `google-services.json`: cosa dice Firebase sul metterlo in un repository pubblico, e come lo usa
   Expo SDK 58 con `expo-notifications` (`android.googleServicesFile`, prebuild senza EAS): serve
   qualcos'altro oltre al file per ricevere il token FCM nativo (`getDevicePushTokenAsync`)?

## Idee per dopo
- Un controllo nello smoke di `consegna`, da T10 in poi: il server dichiara «push attive» in
  `/api/health` se `FCM_SERVICE_ACCOUNT_BASE64` è presente e valido (senza esporlo).
- Fetta della costruzione di T10: prima il calcolo dei promemoria con orologio iniettato e FCM finto
  (server puro, nessuna dipendenza), poi solleciti e segno web, poi il client FCM reale e il token
  del dispositivo (le porte delle dipendenze).

## Critica ricevuta e cosa cambia
Accolti **5 su 5** «DA CORREGGERE», più la semplificazione e i facoltativi utili.
1. `GOOGLE_SERVICES_JSON` diventa **variabile di repository** (`vars.`), non segreto: verificato in
   `consegna.yml` che il job `apk` non ha environment né segreti. Controllo (a) con `gh variable list`;
   il runbook spiega che il file non è segreto ma la chiave API va ristretta.
2. Ordine della prova: (b) `validate_only` prima della cancellazione del file della chiave; il giro
   `verifica-produzione` ripete solo (a).
3. Token d'accesso: un solo comando, niente `curl -v/-i`, stampa solo codice HTTP ed `error.status`;
   `GOOGLE_APPLICATION_CREDENTIALS` + `gcloud auth application-default print-access-token`
   [DA VERIFICARE]; pulizia con `gcloud auth application-default revoke`; un agente non legge mai il
   file della chiave.
4. Passo di restrizione della chiave API Android (pacchetto + SHA-1; API FCM Registration e Firebase
   Installations) e divieto di usare l'account `firebase-adminsdk`: account dedicato con ruolo
   personalizzato `cloudmessaging.messages.create`.
5. Rollback ordinato: revoca della chiave (effetto immediato), svuotamento del segreto (nessun effetto
   fino al deploy), deploy manuale (`workflow_dispatch` con `deploy=true`), con il momento in cui ogni
   passo agisce.
- Semplificazione accolta: «Prova in produzione» è una riga che rimanda a `traguardi.json`.
- Controlli per parola chiave e regex anti-segreti con `private_key_id` e `iam.gserviceaccount.com`
  accolti (la regex prende solo indirizzi concreti, non i segnaposto `<…>`).
- Facoltativi: accolta la diagnosi 400/404 ok, 403 `SERVICE_DISABLED` vs `PERMISSION_DENIED` (rende
  la prova più utile, costa due righe). Disattivare Analytics alla creazione del progetto e la nota
  sui ruoli Owner: lasciati al costruttore come consiglio facoltativo, non come controllo del «Fatto
  quando», per non allungare il runbook oltre le 200 righe.
- Scartato: nulla dei punti obbligatori. Nessuna porta a senso unico nuova: variabile e segreto
  GitHub li crea l'umano eseguendo il runbook; il giro scrive solo documenti.
