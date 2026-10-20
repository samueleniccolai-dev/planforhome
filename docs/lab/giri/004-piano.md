---
giro: 004
traguardo: T3
tipo: costruzione
fase: revisione
inizio: 2026-10-20T02:06:05Z
ricerca: sì
accettazione: 3fda8817edada6d754c74dac1e08f5d3a018098f
ripreso: no
---
# Piano del giro 004 — T3 parte 2: accesso dal web, sessione che si rinnova, revoca al cambio password

## Fetta e traguardo
T3, parte 2 di 2, tipo `costruzione`. Il giro 003 ha fatto l'API (#10, mergiata). Restano del
«Fatto quando» di T3: login e logout sul web con Playwright e lo smoke della pagina di login nelle
due lingue. In più la richiesta dell'umano del 20/10 (DECISIONI n. 17): la scadenza della sessione
si rinnova, e il cambio password revoca le altre sessioni, **prima** dell'app Android.
Fonti: SPEC §2.2.1 (accesso), §9 (sessione: web con cookie `HttpOnly`, `Secure`, `SameSite=Lax` e
CSRF), §10 (smoke da T3), §13, App. A; DECISIONI n. 11, 17.

**Cosa resta dopo questo giro:** l'archivio del token su Android (SPEC §9, «archivio cifrato di
Expo»), che chiede una dipendenza nuova (`expo-secure-store`): porta a senso unico, è la fetta del
giro successivo e si apre con una domanda. Poi `verifica-produzione` di T3.

### Vincoli dai test di accettazione già su `main` (nessuno li tocca)
- `Giro003LoginAcceptanceTest.aSessionExpiresThirtyDaysAfterLoginOnTheServerClock`: una sessione
  **usata** al giorno 29 scade al giorno 30 + 1 minuto. Quindi l'uso normale (`GET /api/me`) **non**
  rinnova: il rinnovo è esplicito, `POST /api/auth/refresh`, chiamato dal client.
- `Giro003IsolationAcceptanceTest.PUBLIC` = solo health, register, login. Quindi nessun endpoint
  pubblico nuovo: il login web usa lo stesso `POST /api/auth/login`; `refresh` richiede la sessione
  (401 senza).

### Contratto deciso (porte a doppio senso)
| Cosa | Decisione |
|---|---|
| Login web | `POST /api/auth/login` con `"client": "web"` nel corpo → 200, corpo `{expiresAt, personId}` **senza** `token`; `Set-Cookie` `pfh_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=2592000` e `pfh_csrf=<csrf>; Secure; SameSite=Lax; Path=/; Max-Age=2592000` (leggibile da JS). Senza `client` (o con un altro valore): come oggi, token nel corpo, nessun cookie. |
| Autenticazione | Se c'è l'header `Authorization`, decide solo lui e il cookie si **ignora del tutto** (Bearer inventato + cookie valido → 401). Altrimenti il cookie `pfh_session`. Stessa sessione in `auth_session`, stessa scadenza. |
| CSRF | Valore = base64url di SHA-256 di `"csrf:" + token di sessione`: legato alla sessione, nessuna colonna nuova. Con autenticazione **da cookie**, POST/PUT/PATCH/DELETE senza header `X-CSRF-Token` uguale → 403 `{"error":"csrf_invalid"}`, nessun effetto. Con Bearer il controllo non serve e non si fa. Senza sessione resta 401, mai 403: prima l'autenticazione, poi il CSRF (il test di isolamento 003 non cambia). Il controllo **non** vale sui tre endpoint pubblici (health, register, login), anche con un cookie valido presente. |
| Rinnovo | `POST /api/auth/refresh` (autenticato) → 200 `{expiresAt}` con `expiresAt = now + 30 giorni` dal `Clock`; con cookie rimanda i due `Set-Cookie` con il nuovo `Max-Age`. Non rinnova una sessione revocata o scaduta (401). Non cambia il token. Con cookie richiede `X-CSRF-Token` (è una POST). Istanti solo dal `Clock` (parametri della query), mai `now()` del database. |
| Logout web | `POST /api/auth/logout` con cookie + `X-CSRF-Token` → 204, sessione revocata, i due cookie cancellati con `Max-Age=0` e lo **stesso `Path`** di quando sono nati (`/api` per `pfh_session`, `/` per `pfh_csrf`). |
| Cambio password | `PUT /api/me/password` riuscito revoca **tutte le altre** sessioni della persona; quella che ha fatto la richiesta resta valida. `changePassword` è `@Transactional`; ordine: `update` dell'hash, poi `update auth_session set revoked_at = ? where person_id = ? and id <> ? and revoked_at is null`. Il login verifica la password con il bean `PasswordEncoder` (i test vi agganciano un fermo). |
| App web | `/` resta la pagina iniziale (test del giro 000) con in più il link «Accedi»/«Sign in» → `/login`. `/login`: email, password, pulsante. Login riuscito → `/me`: saluto con il nome e pulsante «Esci». `/me` senza sessione (`GET /api/me` ≠ 200) → `/login`. All'apertura di `/me` con sessione, il client chiama `POST /api/auth/refresh` una volta. Le chiamate usano `credentials: 'include'` e, per i metodi non sicuri, `X-CSRF-Token` letto dal cookie `pfh_csrf`. API sullo stesso dominio (`/api`, Caddy). |
| Android in questo giro | Lo stesso codice compila e l'APK si costruisce, ma il **login nativo non è collegato**: il client API e il link «Accedi» valgono solo con `Platform.OS === 'web'` (e solo lì si manda `client:"web"`). Token, archivio e login su Android: giro successivo. Nessuna prova su Android in questo giro. |

