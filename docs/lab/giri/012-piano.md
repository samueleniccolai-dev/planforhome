---
giro: 012
traguardo: T5
traguardi_extra: []
tipo: verifica-produzione
fase: domanda (da: revisione)
inizio: 2026-10-20T19:34:21Z
ricerca: no
accettazione:
ripreso: no
---
> **DOMANDA (giro 012):** per verificare T5 in produzione servono scritture di prova verso
> `app.planforhome.com`. Sono 3 account `verifica012.<epoch>.{a,b,c}@example.com`, 3 famiglie, 1
> risorsa «Leo» e circa 25 task, tutti inventati. Restano in produzione: non c'è un'API per
> cancellarli. La decisione 36 autorizzava queste scritture **solo per la verifica di T4**. Nel
> giro 009 il permesso della sessione le ha negate a metà giro.
> Opzioni:
> - **A) autorizzare le scritture di prova per questo giro** (raccomandata). Pro: T5 si verifica
>   tutto, come T4. Contro: altri dati finti in produzione.
> - **A+) come A, e in più autorizzare una volta per tutte le scritture di prova dei prossimi giri
>   `verifica-produzione`**, con gli stessi vincoli: account `verificaNNN.*@example.com`, dati
>   inventati, limiti per IP rispettati. Pro: T6–T10 non si fermano sulla stessa domanda. Contro:
>   l'umano non vede più, giro per giro, cosa si scrive.
> - **B) l'umano esegue la sequenza** delle sezioni P–W e scrive l'esito nel piano. Pro: nessuna
>   scrittura da agenti. Contro: circa 60 chiamate a mano.
> - **C) nessuna scrittura.** Valgono solo T5.1–T5.4 e S1–S2. T5 resta `in-corso`: le prove della
>   CI non bastano per `passato`.
>
> Cosa succede dopo: con A o A+ il revisore esegue il piano così com'è, e con A+ la decisione
> entra nel registro come regola permanente. Con B l'esito va nel piano e nel rapporto. Con C il
> giro si chiude senza passaggio di T5.

# Piano del giro 012 — verifica in produzione di T5 (task, coda e permessi)

