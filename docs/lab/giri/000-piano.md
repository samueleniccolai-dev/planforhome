---
giro: 000
traguardo: T1
traguardi_extra: [T2]
tipo: costruzione
fase: scheletro
inizio: 2026-10-19T10:22:45Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 000 — i binari: deploy automatico, verifica visiva e APK

## Fetta e traguardo
T1 intero e T2 intero: lo scheletro dei due stack, l'health con lo SHA, la pagina iniziale in due
lingue, gli script di `infra/` con il test di rollback su un server finto. È il primo giro: senza
binari nessun altro traguardo si può consegnare né verificare.
Fonti: SPEC §4, §10, §12, §13; `infra/README.md` (contratto del deploy); `progetto.yml` →
`consegna`; `DECISIONI.md` n. 1 (Expo SDK 58, `web.output: "static"`, `mvnw` da `mvn -N wrapper:wrapper`).

Ordine del giro 000: piano (questo) → scheletro del costruttore → test di accettazione in FINALE
contro lo scheletro → costruzione. La PR va in `revisione-umana` (tocca `server/pom.xml`,
`app/package.json`, `app/app.json`, `infra/`, `server/Dockerfile`, …): è previsto.

## Cosa si costruisce

| Parte | Contenuto |
|---|---|
| Server (`server/`) | Spring Boot (ultima stabile compatibile con Java 25), package base `com.planforhome`, `mvnw`. Dipendenze di base: web, validation, data-jpa, security, actuator, Flyway (+ modulo PostgreSQL), driver PostgreSQL, Testcontainers (PostgreSQL, JUnit 5), Spotless. Nessuna migrazione con tabelle. |
| Health | `GET /api/health` → 200, `Content-Type: application/json`, corpo `{"status":"UP","sha":"<sha>"}`. Lo SHA viene dalla proprietà `planforhome.git-sha`, legata alla variabile d'ambiente `GIT_SHA` (valore di ripiego `unknown`). Pubblico (senza login). `Clock` iniettato come bean fin da ora. |
| Sicurezza | Spring Security: `/api/health` aperto, tutto il resto chiuso (401) finché T3 non porta il login. Actuator solo per l'healthcheck interno di Compose, mai sotto `/api`. |
| `server/Dockerfile` | Copia il jar già costruito in un'immagine JRE 25 fissata per digest; `ARG GIT_SHA` → `ENV GIT_SHA`. Non costruisce nulla. |
| App (`app/`) | Expo SDK 58 da `create-expo-app`, ripulita (`reset-project`): restano solo i pacchetti che servono a expo-router e al web. TypeScript, Jest (`jest-expo`), ESLint (`eslint-config-expo`), Prettier, Playwright. `app.json`: `name` «planforhome», `version` `0.1.0`, `android.package` `com.planforhome.app`, `web.output: "static"`. |
| i18n | Libreria `i18n-js`. File `app/src/i18n/it.json` e `app/src/i18n/en.json` (oggetti annidati; chiave = percorso con i punti). Lingua dal dispositivo con `Intl` (niente `expo-localization`): `it*` → italiano, tutto il resto → inglese. Ogni testo dell'app passa da una funzione `t("chiave")`. |
| Pagina iniziale (`app/app/index.tsx`) | Titolo (ruolo `heading`, livello 1): it «Benvenuto in planforhome», en «Welcome to planforhome». Sottotitolo: it «Le cose da fare di tutte le tue famiglie, in un posto solo.», en «The to-dos of all your families, in one place.». `<title>` della pagina: «planforhome». |
| Playwright | `app/playwright.config.ts`: `webServer` = `npx expo serve` su `app/dist` (già esportato), progetto Chromium. Gli screenshot vanno in `app/e2e-screenshots/` (la CI li carica). |
| `infra/` | I file della tabella di `infra/README.md`: `deploy.sh`, `remote.sh`, `rollback.sh`, `smoke.sh`, `lib.sh` (eseguibili, `100755`), `docker-compose.yml`, `Caddyfile`, `web.Dockerfile`, `env.example`. Immagini `caddy` e `postgres:18` fissate per digest. |