### Testi (chiavi in `it.json` ed `en.json`; i test li usano)
| Chiave (indicativa) | it | en |
|---|---|---|
| `home.signIn` (link su `/`) | Accedi | Sign in |
| `login.title` (h1) | Accedi a planforhome | Sign in to planforhome |
| `login.email` (etichetta) | Email | Email |
| `login.password` (etichetta) | Password | Password |
| `login.submit` (pulsante) | Accedi | Sign in |
| `login.invalid` (`role="alert"`) | Email o password non corretti. | Wrong email or password. |
| `login.tooMany` (`role="alert"`) | Troppi tentativi. Riprova fra qualche minuto. | Too many attempts. Try again in a few minutes. |
| `login.error` (`role="alert"`, rete o 5xx) | Accesso non riuscito. Riprova. | Sign-in failed. Try again. |
| `me.greeting` (h1, con il nome) | Ciao, {name} | Hi, {name} |
| `me.signOut` (pulsante) | Esci | Sign out |

### Dati demo
- Server: quelli di App. A già seminati dal giro 003 (Luca solo in Famiglia Mamma, Rosa solo in
  Famiglia Babbo, password `DEMO_PASSWORD` dei test), più account nuovi per ogni test, con email
  `*.giro004@example.com` e password `Lanterna-Blu-42` / `Girasole-Verde-77`.
