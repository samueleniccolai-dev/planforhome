# Guida alla console Google Cloud per FCM

**Integrazione:** FCM · **Traguardo:** T10 · **Ultima verifica:** 22/10/2026, alla prima esecuzione di `fcm.md`

Serve dopo il runbook: per controllare, ruotare la chiave, aggiornare lo SHA-1 o revocare l'accesso. Il repository è pubblico, quindi i valori reali non stanno qui. L'ID del progetto, lo SHA-1 e l'ID della chiave si leggono in console o con i comandi di «Controllare lo stato». `<PROGETTO>` è l'ID del progetto Firebase.

## Prima di entrare

Entra sempre con l'account Google personale, nel progetto `<PROGETTO>`, e non attivare mai la fatturazione.

- **Account:** quello personale, mai quello di lavoro. È il proprietario del progetto.
- **Da un PC non tuo:** finestra in incognito, nessuna password salvata, nessuna sincronizzazione. Alla fine chiudi tutte le schede.
- **Progetto:** selettore in alto a sinistra → `<PROGETTO>`.
- **Banner «Prova Google Cloud con 300 $»:** clicca «Ignora». Mai «Inizia gratuitamente»: chiede una carta e apre un account di fatturazione. Il progetto è sul piano Firebase **Spark**, senza fatturazione.
- **Due console, un progetto:** [console.cloud.google.com](https://console.cloud.google.com/) per API, chiavi e permessi; [console.firebase.google.com](https://console.firebase.google.com/) per l'app Android e `google-services.json`.

## Mappa della console

Quasi tutto sta sotto il menu ☰ in alto a sinistra. La barra di ricerca in alto trova una pagina anche per nome.

| Cosa ti serve | Dove si trova | Cosa ci fai |
|---|---|---|
| Chiavi API | ☰ → API e servizi → Credenziali | restrizioni per app Android e per API |
| API attive | ☰ → API e servizi → API e servizi abilitati | controllare che FCM sia attiva |
| Abilitare un'API | ☰ → API e servizi → Libreria | cercare l'API → «Abilita» |
| Account di servizio | ☰ → IAM e amministrazione → Account di servizio | `fcm-sender` e la sua scheda «Chiavi» |
| Chi ha quale ruolo | ☰ → IAM e amministrazione → IAM | controllare i permessi |
| Ruoli personalizzati | ☰ → IAM e amministrazione → Ruoli | il ruolo `fcm-sender` |
| Terminale | icona **>_** in alto a destra (Cloud Shell) | `gcloud`, `gh` e `jq` già installati |
| App Android e `google-services.json` | Firebase → ⚙ Impostazioni progetto → Generali → «Le tue app» | riscaricare il file |
| Fatturazione | ☰ → Fatturazione | **non toccare** |

## Cosa c'è nel progetto

Dopo il runbook FCM del 22/10/2026 il progetto ha un solo account di servizio con un solo permesso, e una sola chiave. La chiave sta solo nel segreto di GitHub.

| Risorsa | Valore | Note |
|---|---|---|
| Progetto | `<PROGETTO>`, piano Spark | Analytics e Gemini spenti |
| App Android | `com.planforhome.app` | registrata in Firebase |
| API per FCM | `fcm.googleapis.com`, `fcmregistrations.googleapis.com`, `firebaseinstallations.googleapis.com` | più quelle attive di default |
| Android key (auto created by Firebase) | app Android `com.planforhome.app` + SHA-1 della chiave di firma dell'APK di rilascio; solo Firebase Installations API e FCM Registration API | è la chiave dentro `google-services.json` |
| Browser key (auto created by Firebase) | nessuna restrizione per sito, 27 API di Firebase | non usata da planforhome; lasciata così (decisione aperta in `docs/lab/PROGRESS.md`) |
| Ruolo personalizzato | titolo `fcm-sender`, ID `fcmSender`, solo `cloudmessaging.messages.create` | |
| Account di servizio | `fcm-sender@<PROGETTO>.iam.gserviceaccount.com` | un solo ruolo, `fcmSender` |
| Chiave dell'account | una sola | creata in Cloud Shell, mai scaricata |
| Segreto GitHub | `FCM_SERVICE_ACCOUNT_JSON`, environment `produzione` | contiene la chiave; lo usa il deploy |
| Variabile GitHub | `GOOGLE_SERVICES_JSON`, del repository | serve alla build dell'APK |

## Cloud Shell senza lasciare tracce

In Cloud Shell lavora sempre in `/tmp/fcm`. La home (`$HOME`, 5 GB) resta salvata tra una sessione e l'altra. `/tmp` invece sparisce quando la macchina si spegne.

**Avvio** (icona **>_**, poi):

```
mkdir -m 700 -p /tmp/fcm && cd /tmp/fcm
export P=<PROGETTO> GH_CONFIG_DIR=/tmp/fcm/gh SA=fcm-sender@<PROGETTO>.iam.gserviceaccount.com
gh auth login -h github.com -p https -w
```

- Il login mostra un codice: inseriscilo su github.com/login/device. A «Authenticate Git with your GitHub credentials?» rispondi **No**, altrimenti scrive in `~/.gitconfig`.
- Un file caricato con ⋮ → «Carica» finisce nella home. Spostalo subito con `mv ~/<file> /tmp/fcm/`.
- La connessione cade spesso. Clicca «Riconnetti» e ripeti `cd` ed `export`. Se `/tmp/fcm` non c'è più, la macchina è nuova e i file sono persi.
- `sudo apt-get install` vale solo fino alla fine della sessione.
- Per vedere variabili e segreti stampa **solo i nomi**: `gh variable list -R samueleniccolai-dev/planforhome --json name -q '.[].name'`. Mai `cat` di una chiave, mai `curl -v` o `curl -i`.

**Pulizia** (sempre, alla fine):

```
unset GOOGLE_APPLICATION_CREDENTIALS SA
gh auth logout -h github.com
git config --global --remove-section credential.https://github.com 2>/dev/null; git config --global --remove-section credential.https://gist.github.com 2>/dev/null
cd ~ && rm -rf /tmp/fcm
ls -a ~ | grep -i -E 'google-services|fcm' || echo pulito
```

Poi `exit`, cancella dal PC i file scaricati (anche dal cestino) e chiudi la finestra in incognito.

## Operazioni ricorrenti

Tre operazioni, tutte da Cloud Shell avviata come sopra: un controllo da 2 minuti, la rotazione della chiave e l'aggiornamento dello SHA-1.

### Controllare lo stato

```
gcloud services api-keys list --format='yaml(displayName,restrictions)'
gcloud projects get-iam-policy "$P" --flatten='bindings[].members' --filter='bindings.members:fcm-sender@' --format='value(bindings.role)'
gcloud iam service-accounts keys list --iam-account="$SA" --managed-by=user --format='value(name.basename())'
```

Devi vedere: la Android key con `androidKeyRestrictions` e 2 `apiTargets`; una sola riga `projects/<PROGETTO>/roles/fcmSender`; una sola chiave.

### Ruotare la chiave di servizio

1. Annota l'ID della chiave attuale con il terzo comando qui sopra.
2. Crea la nuova chiave: `(umask 077; gcloud iam service-accounts keys create fcm-key.json --iam-account="$SA")`
3. Provala. Devi vedere `400 INVALID_ARGUMENT`. Un `403` subito dopo un cambio di permessi è la propagazione: aspetta 2 minuti e ripeti.

   ```
   export GOOGLE_APPLICATION_CREDENTIALS=/tmp/fcm/fcm-key.json
   code=$(curl -s -o risposta.json -w '%{http_code}' -X POST -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json' -d '{"validate_only":true,"message":{"token":"token-inventato-0000","notification":{"title":"prova","body":"prova"}}}' "https://fcm.googleapis.com/v1/projects/$P/messages:send"); echo "$code $(jq -r '[.error.status, .error.message] | join(" — ")' risposta.json)"; rm -f risposta.json
   ```
4. Mettila nel segreto: `gh secret set FCM_SERVICE_ACCOUNT_JSON --env produzione -R samueleniccolai-dev/planforhome < fcm-key.json`
5. Il server la usa dal deploy successivo: un merge su `main` o un run di `consegna`. Con `LAB_ATTIVO=true`, un run manuale di `consegna` fa partire anche il job `avanti`.
6. A deploy fatto, cancella la vecchia: `gcloud iam service-accounts keys delete <ID-VECCHIO> --iam-account="$SA" --quiet`
7. Pulizia.

### Nuovo certificato di firma dell'APK

Se cambia il keystore di rilascio, cambia lo SHA-1 e l'app non registra più il token FCM. Leggi il nuovo SHA-1 dall'APK firmato, senza toccare il keystore:

```
read -r RUN NAME < <(gh api repos/samueleniccolai-dev/planforhome/actions/artifacts --jq '.artifacts[] | select(.name|startswith("planforhome-")) | select(.expired|not) | "\(.workflow_run.id) \(.name)"' | head -1)
gh run download "$RUN" -R samueleniccolai-dev/planforhome -n "$NAME" -D apk
sudo apt-get install -y apksigner >/dev/null
apksigner verify --print-certs apk/*.apk | grep 'SHA-1' | sed 's/.*: //; s/../&:/g; s/:$//' | tr a-f A-F
```

Poi Credenziali → Android key → matita sulla riga `com.planforhome.app` → nuovo SHA-1 → «Fine» → «Salva». L'effetto arriva entro 5 minuti. Copia lo SHA-1, non riscriverlo: `0` e `O` si confondono.

## Emergenza: revocare l'accesso

Se la chiave è finita dove non doveva, cancellala per prima cosa: è l'unico passo con effetto immediato. Gli altri agiscono al deploy o alla build.

1. **Cancella la chiave.** IAM e amministrazione → Account di servizio → `fcm-sender` → scheda «Chiavi» → cestino. Da Cloud Shell: `gcloud iam service-accounts keys delete <ID> --iam-account="$SA" --quiet`. Effetto: nessun nuovo token d'accesso. Un token già emesso vale fino alla scadenza: il runbook dice al massimo un'ora, ma è ancora da verificare.
2. **Togli il segreto.** `gh secret delete FCM_SERVICE_ACCOUNT_JSON --env produzione -R samueleniccolai-dev/planforhome`. Effetto: nessuno fino al deploy.
3. **Rifai il deploy.** Un merge su `main` o un run di `consegna`. Il server riparte con le notifiche push spente, come previsto con il segreto vuoto. Con `LAB_ATTIVO=true`, il run manuale fa partire anche il job `avanti`.
4. **Facoltativi, per ultimi:**
   - `gh variable delete GOOGLE_SERVICES_JSON -R samueleniccolai-dev/planforhome`, con effetto alla prossima build dell'APK;
   - togliere l'app Android da Firebase, o cancellare il progetto. **Irreversibile.**

## Da non fare e problemi già visti

**Da non fare**

- Cliccare «Inizia gratuitamente» o creare un account di fatturazione.
- Generare chiavi dall'account `firebase-adminsdk-…` creato da Firebase: ha ruoli troppo ampi.
- Scaricare la chiave sul PC, oppure stamparla con `cat`, `echo`, `curl -v`.
- Filtrare `gh variable list` con `cut -f1`: stampa a video tutto `google-services.json`.
- Attivare Analytics o Gemini: a FCM non servono.
- Cancellare la Browser key senza un motivo preciso: è irreversibile.

**Problemi già visti il 22/10/2026**

| Cosa vedi | Causa | Cosa fare |
|---|---|---|
| «Fingerprint del certificato SHA-1 non valida» | una lettera `O` al posto dello zero | copia lo SHA-1 dal terminale |
| `403 PERMISSION_DENIED` nella prova | ruolo assegnato da meno di 2 minuti | aspetta e ripeti: poi esce `400 INVALID_ARGUMENT` |
| WARNING «API is not enabled for permissions», `apiDisabled: true` | anomalia di gcloud | ignoralo: il permesso funziona |
| ID del ruolo `fcm-sender` rifiutato | gli ID non ammettono il trattino | ID `fcmSender`, titolo `fcm-sender` |
| «Service account … already exists» | comando lanciato due volte | nessun danno |
| «The project property is set to the empty string» | variabile `P` persa dopo una riconnessione | `export P=<PROGETTO>` |
| «La connessione a Google Cloud Shell è stata interrotta» | inattività o rete | «Riconnetti», poi `cd` ed `export` |

## Fonti

Pagine ufficiali consultate il 22/10/2026:

- [Firebase — chiavi API](https://firebase.google.com/docs/projects/api-keys)
- [Firebase — ruoli predefiniti per prodotto](https://firebase.google.com/docs/projects/iam/roles-predefined-product)
- [FCM — projects.messages.send](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send)
- [FCM — codici di errore](https://firebase.google.com/docs/cloud-messaging/error-codes)
- [gcloud auth application-default print-access-token](https://docs.cloud.google.com/sdk/gcloud/reference/alpha/auth/application-default/print-access-token)
- [Vincoli di sicurezza di base delle organizzazioni](https://docs.cloud.google.com/organization-policy/manage-baseline-constraints)
- [Come funziona Cloud Shell](https://docs.cloud.google.com/shell/docs/how-cloud-shell-works?hl=it)

Procedura di prima installazione: `docs/runbook/fcm.md`.
