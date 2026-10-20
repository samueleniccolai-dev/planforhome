---
giro: 015
traguardo: T6
traguardi_extra: []
tipo: verifica-produzione
fase: chiusura
inizio: 2026-10-20T23:00:49Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 015 — verifica in produzione di T6 (task ciclici)

## Fetta e traguardo
Verifica di T6. T6 è stato costruito nei giri 013 (ricorrenze sul server, end-series, carta demo,
PR #20) e 014 (ricorrenze nell'app, «Annulla questa volta», «Termina la serie», PR #21). Il
rapporto 014 dice «Fatto quando verde, da verificare in produzione». La PR #21 è mergiata
(`1aea539`) e il deploy è verde. Questo giro ripete i controlli del «Fatto quando» di T6 contro
`https://app.planforhome.com` e contro le run della CI. Nessun codice.
Fonti: SPEC §2.2.5, §5 (P10), §6; `traguardi.json` → T6; contratti in
`server/src/main/java/com/planforhome/task/TaskService.java` e `Recurrence.java` (su `1aea539`);
testi dell'app in `app/e2e/acceptance/giro-014-recurrence.spec.ts`.

Riferimenti fissati al momento del piano (2026-10-20, circa 23:05Z):
- `$SHA` = `1aea539809fd74f0d0df22c2ea27d5ab9f43c667` (merge della PR #21). `git diff --stat 3e85f66 1aea539`
  è vuoto: il merge ha lo stesso albero dell'ultimo commit della PR.
- `$RUN_CONSEGNA` = 39511453875 (`workflow_run` su `main`): job `decidi`, `immagine`, `pubblica`,
  `deploy` e `avanti` in `success`, `controllo` in `skipped`. **Il job `apk` è ancora in corso.**
  L'API mostra `head_sha` `4012620`, ma `/api/health` riporta `1aea539`: conta quest'ultimo
  (stesso caso del giro 012).
- `$RUN_CI_PR` = 39508622314 (`ci` sulla PR #21, `3e85f66`): `success`.
- `GET /api/health` → `{"status":"UP","sha":"1aea539809fd74f0d0df22c2ea27d5ab9f43c667"}`.
- Scritture di prova in produzione: autorizzate dalla **decisione 42** (A+) per tutti i giri
  `verifica-produzione`. Non serve una domanda.

Il «Fatto quando» di T6 non nomina Android: l'APK non entra nel verdetto.

## Fatto quando — controlli eseguibili

### Regole per le prove in produzione (come nei giri 009 e 012)
- Tutto da fuori: `curl` e `jq` verso `https://app.planforhome.com` (token Bearer dal login con
  `client` mobile), Playwright per il web. Nessun comando sui server (regola 7). **Gli account demo
  non si usano** (servirebbe `DEMO_PASSWORD`).
- Account inventati `verifica015.<epoch>.<x>@example.com`, con `<x>` = `a`, `b`, `c`; `<epoch>` =
  `date -u +%s` all'inizio, annotato nel rapporto. Locale `it`.
- Password generate al momento in `/tmp/giro-015/` (`openssl rand -base64 18`), mai stampate né
  committate, passate con `jq -n --rawfile`. A fine giro si cancella `/tmp/giro-015/`.
- Limiti: 3 registrazioni, nessun login o codice sbagliato. La sequenza si esegue **una volta sola,
  nell'ordine**. Un errore esterno (rete, proxy, 429) si dichiara nel rapporto e non è un difetto.
- Ogni `id` e `mutationId` è un UUIDv7 generato al momento; tutti annotati nel rapporto.
- Notazione: `T(x)` è il task con titolo `x`. «la successiva» è il task `OPEN` con lo stesso
  `seriesId` e `due` più tardo, letto con `GET /api/families/{F}/tasks`. «nessuna successiva»
  significa: dopo l'operazione, nella serie non c'è nessun task `OPEN`. «stato invariato»: un `GET`
  dopo il rifiuto mostra stessi `status`, `assigneePersonId` e `version`, e la serie ha lo stesso
  numero di righe.
- **Finestra di validità:** le date sono scelte per l'esecuzione tra il 2026-10-21 e il
  **2026-10-24T06:00Z**. Fuori da questa finestra, il revisore sposta tutte le date di un numero
  intero di settimane (stesso giorno della settimana, stessi orari locali) e lo annota. R5 e R7
  dipendono dalla finestra; gli altri casi hanno scadenze future e non dipendono dall'ora.

### Persone e famiglie di prova (inventate)
| Chi | Come nasce | Ruolo |
|---|---|---|
| A, «Verifica A» | registrazione con `familyName: "Famiglia Verifica 015"` (F, fuso atteso `Europe/Rome`) | gestore di F; crea FN |
| FN | A: `POST /api/families` `{id, name:"Famiglia Verifica 015 NY", timeZone:"America/New_York"}` | A gestore |
| B, «Verifica B» | registrazione con un codice d'invito di F | membro di F |
| Leo | A: `POST /api/families/{F}/resources` `{id, displayName:"Leo", referentPersonId:<B>}` | risorsa di F senza account |
| C, «Verifica C» | registrazione con `familyName: "Famiglia Verifica 015 Altra"` (FX) | gestore di FX, estraneo a F e FN |

### A. Prove nella CI e in locale (orologio iniettato)
- [ ] T6.1 `gh api repos/samueleniccolai-dev/planforhome/actions/runs/39508622314/jobs` → job
      `server` e `app` in `success`. In `git ls-tree -r 1aea539` ci sono
      `Giro013{Recurrence,EndSeries,DemoPaper}AcceptanceTest`, `Giro014SeriesAcceptanceTest`,
      `app/e2e/acceptance/giro-014-recurrence.spec.ts` e `app/src/task/__tests__/recurrence.test.ts`.
- [ ] T6.2 In locale, su `1aea539`:
      `cd server && ./mvnw -q -Dtest='Giro013*AcceptanceTest,Giro014*AcceptanceTest' test` → verde.
      Il rapporto cita, per ogni pezzo del «Fatto quando», il metodo che lo copre con l'orologio
      iniettato sul server: ogni giorno, ogni N giorni, settimanale con giorni scelti, mensile con
      il 31 in un mese di 30 giorni **e a febbraio**, periodi persi, ora legale di Roma e New York,
      P10 permesso e vietato, ciclico senza scadenza, assegnatario o coda, carta del giovedì
      (`case12…`). Un pezzo senza metodo è un difetto `015:alto` con `difetto_di: 013`.
- [ ] T6.3 In locale: `cd app && npx jest src/task/__tests__/recurrence.test.ts` → verde. Il
      rapporto cita i casi del client con orologio finto per i quattro tipi e per l'ora legale
      (buco e sovrapposizione). Un tipo senza caso è un difetto `015:alto` con `difetto_di: 014`.
- [ ] T6.4 In locale: `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-014-*`
      → verde in `it-IT` ed `en-US`. Se mancano Docker o il browser, vale T6.1 e lo si dichiara.
- [ ] T6.5 `$RUN_CONSEGNA`: job `deploy` («Deploy and smoke test») in `success`.

### S. Smoke da fuori
- [ ] S1 `curl -sS https://app.planforhome.com/api/health` → 200 con `"sha":"1aea539809fd74f0d0df22c2ea27d5ab9f43c667"`.
      Si ripete alla fine: se lo SHA cambia a metà, si annota (vedi «Rischi»).
- [ ] S2 Senza login: `POST /api/families/{UUIDv7 inventato}/tasks/{UUIDv7 inventato}/end-series` → 401.

### P0. Preparazione (se un passo fallisce la sequenza si ferma)
Registrazione di A, login, creazione di FN, codice d'invito di F, registrazione e login di B,
risorsa Leo, registrazione e login di C. Tutte le creazioni di task sotto sono di A in F, salvo
dove è scritto altro, con `POST /api/families/{F}/tasks` e il campo `recurrence`.

### R. Ricorrenze nel fuso della famiglia (API in produzione)
Per ogni caso: la creazione → 201 con `recurrence` nella forma canonica e un `seriesId`; dopo la
chiusura, la successiva ha lo stesso `seriesId`, la stessa `recurrence`, `status:"OPEN"`,
`version:1`, e **una sola** riga nuova nella serie.
- [ ] R1 Ogni giorno, assegnatario conservato. `T("Annaffiare il basilico")`, `dueKind:"DATE"`,
      `due:"2026-10-28"`, `recurrence:{type:"DAILY"}`, `assigneePersonId:<Leo>`. B `POST …/done`
      (referente di Leo) → 200 `DONE`. Successiva: `due:"2026-10-29"`, `assigneePersonId` = Leo.
- [ ] R2 Ogni N giorni, coda conservata. `T("Cambiare l'acqua ai fiori")`, DATE `2026-10-30`,
      `{type:"EVERY_N_DAYS", interval:3}`, in coda. A segna fatto → successiva `2026-11-02`,
      `assigneePersonId:null`.
- [ ] R3 Settimanale con giorni scelti. `T("Portare fuori il vetro")`, DATE `2026-11-03` (martedì),
      `{type:"WEEKLY", days:["TUESDAY","FRIDAY"]}`. Fatto → `2026-11-06` (venerdì); fatto la
      successiva → `2026-11-10` (martedì).
- [ ] R4 Mensile con il 31. `T("Leggere il contatore")`, DATE `2026-10-31`,
      `{type:"MONTHLY", dayOfMonth:31}`. Fatto → `2026-11-30`. `T("Pagare il condominio")`, DATE
      `2027-01-31`, stessa regola. Fatto → `2027-02-28`.
- [ ] R5 Periodi persi saltati (la carta, con un account di prova). `T("Mettere fuori la carta di
      prova")`, DATE `2026-10-20` (martedì, già passato), `{type:"WEEKLY", days:["TUESDAY"]}`. Fatto
      tra mercoledì 21 e lunedì 26 → successiva `2026-10-27`, e nessun'altra riga nella serie (niente
      arretrati). Per la versione DATETIME: `T("Aprire le finestre")`, DATETIME
      `2026-10-19T06:00:00Z` (08:00 a Roma), `{type:"DAILY"}`. Fatto → la successiva è la prima
      08:00 di Roma **dopo** l'istante della risposta del done (annotato), mai nel passato.
- [ ] R6 «Annulla questa volta». `T("Pagare l'affitto")`, DATE `2026-11-05`,
      `{type:"MONTHLY", dayOfMonth:5}`, in coda. A `POST …/cancel` → 200 `CANCELLED`; successiva
      `2026-12-05`, in coda.
- [ ] R7 Ora legale a Roma (fine il 25/10). `T("Dare la medicina al gatto")`, DATETIME
      `2026-10-24T06:00:00Z` (08:00 CEST), `{type:"DAILY"}`. Fatto → successiva
      `2026-10-25T07:00:00Z` (08:00 CET); `recurrence.time` = `"08:00"`.
- [ ] R8 Ora legale a New York (fine l'1/11), in FN. `T("Portare il cane al parco")`, DATETIME
      `2026-10-25T11:00:00Z` (07:00 EDT), `{type:"WEEKLY", days:["SUNDAY"]}`. Fatto → successiva
      `2026-11-01T12:00:00Z` (07:00 EST); `familyTimeZone:"America/New_York"`.
- [ ] R9 Ciclico senza scadenza rifiutato. Creazione con `recurrence:{type:"DAILY"}` e senza `due`
      → 400 `recurrence_needs_due`; con `{type:"MONTHLY", dayOfMonth:32}` → 400
      `recurrence_invalid`. In F non nasce nessun task. `PUT` che toglie la scadenza a
      `T("Pagare l'affitto")` aperto → 400 `recurrence_needs_due`, stato invariato.

### E. «Termina la serie» (P10) e chiusure ripetute
- [ ] E1 **Permesso, membro creatore:** B crea `T("Svuotare la lavastoviglie")`, DATE `2026-11-02`,
      `{type:"DAILY"}`, in coda. B `POST …/end-series` → 200 `CANCELLED`; nessuna successiva.
- [ ] E2 **Permesso, gestore:** B crea `T("Stendere il bucato")`, DATE `2026-11-04`, `{type:"DAILY"}`.
      A `POST …/end-series` → 200 `CANCELLED`; nessuna successiva.
- [ ] E3 **Vietato, membro non creatore:** A crea `T("Pulire il frigo")`, DATE `2026-11-07`,
      `{type:"WEEKLY", days:["SATURDAY"]}`, assegnato a B. B `POST …/end-series` → 403
      `{"error":"forbidden"}`, stato invariato. B può però segnarlo fatto (P7) → 200 e la successiva
      `2026-11-14` resta assegnata a B. C `POST /api/families/{F}/tasks/{frigo}/end-series` → 404.
- [ ] E4 Una occorrenza `DONE` resta (dubbio 1 del giro 014). Sulla serie di R1: la prima occorrenza è
      `DONE`, la seconda `OPEN`. A `POST …/end-series` sulla seconda → 200; la prima resta `DONE`
      con la stessa `version`; nella serie nessun `OPEN`.
- [ ] E5 Su un task non ciclico (`T("Comprare il pane")`, A, senza `recurrence`) → 409
      `not_recurring`; su un'occorrenza già `CANCELLED` → 409 `not_open`.
- [ ] E6 Idempotenza: sulla serie di R2, A ripete il done della prima occorrenza con lo stesso corpo
      e lo stesso `mutationId` → 200, stessa `version`, e nella serie restano 2 righe. A ripete
      l'end-series di E2 con lo stesso `mutationId` → 200, stessa `version`.

### I. Isolamento
- [ ] I1 `GET /api/tasks` di C non contiene nessun `seriesId` di F o FN; `GET /api/families/{F}/tasks`
      di C → 404.
- [ ] I2 C `POST /api/families/{FX}/tasks/{id della successiva di R3}/done` → 404, con corpo
      identico (`cmp`) a quello di un task inesistente; la successiva di R3 resta `OPEN`.

### W. Web (Playwright su produzione, `it-IT`, come A)
- [ ] W1 Script temporaneo fuori dal repo (`/tmp/giro-015/web/web.spec.ts`, config con `baseURL:
      https://app.planforhome.com`, niente `webServer`, `timezoneId: 'Asia/Tokyo'`), lanciato con
      `cd app && npx playwright test --config /tmp/giro-015/web/playwright.config.ts`. Elementi per
      ruolo ed etichetta, testi di `giro-014-recurrence.spec.ts`. Da «Famiglia Verifica 015»:
      «Titolo del nuovo task» = «Mettere fuori la carta dal web», «Scadenza (gg/mm/aaaa)» =
      `27/10/2026`, gruppo «Si ripete» → «Ogni settimana», casella «Martedì», «Aggiungi task».
      Nell'elenco «Task della famiglia» l'elemento mostra un testo che inizia con «Si ripete» e uno
      con «Prossima».
- [ ] W2 «Segna fatto» sull'elemento → senza ricaricare compare un nuovo «Mettere fuori la carta
      dal web» con «Scadenza: 03/11/2026»; il primo mostra «Fatto».
- [ ] W3 «Annulla questa volta» sul secondo, poi «Conferma annullamento» → compare quello del
      10/11/2026, il secondo mostra «Annullato».
- [ ] W4 «Termina la serie» sul terzo, poi «Conferma: termina la serie» → mostra «Annullato» e non
      compare nessuna occorrenza nuova; il `GET` dell'API conferma che nella serie non c'è nessun
      `OPEN`.
      Se il browser non esce dal proxy, valgono T6.4 e le prove R ed E, e lo si dichiara.

### Esito
T6 è `passato` se sono verdi T6.1–T6.5 (T6.4 o il suo ripiego dichiarato), S1–S2, R1–R9, E1–E6,
I1–I2 e W1–W4 (o il loro ripiego). Un controllo rosso è un difetto `015:<gravità>` con
`difetto_di: 013` o `014`, e T6 resta `in-corso`. Sono `bloccante`: una successiva con data
sbagliata in R1–R8, due successive per una stessa chiusura, una successiva dopo «Termina la serie»,
un 200 in E3 o in I1–I2, un ciclico senza scadenza accettato in R9.

## Per l'umano (non entra nel verdetto)
- APK di `1aea539`: al momento del piano il job `apk` di `$RUN_CONSEGNA` è in corso; il rapporto ne
  annota l'esito e il nome. TalkBack sui gruppi radio e Hermes con `Intl` e fuso restano da provare
  su un telefono fisico.
- Conferma facoltativa con i dati demo: Marco segna fatto «Mettere fuori la carta» di giovedì e la
  ritrova il martedì dopo (in CI: `Giro013DemoPaperAcceptanceTest.case12…`).

## Fuori perimetro
- Qualsiasi riga di codice, test, configurazione, workflow o script del repository. Lo script
  Playwright vive in `/tmp/giro-015/` e viene cancellato.
- I due test mancanti dei dubbi del giro 014 (end-series con `DONE` e `nextDue` al confine «oggi»)
  come test nel repository: qui E4 li prova solo in produzione; il test vero va in un giro di
  costruzione.
- Cambiare la regola di una serie, «questo e i seguenti», modifica di titolo e scadenza dall'app;
  «Prossima» quando la serie ha già una successiva (limite noto del giro 014).
- Login su Android, APK su telefono fisico. Login con gli account demo. Pulizia degli account di
  prova (005, 009, 012, 015). PR Dependabot #2 e #3.
- T1–T5, già `passato`. T7 e oltre: inoltro (anche di un task ciclico), lista della spesa, sync,
  promemoria.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica dell'email e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: è un giro di verifica.

## Porte
- Doppio senso previste: nessuna nel repository.
- Senso unico: nessuna. Le scritture di prova in produzione (3 account, 3 famiglie, 1 risorsa,
  circa 25 task inventati, che restano lì) sono coperte dalla decisione 42.

## Rischi di concorrenza
- Nessuna sonda parallela voluta: la concorrenza su done ed end-series è provata in CI
  (`Giro013EndSeriesAcceptanceTest.case10…`, `Giro014SeriesAcceptanceTest.s3…`). Le chiusure qui
  sono sequenziali; ogni `GET` di controllo segue la risposta della scrittura.
- R5 (DATETIME) e R7 dipendono dall'ora reale del server: si annotano l'istante della risposta e il
  `Date` dell'header. Se l'orologio del server e quello locale differiscono di più di un minuto, lo
  si dichiara.
- I replay di E6 vanno eseguiti dopo le operazioni originali e prima di altre scritture sulla serie.
- Un merge su `main` durante il giro cambia la versione in produzione; S1, ripetuto alla fine, lo
  mostra. In quel caso si rifà la verifica sul nuovo SHA.
- Limiti per IP condivisi con altre sessioni: un 429 inatteso si annota e non è un difetto.

## Budget
0 righe di codice. File scritti: `015-piano.md`, `015-rapporto.md`, `PROGRESS.md` e i campi
`stato`, `giri`, `pr` e `passato_il` di T6 in `traguardi.json`. File temporanei solo in
`/tmp/giro-015/`.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Piccolo giro di costruzione con i test dei dubbi 1 e 2 del giro 014 (end-series con `DONE` che
  resta; `nextDue` quando la data è oggi).
- Uno script riusabile per le verifiche in produzione (`scripts/verifica/`), con le date calcolate
  dall'ora corrente invece che fissate a mano.
- Un reset del demo che cancelli gli account `verificaNNN.*`.
