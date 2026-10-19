---
giro: 003
traguardo: T3
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-19T21:33:27Z
ricerca: no
accettazione: 41337bc8dc4ca47543d77b1fc831854e32e7c11a
ripreso: no
---
# Piano del giro 003 — lucchetto: account e accesso sull'API

## Fetta e traguardo
T3, parte 1 di 2: **il lato server dell'accesso** — registrazione (crea famiglia o codice d'invito),
login e logout con token opaco, cambio password, regole sulle password, limite ai tentativi, dati
demo dell'Appendice A, test di isolamento parametrico, smoke `GET /api/families` → 401.
È il primo traguardo dopo i binari: senza account nessun altro traguardo (T4–T10) ha un utente.
T3 intero non sta in una sessione (server + schermate web + cookie/CSRF + smoke della pagina di
login): si taglia sul confine API / app.

**Resta per la parte 2 (giro successivo, T3):** schermate di login e logout sul web (Expo), cookie
di sessione `HttpOnly; Secure; SameSite=Lax` con protezione CSRF per il web, test Playwright di
login e logout, smoke della pagina di login nelle due lingue, decisione sull'archivio del token su
Android (probabile porta: `expo-secure-store`).

Fonti: SPEC §2.2.1, §2.3, §5 (righe P13–P14 solo dove servono a T3), §6, §9, §10, App. A;
`infra/smoke.sh`; `infra/docker-compose.yml` (`DEMO_PASSWORD` già passato al server).

## Cosa si costruisce

| Parte | Contenuto |
|---|---|
| Migrazione `V1__accounts.sql` | Tabelle `person`, `user_account`, `family` (`time_zone` predefinito `Europe/Rome`), `membership` (PK `family_id, person_id`; `role` `MANAGER`/`MEMBER`; `referent_person_id` con FK composta `(family_id, referent_person_id)` → `membership`), `invite` (`code` unico), `auth_session` (`token_hash` SHA-256 unico, `person_id`, `created_at`, `expires_at`, `revoked_at`). Colonne come SPEC §6; `timestamptz`; email unica normalizzata (trim + minuscolo). Indici: `membership(person_id)`, `auth_session(person_id)`, `invite(family_id)` (oltre a PK e vincoli unici). Nessun `DEFAULT now()` usato dalla logica: ogni istante (`created_at`, `expires_at`, `used_at`, `revoked_at`) arriva come parametro da `Clock.instant()`. Id UUIDv7 generati dal server (Hibernate `@UuidGenerator(style = VERSION_7)`, nessuna libreria). |
| Package `com.planforhome.account` | Registrazione, login, logout, `/api/me`, cambio password, criteri delle password, limite ai tentativi. Logica nei servizi, non nei controller. |
| Package `com.planforhome.family` | `GET /api/families`, `GET /api/families/{familyId}/members`, `POST /api/families/{familyId}/invites` (minimo indispensabile per provare la registrazione con codice; i casi P13 completi sono di T4). |
| Package `com.planforhome.demo` | Seeder dell'Appendice A: parte all'avvio **solo se** `planforhome.demo.password=${DEMO_PASSWORD:}` non è vuota; idempotente (se `marco@example.com` esiste non fa nulla), **in una sola transazione** (o tutto o niente). Nome visualizzato = nome proprio («Marco», «Leo», …). Nessuna password demo in `server/src/main`. Nota nel runbook della consegna se esiste, altrimenti nel rapporto: `DEMO_PASSWORD` vuota = nessun dato demo. |
| Sicurezza | Filtro che legge `Authorization: Bearer <token>`, cerca `sha256(token)` in `auth_session` non revocata e non scaduta (`Clock`), account non disattivato. Pubblici solo `/api/health`, `POST /api/auth/register`, `POST /api/auth/login`. Password con `BCryptPasswordEncoder` di Spring Security (Argon2 richiederebbe BouncyCastle: dipendenza nuova). Login con email sconosciuta: si esegue comunque `matches` contro un hash BCrypt fittizio (stesso costo), così il tempo non rivela chi esiste. `server.forward-headers-strategy=native` per avere l'IP vero dietro Caddy. |
| Smoke (`infra/smoke.sh`) | Riga «T3: `GET /api/families` senza login → 401». |

