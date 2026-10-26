---
giro: 057
traguardo: T16
traguardi_extra: []
tipo: verifica-produzione
fase: revisione
inizio: 2026-10-26T12:01:05Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 057 — verifica in produzione di T16 (UI-5: tema scuro e stati di schermata)

## Fetta e traguardo
T16, tipo `verifica-produzione`: il rapporto 056 dice «Fatto quando verde, da verificare in
produzione», le PR #79 (`6981a7b`) e #80 (`32b223a`) sono mergiate, il deploy è verde. Nessun codice.
Fonti: SPEC §12; DESIGN §2, §3, §8; `traguardi.json` → T16; piani e rapporti 055 e 056.

Riferimenti fissati al momento del piano (2026-10-26T12:05Z):
- `$SHA` = `32b223a5d5e5139408dd22e9860d60bb9d52585d` (merge della PR #80, testa di `main`);
  `GET /api/health` → `{"status":"UP","sha":"32b223a5d5e5139408dd22e9860d60bb9d52585d"}`.
- `$RUN_CONSEGNA` = 40318715161 (evento `workflow_run`, creata 11:56:00Z; l'API riporta
  `head_sha` `6981a7b`, come nel giro 054): `decidi`, `immagine`, `pubblica`, `deploy`, `avanti`
  in `success`, `controllo` `skipped`; **`apk` in corso** (partito 11:56:20Z). Il run
  40319406237 su `32b223a` è `skipped`: atteso, non un difetto.
- `$RUN_CONSEGNA_055` = 40308021544 (dopo il merge della #79): `success`, artefatto
  `planforhome-0.1.0-6981a7b` (solo parte 1 di T16).
- `$RUN_CI_055` = 40298641309 (`ci` su `claude/giro-055-t16`, `7285bf0`): `success`.
  `$RUN_CI_056` = 40316442136 (`ci` su `claude/giro-056-t16`, `42e8986`): `success`.
- I giri 055 e 056 non toccano il server: si verifica l'app web servita in produzione, l'APK e
  i test in locale. Il server serve a preparare i dati e a controllare lo stato finale.
- La galleria in produzione è spenta (`isGalleryEnabled`): A1 del 056 e la parte `/gallery` di
  A3 del 055 valgono in locale (V3).
- Colori attesi (token del 055): scuro fondo `rgb(17, 20, 24)` (`#111418`), titolo
  `rgb(232, 236, 241)` (`#E8ECF1`); chiaro fondo `rgb(243, 245, 247)` (`#F3F5F7`), titolo
  `rgb(20, 24, 29)` (`#14181D`).

## Fatto quando — controlli eseguibili

### Regole per le prove da fuori (come nei giri 048, 051, 054)
- `curl`, `jq` e Playwright verso `https://app.planforhome.com`; nessun comando sui server. Gli
  account demo di SPEC Appendice A li usa solo l'umano.
- Scritture di prova coperte dalla **decisione 42**. Account inventati
  `verifica057.<epoch>.<x>@example.com`, `<x>` = `a`, `b`, `c`. Password generate in
  `/tmp/giro-057/` (`openssl rand -base64 18`), mai stampate. UUIDv7 generati al momento,
  annotati nel rapporto. Tre registrazioni, nessun login sbagliato; sequenza eseguita una volta.
- Script Playwright di prova in `/tmp/giro-057/` (config con `baseURL` di produzione, Chromium
  locale se il download dal proxy dà 403), cancellati a fine giro; non entrano nel repository.
  `locale` del contesto `it-IT` (salvo dove detto), fuso `Europe/Rome`. Tema con
  `page.emulateMedia({ colorScheme })`. Le richieste si contano con `page.on('request')`.
- **Stati V8 in produzione:** caricamento, errore e rete caduta si provocano solo **nel browser**
  con `page.route` su un `GET` (trattenuto, `fulfill` 500, `abort('internetdisconnected')`);
  nessuna richiesta finta arriva al server, nessuna scrittura. Il vuoto si prova anche con dati
  veri (C senza task). Durante i controlli S il contatore delle richieste non `GET` verso
  `/api/` resta 0.
- Il contrasto si misura nel DOM come A3 del 055: per ogni elemento con testo visibile, `color`
  contro i fondi risalendo gli antenati fino al primo opaco, composti con l'alfa; esenti i
  controlli disattivati (`aria-disabled="true"`, `:disabled`).
- Un errore esterno (rete, proxy, 429 di registrazione) si dichiara e non è un difetto.

### Dati di prova (inventati)
| Chi / cosa | Come nasce | Note |
|---|---|---|
| A, «Verifica A», `locale: "it"` | registrazione con `familyName: "Famiglia Verifica 057"` (F) | gestore di F |
| F2 «Famiglia Verifica 057 Due» | A, `POST /api/families` | seconda voce in `/families` |
| B, «Verifica B», `locale: "en"` | registrazione con `inviteCode` di F (A, `POST /api/families/F/invites`) | membro di F |
| C, «Verifica C», `locale: "it"` | registrazione con `familyName: "Famiglia Verifica 057 Altra"` (FX) | non in F né in F2; nessun task |

| Task / voci | Famiglia | Come nasce | Serve a |
|---|---|---|---|
| «Preparare lo zaino», aperto, in coda | F | API, A | D1, Q1 |
| L «Spesa del martedì», `template: SHOPPING_LIST`, in coda, senza scadenza | F | API, A | D1, S1–S3, Q1 |
| voci di L: «Latte», «Pane», «Mele» | F | A, `POST …/tasks/L/items` | D1, S1 |
| TX «Task segreto di C», aperto, C | FX | API, C — **dopo** E1 | X1 |

### V. CI, test in locale, APK
- [ ] V1 `gh api repos/{owner}/{repo}/actions/runs/40298641309/jobs` e `…/40316442136/jobs` →
      `server`, `app`, `apk` in `success`. `git ls-tree -r --name-only 32b223a` contiene
      `app/src/ui/LoadingState.tsx`, `app/src/ui/__tests__/contrast.test.ts`,
      `app/e2e/acceptance/giro-055-dark-theme.spec.ts`,
      `app/e2e/acceptance/giro-056-screen-states.spec.ts`.
- [ ] V2 In locale su `32b223a`: `cd app && npm ci && TZ=Europe/Rome npm test && npx tsc --noEmit && npx eslint .`
      → verde (comprende `contrast.test.ts` e il test di `LoadingState`).
      `npx expo config --type public | grep -E "userInterfaceStyle|expo-system-ui"` →
      `automatic` e il plugin presente; `grep '"expo-system-ui"' app/package.json` → presente.
      Prova di mutazione a mano (poi annullata con `git checkout -- app/`): in `tokens.ts`
      portare il testo scuro a `#5A6470` → `npx jest src/ui/__tests__/contrast` rosso; in
      `LoadingState.tsx` togliere `accessibilityLiveRegion` → il test jest di `LoadingState` o
      la suite `giro-056-screen-states` (A1) rossa. Se una resta verde, `057:maggiore`
      (`difetto_di` 055 o 056).
- [ ] V3 In locale: `cd app && npx expo export -p web && npx playwright test e2e/acceptance/giro-055-* e2e/acceptance/giro-056-*`
      → verde (A0–A5 del 055, compreso `/gallery` in scuro; A0–A9 e concorrenza del 056).
      Senza browser valgono V1 e le run CI, dichiarandolo.
- [ ] V4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] V5 Ultimo APK: in `$RUN_CONSEGNA` job `apk` (e `apk-firma`, se c'è) in `success` e un
      artefatto `planforhome-0.1.0-<sha>`, dimensione > 0, non scaduto
      (`gh api repos/{owner}/{repo}/actions/runs/40318715161/artifacts`). Atteso `<sha>` =
      `32b223a`; se è `6981a7b`, si guarda nel log del job (`actions/checkout`) quale commit è
      stato preso e si annota: un APK su `6981a7b` non contiene la parte 2 e non vale per T16,
      si cerca un run di consegna con APK su `32b223a` (non è un difetto di 055/056). Il job era
      in corso alle 12:05Z: controllo a intervalli, massimo 30 minuti; se fallisce,
      `057:maggiore` (`difetto_di` 056); se dopo 30 minuti è ancora in corso, il giro si
      dichiara in attesa, non `passato`.

### H. Da fuori, senza login
- [ ] H1 `curl -sS https://app.planforhome.com/api/health` → 200 con
      `"sha":"32b223a5d5e5139408dd22e9860d60bb9d52585d"`. Ripetuto alla fine.
- [ ] H2 `curl -sS https://app.planforhome.com/gallery` → il corpo non contiene «Pannello di
      prova» (la galleria resta spenta).
- [ ] H3 `curl -sS https://app.planforhome.com/login` → contiene
      `<meta name="color-scheme" content="light dark"/>` (A4 del 055; si confronta per attributi,
      la barra finale non conta).

### P. Preparazione (API, account di prova)
- [ ] P0 A si registra (`it`), crea F2 e un invito di F; B si registra (`en`) con l'invito; C si
      registra (`it`). Login di tutti e tre. Se un passo fallisce, la sequenza si ferma e il giro
      si dichiara bloccato (errore esterno ≠ difetto).
- [ ] P1 A crea «Preparare lo zaino» e L in F, le tre voci di L; ogni richiesta → 2xx.
      `GET /api/families/F/tasks` come A → i due task. TX si crea solo dopo E1.

### T. Tema scuro e chiaro (web; il cuore della parte 1)
- [ ] T1 Senza sessione, `colorScheme: 'dark'`: su `/` e `/login` il contenitore di `Screen`
      (primo antenato del `heading` 1 con fondo non trasparente che riempie la finestra; non
      `body`) ha fondo `rgb(17, 20, 24)` e il `heading` 1 colore `rgb(232, 236, 241)`; con
      `'light'` fondo `rgb(243, 245, 247)` e titolo `rgb(20, 24, 29)`. Su `/` il link «Accedi»
      (per ruolo) porta a `/login`.
- [ ] T2 Login come A, stesso controllo in scuro e in chiaro su `/families`,
      `/family?id=<F>`, `/tasks`, `/me`, `/list?family=<F>&task=<L>`, ognuna con i suoi dati
      visibili prima di misurare (link «Famiglia Verifica 057 Due»; «Verifica B» nelle persone;
      «Preparare lo zaino»; «Ciao, Verifica A»; «Latte»). Atteso con `expect.poll`: il prerender
      esce chiaro e passa a scuro dopo l'idratazione (lampo dichiarato nel 055, non un difetto).
- [ ] T3 Dal vivo: su `/families` in chiaro, `emulateMedia({ colorScheme: 'dark' })` **senza
      ricaricare** → il fondo passa a `rgb(17, 20, 24)`; di nuovo `'light'` → `rgb(243, 245, 247)`.
- [ ] T4 Contrasto in scuro: sulle sette schermate di T1–T2 ogni testo visibile ≥ 4.5:1
      (misura del DOM, regole sopra). Si annotano il minimo per schermata e l'elemento.
- [ ] T5 Nessun `pageerror` né messaggio di console su idratazione (`hydrat…`, React
      #418/#423/#425) durante T1–T4.

### S. Stati V8 sulle schermate (login come A, `colorScheme` chiaro e scuro, 390×844)
Endpoint come nella tabella del piano 056.
- [ ] S1 Caricamento: con il `GET` trattenuto (`/api/families` per `/families`, `/family` e
      `/me` famiglie; `/api/families/F/tasks` per la sezione task di `/family`; `/api/tasks`
      per `/tasks`; `/api/families/F/tasks/L/items` per `/list`) → esattamente 1 `status`
      «Caricamento…», dentro `Screen` con il fondo del tema; rilasciato (`route.fallback()`) → i
      dati veri compaiono e lo `status` sparisce. Su `/family` con solo i task trattenuti:
      titolo «Famiglia Verifica 057» visibile e 1 `status`. Su `/me` con le famiglie
      trattenute: «Ciao, Verifica A» e «Esci» visibili, «Cambia famiglia» solo dopo il rilascio.
- [ ] S2 Errore: stesso `GET` trattenuto, poi `fulfill` 500 → l'`alert` del piano 056
      («Impossibile caricare le famiglie. Riprova.», «Impossibile caricare la famiglia.
      Riprova.», «Impossibile caricare i task. Riprova.», «Impossibile caricare le tue
      famiglie. Riprova.», «Qualcosa non ha funzionato. Riprova.»; sulla sezione task di
      `/family` la nota `status` esistente) e nessuno `status` «Caricamento…»; l'URL non cambia.
- [ ] S3 Rete caduta: `/tasks` e `/families`, `GET` trattenuto e poi
      `abort('internetdisconnected')` → stesso `alert` di S2, nessuno `status`, l'URL non cambia.
- [ ] S4 In scuro, su ogni stato di S1–S3 ogni testo visibile ≥ 4.5:1.
- [ ] S5 Nessuna richiesta non `GET` verso `/api/` durante S1–S4 (contatore = 0).

### E. Stati vuoti con dati veri
- [ ] E1 Login come C (FX senza task): `/tasks` mostra l'`EmptyState` di `task.empty` (titolo e
      suggerimento visibili), nessun `alert`, nessuno `status`; in chiaro e scuro, in scuro
      contrasto ≥ 4.5:1.
- [ ] E2 `/me` di A con `GET /api/families` → `fulfill` `[]` nel browser: saluto, «Non fai
      ancora parte di nessuna famiglia», il suggerimento, «Esci»; nessun link «Cambia
      famiglia», nessuno `status`, nessun `alert` (A5 del 056; in produzione nessun account
      resta senza famiglie, perciò lo stato si provoca nel browser).

### Q. Screenshot (solo per il rapporto, in `/tmp/giro-057/`)
- [ ] Q1 `/`, `/login`, `/families`, `/family?id=<F>`, `/tasks`, `/me`,
      `/list?family=<F>&task=<L>` × `light|dark` × 390×844 e 1280×800, presi dopo che il fondo
      del tema è applicato → 28 file non vuoti; in ognuno `document.documentElement.scrollWidth`
      ≤ viewport. Più gli stati `families-loading`, `tasks-error`, `me-empty`, `tasks-empty` (C)
      × `light|dark` a 390×844 → 8 file.

### X. Isolamento, regressione
- [ ] X1 C crea TX in FX; C `GET /api/families/<F>/tasks/<L>/items` → 403 o 404; C
      `GET /api/tasks` → nessun task di F; A `/family?id=<FX>` → famiglia non trovata, nessun
      «Task segreto di C», in chiaro e in scuro (lo stato d'errore o di «non trovata» ha il fondo
      del tema); in `/families` di A, FX non compare.

### F. Sul telefono
- [ ] F1 APK su Android in tema scuro di sistema (`userInterfaceStyle: automatic` con
      `expo-system-ui`), annuncio TalkBack del «Caricamento…», note offline/conflitto della sync
      su Android: non si provano dalla catena (nessun dispositivo né emulatore). Si dichiarano e
      restano «Per l'umano» in `PROGRESS.md`. Non bloccano il `passato`.

### Esito
T16 è `passato` se sono verdi V1–V5 (V3 con il ripiego dichiarato), H1–H3, P0–P1, T1–T5,
S1–S5, E1–E2, Q1, X1, con F1 dichiarata. Un rosso è un difetto `057:<gravità>` con `difetto_di`
055 (tema, token, contrasto, `meta color-scheme`, `expo-system-ui`) o 056 (`LoadingState`, stati
d'errore e vuoto, `/` dal kit), e T16 resta `in-corso`. Un atteso sbagliato del piano si scrive
come «atteso del piano», non come difetto, e si riesegue il controllo corretto.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository.
- I dubbi già noti: lampo chiaro prima dell'idratazione (055); `me()` che non distingue 401 da
  errore, quindi `/api/me` che fallisce porta a `/login`; spinner Android senza timeout;
  `aria-live` montata già piena; nessun test di `/me` con famiglie abortite (056). Non diventano
  difetti nuovi.
- Bottone «Riprova», ritardo anti-sfarfallio, scheletri; preferenza del tema dentro l'app;
  ritocchi ai token scuri.
- Galleria in produzione (spenta): vale V3.
- Offline sul web (si prova solo la rete caduta di S3, come nel 056).
- Pulizia degli account di prova dei giri precedenti e di questo. Prove di carico.
- T1–T15, già `passato`; T17–T19.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni» a griglia;
  set di icone come dipendenza; accesso con Google o Apple, iPhone, Play Store; verifica
  dell'email e recupero della password; sincronizzazione in tempo reale e offline sul web; dati
  reali (R1).

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna nuova. Scritture di prova in produzione (3 account, 4 famiglie, 1 invito,
  4 task inventati, 3 voci) coperte dalla decisione 42. Le risposte finte di S ed E2 restano nel
  browser.

## Rischi di concorrenza
- Nessuna scrittura dalla UI: S5 conta le richieste non `GET` e deve trovarne 0.
- `page.route` registrata dopo il login e tolta (`unroute`) tra un controllo e l'altro, così uno
  stato finto non contamina il successivo.
- Un merge su `main` durante il giro cambia la versione: H1 ripetuto alla fine lo mostra; in quel
  caso si rifà la verifica sul nuovo SHA.
- L'APK del run in corso potrebbe non essere di `32b223a` (V5): si controlla il nome e il log.

## Budget
0 righe di codice. File scritti: `057-piano.md`, `057-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr`, `passato_il` di T16 in `traguardi.json`. Temporanei solo in `/tmp/giro-057/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Un emulatore Android nella CI per tema scuro, TalkBack e fontScale (porta: immagine o action nuova).
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`), già proposto nel 039.
- `me()` che distingue 401 da errore di rete, timeout dello spinner Android (dubbi del 056).