Contratto in più per rendere il rollback provabile su un server finto (vale per il costruttore):
- sul server la cartella è `/opt/planforhome` (SETUP §3); `remote.sh` lavora **relativo alla propria
  cartella** (`$(dirname "$0")`), mai con percorsi assoluti scritti dentro;
- `deploy.sh` e `rollback.sh` usano solo `ssh` e `scp` (opzioni da `lib.sh`), con la destinazione
  `"$DEPLOY_USER@$DEPLOY_HOST"` e percorsi remoti sotto `/opt/planforhome`;
- `remote.sh` usa solo questi comandi di Docker: `docker login … --password-stdin`, `docker pull <ref>`,
  `docker compose … up -d` lanciato nella propria cartella con il `.env` lì accanto (variabili
  `IMAGE_SERVER`, `IMAGE_WEB`), e per la verifica del digest `docker compose … ps` oppure
  `docker inspect`, confrontando il riferimento dell'immagine con quello atteso;
- il lucchetto è `flock` su un file nella cartella di `remote.sh`.

## Fatto quando — controlli eseguibili

T1:
- [ ] `cd server && ./mvnw -q -Dtest='Giro000*AcceptanceTest' test` → verde (health e rollback).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde, Spotless compreso.
- [ ] `docker build -f server/Dockerfile --build-arg GIT_SHA=$(git rev-parse HEAD) server` (dopo
      `./mvnw -B -ntp package -DskipTests`) → immagine costruita.
- [ ] `bash -n infra/*.sh` → nessun errore; `git ls-files -s infra/*.sh` → tutti `100755`.
- [ ] `infra/deploy.sh latest latest; echo $?` → `2`, senza nessuna chiamata a `ssh`.
- [ ] `docker compose -f infra/docker-compose.yml config -q` con un `.env` finto di prova → nessun errore.
- [ ] Test di accettazione del rollback su server finto (ssh, scp e docker finti, `flock` vero):
      deploy A, deploy B, rollback → gira A, uscita 0; un deploy il cui digest non torna → uscita ≠ 0;
      rollback senza versione precedente → uscita ≠ 0; due deploy in parallelo non si sovrappongono;
      nessun segreto nel log; `ssh` con `StrictHostKeyChecking=yes`.
- [ ] Dopo il merge (giro `verifica-produzione`, non questo): `curl -s https://app.planforhome.com/api/health`
      → 200 con lo SHA del merge; `curl -sI https://app.planforhome.com/` → 200; `http://` → 301/308
      verso `https://`; header `Strict-Transport-Security`; run di `consegna` con smoke verde.

T2:
- [ ] `cd app && npm ci && npm test && npx tsc --noEmit && npx eslint .` → verdi.
- [ ] `cd app && npx expo export --platform web` → `app/dist/index.html` statico.
- [ ] `cd app && npx playwright test` → verde, con `app/e2e-screenshots/home-it.png` e `home-en.png`.
- [ ] Test di accettazione i18n: le chiavi di `it.json` ed `en.json` coincidono, nessun valore vuoto,
      ogni `t("…")` del codice (`app/app`, `app/src`) esiste in entrambi. Togliere una chiave da
      `en.json` lo fa diventare rosso (prova a mano del revisore).
