---
giro: 028
traguardo: T9
traguardi_extra: []
tipo: verifica-produzione
fase: revisione
inizio: 2026-10-22T07:21:27Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 028 — verifica in produzione di T9 (offline e sincronizzazione)

## Fetta e traguardo
Verifica di T9. T9 è stato costruito nei giri 023–027 (PR #33, #34, #35, #36, #37). Il rapporto 027
dice «Fatto quando verde, da verificare in produzione». La PR #37 è mergiata (`32a0e1b`) e il
deploy è verde. Questo giro ripete i controlli del «Fatto quando» di T9 contro
`https://app.planforhome.com`, contro le run della CI e sull'ultimo APK. Nessun codice.
Fonti: SPEC §4, §7; `traguardi.json` → T9; API in
`server/src/main/java/com/planforhome/sync/SyncController.java` (`GET /api/sync/families/{F}/snapshot`,
`GET /api/sync/families/{F}/changes?after=&limit=`) e
`server/src/main/java/com/planforhome/task/TaskController.java`.

Riferimenti fissati al momento del piano (2026-10-22, circa 07:30Z):
- `$SHA` = `32a0e1b3ecee1640693e78285ee21f1adf0700eb` (merge della PR #37; testa della PR `9e18400`).
- `GET /api/health` → `{"status":"UP","sha":"32a0e1b3ecee1640693e78285ee21f1adf0700eb"}`.
- `$RUN_CONSEGNA` = 39739356851: `decidi`, `immagine`, `pubblica`, `deploy`, `avanti` in `success`,
  `controllo` `skipped`; **`apk` ancora in corso**. L'API mostra `head_sha` `867d2cd`, ma
  `/api/health` riporta `32a0e1b`: conta quest'ultimo (stesso caso dei giri 012, 015, 017, 022). La
  run 39739988628 (`head_sha` `32a0e1b`) è `skipped`. Il verificatore conferma all'inizio quale run
  ha prodotto il deploy e l'APK di `$SHA` e lo annota.
- `$RUN_CI_PR` = 39737327267 (`ci` sulla PR #37, `9e18400`): `lab`, `apk`, `app`, `server`, `build`
  in `success`.
- Scritture di prova in produzione: autorizzate dalla **decisione 42** (A+). Non serve una domanda.

## Fatto quando — controlli eseguibili

### Regole per le prove in produzione (come nei giri 009, 012, 015, 017, 022)
- Tutto da fuori: `curl` e `jq` verso `https://app.planforhome.com`, login con
  `client:"android"` (token Bearer, come l'APK). Nessun comando sui server (regola 7). **Gli account
  demo non si usano.**
- Account inventati `verifica028.<epoch>.<x>@example.com`, `<x>` = `a`, `b`, `c`; `<epoch>` =
  `date -u +%s` all'inizio, annotato nel rapporto. Locale `it`.
- Password generate al momento in `/tmp/giro-028/` (`openssl rand -base64 18`), mai stampate né
  committate, passate con `jq -n --rawfile`. A fine giro si cancella `/tmp/giro-028/`.
- Limiti: 3 registrazioni, 1 codice d'invito usato, nessun login sbagliato. Sequenza eseguita **una
  volta sola, nell'ordine**. Un errore esterno (rete, proxy, 429) si dichiara e non è un difetto.
- Ogni `id` e `mutationId` è un UUIDv7 generato al momento; tutti annotati nel rapporto.
- Notazione: `T(x)` è il task con titolo `x`; `CH(F, n)` =
  `GET /api/sync/families/{F}/changes?after=n`; `SN(F)` = `GET /api/sync/families/{F}/snapshot`.
- Tutte le scadenze sono future (novembre 2026).

### Persone e famiglie di prova (inventate)
| Chi | Come nasce | Ruolo |
|---|---|---|
| A, «Verifica A» | registrazione con `familyName: "Famiglia Verifica 028"` (F); poi crea `"Famiglia Verifica 028 Due"` (F2) | gestore di F e di F2 |
| B, «Verifica B» | registrazione con un codice d'invito di F, **dopo** le prove Q e K | membro di F |
| C, «Verifica C» | registrazione con `familyName: "Famiglia Verifica 028 Altra"` (FX) | **non in F né in F2** |

### A. Prove nella CI e in locale
- [ ] T9.1 `gh api repos/samueleniccolai-dev/planforhome/actions/runs/39737327267/jobs` → `server`,
      `app`, `apk` in `success`. `git ls-tree -r 32a0e1b` contiene
      `Giro023Sync{Changes,Conflict,Isolation,Queue,Snapshot}AcceptanceTest.java` e
      `app/e2e/acceptance/giro-02{4,5,6,7}-*.spec.ts`.
- [ ] T9.2 In locale su `32a0e1b`: `cd server && ./mvnw -q -Dtest='Giro023*AcceptanceTest' test` →
      verde. Il rapporto cita il metodo per ogni pezzo lato server del «Fatto quando»: coda in ordine
      e ripetuta una volta sola (`aQueueSentTwiceTakesEffectOnceAndInOrder`); lettura per seq con
      creazioni, modifiche e cancellazioni (`changesCarryTheCurrentStateAndTheDeletions`); fotografia
      a chi entra (`whoJoinsGetsTheWholeFamilyThenOnlyTheChangesAfterIt`); vince la prima e l'altro
      riceve l'esito (`theFirstWriteWinsAndTheSecondGetsTheCurrentTask`,
      `takingAtOnceGivesAlreadyTakenWithTheNameOfTheWinner`); modifica non più permessa rifiutata
      (`aQueuedWriteThatIsNoLongerAllowedIsRefusedWhateverItsVersion`) e successive sullo stato vero
      (`theNextQueuedWriteIsJudgedOnTheTrueState`). Un pezzo senza metodo è un difetto
      `028:maggiore` con `difetto_di` il giro che l'ha costruito.
- [ ] T9.3 In locale: `cd app && npm test && npx playwright test e2e/acceptance/giro-024-* e2e/acceptance/giro-025-* e2e/acceptance/giro-026-* e2e/acceptance/giro-027-*`
      → verde. Il rapporto cita il test del motore per ciascun pezzo lato client: rete che cade a
      metà, niente perso né duplicato (giro 024, «network drops mid-send …»); spunte della lista
      offline arrivate dopo la riconnessione (giro 024, «offline checks of latte, pane, uova …»;
      giro 026, S3); inoltro fuori dalle famiglie dell'utente → nessuna riga locale (giro 024, «a
      task forwarded out of the user families …»; giro 025, C1–C4); perdita di un'appartenenza →
      famiglia cancellata in locale (giro 024, «a lost family …»; giro 025, C10; giro 027, R1c).
      **Nota di forma:** il «Fatto quando» dice «Test Jest»; questi test del motore girano in Node
      sotto Playwright (senza pagina), con Jest per il resto di `app/src/sync`. Il verificatore lo
      annota come scostamento di forma, non come difetto, e lo porta in «Per l'umano». Se mancano
      Docker o il browser, valgono T9.1 e la run CI della PR, e lo si dichiara.
- [ ] T9.4 Run di consegna di `$SHA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] T9.5 **Ultimo APK**: nella stessa run, job `apk` in `success` e un artefatto APK elencato da
      `gh api repos/samueleniccolai-dev/planforhome/actions/runs/<run>/artifacts` (nome con versione
      e `32a0e1b`, dimensione > 0, non scaduto). Se il job è ancora in corso si attende la fine con un
      controllo a intervalli; se fallisce è un difetto `028:maggiore`. L'installazione sul telefono
      resta all'umano (vedi «Per l'umano»).

### S. Smoke da fuori
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con `"sha":"32a0e1b3ecee1640693e78285ee21f1adf0700eb"`.
      Si ripete alla fine.
- [ ] S2 Senza login: `SN({UUIDv7 inventato})` e `CH({UUIDv7 inventato}, 0)` → 401.

### P0. Preparazione (se un passo fallisce la sequenza si ferma)
Registrazione e login di A (`client:"android"`), creazione di F2 da parte di A, registrazione e login
di C. B nasce in J1 (sotto). Controllo: `GET /api/families` di A elenca F e F2.

### Q. Coda offline: in ordine, ripetuta ha effetto una volta
- [ ] Q1 `n0` = `SN(F).seq`. A prepara **senza inviarle** quattro scritture con `mutationId` m1–m4:
      m1 crea `T("Annaffiare le piante")` in F (DATE `2026-11-10`, in coda); m2 `PUT` titolo
      «Annaffiare le piante del balcone» (version 1); m3 `take`; m4 `done`. Le invia in quest'ordine,
      una dopo la risposta dell'altra → 201, 200, 200, 200.
- [ ] Q2 Rimanda le stesse quattro, identiche, nello stesso ordine → ognuna 2xx con lo stesso `id` e
      la stessa `version` della prima risposta (la `done` risponde lo stato corrente); `GET` del task
      → titolo del balcone, `DONE`, assegnato ad A, `version` invariata rispetto a Q1.
- [ ] Q3 `CH(F, n0)` → il task compare **una volta**, `op:"UPSERT"`, `data.status:"DONE"`; nessuna
      riga in più dopo Q2 (`lastSeq` uguale a quello letto subito dopo Q1).
- [ ] Q4 Stesso `mutationId` di m2 con un corpo diverso (titolo «Altro») → 409 `mutation_conflict`;
      titolo invariato.

### K. Lettura per seq: creazioni, modifiche e cancellazioni
- [ ] K1 `k0` = `SN(F).seq`. A crea `T("Spesa per la cena")` con `template:"SHOPPING_LIST"` e le voci
      «Pane», «Olive»; A spunta «Pane» (`PUT …/checked` `{checked:true}`, la modifica); A toglie
      «Olive» (`POST …/remove` dal creatore, la voce è cancellata).
- [ ] K2 `CH(F, k0)` → la lista `UPSERT`, «Pane» `UPSERT` con `checked:true`, «Olive» `DELETE` con
      `data:null` e `deletedAt` valorizzato; ordine per `seq` crescente; `hasMore:false`.
- [ ] K3 `CH(F, k0)` con `limit=1` → una sola modifica, `hasMore:true`; si prosegue da `lastSeq`
      finché `hasMore:false`: l'unione delle pagine è uguale a K2. `after=-1` e `limit=0` → 400
      `invalid_request`.

### J. Chi entra riceve prima la fotografia
- [ ] J1 A genera un codice d'invito di F; B si registra con il codice e fa login (`client:"android"`).
- [ ] J2 B `SN(F)` → `seq` ≥ ultimo `lastSeq` di K; `tasks` contiene «Annaffiare le piante del
      balcone» e «Spesa per la cena»; `shoppingItems` contiene «Pane» e non «Olive»; `members` A
      (MANAGER) e B (MEMBER), non C.
- [ ] J3 B `CH(F, SN.seq)` → `changes:[]`. A crea `T("Portare fuori il vetro")`; B `CH(F, SN.seq)` →
      solo quel task.

### C. Conflitti: vince la prima, l'altro riceve l'esito
- [ ] C1 A crea `T("Pagare il condominio")` in F, in coda, DATE `2026-11-15`. A e B mandano **in
      parallelo** (`&` e `wait`) un `PUT` di titolo diverso con la stessa `version` → uno 200, l'altro
      409 `version_conflict` con il task corrente nel corpo (titolo del vincitore, `version` + 1).
- [ ] C2 A crea `T("Ritirare il pacco")` in coda. A e B mandano **in parallelo** `take` → uno 200,
      l'altro 409 `already_taken` con il nome del vincitore. Il `GET` mostra un solo assegnatario.

### N. Modifica non più permessa, poi stato vero
- [ ] N1 A promuove B a MANAGER di F. A crea `T("Pulire il garage")` in coda. B prepara offline
      (non inviata) un'assegnazione di «Pulire il garage» ad A con la `version` letta ora.
- [ ] N2 A riporta B a MEMBER. B invia l'assegnazione preparata → 403 `forbidden` (non 409); il task
      resta in coda.
- [ ] N3 B invia subito dopo `take` di «Pulire il garage» → 200 (valutato sullo stato vero: in
      coda, B membro); il `GET` mostra B assegnatario.

### I. Isolamento e inoltro
- [ ] I1 C `SN(F)`, `CH(F, 0)` → 404, corpo identico (`cmp`) a quello di una famiglia inesistente;
      C `CH(FX, 0)` non contiene nessun `entityId` di F.
- [ ] I2 A inoltra «Spesa per la cena» da F a F2 (B non è in F2). B `CH(F, <seq prima dell'inoltro>)`
      → il task è `DELETE` (`data:null`), «Pane» `DELETE`; in nessuna risposta a B compaiono titolo
      o testo delle voci. B `SN(F)` non contiene né il task né «Pane». A `SN(F2)` li contiene.
- [ ] I3 A toglie B da F. B `SN(F)` e `CH(F, 0)` → 404 (il segnale che sul telefono cancella la
      famiglia, provato in T9.3). Fine del ciclo di B.

### Esito
T9 è `passato` se sono verdi T9.1–T9.5 (T9.3 o il suo ripiego dichiarato), S1–S2, Q1–Q4, K1–K3,
J1–J3, C1–C2, N1–N3, I1–I3. Un controllo rosso è un difetto `028:<gravità>` con `difetto_di` il giro
che l'ha costruito (023–027), e T9 resta `in-corso`. Sono `bloccante`: un effetto doppio in Q2–Q3;
due 200 in C1 o C2; un 2xx in N2; un 200 o un dato di F in I1; titolo o voci visibili a B in I2;
un 200 in I3. La prova sul telefono (sotto) non entra nel verdetto: se l'umano la riporta rossa
prima della chiusura, T9 resta `in-corso`.

## Per l'umano (non entra nel verdetto, ma lo può fermare)
- APK di `32a0e1b` (artefatto di T9.5) su un telefono fisico, account demo Anna: login; modalità
  aereo; spuntare voci della lista, «prendi», «fatto» e «inoltra» su task in coda; rete su → entro
  60 s il server ha le modifiche una volta sola. Conflitto: Anna offline prende la bolletta, Luca
  dal web la prende → entro 60 s Anna vede «Già preso da Luca Rossi». Avviso letto da TalkBack.
  Riaprire l'app in aereo: la famiglia c'è ancora (SQLite).
- Ratificare o no lo scostamento di forma di T9.3 (test del motore in Node sotto Playwright, non
  Jest).
- PR Dependabot #2 e #3, già segnalate.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository. Gli script di
  prova vivono in `/tmp/giro-028/` e vengono cancellati.
- Prova dell'APK su telefono fisico (all'umano). Login con gli account demo da parte della catena.
  Pulizia degli account di prova (005–022, 028). Prove di carico.
- Limiti noti del rapporto 027: persone non aggiornate dopo lo snapshot, `/tasks` online su Android,
  esiti persi lasciando la schermata, mutazione `title: null`.
- T1–T8, già `passato`. T10 (promemoria).
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica dell'email e recupero della
  password; **sincronizzazione in tempo reale e offline sul web**; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna. Le scritture di prova in produzione (3 account, 3 famiglie, circa 8 task e
  2 voci inventati, che restano lì) sono coperte dalla decisione 42.

## Rischi di concorrenza
- C1 e C2 sono sonde parallele volute (2 richieste): se nessuna delle due vince o tornano 5xx, si
  annota con il corpo; un 429 non è un difetto. Se l'ordine d'arrivo fa vincere sempre lo stesso,
  non importa: conta che il vincitore sia uno solo e l'altro abbia l'esito.
- Q2 e Q4 si fanno subito dopo Q1, prima di altre scritture sullo stesso task.
- K3 e J3 leggono mentre nessun'altra scrittura di prova è in corso (sequenza seriale).
- Un merge su `main` durante il giro cambia la versione in produzione; S1 ripetuto alla fine lo
  mostra, e in quel caso si rifà la verifica sul nuovo SHA.

## Budget
0 righe di codice. File scritti: `028-piano.md`, `028-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr` e `passato_il` di T9 in `traguardi.json`. File temporanei solo in
`/tmp/giro-028/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`), con le sonde di sync.
- Un reset del demo che cancelli gli account `verificaNNN.*`.
