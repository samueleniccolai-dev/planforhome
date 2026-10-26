---
giro: 054
traguardo: T15
traguardi_extra: []
tipo: verifica-produzione
fase: revisione
inizio: 2026-10-26T05:40:22Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 054 — verifica in produzione di T15 (UI-4: famiglia, profilo, spesa e lingua del web)

## Fetta e traguardo
T15, tipo `verifica-produzione`: il rapporto 053 dice «Fatto quando verde, da verificare in
produzione», le PR #76 (`e298949`) e #77 (`ec02a80`) sono mergiate, il deploy è verde. Nessun codice.
Fonti: SPEC §2.2.1, §2.2.7, §2.2.9; DESIGN §5; `traguardi.json` → T15; piani e rapporti 052 e 053.

Riferimenti fissati al momento del piano (2026-10-26T05:40Z):
- `$SHA` = `ec02a80027063fbcad624df312e68981dc45d53c` (merge della PR #77, testa di `main`);
  `GET /api/health` → `{"status":"UP","sha":"ec02a80027063fbcad624df312e68981dc45d53c"}`.
- `$RUN_CONSEGNA` = 40274965561 (evento `workflow_run`, creata 05:34:39Z; l'API riporta
  `head_sha` `e298949`): `decidi`, `immagine`, `pubblica`, `deploy`, `avanti` in `success`,
  `controllo` `skipped`; **`apk` ancora in corso**. Il run 40275455434 su `ec02a80` è `skipped`:
  atteso (come 40241655283 nel giro 051), non un difetto.
- `$RUN_CI_052` = 40250791206 (`ci` su `claude/giro-052-t15`, `0206715`): `success`.
  `$RUN_CI_053` = 40272939507 (`ci` su `claude/giro-053-t15`, `daa7dea`): `success`.
- I giri 052 e 053 non toccano il server: la verifica è sull'app web servita in produzione,
  sull'APK e sui test in locale. Il server serve a preparare i dati e a controllare lo stato finale.
- La galleria in produzione è spenta per scelta (`isGalleryEnabled`): G1 del 052 vale in locale (V3).
- `?fs=` (fontScale del web) è accettato da `family.tsx`, `families.tsx`, `me.tsx` (052) e
  `list.tsx` (053): gli screenshot a `fs` 2 si fanno così anche in produzione.

## Fatto quando — controlli eseguibili

### Regole per le prove da fuori (come nei giri 045, 048, 051)
- `curl`, `jq` e Playwright verso `https://app.planforhome.com`; nessun comando sui server. Gli
  account demo di SPEC Appendice A li usa solo l'umano.
- Scritture di prova coperte dalla **decisione 42**. Account inventati
  `verifica054.<epoch>.<x>@example.com`, `<x>` = `a`, `b`, `c`. Password generate in
  `/tmp/giro-054/` (`openssl rand -base64 18`), mai stampate. UUIDv7 generati al momento, annotati
  nel rapporto. Tre registrazioni, nessun login sbagliato; sequenza eseguita una volta.
- Gli script Playwright di prova vivono in `/tmp/giro-054/` (config con `baseURL` di produzione,
  Chromium locale se il download dal proxy dà 403) e si cancellano a fine giro; non entrano nel
  repository. Lingua del browser con `locale` del contesto (`en-US` o `it-IT`), fuso `Europe/Rome`.
  Le richieste si contano con `page.on('request')`.
- Un errore esterno (rete, proxy, 429 di registrazione) si dichiara e non è un difetto.

### Dati di prova (inventati)
| Chi / cosa | Come nasce | Note |
|---|---|---|
| A, «Verifica A», `locale: "it"` | registrazione con `familyName: "Famiglia Verifica 054"` (F) | gestore di F |
| F2 «Famiglia Verifica 054 Due» | A, `POST /api/families` | A gestore; seconda voce in `/families` |
| B, «Verifica B», `locale: "en"` | registrazione con `inviteCode` di F (A, `POST /api/families/F/invites`) | membro di F |
| «Leo Verifica» | A, `POST /api/families/F/resources` | risorsa senza account, solo in F |
| C, «Verifica C», `locale: "it"` | registrazione con `familyName: "Famiglia Verifica 054 Altra"` (FX) | non in F né in F2 |

| Task / voci | Famiglia | Come nasce | Serve a |
|---|---|---|---|
| L «Spesa del lunedì», `template: SHOPPING_LIST`, in coda, senza scadenza | F | API, A | D1–D5 |
| voci di L: «Uova», «Farina», «Zucchero», «Sale» | F | A, `POST …/tasks/L/items` | D1–D5 |
| «Zucchero» spuntata | F | A, `PUT …/items/<Zucchero>/checked` `{checked:true}` | D2 |
| «Sale» tolta da B | F | B, `POST …/items/<Sale>/remove` | D3 |
| «Preparare lo zaino», aperto, in coda | F | API, A | K1 (la schermata ha almeno un task) |
| TX «Task segreto di C», aperto, C | FX | API, C | X1 |

### V. CI, test in locale, APK
- [ ] V1 `gh api repos/{owner}/{repo}/actions/runs/40250791206/jobs` e `…/40272939507/jobs` →
      `server`, `app`, `apk` in `success`. `git ls-tree -r --name-only ec02a80` contiene
      `app/src/ui/{LinkRow,ListRow}.tsx`, `app/src/shopping/ShoppingList.tsx`,
      `app/e2e/acceptance/giro-052-{account-locale,screens-kit}.spec.ts`,
      `app/e2e/acceptance/giro-053-shopping-kit.spec.ts`.
- [ ] V2 In locale su `ec02a80`: `cd app && npm ci && TZ=Europe/Rome npm test && npx tsc --noEmit && npx eslint .`
      → verde (K1, Q1 del 052 e del 053). Statico:
      `grep -nE "#[0-9a-fA-F]{3,8}|StyleSheet|style=|@/ui/tokens" app/app/family.tsx app/app/families.tsx app/app/me.tsx app/app/list.tsx app/src/shopping/ShoppingList.tsx`
      → nessuna riga; `grep -nE "#[0-9a-fA-F]{3,8}" app/src/ui/LinkRow.tsx app/src/ui/ListRow.tsx`
      → nessuna riga. Prova di mutazione a mano (poi annullata con `git checkout -- app/`): in
      `ShoppingList` togliere `struck` dal testo della voce tolta → la suite
      `giro-053-shopping-kit` (D3) rossa; in `setAccountLocale` ignorare la lingua dell'account →
      `npm test -- src/i18n` rosso. Se una resta verde, `054:maggiore` (`difetto_di` 053 o 052).
- [ ] V3 In locale: `cd app && npx expo export -p web && npx playwright test e2e/acceptance/giro-052-* e2e/acceptance/giro-053-*`
      → verde (L1–L6, S1, P1–P3, G1, V1 del 052; S1, D1–D7, V1 del 053, compresi L5 e L6 che in
      produzione non si provocano). Senza browser valgono V1 e le run CI, dichiarandolo.
- [ ] V4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] V5 Ultimo APK: in `$RUN_CONSEGNA` job `apk` (e `apk-firma`, se c'è) in `success` e un
      artefatto `planforhome-0.1.0-<sha>`, dimensione > 0, non scaduto
      (`gh api repos/{owner}/{repo}/actions/runs/40274965561/artifacts`). Atteso `<sha>` =
      `ec02a80`; se è `e298949`, si guarda nel log del job quale commit è stato preso
      (`actions/checkout`) e si annota: un APK su `e298949` non contiene la parte 2 e non vale per
      T15, si attende o si cerca un run di consegna con APK su `ec02a80` (non è un difetto di
      052/053). Il job era in corso alle 05:40Z: controllo a intervalli, massimo 30 minuti; se
      fallisce, `054:maggiore` (`difetto_di` 053); se è ancora in corso dopo 30 minuti, il giro
      si dichiara in attesa, non `passato`.

### S. Da fuori, senza login
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con
      `"sha":"ec02a80027063fbcad624df312e68981dc45d53c"`. Ripetuto alla fine.
- [ ] S2 `curl -sS https://app.planforhome.com/gallery` → il corpo non contiene «Pannello di
      prova» (la galleria resta spenta).

### P. Preparazione (API, account di prova)
- [ ] P0 A si registra (`it`), crea F2, un invito di F e la risorsa «Leo Verifica»; B si registra
      (`en`) con l'invito; C si registra (`it`). Login di tutti e tre. Se un passo fallisce, la
      sequenza si ferma e il giro si dichiara bloccato (errore esterno ≠ difetto).
- [ ] P1 A crea L e «Preparare lo zaino» in F, le quattro voci di L, spunta «Zucchero»; B toglie
      «Sale»; C crea TX in FX; ogni richiesta → 2xx. `GET …/tasks/L/items` come A → «Zucchero»
      spuntata, «Sale» tolta da B.

### L. Lingua del web (SPEC §2.2.9; il cuore di T15)
- [ ] L1 Contesto `en-US`, nessuna sessione: `/login` mostra «Sign in to planforhome» e il
      bottone «Sign in», `html[lang="en"]` (prima del login vince il browser). Login come A
      (`it`) → `/families` «Scegli una famiglia», `html[lang="it"]`; `/me` «Ciao, Verifica A»,
      «Esci», «Lingua dell'account: Italiano»; `/family?id=<F>` «Persone». Nessun `pageerror` né
      messaggio di console su idratazione (`hydrat…`, React #418/#423/#425).
- [ ] L2 Stesso contesto, ricaricamento di `/family?id=<F>` → ancora «Persone» e «Gestore»,
      `html[lang="it"]`, senza passare da `/me`.
- [ ] L3 Da `/me`, «Esci» → un solo `POST /api/auth/logout`; `/login` di nuovo «Sign in to
      planforhome», `html[lang="en"]`.
- [ ] L4 Il contrario: contesto `it-IT`, `/login` «Accedi a planforhome», `html[lang="it"]`;
      login come B (`en`) → `/me` «Hi, Verifica B», «Sign out», «Account language: English»,
      `html[lang="en"]`.

### K. Schermate dal kit (login come A, `it-IT`, 390×844 e 1280×800)
- [ ] K1 `/family?id=<F>`: lista «Persone» con un `listitem` per Verifica A («Gestore»),
      Verifica B («Membro») e Leo Verifica («Senza account»), ognuno con iniziali e nome visibili.
- [ ] K2 `/families`: `link` «Famiglia Verifica 054», «Famiglia Verifica 054 Due» e «Tutte le
      mie famiglie», ognuno un `<a href>` alto ≥ 48 px a `fs` 1 e 2; un clic su «Famiglia
      Verifica 054 Due» apre `/family?id=<F2>`.
- [ ] K3 `/me`: `button` «Esci» alto ≥ 48 px a `fs` 1 e 2.

### D. Lista della spesa (login come A, `/list?family=<F>&task=<L>`)
- [ ] D1 `heading` livello 2 visibili «Da prendere», «Spuntate», «Voci tolte», e tre `list` con
      gli stessi nomi; «Uova» e «Farina» in «Da prendere», «Zucchero» in «Spuntate», «Sale» in
      «Voci tolte».
- [ ] D2 Spuntata non solo dal colore: `checkbox` «Zucchero» `aria-checked="true"` con un
      discendente visibile in più (il segno di spunta) rispetto alla `checkbox` «Uova».
- [ ] D3 Tolta non solo dal colore: il testo «Sale» (`exact`) ha `text-decoration-line`
      calcolato `line-through`; la riga mostra «tolta da Verifica B» in carattere più piccolo
      di «Sale»; «Uova» dentro la sua `checkbox` non è rigato.
- [ ] D4 Bersagli: ogni `checkbox` e `button` della schermata alto ≥ 48 px a `fs` 1 e 2; nessun
      traboccamento orizzontale a 390 px con `fs` 2.
- [ ] D5 Un clic sul testo «Uova» → esattamente 1 `PUT …/items/<Uova>/checked` con
      `checked: true`; «Uova» passa in «Spuntate» una volta sola; `GET …/items` come A lo
      conferma.

### Q. Screenshot (solo per il rapporto, in `/tmp/giro-054/`)
- [ ] Q1 `/families`, `/me`, `/family?id=<F>`, `/list?family=<F>&task=<L>` × 390×844 e 1280×800
      × `?fs=1` e `?fs=2` → 16 file non vuoti; in ognuno `heading` 1 a 24 × `fs` px (atteso con
      `expect.poll`), `document.documentElement.scrollWidth` ≤ viewport, nessun testo tagliato
      (`scrollWidth` ≤ `clientWidth` sui testi a una riga).

### X. Isolamento, regressione
- [ ] X1 C `GET /api/families/<F>/tasks/<L>/items` → 403 o 404; C `GET /api/tasks` → nessun
      task di F; A `/family?id=<FX>` → famiglia non trovata, nessun «Task segreto di C»; in
      `/families` di A, FX non compare.

### F. Sul telefono
- [ ] F1 APK su Android (lista della spesa a fontScale 2.0, TalkBack sulla voce tolta e sulla
      spunta, lingua dell'account sull'app) non si prova dalla catena (nessun dispositivo né
      emulatore): si dichiara e resta «Per l'umano» in `PROGRESS.md`. Non blocca il `passato`.

### Esito
T15 è `passato` se sono verdi V1–V5 (V3 con il ripiego dichiarato), S1–S2, P0–P1, L1–L4,
K1–K3, D1–D5, Q1, X1, con F1 dichiarata. Un rosso è un difetto `054:<gravità>` con `difetto_di`
052 (lingua, famiglia, famiglie, profilo, `LinkRow`) o 053 (lista, `ListRow`, `Text.struck`), e
T15 resta `in-corso`. Un atteso sbagliato del piano si scrive come «atteso del piano», non come
difetto, e si riesegue il controllo corretto.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository.
- I dubbi già noti (lingua che resta dell'account su `/login` dopo un 401, giro 052; rigatura
  del bottone disabilitato, convenzione del kit): non diventano difetti nuovi.
- L5 (risposta tardiva) e L6 (`/api/me` in 500) del 052: non si provocano in produzione; vale V3.
- Galleria in produzione (spenta): G1 del 052 vale in V3.
- Cambiare la lingua dal profilo; cambiare la password dall'app; voce di galleria per la lista.
- Pulizia degli account di prova dei giri precedenti e di questo. Prove di carico.
- T1–T14, già `passato`; T16–T19 (tema scuro compreso).
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni» a griglia;
  set di icone come dipendenza; accesso con Google o Apple, iPhone, Play Store; verifica
  dell'email e recupero della password; sincronizzazione in tempo reale e offline sul web; dati
  reali (R1).

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna nuova. Scritture di prova in produzione (3 account, 3 famiglie, 1 invito,
  1 risorsa, 3 task inventati, 4 voci, 1 spunta, 1 voce tolta, 1 spunta dalla UI) coperte dalla
  decisione 42.

## Rischi di concorrenza
- Ogni azione con un solo clic; si conta una sola richiesta e si controlla lo stato finale con
  un `GET`, così un doppio invio si vede (D5).
- Un merge su `main` durante il giro cambia la versione: S1 ripetuto alla fine lo mostra; in quel
  caso si rifà la verifica sul nuovo SHA.
- L'APK del run in corso potrebbe non essere di `ec02a80` (V5): si controlla il nome e il log.

## Budget
0 righe di codice. File scritti: `054-piano.md`, `054-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr`, `passato_il` di T15 in `traguardi.json`. Temporanei solo in `/tmp/giro-054/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Un emulatore Android nella CI per TalkBack e fontScale di sistema (porta: immagine o action nuova).
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`), già proposto nel 039.
- Cambiare la lingua dal profilo (`PUT /api/me/locale`), già annotato nel 052.
