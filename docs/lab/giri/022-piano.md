---
giro: 022
traguardo: T8
traguardi_extra: []
tipo: verifica-produzione
fase: revisione
inizio: 2026-10-21T16:04:01Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 022 — verifica in produzione di T8 (lista della spesa)

## Fetta e traguardo
Verifica di T8. T8 è stato costruito nei giri 018–021 (PR #25, #27, #29, #31). Il rapporto 021 dice
«Fatto quando verde, da verificare in produzione». La PR #31 è mergiata (`24e9f1d`, 2026-10-21
15:58Z) e il deploy è verde. Questo giro ripete i controlli del «Fatto quando» di T8 contro
`https://app.planforhome.com`, contro le run della CI e sull'ultimo APK. Nessun codice.
Fonti: SPEC §2.2.7, §5 (P16–P18), §6 (`shopping_item`); `traguardi.json` → T8; API in
`server/src/main/java/com/planforhome/shopping/ShoppingController.java`; testi dell'app in
`app/src/i18n/it.json` → `list.*` e `task.shoppingSwitch`.

Riferimenti fissati al momento del piano (2026-10-21, circa 16:10Z):
- `$SHA` = `24e9f1d2cbf5c0b39600da1917e53c316c1b55ee` (merge della PR #31; testa della PR `31fae01`).
- `$RUN_CONSEGNA` = 39630444812: job `decidi`, `immagine`, `deploy`, `avanti` in `success`,
  `controllo` `skipped`; **`apk` e `pubblica` ancora in corso**. L'API mostra `head_sha` `2abd912`, ma
  `/api/health` riporta `24e9f1d`: conta quest'ultimo (stesso caso dei giri 012, 015, 017). La run
  39631425599 (`head_sha` `24e9f1d`) è `skipped`. Il verificatore conferma all'inizio quale run ha
  prodotto il deploy e l'APK di `$SHA` e lo annota.
- `$RUN_CI_PR` = 39628243749 (`ci` sulla PR #31, `31fae01`): `success`.
- `GET /api/health` → `{"status":"UP","sha":"24e9f1d2cbf5c0b39600da1917e53c316c1b55ee"}`.
- Scritture di prova in produzione: autorizzate dalla **decisione 42** (A+). Non serve una domanda.

## Fatto quando — controlli eseguibili

### Regole per le prove in produzione (come nei giri 009, 012, 015, 017)
- Tutto da fuori: `curl` e `jq` verso `https://app.planforhome.com` (token Bearer dal login con
  `client` mobile), Playwright per il web. Nessun comando sui server (regola 7). **Gli account demo
  non si usano.**
- Account inventati `verifica022.<epoch>.<x>@example.com`, `<x>` = `a`, `b`, `c`; `<epoch>` =
  `date -u +%s` all'inizio, annotato nel rapporto. Locale `it`.
- Password generate al momento in `/tmp/giro-022/` (`openssl rand -base64 18`), mai stampate né
  committate, passate con `jq -n --rawfile`. A fine giro si cancella `/tmp/giro-022/`.
- Limiti: 3 registrazioni, 1 codice d'invito usato, nessun login sbagliato. Sequenza eseguita **una
  volta sola, nell'ordine**. Un errore esterno (rete, proxy, 429) si dichiara e non è un difetto.
- Ogni `id` e `mutationId` è un UUIDv7 generato al momento; tutti annotati nel rapporto.
- Notazione: `L(x)` è la lista (task con `template:"SHOPPING_LIST"`) con titolo `x`; `V(x)` la voce
  con testo `x`; `I = /api/families/{F}/tasks/{lista}/items`. Ogni `GET I` di controllo segue la
  risposta della scrittura.
- Tutte le scadenze sono future (novembre 2026).

### Persone e famiglie di prova (inventate)
| Chi | Come nasce | Ruolo |
|---|---|---|
| A, «Verifica A» | registrazione con `familyName: "Famiglia Verifica 022"` (F) | gestore di F, crea le liste |
| B, «Verifica B» | registrazione con un codice d'invito di F | membro di F |
| C, «Verifica C» | registrazione con `familyName: "Famiglia Verifica 022 Altra"` (FX) | **non in F** |

### A. Prove nella CI e in locale
- [ ] T8.1 `gh api repos/samueleniccolai-dev/planforhome/actions/runs/39628243749/jobs` → job
      `server` e `app` in `success`. `git ls-tree -r 24e9f1d` contiene i test di accettazione
      `Giro018Shopping*`, `Giro019*` (ClearChecked, ShoppingRemoval, ShoppingConcurrency,
      ShoppingSeries, ShoppingIsolation, ForwardedList), `Giro020ShoppingSeriesAcceptanceTest`,
      `app/e2e/acceptance/giro-019-shopping.spec.ts`, `giro-020-reorder.spec.ts`,
      `giro-021-focus.spec.ts`.
- [ ] T8.2 In locale su `24e9f1d`: `cd server && ./mvnw -q -Dtest='Giro018*AcceptanceTest,Giro019*AcceptanceTest,Giro020*AcceptanceTest' test`
      → verde. Il rapporto cita, per ogni pezzo del «Fatto quando», il metodo che lo copre: aggiunta,
      spunta, riordino, «togli le spuntate» (API); **fusione di due modifiche concorrenti su voci
      diverse** (`lucaAndDavideCheckDifferentItemsTogetherAndBothChecksStay`); **riordino concorrente,
      vince l'ultimo** (`twoOrdersFromTheSameReadTheLastOneWins`); **lista ciclica**
      (`doneCarriesTheUncheckedItemsToTheNextSaturday`,
      `aStruckUncheckedItemPassesAsANormalOneAndACheckedOneStaysBehind`). Un pezzo senza metodo è un
      difetto `022:maggiore` con `difetto_di` il giro che l'ha costruito.
- [ ] T8.3 In locale: `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-019-* e2e/acceptance/giro-020-* e2e/acceptance/giro-021-*`
      → verde (17 + 10 + 8). Il rapporto cita il test Playwright per ciascuna azione: aggiungere con
      una riga e invio, spuntare, riordinare, togliere le spuntate. Se mancano Docker o il browser,
      vale T8.1 e lo si dichiara.
- [ ] T8.4 Run di consegna di `$SHA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] T8.5 **Ultimo APK**: nella stessa run, job `apk` in `success` e un artefatto APK elencato da
      `gh api repos/samueleniccolai-dev/planforhome/actions/runs/<run>/artifacts` (nome, dimensione
      > 0, non scaduto). Se il job è ancora in corso si attende la sua fine con un controllo a
      intervalli; se fallisce è un difetto `022:maggiore`. L'installazione sul telefono resta
      all'umano (vedi «Per l'umano»).

### S. Smoke da fuori
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con `"sha":"24e9f1d2cbf5c0b39600da1917e53c316c1b55ee"`.
      Si ripete alla fine.
- [ ] S2 Senza login: `GET /api/families/{UUIDv7 inventato}/tasks/{UUIDv7 inventato}/items` → 401.

### P0. Preparazione (se un passo fallisce la sequenza si ferma)
Registrazione e login di A, codice d'invito di F, registrazione e login di B, registrazione e login
di C. Controllo: `GET /api/families/{F}/members` di A elenca A e B, non C.

### L. Le azioni della lista (API)
- [ ] L1 **Crea.** A crea `L("Spesa del sabato")` in F, in coda, `template:"SHOPPING_LIST"` → 201;
      `GET I` → `[]`.
- [ ] L2 **Aggiunge.** A `POST I` `{mutationId, id, text:"Latte"}` → 201, `checked:false`,
      `position:0`, `createdBy` = A. Poi `"Pane"`, `"Mele"` (A) e `"Caffè"` (B) → 201, posizioni 1, 2, 3;
      `Caffè` ha `createdBy` = B. `text:"   "` → 400 `text_invalid`. Replay dello stesso corpo di
      `Latte` → 200, stesso `id` e `version`, `GET I` ha 4 voci.
- [ ] L3 **Spunta.** B `PUT I/{Pane}/checked` `{mutationId, checked:true}` → 200 `checked:true`,
      `version` + 1. Poi `{checked:false}` → `checked:false`; di nuovo `true`.
- [ ] L4 **Riordina.** A `PUT I/order` con `[Mele, Latte, Caffè, Pane]` → 200, posizioni 0–3 in
      quell'ordine; `GET I` uguale. Un `id` doppio → 400 `invalid_request`, ordine invariato.
- [ ] L5 **Togli le spuntate (P18).** B (membro, non creatore, non assegnatario)
      `POST I/clear-checked` → 403 `{"error":"forbidden"}`, `Pane` ancora lì. A → 200: `Pane` non c'è
      più, le altre 3 restano con i loro `checked:false`.

### R. Togliere una voce (P17) e rigate (§2.2.7)
- [ ] R1 B `POST I/{Caffè}/remove` → 200, `removedBy` = B, `deletedAt:null` (rigata). B
      `PUT I/{Caffè}/checked` `{checked:true}` → 409 `item_removed`.
- [ ] R2 A spunta `Mele`; A `POST I/clear-checked` → 200: `Mele` tolta, `Caffè` (rigata) resta.
- [ ] R3 B `POST I/{Caffè}/restore` → 200, `removedBy:null`. A `POST I/{Caffè}/remove` → 200 e
      `Caffè` non è più in `GET I` (cancellata dal creatore).

### C. Concorrenza (sonde da fuori, oltre alla CI)
- [ ] C1 **Voci diverse si fondono.** A aggiunge `"Uova"` e `"Burro"`. Dallo stesso `GET I`, A spunta
      `Uova` e B spunta `Burro` **in parallelo** (due `curl` lanciati con `&` e `wait`) → entrambi
      200; `GET I` mostra `Uova` e `Burro` entrambi `checked:true`, nessuna voce persa.
- [ ] C2 **Riordino: vince l'ultimo.** Dallo stesso `GET I`, A manda l'ordine `X` e, dopo la sua
      risposta, B manda l'ordine `Y` (diverso, stesse voci) → entrambi 200; `GET I` è nell'ordine `Y`.
- [ ] C3 Due `POST I` in parallelo (A `"Sale"`, B `"Zucchero"`) → entrambi 201, posizioni distinte.

### Y. Lista ciclica
- [ ] Y1 A crea `L("Spesa ciclica")` in F, DATE `2026-11-07` (sabato),
      `recurrence:{type:"WEEKLY", days:["SATURDAY"]}`, assegnata a B. Voci `"Riso"`, `"Olio"`,
      `"Farina"`, `"Limoni"`. B spunta `Olio`; B riga `Farina` (remove da membro); B spunta `Limoni`
      e poi lo riga.
- [ ] Y2 B `POST /api/families/{F}/tasks/{ciclica}/done` → 200 `DONE`. La successiva (stesso
      `seriesId`, `OPEN`, `due:"2026-11-14"`): `GET` delle sue voci → esattamente `Riso` e `Farina`,
      entrambe `checked:false`, `removedBy:null` (la rigata torna normale); **non** `Olio` né
      `Limoni` (spuntata e rigata). Le voci nuove hanno `id` diversi dalla lista chiusa.
- [ ] Y3 La lista chiusa rifiuta scritture: `POST` di una voce sulla lista `DONE` → 409 `not_open`.

### I. Isolamento
- [ ] I1 C `GET /api/families/{F}/tasks/{Spesa del sabato}/items` → 404; C `POST` di una voce, C
      `PUT …/order`, C `POST …/clear-checked` sulla stessa lista → 404; `GET I` di A invariato.
- [ ] I2 C crea `L("Spesa altrui")` in FX; C usa l'`id` della lista di F con la sua famiglia
      nell'URL (`/api/families/{FX}/tasks/{Spesa del sabato}/items`) → 404, corpo identico (`cmp`) a
      quello di una lista inesistente. Un `itemId` di F dentro la lista di FX
      (`PUT /api/families/{FX}/tasks/{altrui}/items/{Uova}/checked`) → 404; `Uova` invariata.
- [ ] I3 Un task normale (senza template) di F: `POST` di una voce → 409 `not_shopping_list`.

### W. Web (Playwright su produzione, `it-IT`, come A)
Script temporaneo fuori dal repo (`/tmp/giro-022/web/web.spec.ts`, config con `baseURL:
https://app.planforhome.com`, niente `webServer`), lanciato con
`cd app && npx playwright test --config /tmp/giro-022/web/playwright.config.ts`. Elementi per ruolo
ed etichetta, testi di `list.*`. Prima, con l'API, A crea in F `L("Spesa dal web")` vuota.
- [ ] W1 A entra in «Famiglia Verifica 022», pulsante «Apri la lista «Spesa dal web»» → titolo
      (heading livello 1) «Spesa dal web», «Nessuna voce.».
- [ ] W2 Campo «Nuova voce»: «Pasta» + Invio, «Pomodori» + Invio, «Basilico» + Invio → tre voci
      nella lista «Da prendere», in quest'ordine; il campo resta con il fuoco ed è vuoto. Il `GET I`
      dell'API mostra le tre voci.
- [ ] W3 Casella (ruolo `checkbox`) «Pomodori» → la voce passa nella lista «Spuntate»; l'API la
      mostra `checked:true`.
- [ ] W4 «Sposta giù «Pasta»» → in «Da prendere» l'ordine è Basilico, Pasta; l'API ha lo stesso
      ordine dopo la risposta.
- [ ] W5 «Togli le spuntate» → la lista «Spuntate» è vuota; l'API non ha più `Pomodori`.
      Se il browser non si scarica (proxy, decisione 53), valgono T8.1 e T8.3 (ripiego) e le prove
      L, R, C, Y, I, e lo si dichiara.

### Esito
T8 è `passato` se sono verdi T8.1–T8.5 (T8.3 o il suo ripiego dichiarato), S1–S2, L1–L5, R1–R3,
C1–C3, Y1–Y3, I1–I3 e W1–W5 (o il loro ripiego). Un controllo rosso è un difetto `022:<gravità>` con
`difetto_di` il giro che l'ha costruito (018–021), e T8 resta `in-corso`. Sono `bloccante`: un 200
in L5 per B o in I1–I3; una voce persa in C1 o C3; un ordine diverso da `Y` in C2; in Y2 una voce
spuntata passata o una non spuntata persa.

## Per l'umano (non entra nel verdetto)
- APK di `24e9f1d`: installarlo su un telefono fisico e provare la lista (fuoco dopo «Sposta»,
  TalkBack, `Intl` su Hermes), come chiesto nel rapporto 021.
- Conferma facoltativa con i dati demo: la «Lista della spesa» di Famiglia Principale.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository. Lo script
  Playwright vive in `/tmp/giro-022/` e viene cancellato.
- Uso offline della lista (traguardo dell'offline, T9). Annuncio `aria-live` della nuova posizione.
  StrictMode in sviluppo. Inoltro di una lista (provato in CI, `Giro019ForwardedList…`).
- Login su Android e prova dell'APK su telefono fisico (all'umano). Login con gli account demo.
  Pulizia degli account di prova (005, 009, 012, 015, 017, 022). PR Dependabot #2 e #3.
- T1–T7, già `passato`. T9 e T10.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica dell'email e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna. Le scritture di prova in produzione (3 account, 2 famiglie, 5 liste o task
  e circa 20 voci inventate, che restano lì) sono coperte dalla decisione 42.

## Rischi di concorrenza
- C1 e C3 sono sonde parallele volute ma piccole (2 richieste): se una torna 409 `mutation_conflict`
  o 5xx, si annota con il corpo; un 429 non è un difetto.
- C2 è sequenziale per costruzione: «l'ultimo arrivato» si decide dall'ordine delle risposte.
- I replay (L2) si fanno subito dopo la prima scrittura, prima di altre su quella voce.
- In W2 si conta che ogni Invio faccia partire una sola `POST` (`page.on('request')`).
- Un merge su `main` durante il giro cambia la versione in produzione; S1 ripetuto alla fine lo
  mostra, e in quel caso si rifà la verifica sul nuovo SHA.

## Budget
0 righe di codice. File scritti: `022-piano.md`, `022-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr` e `passato_il` di T8 in `traguardi.json`. File temporanei solo in
`/tmp/giro-022/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`).
- Un reset del demo che cancelli gli account `verificaNNN.*`.
