---
giro: 043
traguardo: T11
traguardi_extra: []
tipo: verifica-produzione
fase: revisione
inizio: 2026-10-25T05:46:14Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 043 — verifica in produzione di T11 (bonifica dei minori della caccia 040)

## Fetta e traguardo
T11, tipo `verifica-produzione`: il rapporto 042 dice «Fatto quando verde, da verificare in
produzione», la PR #66 è mergiata in `dd26d2b`, il deploy è verde. Nessun codice.
Fonti: SPEC §5, §7, §8; `traguardi.json` → T11; piano e rapporto 042; decisione 125 (semantica
del PUT parziale); decisione 42 (scritture di prova in produzione).

Riferimenti fissati al momento del piano (2026-10-25T05:50Z):
- `$SHA` = `dd26d2bfdd69cd6d45d14eefde0c564eaf4d0c42` (merge della PR #66);
  `GET /api/health` → `{"status":"UP","sha":"dd26d2bfdd69cd6d45d14eefde0c564eaf4d0c42"}`.
- `$RUN_CONSEGNA` = 40166458914: `controllo`, `immagine`, `pubblica`, `deploy`, `avanti` in
  `success`, `decidi` `skipped`; **`apk` ancora in corso** (poi `apk-firma`). Il run
  40166771688 su `dd26d2b` è `skipped`: atteso, non un difetto.
- `$RUN_CI_PR` = 40139137434 (`ci` su `claude/giro-042-t11`, `bafb1e0`): `build`, `server`,
  `app`, `apk`, `lab` in `success`.
- Differenze di prodotto tra `dd26d2b^1` e `dd26d2b`: `TaskService`, `TaskController` (PUT
  parziale), `PushService` (riga saldata), `app/src/push/registration.ts` (timeout del token),
  più i test.

## Fatto quando — controlli eseguibili

### Regole per le prove da fuori (come nei giri 037 e 039)
- `curl` e `jq` verso `https://app.planforhome.com`, login con `client:"android"`. Nessun comando
  sui server. Gli account demo di SPEC Appendice A non si toccano.
- Account inventati `verifica043.<epoch>.<x>@example.com`, `<x>` = `a`, `b`, `c`; locale `it`.
  Password generate in `/tmp/giro-043/` (`openssl rand -base64 18`), mai stampate; la cartella si
  cancella a fine giro. UUIDv7 (`mutationId`) generati al momento, annotati nel rapporto.
- Tre registrazioni, un codice d'invito, nessun login sbagliato; sequenza eseguita una volta.
  Un errore esterno (rete, proxy, 429 di registrazione) si dichiara e non è un difetto.

### Persone e dati di prova (inventati)
| Chi | Come nasce | Ruolo |
|---|---|---|
| A, «Verifica A» | registrazione con `familyName: "Famiglia Verifica 043"` (F) | gestore di F |
| B, «Verifica B» | registrazione con un codice d'invito di F | membro di F |
| C, «Verifica C» | registrazione con `familyName: "Famiglia Verifica 043 Altra"` (FX) | non in F |

Task di F creati da A:
- `T1` «Pagare la bolletta dell'acqua», note «Codice utenza 5582», criticità `HIGH`, scadenza
  `DATE` `2026-12-03`, in coda.
- `T2` «Portare la caldaia alla revisione», criticità `NORMAL`, scadenza `DATETIME`
  `2026-12-10T09:00:00Z`, assegnato ad A (genera due `AUTO`).
- `T3` «Innaffiare le piante del terrazzo», ricorrente ogni lunedì, scadenza `DATE` `2026-11-30`.

### V. CI, test in locale, APK
- [ ] V1 `gh api repos/{owner}/{repo}/actions/runs/40139137434/jobs` → `server`, `app`, `apk`
      in `success`. `git ls-tree -r --name-only dd26d2b` contiene
      `Giro042PartialUpdateAcceptanceTest.java`, `Giro042ReminderNetworkErrorAcceptanceTest.java`,
      `app/e2e/acceptance/giro-042-push-registration.spec.ts`,
      `app/src/push/__tests__/registration.test.ts`.
- [ ] V2 In locale su `dd26d2b`: `cd server && ./mvnw -q -Dtest='Giro042*AcceptanceTest,Giro011*AcceptanceTest,Giro013*AcceptanceTest,PushServiceReminderTest' test`
      → verde. Il rapporto cita un metodo per ciascuno dei minori (1) e (3) del «Fatto quando» di
      T11 (A1–A7 per (1), A8 per (3)). Un minore senza metodo è `043:maggiore`.
- [ ] V3 In locale: `cd app && npm test && npx playwright test e2e/acceptance/giro-042-*` → verde;
      il rapporto cita il test Jest del minore (2) (token appeso, ritento al secondo `ensure()`,
      `getTimerCount()` 0). Senza Docker o browser valgono V1 e la run CI, dichiarandolo.
- [ ] V4 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.
- [ ] V5 Ultimo APK: in `$RUN_CONSEGNA` job `apk` e `apk-firma` in `success` e un artefatto
      `planforhome-0.1.0-dd26d2b`, dimensione > 0, non scaduto
      (`gh api repos/{owner}/{repo}/actions/runs/40166458914/artifacts`). Se il job è in corso si
      attende con un controllo a intervalli (massimo 30 minuti); se fallisce, `043:maggiore`
      (`difetto_di` 042).

### S. Da fuori, senza login
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con
      `"sha":"dd26d2bfdd69cd6d45d14eefde0c564eaf4d0c42"`. Ripetuto alla fine.
- [ ] S2 Senza token, con UUIDv7 inventati: `PUT /api/families/{f}/tasks/{t}` con
      `{"mutationId":…,"title":"x"}` → 401.

### P. PUT parziale in produzione — minore (1)
- [ ] P0 A e C si registrano e fanno login; A genera un codice d'invito di F; B si registra con
      il codice e fa login. A crea T1, T2, T3. Se un passo fallisce, la sequenza si ferma.
- [ ] P1 A `PUT …/tasks/T1` con solo `mutationId` e `title` «Pagare la bolletta del gas» → 200;
      nella risposta e in `GET /api/families/F/tasks`: note «Codice utenza 5582», criticità
      `HIGH`, `dueKind` `DATE`, scadenza `2026-12-03` invariate; `version` + 1.
- [ ] P2 B fa il pull `GET /api/sync/families/F/changes?after=<seq letto prima di P1>` → la riga
      `UPSERT` di T1 porta il titolo nuovo e note, criticità, scadenza conservate, stessa `version`.
- [ ] P3 Replay di P1 con la stessa `mutationId` → stessa risposta, `version` invariata.
- [ ] P4 A `PUT` T1 con `notes: null` → note `null`, il resto invariato; poi con
      `criticality: null` → `NORMAL`; poi con `dueKind: null, due: null` → senza scadenza.
- [ ] P5 A `PUT` T1 con `title: null` → 400 `title_invalid`; con solo `due` → 400 `due_invalid`;
      con `title: 5` → 400. In tutti i casi `version` e campi invariati.
- [ ] P6 A `PUT` T3 con solo `title` → 200, scadenza e ricorrenza conservate; con
      `dueKind: null, due: null` → 400 `recurrence_needs_due`.
- [ ] P7 (isolamento) C `PUT` parziale su T1 con l'`id` di F nell'URL → 404 `not_found`, corpo
      identico (`cmp`) a quello di una famiglia inesistente; C su FX con `taskId` = T1 → 404;
      T1 e `version` invariati (rilettura di A).

### R. Promemoria dopo il PUT parziale — regressione di (1) e (3)
- [ ] R1 A `GET /api/families/F/tasks/T2/reminders` → 200, sole chiavi `id`, `kind`, `dueAt`,
      `sentAt`, `result`; due `AUTO` `pending` a `2026-12-10T08:00:00Z` e `09:00:00Z`.
- [ ] R2 A `PUT` T2 con solo `title` «Portare la caldaia al tecnico» → le due `AUTO` invariate
      (stessi `id` e `dueAt`): un PUT senza scadenza non sposta i promemoria. Righe cambiate o
      sparite = `043:maggiore` (`difetto_di` 042).
- [ ] R3 Il minore (3) non si provoca in produzione (serve un errore di rete simulato): vale V2
      (`Giro042ReminderNetworkErrorAcceptanceTest`, `PushServiceReminderTest`). Lo si dichiara.

### Esito
T11 è `passato` se sono verdi V1–V5 (V2 e V3 con i ripieghi dichiarati), S1–S2, P0–P7, R1–R2.
Un rosso è un difetto `043:<gravità>` con `difetto_di` 042, e T11 resta `in-corso`. Sono
`bloccante`: un 2xx in P7; un campo omesso azzerato in P1 o R2; un 2xx in P5. Un atteso sbagliato
del piano si scrive come «atteso del piano», non come difetto.

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository. Gli script di
  prova vivono in `/tmp/giro-043/` e si cancellano.
- Prova del minore (2) su un telefono vero (token FCM appeso): non si provoca a mano; valgono
  Jest e Playwright B1–B3. Nessuna richiesta all'umano in questo giro.
- Il form «Modifica task» dell'app (idea del 042, non costruita).
- Difetti e dubbi già noti, non trasformati in difetti nuovi: `server/mvnw.cmd` con fine riga
  CRLF nell'albero di lavoro; `pr_guard` non lanciabile dal revisore; dubbi 033, 036, 038.
- Pulizia degli account di prova (005–039, 043). Prove di carico.
- T1–T10, già `passato`; T12–T19.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni» a griglia;
  set di icone come dipendenza; accesso con Google o Apple, iPhone, Play Store; verifica
  dell'email e recupero della password; sincronizzazione in tempo reale e offline sul web; dati
  reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna nuova. Scritture di prova (3 account, 2 famiglie, 3 task inventati,
  alcune modifiche) coperte dalla decisione 42.

## Rischi di concorrenza
- Ogni PUT alza `version`: le scritture successive leggono la `version` nuova; P3 si fa subito
  dopo P1, prima di P4.
- P2: il `seq` di partenza si legge prima di P1, altrimenti la riga non compare.
- R2: un ricalcolo dei promemoria appena dopo il PUT (righe vecchie e nuove insieme) è
  `043:maggiore`.
- Un merge su `main` durante il giro cambia la versione: S1 ripetuto alla fine lo mostra; in quel
  caso si rifà la verifica sul nuovo SHA.

## Budget
0 righe di codice. File scritti: `043-piano.md`, `043-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr`, `passato_il` di T11 in `traguardi.json`. Temporanei solo in `/tmp/giro-043/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`), già proposto nel 039.
- Una prova sul telefono del timeout del token, se in futuro emerge un difetto di registrazione.
