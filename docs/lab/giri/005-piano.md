---
giro: 005
traguardo: T3
traguardi_extra: []
tipo: verifica-produzione
fase: chiusura
inizio: 2026-10-20T03:34:05Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 005 — verifica in produzione di T3 (account e accesso)

## Fetta e traguardo
Verifica di T3. Il rapporto 004 dice «Fatto quando verde, da verificare in produzione». La PR #11
è mergiata (c3538cd), e il deploy di c3538cd è verde. Questo giro ripete i controlli del «Fatto
quando» di T3 contro `https://app.planforhome.com` e contro le run della CI. Nessun codice.
Fonti: SPEC §2.2.1, §2.3, §6, §9, §10, App. A; `traguardi.json` → T3; contratto dell'API in
`003-piano.md` e `004-piano.md`.

Riferimenti fissati al momento del piano (2026-10-20T03:36Z):
- `$SHA` = `c3538cd4e28bb2ac2affb5475f3e82f87e3ca0fd`. `git diff --stat 596fc04 c3538cd` è vuoto:
  il merge ha lo stesso albero dell'ultimo commit della PR #11.
- `$RUN_CONSEGNA` = 39364524717 (push su `main`, c3538cd). Job `controllo`, `immagine`,
  `pubblica`, `deploy` («Deploy and smoke test»), `avanti`: `success`. Job `apk` ancora in corso:
  T3 non ne dipende.
