---
giro: 030
traguardo: T10
tipo: runbook
fase: critica
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
- environment GitHub dei segreti di produzione: `produzione` (job `deploy` e `apk` di `consegna`);
- `FCM_SERVICE_ACCOUNT_JSON` vuoto = notifiche spente: oggi il server non lo legge ancora.

## Fatto quando — controlli eseguibili
- [ ] `test -f docs/runbook/fcm.md` → esiste, segue `docs/lab/giri/_modello-runbook.md`: sezioni «A cosa
  serve», «Prerequisiti», «Passi», «Prova di riuscita», «Rollback», «Dopo l'esecuzione», «Note di
  esecuzione».
- [ ] `grep -c '☐ __' docs/runbook/fcm.md` → ≥ 6: ogni passo numerato ha la sua casella dei minuti.
  I passi coprono almeno: progetto Firebase (piano gratuito Spark, nessuna carta), app Android
  `com.planforhome.app`, download di `google-services.json`, API «Firebase Cloud Messaging API (V1)»
  attiva, account di servizio con il ruolo minimo per inviare, chiave JSON, segreti GitHub.
- [ ] I segreti sono **solo nominati** con il loro environment: `FCM_SERVICE_ACCOUNT_JSON` in
  `produzione` (nome già usato da `consegna`, non si cambia) e `GOOGLE_SERVICES_JSON` in `produzione`
  (il file non entra nel repository pubblico; lo scrive nel progetto Android la build dell'APK, in un
  giro di costruzione). `grep -nE '"private_key"|AIza[0-9A-Za-z_-]{20,}|BEGIN PRIVATE KEY' docs/runbook/fcm.md`
  → nessuna riga.
- [ ] «Prova di riuscita» falsificabile, eseguibile **oggi**, senza codice di T10 e senza stampare
  segreti: (a) `gh secret list --env produzione` → elenca `FCM_SERVICE_ACCOUNT_JSON` e
  `GOOGLE_SERVICES_JSON`; (b) una chiamata FCM HTTP v1 `messages:send` con `"validate_only": true` a
  un token di registrazione inventato, autenticata con l'account di servizio → errore di token non
  valido (HTTP 400 `INVALID_ARGUMENT` o 404 `UNREGISTERED`, da confermare con la ricerca), **non**
  401/403: la credenziale e l'API funzionano. Il token d'accesso passa in una variabile, mai a video.
- [ ] Una sezione «Prova in produzione, dopo la costruzione di T10» rimanda al «Fatto quando» di T10
  (dispositivo di prova registrato, `reminder.result` con l'identificativo del messaggio): la esegue
  il giro `verifica-produzione`, non questo runbook.
- [ ] «Rollback» passo per passo: chiave dell'account di servizio revocata in Google Cloud, segreti
  GitHub cancellati (`FCM_SERVICE_ACCOUNT_JSON` vuoto = push spente, già previsto da `infra/README.md`),
  app Android tolta o progetto Firebase cancellato, con l'effetto di ciascun passo.
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
- Doppio senso previste: nome del file `docs/runbook/fcm.md`; nome del nuovo segreto
  `GOOGLE_SERVICES_JSON`; ordine dei passi; ruolo IAM suggerito (si cambia in console).
- Senso unico in questo giro: nessuna. Il giro scrive solo documenti; FCM come canale è già deciso
  (ADR-0001 R5, `traguardi.json` T10), ed è gratuito. Il runbook deve avvisare che, quando l'umano lo
  esegue, la creazione del progetto Firebase e della chiave sono atti suoi, fuori dal repository.
- Senso unico **attese nei giri di costruzione di T10** (da porre allora, non qui): libreria Maven
  per FCM (`firebase-admin` oppure solo `google-auth-library-oauth2-http` + client HTTP di Spring);
  `expo-notifications` (npm e plugin di Expo); scrittura di `google-services.json` nella build
  dell'APK (tocca `.github/`, revisione umana).

## Rischi di concorrenza
Nessuno nel codice. Rischio operativo: la chiave dell'account di servizio finisce in chiaro (terminale,
cronologia della shell, log). Il runbook impone `gh secret set … < file` e la cancellazione del file
locale subito dopo, e vieta `echo`/`cat` della chiave o del token d'accesso.

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
(dopo il critico) Accolto: … · Scartato, con motivo: …
