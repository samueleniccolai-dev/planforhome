---
giro: 000
traguardo: T1
traguardi_extra: [T2]
tipo: costruzione
fase: revisione
inizio: 2026-10-19T10:22:45Z
ricerca: no
accettazione: 1cdb6be720121c6809e77899fba8b4dd4cfa1b63
ripreso: no
---
# Piano del giro 000 — i binari: deploy automatico, verifica visiva e APK

## Fetta e traguardo
T1 intero e T2 intero: lo scheletro dei due stack, l'health con lo SHA, la pagina iniziale in due
lingue, gli script di `infra/` con il test di rollback su un server finto. È il primo giro: senza
binari nessun altro traguardo si può consegnare né verificare.
Fonti: SPEC §4, §10, §12, §13; `infra/README.md` (contratto del deploy); `progetto.yml` →
`consegna`; `DECISIONI.md` n. 1 (Expo SDK 58, `web.output: "static"`, `mvnw` da `mvn -N wrapper:wrapper`).

Ordine del giro 000: piano → critica → scheletro del costruttore → test di accettazione in FINALE
contro lo scheletro → costruzione. La PR va in `revisione-umana` (tocca `server/pom.xml`,
`app/package.json`, `app/app.json`, `infra/`, `server/Dockerfile`, …): è previsto.

## Cosa si costruisce

