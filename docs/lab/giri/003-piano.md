---
giro: 003
traguardo: T3
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-19T21:33:27Z
ricerca: no
accettazione:
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
| Migrazione `V1__accounts.sql` | Tabelle `person`, `user_account`, `family` (`time_zone` predefinito `Europe/Rome`), `membership` (PK `family_id, person_id`; `role` `MANAGER`/`MEMBER`; `referent_person_id` con FK composta `(family_id, referent_person_id)` → `membership`), `invite` (`code` unico), `auth_session` (`token_hash` SHA-256 unico, `person_id`, `created_at`, `expires_at`, `revoked_at`). Colonne come SPEC §6; `timestamptz`; email unica normalizzata (trim + minuscolo). Id UUIDv7 generati dal server (Hibernate `@UuidGenerator(style = VERSION_7)`, nessuna libreria). |
| Package `com.planforhome.account` | Registrazione, login, logout, `/api/me`, cambio password, criteri delle password, limite ai tentativi. Logica nei servizi, non nei controller. |
| Package `com.planforhome.family` | `GET /api/families`, `GET /api/families/{familyId}/members`, `POST /api/families/{familyId}/invites` (minimo indispensabile per provare la registrazione con codice; i casi P13 completi sono di T4). |
| Package `com.planforhome.demo` | Seeder dell'Appendice A: parte all'avvio **solo se** `planforhome.demo.password=${DEMO_PASSWORD:}` non è vuota; idempotente (se `marco@example.com` esiste non fa nulla). Nessuna password demo in `server/src/main`. |
| Sicurezza | Filtro che legge `Authorization: Bearer <token>`, cerca `sha256(token)` in `auth_session` non revocata e non scaduta (`Clock`), account non disattivato. Pubblici solo `/api/health`, `POST /api/auth/register`, `POST /api/auth/login`. Password con `BCryptPasswordEncoder` di Spring Security (Argon2 richiederebbe BouncyCastle: dipendenza nuova). `server.forward-headers-strategy=native` per avere l'IP vero dietro Caddy. |
| Smoke (`infra/smoke.sh`) | Riga «T3: `GET /api/families` senza login → 401». |

### Contratto dell'API (lo usano i test di accettazione)

Errori: corpo JSON `{"error":"<codice>"}`.

| Metodo e percorso | Corpo | Risposta |
|---|---|---|
| `POST /api/auth/register` | `{email, password, displayName, locale ("it"/"en"), familyName?, inviteCode?}` | 201 `{personId, families:[{id,name,role}]}`. Esattamente uno tra `familyName` e `inviteCode`, se no 400 `registration_mode_required`. Codice sconosciuto, scaduto o usato → 400 `invite_invalid`. Password < 10 caratteri → 400 `password_too_short`; nell'elenco comune → 400 `password_too_common`. Email già registrata → 409 `email_taken`. Ogni rifiuto **non crea** persona, account né appartenenza. |
| `POST /api/auth/login` | `{email, password}` | 200 `{token, expiresAt, personId}` (sessione di 30 giorni). Email inesistente, password sbagliata o account disattivato → 401 con corpo **identico** `{"error":"invalid_credentials"}`. |
| `POST /api/auth/logout` | — | 204; il token non vale più (401). |
| `GET /api/me` | — | 200 `{personId, email, displayName, locale}`. |
| `PUT /api/me/password` | `{currentPassword, newPassword}` | 204. Attuale sbagliata → 400 `current_password_wrong`; nuova debole → 400 `password_too_short` / `password_too_common`. |
| `GET /api/families` | — | 200 `[{id, name, timeZone, role}]` delle sole famiglie dell'utente. Senza login 401. |
| `GET /api/families/{familyId}/members` | — | 200 `[{personId, displayName, role, hasAccount, referentPersonId}]`. Famiglia non propria → 404. |
| `POST /api/families/{familyId}/invites` | — | Gestore: 201 `{code, expiresAt}` (scade dopo 7 giorni, codice casuale da `SecureRandom`, almeno 80 bit). Membro: 403. Famiglia non propria: 404. |

Limite ai tentativi (in memoria, finestre sul `Clock`; valori in costanti):
- **login:** 5 tentativi falliti per la stessa email in 15 minuti → dal sesto 429 `too_many_attempts`
  (anche con la password giusta), con `Retry-After`;
- **registrazione:** 10 per IP in un'ora → dall'undicesima 429;
- **codici d'invito:** 5 codici rifiutati per IP in un'ora → dal sesto uso di un codice 429.

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

Utenti creati dai test di registrazione: `nuova.gestrice@example.com` («Famiglia Verdi»),
`nuovo.membro@example.com`, `senza.famiglia@example.com`, `codice.scaduto@example.com`,
`codice.usato@example.com`; password valida `Lanterna-Blu-42`; password comune di 10+ caratteri
`password123`; corta `Corta-1`.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro003*AcceptanceTest' test` → tutti verdi. Coprono:
  - registrazione con `familyName` → 201, chi si registra è `MANAGER` della nuova famiglia (via `GET /api/families`);
  - registrazione con codice valido → 201, `MEMBER` nella famiglia del codice; il codice non si riusa;
  - registrazione senza modo, con entrambi, con codice scaduto (orologio +7 giorni e 1 minuto), già usato o inventato → 400 e nessun account (il login con quella email dà 401 e la stessa email si registra poi con `familyName`);
  - login giusto → 200 con token; `GET /api/me` con il token → 200; logout → token rifiutato (401);
  - email inesistente e password sbagliata → 401 con corpo e stato identici;
  - limiti: sesto login fallito → 429 anche con la password giusta, e dopo 15 minuti di orologio torna 200; undicesima registrazione → 429; sesto codice rifiutato → 429;
  - cambio password: attuale sbagliata → 400; nuova corta o comune → 400; riuscito → vecchia password 401, nuova 200;
  - password `Corta-1` → 400 `password_too_short`; `password123` → 400 `password_too_common`;
  - seeder con `DEMO_PASSWORD`: i 9 utenti entrano; Giulia ha 2 famiglie (Principale MANAGER, Mamma MEMBER), Marco 2, Luca 1; Principale ha 4 membri con Leo (referente Giulia) e Sofia (referente Marco) senza account; Mamma 6, Babbo 3;
  - isolamento parametrico: percorre **tutti** gli endpoint registrati (`RequestMappingHandlerMapping`); ognuno non pubblico risponde 401 senza token; ognuno con `{familyId}` risponde 404 a Luca sulla Famiglia Babbo e a Rosa sulla Famiglia Mamma; l'elenco degli endpoint contiene almeno quelli del contratto.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (Spotless compreso).
- [ ] `grep -rn "Demo-R0-Pass-2026" server/src/main infra` → nessun risultato.
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
| `server/src/test/java/com/planforhome/acceptance/Giro003IsolationAcceptanceTest.java` | tutti gli endpoint registrati: 401 senza token, 404 su famiglia altrui |

Orologio: i test importano una `@TestConfiguration` con un `Clock` `@Primary` mutabile (classe
nel package dei test di accettazione); `@BeforeEach` lo sposta avanti di 2 ore, così ogni test parte
con le finestre del limite vuote.

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
- Due registrazioni con la stessa email: vincolo unico nel database → 409, non 500.
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
(dopo il critico)