## Fetta e traguardo
Verifica di T5. T5 è stato costruito nei giri 008 (API dei task e coda, PR #15), 010 (task
nell'app web, vista «tutte le mie famiglie», task demo, PR #17) e 011 (fatto, riapri, modifica,
annulla e filtri, P7–P9, PR #18). Il rapporto 011 dice «Fatto quando verde, da verificare in
produzione». La PR #18 è mergiata (`a3089bd`) e il deploy è verde. Questo giro ripete i controlli
del «Fatto quando» di T5 contro `https://app.planforhome.com` e contro le run della CI. Nessun
codice.
Fonti: SPEC §2.2.2–§2.2.4, §5 (P1–P9), §6, §7, §12; `traguardi.json` → T5; contratti dell'API in
`server/src/main/java/com/planforhome/task/TaskController.java` e `TaskService.java` (su
`a3089bd`); testi dell'app in `app/e2e/acceptance/giro-010-tasks.spec.ts` e
`giro-011-task-actions.spec.ts`.

Riferimenti fissati al momento del piano (2026-10-20, circa 19:40Z):
- `$SHA` = `a3089bd4fbcf2dbbec13ff24af689dee57a8333f` (merge della PR #18). `git diff --stat 613988a a3089bd`
  è vuoto: il merge ha lo stesso albero dell'ultimo commit della PR.
- `$RUN_CONSEGNA` = 39483821490 (`workflow_run` su `main`): job `decidi`, `immagine`, `pubblica`,
  `deploy` e `avanti` in `success`, `controllo` in `skipped`. **Il job `apk` è ancora in corso.**
  L'API mostra `head_sha` `bef8f1e`, ma `/api/health` riporta `a3089bd`: conta quest'ultimo.
- `$RUN_CI_PR` = 39481042928 (PR #18, `613988a`): `success`.
- `GET /api/health` → `{"status":"UP","sha":"a3089bd4fbcf2dbbec13ff24af689dee57a8333f"}`.

Il «Fatto quando» di T5 non nomina Android: l'APK non entra nel verdetto.

## Fatto quando — controlli eseguibili

### Regole per le prove in produzione (come nel giro 009)
- Tutto da fuori: `curl` e `jq` verso `https://app.planforhome.com` per l'API (token Bearer dal
  login con `client` mobile, come nel giro 009), Playwright per il web. Nessun comando sui server
  (regola 7). Nessuna lettura di `DEMO_PASSWORD`: **gli account demo (Giulia, Luca) non si usano
  in produzione**. Giulia e Leo del «Fatto quando» sono interpretati da A e dalla risorsa «Leo»
  di prova (sezione W).
- Account inventati: `verifica012.<epoch>.<x>@example.com`, con `<x>` uguale ad `a`, `b` o `c`.
  `<epoch>` è il valore di `date -u +%s` all'inizio, annotato nel rapporto. Locale `it`.
- Password generate al momento in `/tmp/giro-012/` (`openssl rand -base64 18 > /tmp/giro-012/p-a`,
  lo stesso per `p-b` e `p-c`). Non si stampano e non si committano. Si passano con
  `jq -n --rawfile p … '{…, password: ($p|rtrimstr("\n"))}' | curl --data @- …`. A fine giro si
  cancella tutta la cartella `/tmp/giro-012/`.
- Limiti: 3 registrazioni sulle 10 consentite per IP all'ora. Nessun codice d'invito sbagliato,
  nessun login sbagliato. La sequenza si esegue **una volta sola, nell'ordine**. Se un passo
  fallisce per un motivo esterno (rete, proxy), lo si dichiara nel rapporto.
- Ogni `id` e ogni `mutationId` è un UUIDv7 generato al momento (`python3 -I -c`: 48 bit di
  millisecondi più una parte casuale). Tutti finiscono annotati nel rapporto.
- Notazione: `T(x)` è il task con titolo `x`. «→ 403» significa corpo `{"error":"forbidden"}`;
  «→ 404» significa lo stesso corpo di una famiglia inesistente (`cmp`). «stato invariato» si
  controlla con un `GET` dopo il rifiuto: stessi `status`, `assigneePersonId` e `version`.

### Persone e famiglie di prova (inventate)
| Chi | Come nasce | Ruolo |
|---|---|---|
| A (`…a@`), nome «Verifica A» | registrazione con `familyName: "Famiglia Verifica 012"` (F) | gestore di F; poi crea FB, quindi **2 famiglie** (fa la parte di Giulia) |
| FB | A: `POST /api/families` `{id, name:"Famiglia Verifica 012 Bis", timeZone:"America/New_York"}` | A gestore |
| B (`…b@`), nome «Verifica B» | registrazione con un codice d'invito di F | membro di F, 1 famiglia |
| Leo | A: `POST /api/families/{F}/resources` `{id, displayName:"Leo", referentPersonId:<B>}` | risorsa di F senza account; referente B |
| C (`…c@`), nome «Verifica C» | registrazione con `familyName: "Famiglia Verifica 012 Altra"` (FX) | gestore di FX, estraneo a F e FB (fa la parte della Famiglia Babbo) |

Il fuso di F è quello di `GET /api/families` (atteso `Europe/Rome`); quello di FB è `America/New_York`.

### A. Prove nella CI (sola lettura) e in locale
- [ ] T5.1 `gh api repos/samueleniccolai-dev/planforhome/actions/runs/39481042928/jobs` → job
      `server` e `app` in `success`. In `git ls-tree -r a3089bd` ci sono
      `Giro008{Task,Queue,Requeue,TaskIsolation}AcceptanceTest`,
      `Giro010DemoTasks{,Seed}AcceptanceTest`,
      `Giro011{DoneReopen,EditCancel,TaskIsolation}AcceptanceTest`,
      `app/e2e/acceptance/giro-010-tasks.spec.ts` e `giro-011-{task-actions,filters}.spec.ts`.
- [ ] T5.2 In locale, su `a3089bd`:
      `cd server && ./mvnw -q -Dtest='Giro008*AcceptanceTest,Giro010*AcceptanceTest,Giro011*AcceptanceTest' test`
      → tutto verde. Due parti del «Fatto quando» si provano **solo** qui, perché da fuori non si
      vedono: il vincolo nel database sull'assegnatario della famiglia e le righe in `change_log`.
      Il rapporto cita i metodi di test che le coprono (nome del metodo e classe, cercati con Grep
      nelle classi `Giro008*` e `Giro011*`). Se uno dei due manca, è un difetto `012:alto` con
      `difetto_di: 008`.
- [ ] T5.3 In locale: `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-010-* e2e/acceptance/giro-011-*`
      → verde in `it-IT` e in `en-US`. Se mancano Docker o il browser, vale T5.1 e lo si dichiara.
- [ ] T5.4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.

### S. Smoke da fuori
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con `"sha":"a3089bd4fbcf2dbbec13ff24af689dee57a8333f"`.
      Si ripete anche alla fine: se lo SHA cambia a metà, si annota (vedi «Rischi»).
- [ ] S2 Senza login: `GET /api/tasks` → 401; `POST /api/families/{UUIDv7 inventato}/tasks` → 401;
      `GET /tasks` e `GET /family` → 200 (file statici).

### P0. Preparazione (non sono controlli, ma se un passo fallisce la sequenza si ferma)
Registrazione di A, login di A, creazione di FB, codice d'invito di F, registrazione di B con il
codice, login di B, creazione della risorsa Leo, registrazione di C, login di C. Poi C crea in FX
il task `T(X1) = "Riparare la grondaia"` con `id` = `<idX1>` → 201.

### P. Righe da P1 a P9: un caso permesso e uno vietato (API in produzione)
Ogni scrittura riuscita si controlla con `version` (1 alla creazione, poi +1 a ogni scrittura
applicata, stessa `version` dopo un rifiuto o un replay).
- [ ] P2 (creare). **Permesso:** B `POST /api/families/{F}/tasks` `{mutationId, id, title:"Comprare il pane"}`
      → 201, `status:"OPEN"`, `assigneePersonId:null`, `createdBy` = B, `criticality:"NORMAL"`, `version:1`.
      A crea in F `T(A1) = "Pagare la mensa"` (in coda) e `T(A2) = "Portare la bici a gonfiare"` (assegnato ad A).
      **Vietato:** C crea in F → 404, e `GET` di A su F non mostra il task di C.
- [ ] P1 (vedere). **Permesso:** B `GET /api/families/{F}/tasks` → 200 con i 3 task di F.
      **Vietato:** C `GET /api/families/{F}/tasks` → 404; B `GET /api/families/{FB}/tasks` → 404;
      `GET /api/tasks` di C non contiene task di F; `GET /api/tasks` di B non contiene `T(X1)`.
- [ ] P3 (assegnare a sé o mettere in coda). **Permesso:** B assegna a sé il proprio «Comprare il pane»
      (`PUT …/assignee` `{mutationId, assigneePersonId:<B>}`) → 200 `version:2`; B lo rimette in
      coda (`assigneePersonId:null`) → 200 `version:3`; A assegna a sé `T(A1)` e poi lo rimette in
      coda → 200 e 200. **Vietato:** B assegna a sé `T(A1)` (in coda, creato da A) → 403, stato invariato.
- [ ] P4 (assegnare ad altri). **Permesso:** A assegna «Comprare il pane» a Leo → 200,
      `assigneePersonId` = Leo. **Vietato:** B assegna a Leo un proprio task nuovo
      `T(B2) = "Annaffiare le piante"` → 403, stato invariato.
- [ ] P5 (prendere dalla coda). **Permesso:** B `POST …/{A1}/take` → 200, `assigneePersonId` = B.
      **Vietato (già preso):** A `POST …/{A1}/take` → 409 con `{"error":"already_taken","assigneePersonId":<B>,"assigneeName":"Verifica B"}`;
      C `POST /api/families/{F}/tasks/{A1}/take` → 404.
- [ ] P6 (rimettere in coda). **Permesso:** B rimette in coda `T(A1)` (assegnato a sé) → 200
      `assigneePersonId:null`. **Vietato:** B rimette in coda `T(A2)` (assegnato ad A) → 403, stato invariato.
- [ ] P7 (segnare fatto). **Permesso:** B `POST …/done` su «Comprare il pane» (assegnato a Leo, di
      cui B è referente) → 200 `status:"DONE"`, `completedBy` = B; A segna fatto `T(A1)` (in coda)
      → 200. **Vietato:** B segna fatto `T(A2)` (assegnato ad A) → 403, stato invariato.
- [ ] P8 (riaprire). **Permesso:** B riapre «Comprare il pane» (fatto da B) → 200 `status:"OPEN"`.
      **Vietato:** B riapre `T(A1)` (fatto da A) → 403, `status` resta `DONE`.
- [ ] P9 (modificare o annullare). **Permesso:** B `PUT /api/families/{F}/tasks/{B2}`
      `{mutationId, title:"Annaffiare le piante del balcone", criticality:"HIGH", dueKind:"DATE", due:"2026-12-20"}`
      → 200 con gli stessi valori e `version` +1; B `POST …/{B2}/cancel` → 200 `status:"CANCELLED"`;
      A modifica il titolo di «Comprare il pane» → 200. **Vietato:** B `PUT` su `T(A2)` → 403;
      B `POST …/{A2}/cancel` → 403; stato e titolo di `T(A2)` invariati.

### I. Isolamento, assegnatario della famiglia, id del client
- [ ] I1 Un assegnatario fuori dalla famiglia viene rifiutato: A crea in F un task con `assigneePersonId` = C
      → 400 `assignee_invalid`; A assegna `T(A2)` a C → 400 `assignee_invalid`. In F non c'è
      nessun task nuovo, e `T(A2)` resta invariato.
- [ ] I2 Un id del client che esiste in un'altra famiglia viene rifiutato: B crea in F un task con
      `id` = `<idX1>` (task di FX) → 409 `id_conflict`. Poi A crea in FB un task con `id` = `<idX1>`
      → 409 `id_conflict`. In nessuno dei due casi nasce un task, e `T(X1)` per C resta invariato
      (`title`, `version:1`, `familyId` = FX).
- [ ] I3 Un id nell'URL di un'altra famiglia viene rifiutato: A `POST /api/families/{F}/tasks/{idX1}/done`
      → 404; C `PUT /api/families/{FX}/tasks/{A2}/assignee` → 404; C `POST /api/families/{F}/tasks/{A2}/cancel`
      → 404. Ogni corpo è identico (`cmp`) a quello di un task inesistente.

### M. `mutation_id` idempotente e `version`
- [ ] M1 B ripete **lo stesso corpo** della creazione di «Comprare il pane» (stesso `mutationId`,
      stesso `id`) → 200, stesso `id`; in F resta un solo task con quel titolo.
- [ ] M2 Ogni operazione ripetuta con lo stesso `mutationId` risponde 200 con lo stato attuale e
      non aumenta `version`: assegnazione (P3), take (P5), done (P7), reopen (P8), PUT e cancel (P9).
- [ ] M3 Lo stesso `mutationId` usato per un'altra operazione o da un'altra persona → 409
      `mutation_conflict`. Per esempio, il `mutationId` del done di P7 usato da A per un cancel, e
      quello del take di P5 usato da A per un take: stato invariato.
- [ ] M4 Dopo M1–M3, per «Comprare il pane» la `version` è pari a 1 più il numero di scritture
      applicate, contate nel rapporto.

### Q. Due prendono lo stesso task in parallelo
- [ ] Q1 A crea in F 5 task in coda, da `"Coda parallela 1"` a `"Coda parallela 5"`. Per ognuno, A e
      B lanciano `POST …/take` **nello stesso istante**, con due `curl` in background e `wait`, ognuno
      con un suo `mutationId`. Atteso per ognuno dei 5 task: esattamente un 200 e un 409
      `already_taken`, il cui `assigneeName` è il nome di chi ha avuto il 200; il `GET` successivo
      mostra quell'assegnatario e `version:2`. Due 200 su uno stesso task sono un difetto
      `012:bloccante` con `difetto_di: 008`.

### W. Web: creare in 3 azioni, assegnare a Leo, «tutte le mie famiglie» (Playwright su produzione)
- [ ] W0 Dati prima del browser (API, come A): in F, `T(Rome) = "Ritirare le analisi"` con
      `dueKind:"DATETIME"`, `due:"2026-11-03T17:30:00Z"`; in FB, `T(NY) = "Prenotare il pediatra"` con
      `dueKind:"DATETIME"`, `due:"2026-11-01T16:00:00Z"` (dopo il ritorno all'ora solare a New
      York); in FB, `T(Day) = "Rinnovare la carta d'identità"` con `dueKind:"DATE"`, `due:"2026-12-20"`.
- [ ] W1 Uno script temporaneo fuori dal repo (`/tmp/giro-012/web/web.spec.ts`, con una config che
      ha `baseURL: https://app.planforhome.com` e niente `webServer`) si lancia con
      `cd app && npx playwright test --config /tmp/giro-012/web/playwright.config.ts`, con
      `timezoneId: 'Asia/Tokyo'`. Elementi cercati per ruolo ed etichetta, testi dei giri 010 e 011.
      **Creare in 3 azioni (`it-IT`):** login di A, scelta di «Famiglia Verifica 012» in `/families`,
      h1 «Famiglia Verifica 012». Da qui: (1) riempire «Titolo del nuovo task» con «Preparare lo
      zaino», (2) cliccare «Aggiungi task». Sono 2 azioni, al massimo 3. Nell'elenco «Task della
      famiglia» compare un solo «Preparare lo zaino», con «In coda» e «Criticità: normale» e senza
      «Scadenza». Il campo torna vuoto.
- [ ] W2 **Assegnare a Leo (`it-IT`):** sull'elemento «Preparare lo zaino»: «Assegna», poi «Assegna a Leo»
      → l'elemento mostra «Assegnato a Leo» e non più «In coda». Il `GET` dell'API, come A, conferma
      `assigneePersonId` = Leo e `version:2`.
- [ ] W3 **Tutte le mie famiglie (`it-IT` ed `en-US`):** il link «Tutte le mie famiglie» / «All my
      families» porta a `/tasks`, con h1 uguale al link. L'elenco «Task di tutte le mie famiglie» /
      «Tasks of all my families» contiene i task aperti di F e FB:
      - «Ritirare le analisi» con «Famiglia Verifica 012» e «Scadenza: 03/11/2026 18:30» / «Due:
        03/11/2026 18:30» (ora di Roma, non di Tokyo);
      - «Prenotare il pediatra» con «Famiglia Verifica 012 Bis» e «… 01/11/2026 11:00» (New York, EST);
      - «Rinnovare la carta d'identità» con «… 20/12/2026».
      Nella pagina non compare nessun testo «Famiglia Verifica 012 Altra», né «Riparare la grondaia».
      Nessuna richiesta del browser contiene l'id di FX (lo si controlla con `page.on('request')`).
      In `en-US` non si crea niente: si apre solo la vista.
- [ ] W4 **Isolamento sul web:** C apre `/family?id=<F>` → alert «Famiglia non trovata.»; nessun
      testo «Famiglia Verifica 012» né «Preparare lo zaino».
      Se il browser non esce dal proxy, valgono T5.3 più le chiamate equivalenti dell'API (I3 e
      `GET /api/tasks` di A con i campi `due` e `familyTimeZone`), e lo si dichiara.
- I casi esatti con Giulia, Leo e la Famiglia Babbo dei dati demo non si provano in produzione
  dall'agente (servirebbe `DEMO_PASSWORD`): vale T5.3. **L'umano** può confermarli entrando come
  Giulia sul web.

### Esito
T5 è `passato` se sono verdi T5.1, T5.2, T5.3 (o il suo ripiego dichiarato), T5.4, S1–S2, P1–P9
(18 casi), I1–I3, M1–M4, Q1 e W1–W4 (o il loro ripiego). Un controllo rosso è un difetto
`012:<gravità>` con `difetto_di: 008`, `010` o `011`, e T5 resta `in-corso`. Sono difetti
`bloccante`: un 200 su un caso vietato di P1–P9, un 200 o un 201 in I1–I3, due 200 in Q1, un
doppione in M1, e un task di FX visibile ad A in W3.

## Per l'umano (non entra nel verdetto)
- APK di `a3089bd`: al momento del piano il job `apk` di `$RUN_CONSEGNA` è ancora in corso. Il
  rapporto annota l'esito e il nome dell'artefatto. Provarlo su un telefono fisico resta all'umano.
  Su Android il login non c'è ancora (porta `expo-secure-store`).
- Conferma facoltativa con i dati demo: Giulia crea «Preparare lo zaino» dalla Famiglia Principale
  e lo assegna a Leo; in «Tutte le mie famiglie» non vede task della Famiglia Babbo.

## Fuori perimetro
- Qualsiasi riga di codice, configurazione, workflow o script del repository. Lo script Playwright
  vive in `/tmp/giro-012/` e viene cancellato.
- Login su Android, `expo-secure-store`, APK su telefono fisico.
- I difetti già noti del giro 011: `me()` con errore di rete, `requeue` sui task chiusi, `PUT`
  senza controllo di `version` (decisione 38), modulo di modifica nell'app, scroll vero. Si
  annotano, ma non sono difetti di questa verifica.
- Filtri dell'app e pulsanti fatto, riapri e annulla sul web: valgono T5.3 e la CI, perché non
  sono nel «Fatto quando».
- Login con gli account demo. Pulizia degli account di prova (005, 009, 012). Difetto `Max-Age`
  del giro 004. PR Dependabot #2 e #3.
- T1–T4, già `passato`. T6 e oltre: ricorrenze, inoltro, sync, promemoria.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica dell'email e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: **DOMANDA** in testa al piano. Servono scritture di prova in produzione (3 account,
  3 famiglie, 1 risorsa, circa 25 task inventati, che restano lì). La decisione 36 valeva solo per T4.