### Contratto dell'API (lo usano i test di accettazione)

Errori: corpo JSON `{"error":"<codice>"}`.

| Metodo e percorso | Corpo | Risposta |
|---|---|---|
| `POST /api/auth/register` | `{email, password, displayName, locale ("it"/"en"), familyName?, inviteCode?}` | 201 `{personId, families:[{id,name,role}]}`. Esattamente uno tra `familyName` e `inviteCode`, se no 400 `registration_mode_required`. Email (dopo trim + minuscolo) vuota, senza `@` o oltre 254 caratteri → 400 `email_invalid`. `displayName` vuoto dopo trim o oltre 80 caratteri → 400 `display_name_invalid`. Password oltre 72 byte UTF-8 → 400 `password_too_long` (72 byte esatti ammessi). Codice sconosciuto, scaduto o usato → 400 `invite_invalid`. Password < 10 caratteri → 400 `password_too_short`; nell'elenco comune → 400 `password_too_common`. Email già registrata (anche con maiuscole o spazi diversi) → 409 `email_taken`, e un codice d'invito presente nella richiesta **non** si consuma (rollback). Ogni rifiuto **non crea** persona, account né appartenenza. |
| `POST /api/auth/login` | `{email, password}` | 200 `{token, expiresAt, personId}` (sessione di 30 giorni). Email inesistente, password sbagliata o account disattivato, password oltre 72 byte → 401 con corpo **identico** `{"error":"invalid_credentials"}` (mai 500). Email confrontata normalizzata. `expiresAt` = `Clock` + 30 giorni. |
| `POST /api/auth/logout` | — | 204; il token non vale più (401). |
| `GET /api/me` | — | 200 `{personId, email, displayName, locale}`. |
| `PUT /api/me/password` | `{currentPassword, newPassword}` | 204. Attuale sbagliata → 400 `current_password_wrong`; nuova debole → 400 `password_too_short` / `password_too_common` / `password_too_long`. |
| `GET /api/families` | — | 200 `[{id, name, timeZone, role}]` delle sole famiglie dell'utente. Senza login 401. |
| `GET /api/families/{familyId}/members` | — | 200 `[{personId, displayName, role, hasAccount, referentPersonId}]`. Famiglia non propria → 404. |
| `POST /api/families/{familyId}/invites` | — | Gestore: 201 `{code, expiresAt}` (scade dopo 7 giorni, codice casuale da `SecureRandom`, almeno 80 bit). Membro: 403. Famiglia non propria: 404. |

