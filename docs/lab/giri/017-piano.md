---
giro: 017
traguardo: T7
traguardi_extra: []
tipo: verifica-produzione
fase: revisione
inizio: 2026-10-21T05:50:55Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 017 — verifica in produzione di T7 (inoltro tra famiglie)

## Fetta e traguardo
Verifica di T7. T7 è stato costruito nel giro 016 (endpoint `POST …/forward`, evento `FORWARDED`,
dialogo «Inoltra il task» nell'app, PR #23). Il rapporto 016 dice «Fatto quando verde, da
verificare in produzione». La PR #23 è mergiata (`bd1b337`) e il deploy è verde. Questo giro ripete
i controlli del «Fatto quando» di T7 contro `https://app.planforhome.com` e contro le run della CI.
Nessun codice.
Fonti: SPEC §2.2.6, §5 (P11); `traguardi.json` → T7; contratto in `016-piano.md` («Cosa si
costruisce», ordine dei controlli) e DECISIONI 54–59; testi dell'app in
`app/src/i18n/it.json` → `task.forward.*` e `app/e2e/acceptance/giro-016-forward.spec.ts`.

Riferimenti fissati al momento del piano (2026-10-21, circa 05:52Z):
- `$SHA` = `bd1b33719e56aaa7166a3bc6ef0a3c73fe97ad3e` (merge della PR #23). `git diff --stat a423a6c bd1b337`
  è vuoto: il merge ha lo stesso albero dell'ultimo commit della PR.
- `$RUN_CONSEGNA` = 39551400218 (`workflow_run` su `main`): job `decidi`, `immagine`, `pubblica`,
  `deploy` e `avanti` in `success`, `controllo` in `skipped`. **Il job `apk` è ancora in corso.**
  L'API mostra `head_sha` `71f2fe5`, ma `/api/health` riporta `bd1b337`: conta quest'ultimo (stesso
  caso dei giri 012 e 015).
- `$RUN_CI_PR` = 39522349983 (`ci` sulla PR #23, `a423a6c`): `success`.
- `GET /api/health` → `{"status":"UP","sha":"bd1b33719e56aaa7166a3bc6ef0a3c73fe97ad3e"}`.
- Scritture di prova in produzione: autorizzate dalla **decisione 42** (A+) per tutti i giri
  `verifica-produzione`. Non serve una domanda.

Il «Fatto quando» di T7 non nomina Android: l'APK non entra nel verdetto.
L'evento «inoltrato» non ha un endpoint di lettura (decisione 59): in produzione non si vede, si
prova solo in CI (T7.2).

## Fatto quando — controlli eseguibili

### Regole per le prove in produzione (come nei giri 009, 012 e 015)
- Tutto da fuori: `curl` e `jq` verso `https://app.planforhome.com` (token Bearer dal login con
  `client` mobile), Playwright per il web. Nessun comando sui server (regola 7). **Gli account demo
  non si usano** (servirebbe `DEMO_PASSWORD`).
- Account inventati `verifica017.<epoch>.<x>@example.com`, con `<x>` = `a`, `b`, `c`; `<epoch>` =
  `date -u +%s` all'inizio, annotato nel rapporto. Locale `it`.
- Password generate al momento in `/tmp/giro-017/` (`openssl rand -base64 18`), mai stampate né
  committate, passate con `jq -n --rawfile`. A fine giro si cancella `/tmp/giro-017/`.
- Limiti: 3 registrazioni, 3 codici d'invito usati, nessun login o codice sbagliato. La sequenza si
  esegue **una volta sola, nell'ordine**. Un errore esterno (rete, proxy, 429) si dichiara nel
  rapporto e non è un difetto.
- Ogni `id` e `mutationId` è un UUIDv7 generato al momento; tutti annotati nel rapporto.
- Notazione: `T(x)` è il task con titolo `x`; `fw(U, Fda, t, Fa)` è
  `POST /api/families/{Fda}/tasks/{t}/forward` di U con corpo `{mutationId, toFamilyId: Fa}`.
  «stato invariato»: un `GET /api/families/{Fda}/tasks` dopo il rifiuto mostra il task con stessi
  `familyId`, `status`, `assigneePersonId` e `version`, e il task non compare nella famiglia di arrivo.
- Tutte le scadenze sono future (novembre 2026): i controlli non dipendono dall'ora.

### Persone e famiglie di prova (inventate)
| Chi | Come nasce | Ruolo |
|---|---|---|
| A, «Verifica A» | registrazione con `familyName: "Famiglia Verifica 017"` (F, fuso atteso `Europe/Rome`) | gestore di F; crea FN |
| FN | A: `POST /api/families` `{id, name:"Famiglia Verifica 017 NY", timeZone:"America/New_York"}` | A gestore |
| B, «Verifica B» | registrazione con un codice d'invito di F; poi `POST /api/families/join` con un codice di FN | membro di F e di FN |
| Leo | A: `POST /api/families/{F}/resources` `{id, displayName:"Leo", referentPersonId:<B>}` | risorsa di F senza account, non in FN |
| C, «Verifica C» | registrazione con `familyName: "Famiglia Verifica 017 Altra"` (FX); poi `POST /api/families/join` con un codice di FN | gestore di FX, membro di FN, **non in F** |

### A. Prove nella CI e in locale
- [ ] T7.1 `gh api repos/samueleniccolai-dev/planforhome/actions/runs/39522349983/jobs` → job
      `server` e `app` in `success`. In `git ls-tree -r bd1b337` ci sono
      `Giro016ForwardAcceptanceTest`, `Giro016ForwardIsolationAcceptanceTest`,
      `app/e2e/acceptance/giro-016-forward.spec.ts` e `V3__task_events.sql`.
- [ ] T7.2 In locale, su `bd1b337`: `cd server && ./mvnw -q -Dtest='Giro016*AcceptanceTest' test`
      → verde (19 test). Il rapporto cita, per ogni pezzo del «Fatto quando», il metodo che lo copre:
      P11 gestore permesso e vietato, membro permesso e vietato; task spostato **ed evento
      `FORWARDED`** (`aManagerOfTheDepartureForwardsAndTheAssigneeNotInTheArrivalIsDropped`, che legge
      `task_event`); assegnatario tenuto o in coda; chi non è in entrambe; ciclico che conserva la
      ricorrenza. Un pezzo senza metodo è un difetto `017:alto` con `difetto_di: 016`.
- [ ] T7.3 In locale: `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-016-*`
      → verde (F1–F7). Se mancano Docker o il browser, vale T7.1 e lo si dichiara.
- [ ] T7.4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.

### S. Smoke da fuori
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con `"sha":"bd1b33719e56aaa7166a3bc6ef0a3c73fe97ad3e"`.
      Si ripete alla fine: se lo SHA cambia a metà, si annota (vedi «Rischi»).
- [ ] S2 Senza login: `POST /api/families/{UUIDv7 inventato}/tasks/{UUIDv7 inventato}/forward` → 401.

### P0. Preparazione (se un passo fallisce la sequenza si ferma)
Registrazione di A, login, creazione di FN, codice d'invito di F, registrazione e login di B,
codice di FN e join di B, risorsa Leo, registrazione e login di C, codice di FN e join di C.
Controllo: `GET /api/families/{FN}/members` di A elenca A, B, C e non Leo. Task creati con
`POST /api/families/{F}/tasks`, da A salvo dove è scritto altro.

### P. Riga P11 di SPEC §5 (un caso permesso e uno vietato per gestore e per membro)
- [ ] P1 **Gestore, permesso, task non suo; assegnatario che non c'è → coda.** B crea
      `T("Ritirare le foto")` in F, DATE `2026-11-06`, assegnato a Leo. A `fw(A, F, foto, FN)` →
      200, `familyId` = FN, `familyTimeZone:"America/New_York"`, `assigneePersonId:null`,
      `status:"OPEN"`, `version` = prima + 1. Il task non è più in `GET /api/families/{F}/tasks` di A
      né di B; è in quello di FN per A, B e C.
- [ ] P2 **Gestore, vietato (non è in entrambe).** C crea `T("Riparare la bici")` in FX. C
      `fw(C, FX, bici, F)` → 404 `not_found`, stato invariato. A `fw(A, F, <task di F>, FX)` → 404,
      stato invariato (A non è in FX).
- [ ] P3 **Membro, permesso, task suo; assegnatario che c'è → resta.** B crea
      `T("Comprare il regalo per la zia")` in F, DATE `2026-11-07`, assegnato a B. B
      `fw(B, F, regalo, FN)` → 200, `familyId` = FN, `assigneePersonId` = B.
- [ ] P4 **Membro, permesso, task assegnato a lui ma creato da altri.** A crea
      `T("Prenotare la revisione")` in F, assegnato a B. B `fw(B, F, revisione, FN)` → 200,
      assegnatario B.
- [ ] P5 **Membro, vietato, task non suo.** A crea `T("Pulire il frigo")` in F, in coda. B
      `fw(B, F, frigo, FN)` → 403 `{"error":"forbidden"}`, stato invariato.
- [ ] P6 **Chi sta solo nella famiglia di arrivo.** C crea `T("Annaffiare l'orto")` in FN (task suo).
      C `fw(C, FN, orto, F)` → 404, stato invariato. Un task di F nell'URL di C
      (`fw(C, F, frigo, FN)`) → 404 con corpo identico (`cmp`) a quello di un task inesistente.

### R. Ricorrenza e fusi
- [ ] R1 **Ciclico DATE conserva la ricorrenza.** A crea `T("Portare fuori la plastica")` in F, DATE
      `2026-11-03` (martedì), `recurrence:{type:"WEEKLY", days:["TUESDAY"]}`, assegnato a B. A
      `fw(A, F, plastica, FN)` → 200: stessi `recurrence` e `seriesId`, `due:"2026-11-03"` (la data
      locale non cambia), `assigneePersonId` = B. B `POST /api/families/{FN}/tasks/{plastica}/done`
      → 200 `DONE`. La successiva (stesso `seriesId`, `OPEN`) è in FN, `due:"2026-11-10"`, stessa
      `recurrence`, assegnata a B, `version:1`; nella serie in F non c'è nessuna riga `OPEN`.
- [ ] R2 **DATETIME resta lo stesso istante.** A crea `T("Chiamare l'idraulico")` in F, DATETIME
      `2026-11-05T17:30:00Z`. `fw(A, F, idraulico, FN)` → 200, `due` = lo stesso istante.

### V. Validazioni e idempotenza
- [ ] V1 `fw(A, F, frigo, F)` → 400 `same_family`; `toFamilyId:"abc"` → 400 `invalid_request`;
      senza `mutationId` → 400 `invalid_request`. Stato invariato dopo i tre.
- [ ] V2 A crea `T("Comprare il pane")` in F, lo segna fatto; `fw(A, F, pane, FN)` → 409 `not_open`;
      il task resta in F, `DONE`.
- [ ] V3 Ripetere P3 con lo stesso corpo e lo stesso `mutationId` → 200, stessa `version`,
      `familyId` = FN; in FN un solo task con quell'`id`. Lo stesso `mutationId` con `frigo` → 409
      `mutation_conflict`, frigo invariato.

### I. Isolamento
- [ ] I1 `GET /api/tasks` di C contiene i task inoltrati in FN (foto, regalo, revisione, plastica,
      idraulico) e nessun task rimasto in F (frigo, pane); `GET /api/families/{F}/tasks` di C → 404.
- [ ] I2 `fw(C, FX, frigo, FN)` (task di F con la famiglia di C nell'URL) → 404; frigo invariato.

### W. Web (Playwright su produzione, `it-IT`, come A)
Script temporaneo fuori dal repo (`/tmp/giro-017/web/web.spec.ts`, config con `baseURL:
https://app.planforhome.com`, niente `webServer`), lanciato con
`cd app && npx playwright test --config /tmp/giro-017/web/playwright.config.ts`. Elementi per ruolo
ed etichetta, testi di `task.forward.*`. Prima, con l'API, A crea in F
`T("Ritirare le foto dal web")` assegnato a Leo e `T("Comprare il regalo dal web")` assegnato ad A.
Si registrano le richieste `…/forward` con `page.on('request')`.
- [ ] W1 A entra in «Famiglia Verifica 017». Pulsante «Inoltra «Ritirare le foto dal web»» →
      dialogo «Inoltra il task» con il focus dentro; gruppo «Famiglia di arrivo» con una sola voce,
      «Famiglia Verifica 017 NY». Scelta la voce → avviso «Avviso inoltro» con il testo «Leo non fa
      parte di Famiglia Verifica 017 NY: il task andrà in coda.», **prima** di «Conferma inoltro»;
      nessuna richiesta `forward` partita.
- [ ] W2 «Annulla» → nessuna richiesta, il task resta in «Task della famiglia», focus sul pulsante
      «Inoltra «Ritirare le foto dal web»».
- [ ] W3 «Inoltra «Comprare il regalo dal web»», scelta FN → nessun avviso «Avviso inoltro»; «Annulla».
- [ ] W4 Di nuovo su «Ritirare le foto dal web», scelta FN, «Conferma inoltro» → una sola `POST
      …/forward` con `toFamilyId` = FN; messaggio «Inoltrato in Famiglia Verifica 017 NY»; il task
      non è più in «Task della famiglia»; il `GET` dell'API lo mostra in FN con
      `assigneePersonId:null`.
      Se il browser non si scarica (proxy, decisione 53), valgono T7.1 (job `app`, F1–F7) e le prove
      P, R, V, I, e lo si dichiara.

### Esito
T7 è `passato` se sono verdi T7.1–T7.4 (T7.3 o il suo ripiego dichiarato), S1–S2, P1–P6, R1–R2,
V1–V3, I1–I2 e W1–W4 (o il loro ripiego). Un controllo rosso è un difetto `017:<gravità>` con
`difetto_di: 016`, e T7 resta `in-corso`. Sono `bloccante`: un 200 in P2, P5, P6 o I1–I2; un
assegnatario tenuto in P1 o perso in P3, P4, R1; una ricorrenza persa o una successiva nella
famiglia di partenza in R1; due task o due versioni per un replay in V3.

### Osservazione (non entra nel verdetto)
- [ ] O1 Dubbio 1 del revisore 016: A crea `T("Aprire le finestre")` in F, DATETIME
      `2026-11-09T07:00:00Z` (08:00 a Roma), `{type:"DAILY"}`; `fw(A, F, finestre, FN)`; A lo segna
      fatto in FN. Si annotano `due` e `recurrence.time` della successiva (con la regola letta nel
      fuso di arrivo ci si aspetta `2026-11-10T13:00:00Z`, 08:00 a New York). Serve a decidere il
      giro di costruzione dei dubbi; il «Fatto quando» chiede solo che la ricorrenza resti, e R1 lo
      prova.

## Per l'umano (non entra nel verdetto)
- APK di `bd1b337`: al momento del piano il job `apk` di `$RUN_CONSEGNA` è in corso; il rapporto ne
  annota l'esito e il nome. L'avviso `role="alert"` su TalkBack resta da provare su un telefono.
- Conferma facoltativa con i dati demo: Giulia inoltra un task da Famiglia Principale a Famiglia
  Mamma e vede l'avviso se l'assegnatario è Marco.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository. Lo script
  Playwright vive in `/tmp/giro-017/` e viene cancellato.
- Correggere i dubbi 1–4 del revisore 016 (ora delle serie DATETIME tra fusi, avviso se `members`
  fallisce, test della serie spezzata, replay di take/done dopo un inoltro): vanno in un giro di
  costruzione. Qui solo l'osservazione O1.
- Storia degli eventi nell'app e `GET …/events`; inoltro di una serie intera.
- Login su Android, APK su telefono fisico. Login con gli account demo. Pulizia degli account di
  prova (005, 009, 012, 015, 017). PR Dependabot #2 e #3.
- T1–T6, già `passato`. T8 e oltre: lista della spesa, sync e offline, promemoria.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica dell'email e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna. Le scritture di prova in produzione (3 account, 3 famiglie, 1 risorsa,
  circa 15 task inventati, che restano lì) sono coperte dalla decisione 42.

## Rischi di concorrenza
- Nessuna sonda parallela voluta: inoltri incrociati e inoltro contro «Prendo io» sono provati in CI
  (`twoCrossedForwardsAtTheSameTimeBothSucceed`,
  `aForwardAndATakeAtTheSameTimeLeaveNoWriteInTheDepartureAfterTheDelete`). Qui le scritture sono
  sequenziali; ogni `GET` di controllo segue la risposta della scrittura.
- Il replay di V3 va eseguito dopo P3 e prima di altre scritture su quel task.
- In W4 un doppio click non è voluto: si conta che parta una sola `POST`.
- Un merge su `main` durante il giro cambia la versione in produzione; S1, ripetuto alla fine, lo
  mostra. In quel caso si rifà la verifica sul nuovo SHA.
- Limiti per IP condivisi con altre sessioni: un 429 inatteso si annota e non è un difetto.

## Budget
0 righe di codice. File scritti: `017-piano.md`, `017-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr` e `passato_il` di T7 in `traguardi.json`. File temporanei solo in
`/tmp/giro-017/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Piccolo giro di costruzione sui dubbi 1–3 del revisore 016, guidato dall'esito di O1.
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`), con le date calcolate
  dall'ora corrente.
- Un reset del demo che cancelli gli account `verificaNNN.*`.