| Parte | Contenuto |
|---|---|
| Server (`server/`) | Spring Boot (ultima stabile compatibile con Java 25), package base `com.planforhome`, `mvnw`. Dipendenze di base: web, validation, data-jpa, security, Flyway (+ modulo PostgreSQL), driver PostgreSQL, Testcontainers (PostgreSQL, JUnit 5), Spotless. **Niente Actuator** (critica 2). Nessuna migrazione con tabelle. |
| Health | `GET /api/health` → 200, `Content-Type: application/json`, corpo `{"status":"UP","sha":"<sha>"}`. Lo SHA viene dalla proprietà `planforhome.git-sha=${GIT_SHA:unknown}`: il test la alimenta con la proprietà `GIT_SHA`, come la variabile d'ambiente del `Dockerfile`. Pubblico (senza login). `Clock` iniettato come bean fin da ora. |
| Sicurezza | Spring Security: `/api/health` aperto, tutto il resto chiuso (401) finché T3 non porta il login. Nessun endpoint di gestione (`/actuator` non risponde 200). |
| `server/Dockerfile` | Copia il jar già costruito in un'immagine JRE 25 fissata per digest; `ARG GIT_SHA` → `ENV GIT_SHA`. Non costruisce nulla. |
| App (`app/`) | Expo SDK 58 da `create-expo-app`, ripulita (`reset-project`): restano solo i pacchetti che servono a expo-router e al web. TypeScript, Jest (`jest-expo`), ESLint (`eslint-config-expo`), Prettier, Playwright. `app.json`: `name` «planforhome», `version` `0.1.0`, `android.package` `com.planforhome.app`, `web.output: "static"`. |
| i18n | **Fatta in casa** in `app/src/i18n/index.ts` (critica 1: `i18n-js` sarebbe una dipendenza nuova): `t(key)` e `useT()`, file `it.json` ed `en.json` (oggetti annidati; chiave = percorso con i punti). Lingua dal dispositivo con `Intl` (niente `expo-localization`): `it*` → italiano, tutto il resto → inglese. Ogni testo dell'app passa da `t('…')`. |
| Pagina iniziale (`app/app/index.tsx`) | Titolo (ruolo `heading`, livello 1): it «Benvenuto in planforhome», en «Welcome to planforhome». Sottotitolo: it «Le cose da fare di tutte le tue famiglie, in un posto solo.», en «The to-dos of all your families, in one place.». `<title>` della pagina: «planforhome». |
| Playwright | `app/playwright.config.ts`: `webServer` = `npx expo serve` su `app/dist` (già esportato), progetto Chromium. Gli screenshot vanno in `app/e2e-screenshots/` (la CI li carica). |
| `infra/` | I file della tabella di `infra/README.md`: `deploy.sh`, `remote.sh`, `rollback.sh`, `smoke.sh`, `lib.sh` (eseguibili, `100755`), `docker-compose.yml`, `Caddyfile`, `web.Dockerfile`, `env.example`. Immagini `caddy` e `postgres:18` fissate per digest; volume `pgdata:/var/lib/postgresql` (critica 4). Healthcheck del `server` su `/api/health` con `bash` e `/dev/tcp` (nell'immagine JRE non ci sono `curl` né `wget`, verificato 2026-10-19). |

Contratto del deploy, provato dal test sul server finto (vale per il costruttore):
- sul server la cartella è `/opt/planforhome` (SETUP §3); `remote.sh` lavora **relativo alla propria
  cartella**, mai con percorsi assoluti scritti dentro;
- `deploy.sh` e `rollback.sh` usano solo `ssh` e `scp` (opzioni da `lib.sh`, `StrictHostKeyChecking=yes`
  e `UserKnownHostsFile` con `DEPLOY_KNOWN_HOSTS`), destinazione `"$DEPLOY_USER@$DEPLOY_HOST"`;
- `deploy.sh`: argomenti controllati per primi (uscita 2, senza nessuna variabile `DEPLOY_*`), poi la
  configurazione (uscita 3 se manca, per esempio, `GHCR_USER` o `LAB_BASE_DOMAIN`); `scp` copia in
  `/opt/planforhome/incoming/<sha>/` (critica 5), mai sopra file in uso; `LAB_BASE_DOMAIN` passa a
  `remote.sh deploy` come quinto argomento;
- `rollback.sh` si chiama **senza argomenti**, con l'ambiente del passo di deploy di `consegna.yml`
  (righe 452-464); `GHCR_USER` è `github.actor`, che per un bot finisce con `[bot]`: va accettato;
- `remote.sh`: prende il lucchetto (`flock` su un file con «lock» nel nome, nella cartella del
  server) **prima** di spostare i file da `incoming/`; attesa massima dalla variabile `LOCK_WAIT`
  (secondi), poi uscita ≠ 0 senza `compose up`;
- `.env` (permessi 600) riscritto a ogni deploy; `POSTGRES_PASSWORD` generata **solo se manca** e
  conservata (critica 3); il token del registry non ci finisce mai;
- comandi di Docker ammessi: `docker login ghcr.io -u … --password-stdin`, `docker logout`,
  `docker pull <ref>`, `docker compose up -d --wait …` nella cartella del server, e per la verifica
  `docker compose ps --format '{{.Service}} {{.Image}}'` (solo i container in esecuzione) sui
  servizi `server` e `caddy`;
- `precedente` = l'ultima coppia verificata diversa da quella che si sta mettendo; rilanciare lo
  stesso deploy non la cambia; dopo un rollback riuscito si cancella.

## Fatto quando — controlli eseguibili

T1:
- [ ] `cd server && ./mvnw -q -Dtest='Giro000*AcceptanceTest' test` → verde (health e deploy/rollback;
      gli script di `infra/` li lancia solo il test, mai a mano: il guard lo impedisce).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde, Spotless compreso.
- [ ] `docker build -f server/Dockerfile --build-arg GIT_SHA=$(git rev-parse HEAD) server` (dopo
      `./mvnw -B -ntp package -DskipTests`) → immagine costruita.
- [ ] `bash -n infra/*.sh` → nessun errore; `git ls-files -s infra/*.sh` → tutti `100755`.
- [ ] `docker compose -f infra/docker-compose.yml config -q` con un `.env` finto di prova → nessun errore.
- [ ] Test di accettazione del deploy su server finto (`ssh`, `scp` e `docker` finti, `flock` vero):
      `deploy.sh latest latest` → 2 senza variabili `DEPLOY_*` e senza `ssh`; configurazione mancante → 3;
      deploy A, deploy B, rollback → gira A; B rilanciato due volte → il precedente resta A; B con
      digest che non torna → ≠ 0, poi rollback → A; server con l'immagine giusta ma fermo → ≠ 0;
      rollback senza precedente (anche dopo un rollback riuscito) → ≠ 0; due deploy in parallelo
      senza `compose up` sovrapposti né `scp` su file sotto lucchetto; lucchetto non preso entro
      `LOCK_WAIT` → ≠ 0 senza `compose up`; rollback durante un `compose up` lento → aspetta e
      riesce; `GHCR_USER` di un bot (`…[bot]`) → deploy e rollback riescono; nessun segreto negli
      argomenti di `ssh`/`scp`/`docker`, nei log o nei file del server tranne il `.env` 600;
      `POSTGRES_PASSWORD` identica dopo A e B.
- [ ] Dopo il merge (giro `verifica-produzione`, non questo): `curl -s https://app.planforhome.com/api/health`
      → 200 con lo SHA del merge; `curl -sI https://app.planforhome.com/` → 200; `http://` → 301/308
      verso `https://`; header `Strict-Transport-Security`; run di `consegna` con smoke verde.

T2:
- [ ] `cd app && npm ci && npm test && npx tsc --noEmit && npx eslint .` → verdi.
- [ ] `cd app && npx expo export --platform web` → `app/dist/index.html` statico.
- [ ] `cd app && npx playwright test` → verde in CI (la sessione non scarica Chromium), con
      `app/e2e-screenshots/home-it.png` e `home-en.png`.
- [ ] Test di accettazione i18n: chiavi di `it.json` ed `en.json` uguali, nessun valore vuoto, ogni
      `t('…')`, `t("…")`, `` t(`…`) `` del codice (`app/app`, `app/src`) esiste in entrambi. Togliere
      una chiave da `en.json` lo fa diventare rosso (provato dal pianificatore: 2 test rossi).
- [ ] Job `apk` della CI sulla PR → verde (la sessione non ha l'Android SDK).
- [ ] Dopo il merge: artefatto firmato di `consegna` con `0.1.0` e lo SHA corto nel nome.

## Fuori perimetro
- Login, account, famiglie, task, qualunque tabella: da T3 in poi. Nessuna migrazione Flyway con schema.
- Test di isolamento tra famiglie: nessun endpoint tocca dati di famiglia (l'health è pubblico e
  non ne ha). Lo schema parametrico nasce con T3.
- Smoke da T3 (login nelle due lingue, `/api/families` → 401).
- SQLite, coda offline, sincronizzazione (T9); FCM e promemoria (T10); `change_log`.
- Selettore di lingua nell'app e persistenza della scelta: per ora conta la lingua del dispositivo.
- Actuator e qualunque endpoint di gestione.
- Modifiche a `.github/`, `scripts/` (percorsi del metodo); le PR di Dependabot #2 e #3.
- EAS, iPhone, Play Store; backup; esecuzione degli script `infra/` a mano o contro il server vero.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista;
  accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali.

## Dati demo
Nessuna persona né famiglia. SHA di prova: A `0123456789abcdef0123456789abcdef01234567`, B
`89abcdef0123456789abcdef0123456789abcdef`. Immagini finte:
`ghcr.io/planforhome-demo/planforhome/server@sha256:<64 volte a>` (A) / `<64 volte b>` (B), e lo
stesso con `web`. Server finto: `deploy@203.0.113.10` (rete di documentazione), dominio
`app.planforhome.test`, `GHCR_USER` `planforhome-demo` (e `planforhome-demo[bot]`). Segreti finti:
`GHCR_TOKEN=fake-ghcr-token-000`, `DEMO_PASSWORD=fake-demo-password-000`, chiave ssh con
`fake-ssh-key-000`, FCM con `private_key` `fake-fcm-key-000`.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Commit `1cdb6be` (`test(acceptance): giro 000 — …`).

| File | Dato … quando … allora … |
|---|---|
| `server/src/test/java/com/planforhome/acceptance/Giro000HealthAcceptanceTest.java` | Porta casuale, PostgreSQL in Testcontainers, proprietà `GIT_SHA` = SHA A; `GET /api/health` senza login → 200, JSON con `status` `UP` e `sha` = SHA A; `GET /api/qualcosa-che-non-esiste` → 401; `/actuator` e `/actuator/health` → non 200. |
| `server/src/test/java/com/planforhome/acceptance/Giro000RollbackAcceptanceTest.java` | 12 casi sul server finto, uno per ogni voce del controllo T1 qui sopra. `ssh` finto: registra gli argomenti, rifiuta senza `StrictHostKeyChecking=yes` o senza la host key fissata, esegue il comando con `/opt/planforhome` rimappato e ambiente pulito (passa solo `LOCK_WAIT`). `scp` finto: registra, rifiuta di sovrascrivere un file se un file `*lock*` della cartella è sotto `flock`. `docker` finto: `login` controlla il token su stdin, `compose up` crea un marcatore, dorme ~1 s (`up-seconds`), fallisce se il marcatore c'è già; `compose ps` rispetta `--format` ed elenca solo i container in esecuzione (salvo `-a`); file di controllo `digest-mismatch`, `server-stops`. |
| `app/e2e/acceptance/giro-000-home.spec.ts` | `locale` `it-IT` → titolo di livello 1 «Benvenuto in planforhome», sottotitolo italiano, `<title>` «planforhome», screenshot `home-it.png`; `en-US` → «Welcome to planforhome», `home-en.png`; `fr-FR` → inglese. |
| `app/e2e/acceptance/giro-000-i18n.spec.ts` | Stesse chiavi in `it.json` ed `en.json`, nessun valore vuoto, ogni chiave usata con `t()` (apici singoli, doppi, backtick) sotto `app/` e `src/` esiste in entrambe; il cercatore di chiavi ignora `split('.')` e simili. |

Stato contro lo scheletro (commit `46ff345`): server 15 test, **14 verdi e 1 rosso per
asserzione** — `theGithubActorOfABotIsAValidRegistryUser`: `deploy.sh` esce 3 («invalid GHCR_USER»)
con `GHCR_USER=planforhome-demo[bot]`. i18n: 4 verdi (rossi togliendo una chiave da `en.json`).
Home: non eseguibile in sessione (manca Chromium), la esegue la CI. Lo scheletro del costruttore
copre già quasi tutto il giro: è l'ordine previsto per il 000.

Cosa resta al costruttore: accettare in `GHCR_USER` il suffisso `[bot]` (anche in `remote.sh`,
senza aprire l'iniezione: resta tra apici singoli); verificare in CI la home e l'APK; `verify`
completo e `docker compose config`.

## Porte
- Doppio senso previste: forma del JSON dell'health; i18n fatta in casa con `Intl` (niente
  `expo-localization`); `version` `0.1.0` e `android.package` `com.planforhome.app`; PostgreSQL 18;
  contratto del deploy qui sopra (`LOCK_WAIT`, `incoming/<sha>/`, nome del lucchetto).
- Senso unico: nessuna nuova. Le immagini `caddy` e `postgres` sono decise da SPEC §10 e
  `infra/README.md`; l'immagine JRE di base del server (Eclipse Temurin 25, fissata per digest) la
  considero compresa in «Java 25» di ADR-0001: **ratifica 000 a**, contestabile.
- Pacchetti del template di Expo: restano solo quelli di expo-router e del web (`react-dom`,
  `react-native-web`, `@expo/metro-runtime`, `react-native-screens`, `react-native-safe-area-context`,
  `expo-linking`, `expo-constants`, `expo-status-bar`). Qualunque altro pacchetto è una porta.
- Il test i18n usa i tipi di Node con `/// <reference types="node" />`: `@types/node` arriva già
  come dipendenza transitiva; non si aggiunge a `package.json` (sarebbe una porta).

## Rischi di concorrenza
- Due deploy insieme (due merge ravvicinati): `flock` in `remote.sh` prima di toccare i file,
  attesa limitata; il test li lancia in parallelo e controlla che i `compose up` non si accavallino e
  che `scp` non sovrascriva file sotto lucchetto.
- Rollback durante un deploy lento: stesso lucchetto; il test controlla che aspetti e poi riesca.
- Lucchetto non preso in tempo: uscita ≠ 0 senza `compose up`.
- Nessuno stato condiviso nell'app e nel server oltre all'health: niente `mutation_id` in questo giro.
- Pagina statica prerenderizzata in inglese e idratata nella lingua del dispositivo: i test
  aspettano il testo finale (asserzioni con attesa), non il primo HTML.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`) ≤ 400; file nuovi ≤ 45 (configurazioni
e `infra/` compresi); deve stare in una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`).

## Idee per dopo
- Selettore di lingua con scelta salvata (con T3, quando c'è il profilo).
- Smoke che verifica anche `/actuator` non raggiungibile da fuori.
- `die` in `lib.sh` stampa anche il codice d'uscita nel messaggio («ERROR: invalid GHCR_USER 3»):
  cosmetico.

## Critica ricevuta e cosa cambia
Accolto (tutti i punti):
1. `i18n-js` è una porta: i18n fatta in casa (`t()`/`useT()` in `app/src/i18n/`), tolta dalle porte.
2. Niente Actuator: healthcheck su `/api/health` con `bash` e `/dev/tcp`; il test controlla che
   `/actuator` non risponda 200.
3. `.env` riscritto a ogni deploy, `POSTGRES_PASSWORD` generata solo se manca: test con password
   identica dopo A e B e `.env` 600.
4. `postgres:18` con `pgdata:/var/lib/postgresql`: nel contratto (verificato dal costruttore).
5. `scp` in `incoming/<sha>/`, `flock` prima di spostare: `scp` finto che fallisce se sovrascrive
   un file mentre il lucchetto è preso.
- Concorrenza: marcatore di `compose up`, attesa massima del lucchetto, rollback durante un
  `compose up` lento: tre test.
- Test: health alimentato da `GIT_SHA`; rollback senza argomenti con l'ambiente del job; argomenti
  di `ssh`/`scp` registrati e senza segreti, segreti solo nel `.env` 600; B due volte; B fallito al
  digest poi rollback; container giusto ma fermo; regex per i tre tipi di apici; `latest latest` → 2
  senza `DEPLOY_*`.
- Note del costruttore: il `docker` finto rispetta `compose ps --format '{{.Service}} {{.Image}}'` e
  `up -d --wait`; `precedente` cancellato dopo il rollback (provato con un secondo rollback → ≠ 0);
  uscite 2 e 3; il controllo a mano `infra/deploy.sh latest latest` è passato dentro il test.

Aggiunto dall'ambiente del job: `github.actor` di un bot (`…[bot]`) come `GHCR_USER` — oggi rosso.
Scartato: nulla.