Limite ai tentativi (in memoria, finestre sul `Clock`; valori in costanti):
- **login:** 5 tentativi falliti per la stessa email **normalizzata** (trim + minuscolo) in 15 minuti →
  dal sesto 429 `too_many_attempts` (anche con la password giusta), con `Retry-After` in secondi;
  contano anche le email che non esistono (stessa risposta che per un'email esistente);
- **registrazione:** 10 per IP in un'ora → dall'undicesima 429;
- **codici d'invito:** 5 codici rifiutati per IP in un'ora → dal sesto uso di un codice 429 (anche
  valido, che resta non consumato).
- Le finestre scadute si eliminano; la mappa ha un tetto di voci (costante, per esempio 10 000): oltre,
  si scartano le voci più vecchie. Test di unità del costruttore.

### Dati demo (inventati, App. A)

Email `<nome>@example.com` (dominio riservato). Password: tutte uguali a `DEMO_PASSWORD`; nei test
`Demo-R0-Pass-2026` (solo in `server/src/test`).

| Famiglia | Persone (ruolo) |
|---|---|
| Famiglia Principale | Marco (MANAGER), Giulia (MANAGER), Leo (MEMBER, senza account, referente Giulia), Sofia (MEMBER, senza account, referente Marco) |
| Famiglia Mamma | Anna (MANAGER), Pietro (MANAGER), Giulia, Luca, Paolo, Davide (MEMBER) |
| Famiglia Babbo | Rosa (MANAGER), Franco (MANAGER), Marco (MEMBER) |

Utenti: marco, giulia, anna, pietro, luca, paolo, davide, rosa, franco (9); risorse senza account
Leo e Sofia (2). Locale `it` per tutti. Fuso `Europe/Rome`.

Utenti creati dai test (tutti `@example.com`, diversi per ogni test perché il database è condiviso):
`nuova.gestrice` («Famiglia Verdi»), `nuovo.membro`, `senza.famiglia`, `codice.scaduto`,
`codice.usato`, `gestore.rossi`/`bianchi`/`neri`/`gialli`/`viola`, `raffica.1`…`raffica.11`,
`accesso.base`, `sessione.lunga`, `blocco.login`, `fantasma` (mai registrato), `cambio.password`, …;
password valida `Lanterna-Blu-42`; password comune di 10+ caratteri
`password123`; corta `Corta-1`.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro003*AcceptanceTest' test` → tutti verdi. Coprono:
  - registrazione con `familyName` → 201, chi si registra è `MANAGER` della nuova famiglia (via `GET /api/families`);
  - registrazione con codice valido → 201, `MEMBER` nella famiglia del codice; il codice scade a `Clock` + 7 giorni e non si riusa;
  - codice valido con email già presa (anche in maiuscolo) → 409 `email_taken`, e lo stesso codice vale poi per un'altra email;
  - password di 73 byte (ASCII o 37 «à») → 400 `password_too_long`, 72 byte → 201; email di 262 caratteri o senza `@` → 400 `email_invalid`; nome vuoto o di 81 caratteri → 400 `display_name_invalid`, 80 → 201;
  - registrazione senza modo, con entrambi, con codice scaduto (orologio +7 giorni e 1 minuto), già usato o inventato → 400 e nessun account (il login con quella email dà 401 e la stessa email si registra poi con `familyName`);
  - login giusto → 200 con token ed `expiresAt` = `Clock` + 30 giorni; `GET /api/me` con il token → 200; logout → token rifiutato (401);
  - sessione: dopo 29 giorni di orologio 200, dopo 30 giorni e 1 minuto 401;
  - email inesistente, password sbagliata e password di 200 caratteri → 401 con corpo e stato identici; mediana del tempo con email inesistente ≥ 40% di quella con password sbagliata;
  - limiti: sesto login fallito → 429 anche con la password giusta, e dopo 15 minuti di orologio torna 200; 6 tentativi su un'email inesistente → 429; 5 falliti con varianti di maiuscole e spazi contano sulla stessa email (sesto in maiuscolo → 429); undicesima registrazione → 429, da un altro IP (`X-Forwarded-For`) 201, dopo un'ora 201; sesto codice dopo 5 rifiutati → 429 anche se valido, e dopo un'ora quel codice funziona;
  - cambio password: attuale sbagliata → 400; nuova corta, comune o oltre 72 byte → 400; riuscito → vecchia password 401, nuova 200;
  - password `Corta-1` → 400 `password_too_short`; `password123` → 400 `password_too_common`;
  - seeder con `DEMO_PASSWORD`: i 9 utenti entrano; Giulia ha 2 famiglie (Principale MANAGER, Mamma MEMBER), Marco 2, Luca 1; Principale ha 4 membri con Leo (referente Giulia) e Sofia (referente Marco) senza account; Mamma 6, Babbo 3;
  - isolamento parametrico: percorre **tutti** gli endpoint `/api/` registrati (`RequestMappingHandlerMapping`); ognuno non pubblico risponde 401 senza token, con un token inventato e con un token dopo il logout; ognuno con `{familyId}` risponde 404 a Luca sulla Famiglia Babbo, a Rosa sulla Famiglia Mamma e su una famiglia inesistente, con corpo identico; controllo positivo: la stessa richiesta di Rosa su Babbo e di Luca su Mamma non è 404 né 5xx; l'elenco degli endpoint contiene almeno quelli del contratto;
  - Luca (MEMBER) che crea un invito nella Famiglia Mamma → 403; Anna (MANAGER) → 201.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (Spotless compreso).
- [ ] `grep -rn "Demo-R0-Pass-2026" server/src/main infra` → nessun risultato.
- [ ] `grep -niE "create index.*(membership|auth_session|invite)" server/src/main/resources/db/migration/V1__accounts.sql` → tre indici: `membership(person_id)`, `auth_session(person_id)`, `invite(family_id)`.
- [ ] `grep -rniE "now\(\)|current_timestamp" server/src/main` → nessun risultato usato dalla logica (ogni istante da `Clock`).
- [ ] `bash -n infra/smoke.sh` → ok; `grep -n "api/families" infra/smoke.sh` → controllo del 401 presente.
- [ ] Dopo il merge: lo smoke della consegna stampa `ok: GET /api/families without login is 401`.
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore oltre alla revisione umana prevista (tocca `infra/` e `application.properties`).

## Fuori perimetro
- Tutta l'app: schermate di registrazione, login, logout, profilo; Playwright di login/logout; smoke della pagina di login (parte 2 di T3).
- Cookie di sessione e CSRF per il web (parte 2); archivio del token su Android.
- P13–P15 completi (risorse senza account create da un gestore, ruoli, togliere appartenenze, lasciare una famiglia, codice usato da un utente già registrato, disattivazione per ultima appartenenza): T4.
- Cambio di lingua dal profilo; reimpostazione password con lo script di amministrazione.
- Revoca delle altre sessioni al cambio password (Idee per dopo).
- `mutation_id`, `version`, `change_log` su persone e famiglie: arrivano con T5/T9 per migrazione additiva; le scritture di questo giro sono solo online.
- Task, ricorrenze, inoltro, lista della spesa, sync, promemoria (T5–T10).
- Da `traguardi.json → fuori_perimetro`: template 730, calendario, accesso Google/Apple, iPhone, Play Store, email (verifica e recupero password), sync in tempo reale, offline sul web, dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/src/test/java/com/planforhome/acceptance/Giro003RegistrationAcceptanceTest.java` | i casi di registrazione, codice d'invito, password deboli, limite di registrazione e codici |
| `server/src/test/java/com/planforhome/acceptance/Giro003LoginAcceptanceTest.java` | login, errore identico, logout, `/api/me`, cambio password, limite sul login |
| `server/src/test/java/com/planforhome/acceptance/Giro003DemoDataAcceptanceTest.java` | `DEMO_PASSWORD` impostata → famiglie e persone dell'App. A |
| `server/src/test/java/com/planforhome/acceptance/Giro003IsolationAcceptanceTest.java` | tutti gli endpoint registrati: 401 senza token, con token inventato o dopo il logout; 404 su famiglia altrui con controllo positivo; MEMBER che crea un invito → 403 |
| `server/src/test/java/com/planforhome/acceptance/Giro003AcceptanceSupport.java`, `AcceptanceClock.java` | supporto comune (HTTP, dati, orologio mutabile) |

Supporto comune: `Giro003AcceptanceSupport` (astratta) e `AcceptanceClock`. Un solo PostgreSQL e un
solo contesto Spring per le quattro classi, con la password demo dei test impostata in `DEMO_PASSWORD`.
Orologio: `AcceptanceClock` è un `Clock` `@Primary` mutabile che parte dal 2031-01-06T08:00Z (lontano
dalla data vera: un istante preso da `now()` SQL o dal sistema si nota); `@BeforeEach` lo sposta
avanti di 2 ore, così ogni test parte con le finestre del limite vuote.
Le richieste arrivano da 127.0.0.1: con `forward-headers-strategy=native` Tomcat si fida di
`X-Forwarded-For` da loopback, e un test lo usa per simulare un altro IP. In produzione è fidato solo
Caddy sulla rete Docker ([DA VERIFICARE] sotto).
Non di accettazione (test di unità del costruttore): due registrazioni concorrenti con lo stesso
codice; tetto e pulizia della mappa dei tentativi; seeder che fallisce a metà → nessun dato.

## Porte
- Doppio senso previste: BCrypt invece di Argon2id (SPEC §9 ammette entrambi; Argon2 vorrebbe
  BouncyCastle); token opaco salvato come hash; limite ai tentativi in memoria (un solo processo in
  R0); elenco delle password comuni come file di risorsa scritto nel repository (nessuna libreria);
  codici d'errore del contratto; durata della sessione 30 giorni; `forward-headers-strategy=native`.
- Senso unico: nessuna. Nessuna dipendenza nuova. Lo schema aggiunge solo tabelle. `infra/smoke.sh`
  e `application.properties` sono percorsi protetti modificabili: PR in revisione umana.

## Rischi di concorrenza
- Due registrazioni con lo stesso codice nello stesso istante: il codice va consumato con un
  `UPDATE invite SET used_by=…, used_at=… WHERE code=… AND used_at IS NULL AND expires_at > now`
  nella stessa transazione della registrazione; 0 righe → `invite_invalid` e rollback. Prova: test
  di unità del costruttore con due thread (non di accettazione).
- Due registrazioni con la stessa email: vincolo unico nel database → 409, non 500; la transazione
  fa rollback, quindi un codice d'invito consumato nella stessa richiesta torna libero.
- Seeder: una sola transazione; due avvii in parallelo non duplicano (vincolo unico sull'email →
  il secondo fallisce senza dati a metà).
- Contatori del limite: struttura concorrente (`ConcurrentHashMap` + aggiornamento atomico).

## Budget
Righe di produzione (`server/src/main`) ≤ 1000 (escluso l'elenco delle password comuni); file ≤ 35;
`infra/smoke.sh` + 6 righe. Deve stare in una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`). Punti [DA VERIFICARE] per il costruttore, da annotare nel rapporto:
`server.forward-headers-strategy=native` con Tomcat considera fidato l'indirizzo del container Caddy
(rete Docker 172.16.0.0/12); Caddy `reverse_proxy` sovrascrive `X-Forwarded-For` inviato da un
client non fidato.

