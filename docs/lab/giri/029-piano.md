---
giro: 029
traguardo: T9
traguardi_extra: []
tipo: verifica-produzione
fase: chiusura
inizio: 2026-10-22T09:35:43Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 029 — seconda verifica in produzione di T9 (offline e sincronizzazione)

## Fetta e traguardo
Riverifica di T9 con gli attesi corretti. Il giro 028 (PR #38, mergiata in `1e813c4`) non ha
passato T9: 5 controlli rossi su 25, tutti per **attesi sbagliati del piano**, nessun difetto del
server (decisione 97). L'umano ha accettato lo scostamento di forma «test Jest» → test del motore in
Node sotto Playwright. Questo giro ripete i controlli del 028 contro `https://app.planforhome.com`,
contro le run della CI e sull'ultimo APK, con gli attesi di Q2, Q4, K3, C1, I2, I3 corretti secondo
il comportamento già documentato. Nessun codice.
Fonti: SPEC §4, §5 (disattivazione all'ultima appartenenza), §7; `traguardi.json` → T9; rapporto
028; API in `server/src/main/java/com/planforhome/sync/SyncController.java` e
`server/src/main/java/com/planforhome/task/TaskController.java`.

Riferimenti fissati al momento del piano (2026-10-22, circa 09:40Z):
- `$SHA` = `1e813c4547f2729d880b07359d80cb3219144733` (merge della PR #38). Rispetto a `32a0e1b`
  (verificato nel 028) cambiano **solo** file in `docs/lab/` e `metrics/`: `server/` e `app/` sono
  identici (`git diff --name-only 32a0e1b 1e813c4`).
- `GET /api/health` → `{"status":"UP","sha":"1e813c4547f2729d880b07359d80cb3219144733"}`.
- `$RUN_CONSEGNA` = 39756028912 (`head_sha` `1e813c4`): `controllo`, `immagine`, `pubblica`,
  `deploy`, `avanti` in `success`, `decidi` `skipped`; **`apk` ancora in corso**. La run
  39756688454 (stesso SHA) è `skipped`.
- `$RUN_CI_PR` = 39737327267 (`ci` sulla PR #37, `9e18400`, codice di T9): `lab`, `apk`, `app`,
  `server`, `build` in `success`. La PR #38 è solo documenti.
- Scritture di prova in produzione: autorizzate dalla **decisione 42**. Non serve una domanda.

## Fatto quando — controlli eseguibili

### Regole per le prove in produzione (come nel giro 028)
- Tutto da fuori: `curl` e `jq` verso `https://app.planforhome.com`, login con
  `client:"android"` (token Bearer, come l'APK). Nessun comando sui server (regola 7). **Gli account
  demo non si usano.**
- Account inventati `verifica029.<epoch>.<x>@example.com`, `<x>` = `a`, `b`, `c`; `<epoch>` =
  `date -u +%s` all'inizio, annotato nel rapporto. Locale `it`.
- Password generate al momento in `/tmp/giro-029/` (`openssl rand -base64 18`), mai stampate né
  committate, passate con `jq -n --rawfile`. A fine giro si cancella `/tmp/giro-029/`.
- Limiti: 3 registrazioni, 1 codice d'invito usato, nessun login sbagliato. Sequenza eseguita **una
  volta sola, nell'ordine**. Un errore esterno (rete, proxy, 429) si dichiara e non è un difetto.
- Ogni `id` e `mutationId` è un UUIDv7 generato al momento; tutti annotati nel rapporto.
- Notazione: `T(x)` è il task con titolo `x`; `CH(F, n)` =
  `GET /api/sync/families/{F}/changes?after=n`; `SN(F)` = `GET /api/sync/families/{F}/snapshot`.
- Tutte le scadenze sono future (novembre 2026).
- **Attesi corretti rispetto al 028** marcati con «(corretto)»: se uno di questi torna come nel 028
  è verde; se torna diverso da entrambi, è un difetto.

### Persone e famiglie di prova (inventate)
| Chi | Come nasce | Ruolo |
|---|---|---|
| A, «Verifica A» | registrazione con `familyName: "Famiglia Verifica 029"` (F); poi crea `"Famiglia Verifica 029 Due"` (F2) | gestore di F e di F2 |
| B, «Verifica B» | registrazione con un codice d'invito di F, **dopo** le prove Q e K | membro di F (gestore da C1 a N2) |
| C, «Verifica C» | registrazione con `familyName: "Famiglia Verifica 029 Altra"` (FX) | **non in F né in F2** |

### A. Prove nella CI e in locale
- [ ] T9.1 `gh api repos/samueleniccolai-dev/planforhome/actions/runs/39737327267/jobs` → `server`,
      `app`, `apk` in `success`. `git ls-tree -r 1e813c4` contiene
      `Giro023Sync{Changes,Conflict,Isolation,Queue,Snapshot}AcceptanceTest.java` e
      `app/e2e/acceptance/giro-02{4,5,6,7}-*.spec.ts`.
- [ ] T9.2 In locale su `1e813c4`: `cd server && ./mvnw -q -Dtest='Giro023*AcceptanceTest' test` →
      verde. Il rapporto cita il metodo per ogni pezzo lato server del «Fatto quando» (stessi metodi
      del piano 028, T9.2). Un pezzo senza metodo è un difetto `029:maggiore`.
- [ ] T9.3 In locale: `cd app && npm test && npx playwright test e2e/acceptance/giro-024-* e2e/acceptance/giro-025-* e2e/acceptance/giro-026-* e2e/acceptance/giro-027-*`
      → verde. Il rapporto cita il test del motore per ciascun pezzo lato client: rete che cade a
      metà (giro 024, «network drops mid-send …»); spunte offline arrivate dopo la riconnessione
      (giro 024, «offline checks of latte, pane, uova …»; giro 026, S3); inoltro fuori dalle
      famiglie → nessuna riga locale, **voci comprese** (giro 025, C1/C2 «task and 3 items end in
      Bianchi-Verdi only», C5 `deleteRowsOfTask`); perdita di un'appartenenza → famiglia cancellata
      in locale (giro 024, «a lost family (404 …) is wiped …»; giro 025, C10; giro 027, R1c).
      **(corretto)** I test del motore in Node sotto Playwright valgono come i «test Jest» del
      «Fatto quando»: scostamento accettato dall'umano dopo il giro 028; non è né difetto né nota.
      Se mancano Docker o il browser, valgono T9.1 e la run CI della PR, e lo si dichiara.
- [ ] T9.4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] T9.5 **Ultimo APK**: in `$RUN_CONSEGNA`, job `apk` in `success` e un artefatto APK elencato da
      `gh api repos/samueleniccolai-dev/planforhome/actions/runs/39756028912/artifacts` (nome con
      versione e `1e813c4`, dimensione > 0, non scaduto). Se il job è ancora in corso si attende la
      fine con un controllo a intervalli; se fallisce è un difetto `029:maggiore`. In mancanza vale
      l'APK di `32a0e1b` (run 39745985968), stesso codice, e lo si dichiara.

### S. Smoke da fuori
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con `"sha":"1e813c4547f2729d880b07359d80cb3219144733"`.
      Si ripete alla fine.
- [ ] S2 Senza login: `SN({UUIDv7 inventato})` e `CH({UUIDv7 inventato}, 0)` → 401.

### P0. Preparazione (se un passo fallisce la sequenza si ferma)
Registrazione e login di A (`client:"android"`), creazione di F2 da parte di A, registrazione e login
di C. B nasce in J1. Controllo: `GET /api/families` di A elenca F e F2.

### Q. Coda offline: in ordine, ripetuta ha effetto una volta
- [ ] Q1 `n0` = `SN(F).seq`. A prepara **senza inviarle** quattro scritture m1–m4: m1 crea
      `T("Annaffiare le piante")` in F (DATE `2026-11-10`, in coda); m2 `PUT` titolo «Annaffiare le
      piante del balcone» (version 1); m3 `take`; m4 `done`. Le invia in ordine, una dopo la
      risposta dell'altra → 201, 200, 200, 200. Si annota la `version` finale `vQ`.
- [ ] Q2 **(corretto)** Rimanda le stesse quattro, identiche, nello stesso ordine → ognuna 2xx con
      lo stesso `id` e lo **stato corrente** del task (`DONE`, `version` = `vQ`), non lo stato della
      prima risposta. `GET` del task → titolo del balcone, `DONE`, assegnato ad A, `version` = `vQ`.
- [ ] Q3 `CH(F, n0)` → il task compare **una volta**, `op:"UPSERT"`, `data.status:"DONE"`; `lastSeq`
      uguale a quello letto subito dopo Q1.
- [ ] Q4 **(corretto)** Stesso `mutationId` di m2 con un corpo diverso (titolo «Altro») → 2xx
      (replay: il corpo non si confronta), **nessun effetto**: titolo ancora del balcone, `version`
      = `vQ`, `lastSeq` di `CH(F, n0)` invariato.

### K. Lettura per seq: creazioni, modifiche e cancellazioni
- [ ] K1 `k0` = `SN(F).seq`. A crea `T("Spesa per la cena")` con `template:"SHOPPING_LIST"` e le voci
      «Pane», «Olive»; A spunta «Pane» (`PUT …/checked` `{checked:true}`); A toglie «Olive»
      (`POST …/remove`).
- [ ] K2 `CH(F, k0)` → la lista `UPSERT`, «Pane» `UPSERT` con `checked:true`, «Olive» `DELETE` con
      `data:null` e `deletedAt` valorizzato; `seq` crescente; `hasMore:false`.
- [ ] K3 **(corretto)** `CH(F, k0)` con `limit=1`, proseguendo da `lastSeq` finché `hasMore:false`:
      ogni pagina ha al più una modifica, `seq` crescente tra le pagine, `hasMore:true` tranne
      l'ultima. Le pagine possono contenere **più righe della stessa entità** (K2 ne accorpa): conta
      che applicandole in ordine, l'ultima riga per entità, si ottenga **lo stesso stato finale di
      K2** (stesso insieme di `entityId`, stesse `op`, «Pane» `checked:true`, «Olive» `DELETE`).
      `after=-1` e `limit=0` → 400 `invalid_request`.

### J. Chi entra riceve prima la fotografia
- [ ] J1 A genera un codice d'invito di F; B si registra con il codice e fa login (`client:"android"`).
- [ ] J2 B `SN(F)` → `seq` ≥ ultimo `lastSeq` di K; `tasks` contiene «Annaffiare le piante del
      balcone» e «Spesa per la cena»; `shoppingItems` contiene «Pane» e non «Olive»; `members` A
      (MANAGER) e B (MEMBER), non C.
- [ ] J3 B `CH(F, SN.seq)` → `changes:[]`. A crea `T("Portare fuori il vetro")`; B `CH(F, SN.seq)` →
      solo quel task.

### C. Conflitti: vince la prima, l'altro riceve l'esito
- [ ] C1 **(corretto)** A promuove B a **MANAGER** di F (ora entrambi possono modificare il titolo).
      A crea `T("Pagare il condominio")` in F, in coda, DATE `2026-11-15`. A e B mandano **in
      parallelo** (`&` e `wait`) un `PUT` di titolo diverso con la stessa `version` → uno 200,
      l'altro 409 `version_conflict` con il task corrente nel corpo (titolo del vincitore, `version`
      + 1).
- [ ] C2 A crea `T("Ritirare il pacco")` in coda. A e B mandano **in parallelo** `take` → uno 200,
      l'altro 409 `already_taken` con il nome del vincitore. Il `GET` mostra un solo assegnatario.

### N. Modifica non più permessa, poi stato vero
- [ ] N1 B è MANAGER di F (da C1; `GET` dei membri lo conferma). A crea `T("Pulire il garage")` in
      coda. B prepara offline (non inviata) un'assegnazione di «Pulire il garage» ad A con la
      `version` letta ora.
- [ ] N2 A riporta B a MEMBER. B invia l'assegnazione preparata → 403 `forbidden` (non 409); il task
      resta in coda.
- [ ] N3 B invia subito dopo `take` di «Pulire il garage» → 200; il `GET` mostra B assegnatario.

### I. Isolamento e inoltro
- [ ] I1 C `SN(F)`, `CH(F, 0)` → 404, corpo identico (`cmp`) a quello di una famiglia inesistente;
      C `CH(FX, 0)` non contiene nessun `entityId` di F.
- [ ] I2 **(corretto)** `s` = `SN(F).seq` letto da B. A inoltra «Spesa per la cena» da F a F2 (B non è
      in F2). B `CH(F, s)` → il task è `DELETE` (`data:null`); **le voci non hanno righe proprie**
      (le cancella il client con il task, provato in T9.3: giro 025 C1/C2, C5); in nessuna risposta
      a B compaiono titolo o testo delle voci. B `SN(F)` non contiene né il task né «Pane». A
      `SN(F2)` li contiene.
- [ ] I3 **(corretto)** A toglie B da F, la sua ultima famiglia: l'account di B è disattivato (SPEC
      §5). B `SN(F)`, `CH(F, 0)` e `GET /api/families` con il suo token → **401**; A `SN(F).members`
      non contiene più B. Fine del ciclo di B.

### Esito
T9 è `passato` se sono verdi T9.1–T9.5 (T9.3 e T9.5 o i loro ripieghi dichiarati), S1–S2, Q1–Q4,
K1–K3, J1–J3, C1–C2, N1–N3, I1–I3. Un controllo rosso è un difetto `029:<gravità>` con `difetto_di`
il giro che l'ha costruito (023–027), e T9 resta `in-corso`. Sono `bloccante`: un effetto doppio in
Q2–Q4; due 200 in C1 o C2; un 2xx in N2; un 200 o un dato di F in I1; titolo o voci visibili a B in
I2; un 2xx in I3. Se un atteso di questo piano risulta di nuovo sbagliato (il server segue SPEC e il
piano no), il verificatore lo scrive come «atteso del piano» e non come difetto del codice. La prova
sul telefono non entra nel verdetto: se l'umano la riporta rossa prima della chiusura, T9 resta
`in-corso`.

## Per l'umano (non entra nel verdetto, ma lo può fermare)
- APK dell'artefatto di T9.5 su un telefono fisico, account demo Anna: login; modalità aereo;
  spuntare voci della lista, «prendi», «fatto» e «inoltra» su task in coda; rete su → entro 60 s il
  server ha le modifiche una volta sola. Conflitto: Anna offline prende la bolletta, Luca dal web la
  prende → entro 60 s Anna vede «Già preso da Luca Rossi», letto da TalkBack. Riaprire l'app in
  aereo: la famiglia c'è ancora.
- **Dubbio aperto dal 028, non provato qui:** alla perdita dell'**ultima** famiglia il server
  risponde 401 (account disattivato) e il motore del telefono, per scelta (giro 024, «a network
  error or 401 is not a lost family»), non cancella nulla: i dati di quella famiglia restano sul
  telefono. Il «Fatto quando» parla di «perdita di un'appartenenza» senza eccezioni. Da decidere
  dopo questo giro (PROGRESS: «Poi dubbio sul 401 all'ultima famiglia»): accettare il limite o
  aprire una costruzione.
- PR Dependabot #2 e #3, PR #34, già segnalate.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository. Gli script di
  prova vivono in `/tmp/giro-029/` e vengono cancellati.
- Il dubbio sul 401 all'ultima famiglia (sopra): il server lo fa secondo SPEC §5; il comportamento
  del telefono si decide in un giro a parte. Questo giro non lo trasforma in difetto.
- Prova dell'APK su telefono fisico (all'umano). Login con gli account demo. Pulizia degli account
  di prova (005–022, 028, 029). Prove di carico.
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
  2 voci inventati, che restano lì; un account disattivato) sono coperte dalla decisione 42.

## Rischi di concorrenza
- C1 e C2 sono sonde parallele volute: se nessuna vince o tornano 5xx, si annota con il corpo; un
  429 non è un difetto. Conta che il vincitore sia uno solo e l'altro abbia l'esito.
- C1 si fa solo dopo che la promozione di B risponde 200 (altrimenti torna il 403 del 028).
- Q2 e Q4 subito dopo Q1, prima di altre scritture sullo stesso task.
- K3 e J3 leggono mentre nessun'altra scrittura di prova è in corso (sequenza seriale).
- Un merge su `main` durante il giro cambia la versione in produzione; S1 ripetuto alla fine lo
  mostra, e in quel caso si rifà la verifica sul nuovo SHA.

## Budget
0 righe di codice. File scritti: `029-piano.md`, `029-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr` e `passato_il` di T9 in `traguardi.json`. File temporanei solo in
`/tmp/giro-029/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`), con le sonde di sync,
  così gli attesi vivono in un solo posto.
- Un reset del demo che cancelli gli account `verificaNNN.*`.