- [ ] Job `apk` della CI sulla PR → verde (la sessione non ha l'Android SDK).
- [ ] Dopo il merge: artefatto firmato di `consegna` con `0.1.0` e lo SHA corto nel nome.

## Fuori perimetro
- Login, account, famiglie, task, qualunque tabella: da T3 in poi. Nessuna migrazione Flyway con schema.
- Test di isolamento tra famiglie: nessun endpoint tocca dati di famiglia (l'health è pubblico e
  non ne ha). Lo schema parametrico nasce con T3.
- Smoke da T3 (login nelle due lingue, `/api/families` → 401).
- SQLite, coda offline, sincronizzazione (T9); FCM e promemoria (T10); `change_log`.
- Selettore di lingua nell'app e persistenza della scelta: per ora conta la lingua del dispositivo.
- Modifiche a `.github/`, `scripts/` (percorsi del metodo); le PR di Dependabot #2 e #3.
- EAS, iPhone, Play Store; backup; esecuzione degli script `infra/` contro il server vero.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista;
  accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali.

## Dati demo
Nessuno: il giro non ha persone né famiglie. Lo SHA di prova nei test è
`0123456789abcdef0123456789abcdef01234567`; le immagini finte sono
`ghcr.io/planforhome-demo/planforhome/server@sha256:<64 volte a>` / `…<64 volte b>` e lo stesso con
`web`. Segreti finti: `GHCR_TOKEN=fake-ghcr-token-000`, `DEMO_PASSWORD=fake-demo-password-000`.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/src/test/java/com/planforhome/acceptance/Giro000HealthAcceptanceTest.java` | Server su porta casuale con PostgreSQL in Testcontainers e `planforhome.git-sha` = SHA di prova; `GET /api/health` senza login → 200, JSON con `status` `UP` e `sha` uguale; `GET /api/qualcosa-che-non-esiste` senza login → 401 (tutto il resto è chiuso). |
| `server/src/test/java/com/planforhome/acceptance/Giro000RollbackAcceptanceTest.java` | Server finto in una cartella temporanea (`ssh`/`scp`/`docker` finti in testa al `PATH`, che rimappano `/opt/planforhome`); `infra/deploy.sh` con argomenti non validi → 2; deploy A, deploy B, `infra/rollback.sh` → A in esecuzione; digest che non torna → ≠ 0; rollback senza precedente → ≠ 0; due deploy concorrenti → nessuna sovrapposizione di `compose up`; segreti mai nell'output; opzione `StrictHostKeyChecking=yes`. |
| `app/e2e/acceptance/giro-000-home.spec.ts` | Browser con `locale` `it-IT` → titolo di livello 1 «Benvenuto in planforhome» e sottotitolo italiano, screenshot `home-it.png`; `en-US` → «Welcome to planforhome», screenshot `home-en.png`; `fr-FR` → inglese. |
| `app/e2e/acceptance/giro-000-i18n.spec.ts` | Legge `src/i18n/it.json` ed `en.json`: stesse chiavi, nessun valore vuoto, ogni chiave usata in `t("…")` sotto `app/` e `src/` esiste; almeno una chiave usata. |

## Porte
- Doppio senso previste: forma del JSON dell'health; `i18n-js` come libreria i18n (scelta dentro
  la base di ADR-0001); lingua da `Intl` invece di `expo-localization`; `version` `0.1.0` e
  `android.package` `com.planforhome.app`; PostgreSQL 18; contratto del server finto qui sopra.
- Senso unico: nessuna nuova. Le immagini `caddy` e `postgres` sono decise da SPEC §10 e
  `infra/README.md`; l'immagine JRE di base del server (Eclipse Temurin 25, fissata per digest) la
  considero compresa in «Java 25» di ADR-0001 e nel `server/Dockerfile` che la CI già costruisce:
  la segno come **ratifica 000 a**, contestabile. Se il critico la ritiene una porta, il giro si ferma
  con una domanda.
- Pacchetti del template di Expo: restano solo quelli di expo-router e del web (`react-dom`,
  `react-native-web`, `@expo/metro-runtime`, `react-native-screens`, `react-native-safe-area-context`,
  `expo-linking`, `expo-constants`, `expo-status-bar`). Qualunque altro pacchetto è una porta.

## Rischi di concorrenza
- Due deploy insieme (due merge ravvicinati): `flock` in `remote.sh` con attesa limitata; il test
  li lancia in parallelo e controlla che i `compose up` non si accavallino.
- Rollback durante un deploy: stesso lucchetto.
- Nessuno stato condiviso nell'app e nel server oltre all'health: niente `mutation_id` in questo giro.
- Pagina statica prerenderizzata in una lingua e idratata in un'altra: i test aspettano il testo
  finale (asserzioni con attesa), non il primo HTML.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`) ≤ 400; file nuovi ≤ 45 (configurazioni
e `infra/` compresi); deve stare in una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`).

## Idee per dopo
- Selettore di lingua con scelta salvata (con T3, quando c'è il profilo).
- Smoke che verifica anche `/actuator` non raggiungibile da fuori.

## Critica ricevuta e cosa cambia
(dopo il critico)