## Rischi di concorrenza
- Q1 è voluto: due `take` paralleli. Se il proxy serializza le richieste, il parallelismo è finto.
  Si annotano gli istanti di partenza e di risposta dei due `curl`: se uno parte dopo la risposta
  dell'altro, il caso non conta come parallelo e lo si dichiara (vale la sonda della CI del giro
  011).
- Se c'è un merge su `main` durante il giro, cambia la versione in produzione e S1, ripetuto alla
  fine, lo mostra. In quel caso si rifà la verifica sul nuovo SHA.
- I limiti per IP sono condivisi con altre sessioni dallo stesso IP di uscita. Un 429 inatteso si
  annota con il passo e non è un difetto.
- I replay di M2 e M3 vanno eseguiti **dopo** le operazioni originali e prima di altre scritture
  sullo stesso task, altrimenti la `version` attesa cambia.
- Nel repository non si scrive niente, oltre ai documenti del giro.

## Budget
0 righe di codice. File scritti: `012-piano.md`, `012-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr` e `passato_il` di T5 in `traguardi.json`. File temporanei solo in
`/tmp/giro-012/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Uno script riusabile per la verifica in produzione (sezioni P, I, M, Q come `scripts/verifica/t5.sh`).
- Un endpoint o un reset del demo per cancellare gli account `verificaNNN.*` (oggi restano).
- Un'autorizzazione permanente, nel registro, per le scritture di prova dei giri `verifica-produzione`
  (opzione A+).
