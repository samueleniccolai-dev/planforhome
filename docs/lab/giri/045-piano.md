---
giro: 045
traguardo: T12
traguardi_extra: []
tipo: verifica-produzione
fase: chiusura
inizio: 2026-10-25T08:18:05Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 045 — verifica in produzione di T12 (fondamenta del kit UI)

## Fetta e traguardo
T12, tipo `verifica-produzione`: il rapporto 044 dice «Fatto quando verde, da verificare in
produzione», la PR #68 è mergiata in `0c943dc`, il deploy è verde. Nessun codice.
Fonti: SPEC §12; DESIGN §2, §3, §5; `traguardi.json` → T12; piano e rapporto 044.

Riferimenti fissati al momento del piano (2026-10-25T08:19Z):
- `$SHA` = `0c943dc8c3d18b31ad15346d476de7cda0a43aa7` (merge della PR #68);
  `GET /api/health` → `{"status":"UP","sha":"0c943dc8c3d18b31ad15346d476de7cda0a43aa7"}`.
- `$RUN_CONSEGNA` = 40175792596: `controllo`, `immagine`, `pubblica`, `deploy`, `avanti` in
  `success`, `decidi` `skipped`; **`apk` ancora in corso**. Il run 40176096288 su `0c943dc` è
  `skipped`: atteso, non un difetto.
- `$RUN_CI_PR` = 40172884784 (`ci` su `claude/giro-044-t12`, `d573747`): `build`, `server`,
  `app`, `apk`, `lab` in `success`.
- Il giro 044 non tocca il server (salvo `server/mvnw.cmd`, solo fine riga): la verifica è tutta
  sull'app web servita in produzione, sull'APK e sui test in locale.

## Fatto quando — controlli eseguibili

### Regole per le prove da fuori
- Playwright e `curl` verso `https://app.planforhome.com`; nessun comando sui server. Gli
  account demo di SPEC Appendice A non si toccano. Nessuna registrazione: basta un login
  sbagliato con un'email inventata `verifica045.<epoch>@example.com` e una password generata in
  `/tmp/giro-045/` (`openssl rand -base64 18`), mai stampata. Un solo tentativo.
- Gli script Playwright di prova vivono in `/tmp/giro-045/` (config con `baseURL` di
  produzione) e si cancellano a fine giro; non entrano nel repository.
- Un errore esterno (rete, proxy, 429) si dichiara e non è un difetto.

### V. CI, test in locale, APK
- [ ] V1 `gh api repos/{owner}/{repo}/actions/runs/40172884784/jobs` → `app`, `apk`, `server`
      in `success`. `git ls-tree -r --name-only 0c943dc` contiene `app/app/gallery.tsx`,
      `app/src/ui/tokens.ts`, `app/e2e/acceptance/giro-044-kit.spec.ts` e i Jest
      `app/src/ui/__tests__/{tokens,no-literal-colors,gallery,Button}.test.ts`.
- [ ] V2 In locale su `0c943dc`: `cd app && npm ci && npm test && npx tsc --noEmit && npx eslint .`
      → verde; `npm test -- no-literal-colors` verde. Prova di mutazione a mano (poi annullata con
      `git checkout -- app/`): aggiungere `const c = '#ABCDEF';` a `app/app/login.tsx` →
      `no-literal-colors` rosso. Se resta verde, `045:maggiore` (`difetto_di` 044).
- [ ] V3 In locale: `cd app && npx playwright test e2e/acceptance/giro-044-kit.spec.ts` → verde
      (A1–A9); i 4 file `e2e-screenshots/gallery-{390,1280}-fs{1,2}.png` esistono, dimensione > 0;
      il rapporto li descrive (a fs2/390: nessun testo tagliato, bottoni in colonna). Senza
      browser valgono V1 e la run CI, dichiarandolo.
- [ ] V4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] V5 Ultimo APK: in `$RUN_CONSEGNA` job `apk` (e `apk-firma`, se c'è) in `success` e un
      artefatto `planforhome-0.1.0-0c943dc`, dimensione > 0, non scaduto
      (`gh api repos/{owner}/{repo}/actions/runs/40175792596/artifacts`). Se il job è in corso si
      attende con un controllo a intervalli (massimo 30 minuti); se fallisce, `045:maggiore`
      (`difetto_di` 044).

### S. Da fuori, senza login
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con
      `"sha":"0c943dc8c3d18b31ad15346d476de7cda0a43aa7"`. Ripetuto alla fine.
- [ ] S2 Gate della galleria in produzione: `curl -sS https://app.planforhome.com/gallery` → il
      corpo HTML non contiene «Galleria del kit», «Kit gallery», «Prova il bottone»; Playwright
      su `https://app.planforhome.com/gallery` e `…/gallery?fs=2` → dopo l'idratazione l'URL è
      `/` (o la sua destinazione, login), nessun heading «Galleria del kit», nessun bottone
      «Prova il bottone». Galleria visibile in produzione = `045:bloccante`.
      Nota: i testi della galleria possono stare nel bundle JS comune (chiavi i18n); non si
      controlla il bundle e non è un difetto.

### L. Login solo-kit in produzione
- [ ] L1 Playwright su `https://app.planforhome.com/login`, viewport 390 e 1280, locale it-IT:
      `getByLabel('Email', { exact: true })` e `getByLabel('Password', { exact: true })` trovati,
      etichette visibili; bottone «Accedi» per ruolo, alto ≥ 56px, etichetta ≥ 18px; colore del
      testo del titolo `rgb(20, 24, 29)` (`#14181D`).
- [ ] L2 In en-US: etichette e bottone con i nomi inglesi (le chiavi del giro 004), nessuna
      chiave grezza a vista (`login.` nel testo della pagina → assente).
- [ ] L3 Login sbagliato (email inventata, una volta) → il bottone è `disabled` durante
      l'attesa, poi un `alert` con il testo dell'errore del giro 004; una sola `POST
      /api/auth/login` osservata da `page.on('request')`.
- [ ] L4 `/login?fs=2` → titolo 24px e campo Email 18px (il moltiplicatore non agisce fuori
      dalla galleria, A6 del 044).
- [ ] L5 Viewport 390: `document.documentElement.scrollWidth <= 390` (nessun overflow orizzontale).

### F. fontScale 2.0 sul telefono
- [ ] F1 La prova «a fontScale 2.0 nessuna funzione persa e nessun testo tagliato» è provata sul
      web con il moltiplicatore della galleria (V3, A5 del 044). La prova su Android a
      fontScale di sistema 2.0 non si può fare dalla catena (nessun dispositivo né emulatore):
      si dichiara e resta «Per l'umano» in `PROGRESS.md`, come per l'APK di T11 nel giro 043.
      Non blocca il `passato`.

### Esito
T12 è `passato` se sono verdi V1–V5 (V3 con il ripiego dichiarato), S1–S2, L1–L5, con F1
dichiarata. Un rosso è un difetto `045:<gravità>` con `difetto_di` 044, e T12 resta
`in-corso`. Un atteso sbagliato del piano si scrive come «atteso del piano», non come difetto.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository.
- I tre dubbi del revisore 044 (`server/mvnw.cmd`, doppio click sincrono già su main, `window`
  senza `Platform.OS` in `gallery.tsx`): già noti, non diventano difetti nuovi.
- `aria-describedby` dell'errore del campo; tema scuro (T16); altre schermate oltre login (T13+).
- Registrazioni, famiglie, task di prova: non servono a T12.
- Pulizia degli account di prova dei giri precedenti. Prove di carico.
- T1–T11, già `passato`; T13–T19.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni» a griglia;
  set di icone come dipendenza; accesso con Google o Apple, iPhone, Play Store; verifica
  dell'email e recupero della password; sincronizzazione in tempo reale e offline sul web; dati
  reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna. Un solo login sbagliato con un'email inventata; nessuna scrittura.

## Rischi di concorrenza
- L3: il doppio invio è già provato nel 044; qui un solo click, si conta una sola richiesta.
- Un merge su `main` durante il giro cambia la versione: S1 ripetuto alla fine lo mostra; in quel
  caso si rifà la verifica sul nuovo SHA.

## Budget
0 righe di codice. File scritti: `045-piano.md`, `045-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr`, `passato_il` di T12 in `traguardi.json`. Temporanei solo in `/tmp/giro-045/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Un emulatore Android nella CI per gli screenshot a fontScale 2.0 (porta: immagine/action nuova).
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`), già proposto nel 039.