- Playwright: API finta nel browser (`page.route('**/api/**')`, perché in CI Playwright gira su
  `expo serve` senza server). Utente Giulia, `giulia@example.com`, password `Lanterna-Blu-42`,
  `personId` `0192a3b4-0000-7000-8000-000000000004`, `displayName` «Giulia», locale `it`;
  cookie `pfh_csrf` = `csrf-finto-giro004`.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro004*AcceptanceTest' test` → verdi, e restano verdi tutti i
      `Giro003*AcceptanceTest` (in particolare scadenza a 30 giorni senza rinnovo e isolamento).
  - login con `"client":"web"` → 200, nessun `token` nel corpo, `Set-Cookie` di `pfh_session` con
    `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api`, `Max-Age=2592000`, e di `pfh_csrf` senza
    `HttpOnly`, `Path=/`;
  - con il solo cookie `GET /api/me` → 200 e `GET /api/families` → solo le famiglie della persona;
  - isolamento parametrico via cookie su **tutti** gli endpoint registrati: cookie inventato o
    chiuso, con e senza `X-CSRF-Token` → 401, mai 403; cookie di Luca + CSRF giusto su ogni endpoint
    `{familyId}` di Famiglia Babbo → 404 con lo stesso corpo di una famiglia inesistente; Rosa col
    suo cookie entra (controllo positivo);
  - con l'header `Authorization` il cookie si ignora: Bearer inventato + cookie valido + logout senza
    CSRF → 401 e la sessione del cookie resta valida; Bearer valido + cookie → vale il Bearer, niente
    CSRF;
  - endpoint pubblici senza CSRF anche con un cookie valido: login web → 200, registrazione → 201;
  - con il cookie, `POST /api/auth/logout` senza `X-CSRF-Token` o con un valore sbagliato → 403
    `csrf_invalid` e la sessione resta valida; con il valore giusto → 204, cookie cancellati (`Max-Age=0`, `Path` giusto), poi
    `GET /api/me` con lo stesso cookie → 401;
  - con il cookie, `PUT /api/me/password` senza `X-CSRF-Token` → 403 e la password non cambia;
  - il `pfh_csrf` di una sessione non vale per un'altra sessione (403);
  - login senza `client` → come nel giro 003 (token nel corpo, nessun `Set-Cookie`);
  - rinnovo: login, +20 giorni, `POST /api/auth/refresh` → 200 con `expiresAt` = orologio + 30
    giorni; a +49 giorni dal login la sessione vale, a +50 giorni e 1 minuto → 401;
  - `refresh` con cookie rimanda `pfh_session` con `Max-Age=2592000`; con un token revocato o
    scaduto → 401 e non lo riapre;
  - cambio password con la sessione A: la sessione B e la sessione C (cookie) della stessa persona →
    401; A → 200; una sessione di un'altra persona non cambia; cambio via cookie: resta il cookie,
    cade il Bearer;
  - corsa login ∥ cambio password, deterministica: il login si ferma (fermo del test sul
    `PasswordEncoder`) dopo la verifica bcrypt e prima dell'insert; il cambio finisce; il login
    riparte → 401, oppure 200 con un token che vale 401.
- [ ] `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-004-*` →
      verdi (it-IT ed en-US), e restano verdi i test del giro 000:
  - da `/`, link «Accedi» → `/login` con h1 «Accedi a planforhome»; screenshot `login-it.png`,
    `login-en.png`;
  - login con email e password giuste → la richiesta ha corpo `{email, password, client:"web"}` →
    `/me` con h1 «Ciao, Giulia» / «Hi, Giulia»;
  - credenziali sbagliate (401) → avviso «Email o password non corretti.», si resta su `/login`;
    429 → avviso «Troppi tentativi…»; 500 → avviso «Accesso non riuscito. Riprova.»;
  - su `/me`, «Esci» → `POST /api/auth/logout` con `X-CSRF-Token: csrf-finto-giro004` → `/login`;
    l'API finta chiude la sessione quando riceve la POST, quindi poi `/me` (API: 401) → `/login`;
  - apertura di `/me` con sessione → **esattamente una** `POST /api/auth/refresh` con
    `X-CSRF-Token` (contata dopo 1,5 s);
  - ogni campo e pulsante di `/login` e `/me` si trova per ruolo ed etichetta.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi (Jest: lettura del cookie
      `pfh_csrf` e interpolazione `{name}`).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde.
- [ ] `infra/smoke.sh` (revisione umana, percorso protetto) aggiunge: `GET /login` → 200 con
      «Sign in to planforhome» (pagina prerenderizzata in inglese); estrae gli `src` dei tag
      `<script>` di `/login` e almeno uno dei bundle contiene sia «Accedi a planforhome» sia «Sign in
      to planforhome»; `POST /api/auth/refresh` senza sessione → 401. Prova: `bash -n
      infra/smoke.sh`; la corsa vera è della consegna dopo il merge.
- [ ] Build dell'APK in CI verde (controllo della PR).

## Fuori perimetro
- Archivio cifrato del token su Android (`expo-secure-store`): porta a senso unico, giro successivo.
- Scelta della famiglia dopo il login e cambio famiglia da ogni schermata (SPEC §2.2.1): con T4.
- Pagine web di registrazione, codici d'invito e cambio password (l'API c'è; T3 chiede solo login e
  logout sul web).