## Idee per dopo
- Revocare le altre sessioni al cambio password.
- Limite sul login anche per IP, non solo per email (oggi un estraneo può bloccare un'email per 15 minuti).

## Critica ricevuta e cosa cambia
Accolti tutti i 5 punti «DA CORREGGERE», più i test mancanti e i due facoltativi.

| Punto | Esito | Dove |
|---|---|---|
| 1. Enumerazione email per tempo e limite | Accolto: hash fittizio per email sconosciute; le email inesistenti contano nel limite | Sicurezza, limiti; test `theLimitCountsAlsoEmailsThatDoNotExist`, `anUnknownEmailTakesAsLongAsAWrongPassword` (soglia larga: 40% della mediana) |
| 2. Password oltre 72 byte → 500 | Accolto: `password_too_long` (byte UTF-8), `email_invalid` (254), `display_name_invalid` (80); login con password lunga → 401 | Contratto; test di registrazione, login, cambio password |
| 3. Istanti da `Clock` | Accolto: niente `now()` nella logica; orologio dei test nel 2031 | Migrazione, Fatto quando (grep); test su `expiresAt` di sessione e invito, sessione scaduta |
| 4. Chiave del limite normalizzata, pulizia, tetto | Accolto; tetto e pulizia con test di unità | Limiti; test `theLimitIsKeyedOnTheNormalisedEmail` |
| 5. Indici in V1 | Accolto | Migrazione, Fatto quando (grep) |
| Concorrenza: 409 non consuma il codice; seeder in una transazione | Accolto | Contratto, Rischi; test `anEmailAlreadyTakenIsRefusedAndDoesNotConsumeTheInvite` |
| Isolamento con controllo positivo; 401 anche con token; MEMBER → 403; sessione +30 g e 1 min → 401 | Accolto; in più il 404 ha lo stesso corpo di una famiglia inesistente | Test di isolamento e di login |
| Facoltativi: nota su `DEMO_PASSWORD`; `X-Forwarded-For` fidato da 127.0.0.1 nei test | Accolti | Cosa si costruisce; Test di accettazione |

Scartato: nulla. Il test sul tempo è statistico: se diventa instabile in CI si allarga la soglia in un
giro successivo, non si toglie.