- `$RUN_CI_PR` = 39362247612 (PR #11, 596fc04): job `server`, `app`, `apk`, `lab`, `build`
  `success`.
- `GET /api/health` → `{"status":"UP","sha":"c3538cd…"}`; `GET /api/families` → 401.

Il «Fatto quando» di T3 non nomina Android. Il login nativo su Android (token in
`expo-secure-store`) resta una costruzione a parte, con la sua porta a senso unico: non entra nel
verdetto di T3, ma va in PROGRESS come prossima fetta.

## Fatto quando — controlli eseguibili

### Regole per le prove in produzione
- Tutto da fuori, con `curl` verso `https://app.planforhome.com`. Nessun comando sui server
  (regola 7). Nessuna lettura di `DEMO_PASSWORD` né di altri segreti.
- **Mai usare le email demo per il login sbagliato**: 5 errori bloccherebbero Marco o Giulia per
  15 minuti. Il limite sul login si prova su un'email inesistente.
- Account di prova inventati, creati da questo giro e lasciati in produzione (non c'è un'API per
  cancellarli): `verifica005.<epoch>.a@example.com` (gestore) e `verifica005.<epoch>.b@example.com`
  (membro), famiglia «Famiglia Verifica 005». `<epoch>` = `date -u +%s` al momento della prova,
  annotato nel rapporto.
- Password di prova: generate al momento (`openssl rand -base64 18 > /tmp/giro-005-p1`, idem
  `p2`, `p3`), mai stampate, mai committate, passate a curl con
  `jq -n --rawfile p /tmp/giro-005-p1 '{…, password: ($p|rtrimstr("\n"))}' | curl --data @- …`.
  Si cancellano a fine giro.
- Il limite di registrazione è 10 per IP all'ora: la sequenza R1–R12 va eseguita **una volta
  sola, nell'ordine**. Se un passo fallisce per un motivo esterno (rete, proxy), si aspetta un'ora
  prima di ripeterla, oppure si dichiara nel rapporto.

### A. Prove nella CI (sola lettura)
- [ ] T3.1 `gh run view 39362247612 --json jobs` → job `server` e `app` `success`. Nella run ci
      sono le classi `Giro003*AcceptanceTest` e `Giro004*AcceptanceTest` (registrazione, login,
      limiti, cambio password, password deboli, dati demo, isolamento parametrico anche via cookie)
      e `app/e2e/acceptance/giro-004-login.spec.ts` (login e logout sul web, it e en).
      Se il proxy blocca i log, vale il job `success` più l'elenco dei file in `git ls-tree c3538cd`.
- [ ] T3.2 In locale, su `c3538cd`: `cd server && ./mvnw -q -Dtest='Giro003*AcceptanceTest,Giro004*AcceptanceTest' test`
      → verde (compresi `Giro003DemoDataAcceptanceTest`: 3 famiglie e 11 persone dell'App. A, e
      `Giro003IsolationAcceptanceTest`: tutti gli endpoint registrati). Se Docker manca nella
      sessione, vale T3.1 e lo si dichiara.
- [ ] T3.3 `$RUN_CONSEGNA`: job `deploy`, passo «Deploy and smoke test» `success`. Lo smoke
      (`infra/smoke.sh` su c3538cd) contiene: `/login` nelle due lingue, `GET /api/families`
      senza login → 401, `POST /api/auth/refresh` senza sessione → 401
      (`git show c3538cd:infra/smoke.sh | grep -n "T3"`). Se il log è leggibile:
      `gh run view 39364524717 --log --job <id deploy> | grep "smoke passed"` → una riga.

### B. Smoke ripetuto da fuori
- [ ] T3.4 `curl -sS https://app.planforhome.com/api/health` → 200, `"sha":"c3538cd4e28bb2ac2affb5475f3e82f87e3ca0fd"`.
- [ ] T3.5 `GET /api/families` senza login → 401; `POST /api/auth/refresh` senza sessione → 401.
- [ ] T3.6 `GET /login` → 200 e contiene `Sign in to planforhome`; uno dei bundle `<script src>`
      della pagina contiene sia `Accedi a planforhome` sia `Sign in to planforhome`.

### C. Registrazione (sequenza R, una sola volta, in quest'ordine)
Corpo: `POST /api/auth/register` con `{email, password, displayName, locale, familyName?, inviteCode?}`.
- [ ] R1 email A, password p1, `familyName: "Famiglia Verifica 005"`, `locale: "it"` → 201,
      `families[0].role` = `MANAGER`.
- [ ] R2 email B, password `abc123456` (9 caratteri), con `familyName` → 400 `password_too_short`.
- [ ] R3 email B, password `qwertyuiop` (nell'elenco comune), con `familyName` → 400 `password_too_common`.
- [ ] R4 email B, password p2, senza `familyName` né `inviteCode` → 400 `registration_mode_required`.
- [ ] R5 email B, password p2, con `familyName` **e** un `inviteCode` → 400 `registration_mode_required`.
- [ ] R6 email B, password p2, `inviteCode: "codice-inventato-005"` → 400 `invite_invalid`.
- Tra R6 e R7: login di A (Bearer, vedi D1), `POST /api/families/{id}/invites` → 201 `{code, expiresAt}`
  con `expiresAt` ≈ ora + 7 giorni.
- [ ] R7 email B, password p2, con il codice → 201, `families[0]` = Famiglia Verifica 005, `MEMBER`.
      Questo prova anche che R2–R6 **non hanno creato** l'account B (altrimenti 409 `email_taken`).
- [ ] R8 email `verifica005.<epoch>.c@example.com`, password p3, con **lo stesso** codice (già usato)
      → 400 `invite_invalid`.
- [ ] R9 email `marco@example.com`, password p3, con `familyName` → 409 `email_taken`: i dati demo
      esistono in produzione (seminati solo se `DEMO_PASSWORD` non è vuota).
- [ ] R10 email `rosa@example.com`, come R9 → 409 `email_taken` (seconda famiglia demo, Babbo).
- [ ] R11 qualunque registrazione → 429 `too_many_attempts` con `Retry-After`. (Se 429 arriva
      prima, per tentativi altrui dallo stesso IP, si annota a che passo.)
- [ ] R12 come R11 con l'header `X-Forwarded-For: 203.0.113.5` → **ancora 429**: Caddy non
      inoltra un `X-Forwarded-For` scelto dal client, quindi il limite non si aggira
      (punto «da verificare col deploy» di PROGRESS).

Il codice scaduto non si prova in produzione (servono 7 giorni): vale il test della CI (T3.1).

### D. Login, sessioni, password
- [ ] D1 `POST /api/auth/login` `{email A, p1}` → 200 `{token, expiresAt, personId}`,
      `expiresAt` ≈ ora + 30 giorni. Con il Bearer: `GET /api/me` → 200 con email A;
      `GET /api/families` → solo Famiglia Verifica 005.
- [ ] D2 Stesso errore: `{email A, password sbagliata}` e `{verifica005.<epoch>.nessuno@example.com, …}`
      → entrambi 401 con corpo **identico byte per byte** `{"error":"invalid_credentials"}`
      (`cmp` dei due corpi salvati in `/tmp/giro-005-…`).
- [ ] D3 Limite sul login: email `verifica005.<epoch>.limite@example.com` (inesistente), 5 login
      sbagliati → 401; il sesto → 429 `too_many_attempts` con `Retry-After` > 0.
- [ ] D4 Limite sui codici: già 2 codici rifiutati (R6, R8). Non si spinge oltre in produzione
      (bloccherebbe l'IP per un'ora sui codici): vale la CI (T3.1). Annotato nel rapporto.
- [ ] D5 Isolamento da fuori: con il Bearer di B (membro), `POST /api/families/{id}/invites` → 403;
      con il Bearer di A, `GET /api/families/<UUIDv7 inventato>/members` → 404;
      senza login `GET /api/families/{id}/members` → 401.
- [ ] D6 Login web: `POST /api/auth/login` con `"client":"web"` (account B, p2) → 200, corpo
      **senza** `token`; `Set-Cookie` di `pfh_session` con `HttpOnly`, `Secure`, `SameSite=Lax`,
      `Path=/api`, `Max-Age=2592000`, e di `pfh_csrf` con `Secure`, `Path=/`
      (punto «cookie `Secure` dietro Caddy» di PROGRESS). Con il solo cookie `GET /api/me` → 200.
- [ ] D7 Con il cookie: `POST /api/auth/refresh` con `X-CSRF-Token` → 200; `POST /api/auth/logout`
      senza `X-CSRF-Token` → 403 `csrf_invalid`; con il token giusto → 204 e cookie con `Max-Age=0`;
      poi `GET /api/me` con lo stesso cookie → 401.
- [ ] D8 Cambio password (account A, Bearer di D1, più una seconda sessione A2 aperta prima):
      `PUT /api/me/password` con nuova `abc123456` → 400 `password_too_short`; con `qwertyuiop` →
      400 `password_too_common`; con attuale sbagliata → 400 `current_password_wrong`; con
      `{p1 → p3}` → 204. Poi: la sessione A2 → 401 (revocata); login con p1 → 401; con p3 → 200.
- [ ] D9 Logout con Bearer → 204; poi `GET /api/me` con lo stesso token → 401.

### E. Login e logout sul web, nel browser, in produzione
- [ ] E1 Playwright su `https://app.planforhome.com`, con uno script temporaneo fuori dal repo
      (`/tmp/giro-005-web/web.spec.ts` e una config con `baseURL` di produzione, senza
      `webServer`; lanciato con `cd app && npx playwright test --config /tmp/giro-005-web/playwright.config.ts`).
      Per ruolo ed etichetta: da `/` il link «Accedi» / «Sign in» porta a `/login`; con email A e
      p3 e il pulsante → `/me` con il titolo di saluto e il pulsante «Esci» / «Sign out»; «Esci» →
      torna a `/login`; poi `/me` → `/login`. In italiano e in inglese (`locale` del contesto).
      Se il browser non esce dal proxy della sessione, vale T3.1 (stessi passi contro il bundle
      locale) più D6–D7 (stesse chiamate che fa il client), e lo si dichiara nel rapporto.

### Esito
T3 `passato` se T3.1, T3.3–T3.6, R1–R12, D1–D3, D5–D9 ed E1 (o il suo ripiego dichiarato) sono
verdi. Un controllo rosso è un difetto `005:<gravità>` con `difetto_di: 003` o `004`, e T3 resta
`in-corso`. Se R12 dà 201 o 400 invece di 429, è un difetto di sicurezza `bloccante`.

Dati a parte, non bloccanti:
- conteggio esatto delle 11 persone demo in produzione: non si vede senza la password demo; vale
  `Giro003DemoDataAcceptanceTest` (T3.1/T3.2) più R9–R10. L'umano può confermarlo entrando come
  Giulia sul web;
- `forward-headers-strategy=native`: con un solo IP di prova non si distingue «IP vero del client»
  da «IP di Caddy per tutti». R12 prova il lato di sicurezza; l'altro lato resta da dichiarare;
- APK di c3538cd (job `apk` di `$RUN_CONSEGNA`): si annota l'esito, non entra in T3.

## Fuori perimetro
- Qualsiasi riga di codice, configurazione, workflow o script del repository (lo script
  Playwright di E1 vive in `/tmp` e si cancella).
- Login e token su Android, `expo-secure-store` (prossima costruzione, porta a senso unico).
- Pagine di registrazione e cambio password nell'app, scelta della famiglia dopo il login (T4).
- Il test «refresh ∥ logout 50 volte» mancante (dubbio del giro 004): va in una costruzione.
- Prove di carico o di forza bruta oltre i limiti sopra; login sbagliati sulle email demo.
- APK su telefono fisico; PR Dependabot #2 e #3.
- T1 e T2, già `passato`.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista;
  accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero della password;
  sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: giro di verifica.

## Porte
- Doppio senso previste: account e famiglia di prova inventati lasciati nel database di
  produzione (R0, dati finti; si possono togliere con una migrazione o un reset del demo).
- Senso unico: nessuna.

## Rischi di concorrenza
- Un merge su `main` durante il giro cambia la versione in produzione: T3.4 lo mostra (SHA
  diverso). In quel caso si rifà tutto sul nuovo SHA, dopo un'ora per il limite di registrazione.
- Il limite di registrazione e dei codici è per IP: altre sessioni dallo stesso IP di uscita
  possono consumare slot. R11 annota a che passo arriva il 429.
- Il limite è in memoria: un riavvio del server a metà sequenza lo azzera e R11 darebbe 201 o 400.
  Se succede, si annota (SHA e `/api/health`) e si ripete R11–R12 dopo 10 tentativi nuovi.
- Nessuna scrittura nel repository oltre ai documenti del giro.

## Budget
0 righe di codice. File scritti: `005-piano.md`, `005-rapporto.md`, `PROGRESS.md` e i campi
`stato`/`giri`/`pr`/`passato_il` di T3 in `traguardi.json`. File temporanei solo in `/tmp/giro-005-…`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Un endpoint o uno script per cancellare gli account di prova delle verifiche (oggi restano).
- Limite sul login anche per IP (idea già del giro 003).
- Rendere `smoke.sh` lanciabile in locale dagli agenti per le verifiche (oggi il hook blocca `bash` su `infra/`).