- Scadenza assoluta massima della sessione, rotazione del token al rinnovo, elenco delle sessioni
  attive, limite del login per IP.
- `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista dedicata;
  accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero della password;
  sincronizzazione in tempo reale e offline sul web; dati reali.
- T3 non diventa `passato` qui: serve un giro `verifica-produzione`.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/.../acceptance/Giro004AcceptanceSupport.java` | supporto: lettura di `Set-Cookie`, invio di `Cookie` e `X-CSRF-Token`, login web; fermo `LoginHold` sul `PasswordEncoder` (solo con l'header `X-Test-Hold-After-Password-Check`) |
| `server/.../acceptance/Giro004WebSessionAcceptanceTest.java` (8) | login web → cookie con gli attributi; cookie apre `/api/me` e `/api/families`; logout senza/sbagliato/giusto `X-CSRF-Token` → 403/403/204 e cookie cancellati con `Path`; cambio password via cookie senza CSRF → 403; CSRF di un'altra sessione → 403; login senza `client` o con `android` invariato; `Authorization` presente → cookie ignorato; pubblici senza CSRF |
| `server/.../acceptance/Giro004SessionLifetimeAcceptanceTest.java` (6) | refresh a +20 giorni → `expiresAt` +30 dal `Clock`; vale a +49, 401 a +50 giorni e 1 minuto; refresh con cookie: senza CSRF 403, con CSRF rimanda gli stessi cookie con `Max-Age`; refresh di revocata/scaduta → 401; cambio password revoca B e C, non A, non altre persone; cambio via cookie; corsa login ∥ cambio con il fermo |
| `server/.../acceptance/Giro004CookieIsolationAcceptanceTest.java` (3) | `POST /api/auth/refresh` registrato; cookie inventato/chiuso, con e senza CSRF → 401 su ogni endpoint non pubblico; cookie di Luca + CSRF su ogni `{familyId}` di Babbo → 404 identico a famiglia inesistente; controllo positivo di Rosa |
| `app/e2e/acceptance/giro-004-login.spec.ts` (8 × 2 lingue) | link da `/`; login giusto → `/me` con saluto e corpo `client:"web"`; 401, 429, 500 → avvisi; logout con CSRF → `/login`, poi `/me` → `/login`; `/me` senza sessione → `/login`; esattamente un refresh all'apertura di `/me`; it-IT ed en-US con screenshot |

Le classi del server estendono `Giro004AcceptanceSupport` (che estende `Giro003AcceptanceSupport`:
stesso PostgreSQL, un secondo contesto Spring per il fermo, `AcceptanceClock` proprio); i cookie si
leggono dagli header `Set-Cookie` e si mandano con l'header `Cookie`, senza `CookieManager`.
Rosso verificato il 20/10: server 17 su 17 falliscono per asserzione (i 43 test 000 e 003 restano
verdi nella stessa corsa); Playwright 16 su 16 per asserzione (elementi assenti, URL non
`/login`).

## Porte
- Doppio senso previste: forma del login web (`client: "web"`), nomi e attributi dei cookie,
  derivazione del CSRF, `POST /api/auth/refresh` esplicito invece del rinnovo a ogni richiesta,
  rotte `/login` e `/me`, login nativo non collegato fino al giro successivo, API finta nei
  test Playwright. Da ratificare: rinnovo esplicito (vincolo del test 003) e CSRF derivato.
- Senso unico: nessuna in questa fetta. Il giro successivo (token su Android) aprirà con la domanda
  su `expo-secure-store`. Il giro tocca `infra/smoke.sh` (percorso protetto): PR in revisione umana.

## Rischi di concorrenza
- **Login con la vecchia password in parallelo al cambio password:** il login verifica il vecchio
  hash, il cambio revoca le altre sessioni, poi il login inserisce la sua: una sessione nata dalla
  vecchia password sopravvive. Rimedio: l'inserimento della sessione è condizionato all'hash
  verificato e blocca la riga dell'account (`insert … select … from user_account where person_id =
  ? and password_hash = ? for share`), così o il login vede il nuovo hash (0 righe → 401) o la
  revoca, dopo il suo commit, vede la nuova sessione. Prova: test di accettazione deterministico
  con il fermo `LoginHold` (`aLoginWithTheOldPasswordDuringTheChangeLeavesNoLiveSession`); se il
  cambio aspetta un lock del login fermo, il test lascia ripartire il login dopo 5 s.
- **Refresh in parallelo a logout o cambio password:** l'`update` del rinnovo ha `revoked_at is null
  and expires_at > now` nella stessa istruzione: non riapre mai una sessione revocata. Prova: test di
  integrazione refresh ∥ logout, 50 ripetizioni.
- **Doppio refresh:** idempotente (stesso `expiresAt` con lo stesso orologio). Doppio clic su
  «Accedi»: pulsante disabilitato durante la richiesta; due sessioni sarebbero comunque innocue.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`) ≤ 650 (server ≈ 250, app ≈ 400);
file toccati ≤ 20; nessuna migrazione; nessuna dipendenza nuova. Deve stare in una sessione.

## Domande per il ricercatore (al massimo 3)
1. Spring Security 7 (Boot 4): modo consigliato per autenticare da cookie accanto al Bearer e
   applicare il CSRF solo alle richieste autenticate da cookie; `CookieCsrfTokenRepository` o filtro
   proprio? Come costruire `Set-Cookie` con `SameSite` (`ResponseCookie`).
2. expo-router (SDK 58) con `web.output: "static"`: come fare il reindirizzamento lato client verso
   `/login` senza rompere il prerender e l'idratazione (`<Redirect>`, `router.replace`); come
   esporre l'etichetta accessibile di `TextInput` e `Pressable` su react-native-web.
3. Playwright 1.64: con `page.route(...).fulfill`, gli header `Set-Cookie` della risposta finta
   finiscono nei cookie del browser, o serve `context.addCookies`? `document.cookie` vede un cookie
   aggiunto così su `http://localhost`?

## Idee per dopo
- Scadenza assoluta (per esempio 180 giorni da `created_at`) anche con il rinnovo.
- Elenco delle sessioni attive e «esci da tutti i dispositivi».
- Limite del login per IP, oltre che per email.

## Critica ricevuta e cosa cambia
Accolti tutti i 5 «DA CORREGGERE», le aggiunte e i due facoltativi. Nessuna porta a senso unico.

| Punto | Esito | Dove |
|---|---|---|
| 1. Contratto del client nativo | Accolto nella forma semplice: in questo giro il nativo non fa login; tolto il «token in memoria»; `client:"web"` solo con `Platform.OS === 'web'` | Contratto (Android), Porte |
| 2. Revoca al cambio password e corsa col login | Accolto: `@Transactional`, ordine hash → revoca `id <> ?`; test deterministico col fermo sul `PasswordEncoder` invece del test di integrazione a 50 ripetizioni | Contratto, Rischi; `Giro004SessionLifetimeAcceptanceTest` |
| 3. `Authorization` presente → cookie ignorato | Accolto, più il caso Bearer valido + cookie | Contratto; `withAnAuthorizationHeaderTheCookieIsIgnored` |
| 4. Isolamento parametrico via cookie | Accolto: nuova classe che percorre `RequestMappingHandlerMapping` | `Giro004CookieIsolationAcceptanceTest` |
| 5. CSRF fuori dagli endpoint pubblici | Accolto: login web e registrazione con cookie senza CSRF, più health | `thePublicEndpointsDoNotCheckCsrfEvenWithASessionCookie` |
| Cookie cancellati con nome e `Path` | Accolto | test di logout |
| Playwright: un solo refresh; API finta con stato; smoke con gli `src` degli `<script>`; refresh dal `Clock` | Accolti | Fatto quando, spec Playwright, test del rinnovo (orologio del 2031) |
| Facoltativi: `login.error` su rete/5xx; smoke `refresh` senza sessione → 401 | Accolti | Testi, Fatto quando |

Scartato: niente. Una scelta mia: il valore derivato del CSRF **non** è vincolato dai test (si
controlla solo che sia diverso fra sessioni e diverso dal token), così resta una porta a doppio
senso.
