---
giro: 010
traguardo: T5
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-20T13:37:31Z
ricerca: sì
accettazione:
ripreso: no
---
# Piano del giro 010 — T5 parte 2: i task nell'app web e i task demo

## Fetta e traguardo
T5, parte 2, tipo `costruzione`: **le schermate dei task sul web** (elenco della famiglia,
creazione con il solo titolo, assegnazione, presa dalla coda, vista «tutte le mie famiglie» con le
date nel fuso della famiglia del task) e **i task demo dell'Appendice A** che T5 può già avere.
Adesso perché il server dei task (P1–P6) è su `main` dal giro 008 e la parte del «Fatto quando» di
T5 che una persona vede (Playwright) manca del tutto.

Il resto di T5 non sta comodo nella stessa sessione (giro 008: 687 righe per il solo server P1–P6).
**Resta per T5 parte 3:** P7 (segnare fatto), P8 (riaprire), P9 (modificare o annullare) sul
server, con i loro test di accettazione (permesso e vietato), e i pulsanti relativi nell'app; i
filtri «assegnati a me», «in coda», «in scadenza» della vista (SPEC §2.2.2). Poi un giro
`verifica-produzione` di T5 (e di T4).

Fonti: SPEC §2.2.2, §2.2.3, §2.2.4, §5 (P1–P6), §12, App. A; `traguardi.json` → T5;
`008-piano.md`, `008-rapporto.md`; codice: `app/app/family.tsx`, `app/app/families.tsx`,
`app/src/api/client.ts`, `app/src/i18n/`, `server/.../task/TaskController.java`,
`server/.../demo/DemoDataSeeder.java`, `app/e2e/acceptance/giro-007-families.spec.ts`.

## Cosa si costruisce

### App (web; il codice compila anche per Android, dove il login non c'è ancora)
Logica fuori dalle schermate (`app/src/task/`), schermate sottili. Nessuna dipendenza nuova.

**Client API** (`app/src/api/client.ts`, oggi solo `GET`/`POST`: si aggiunge `PUT`, con
l'header CSRF come gli altri metodi non sicuri):
| Funzione | Chiamata |
|---|---|
| `familyTasks(familyId)` | `GET /api/families/{id}/tasks` |
| `myTasks()` | `GET /api/tasks` |
| `createTask(familyId, {id, mutationId, title})` | `POST /api/families/{id}/tasks` |
| `assignTask(familyId, taskId, {mutationId, assigneePersonId})` | `PUT …/tasks/{taskId}/assignee` (`null` = coda) |
| `takeTask(familyId, taskId, {mutationId})` | `POST …/tasks/{taskId}/take` |
Esiti: `ok`, `unauthorized` (→ `/login`), `notFound`, `forbidden` (403), `alreadyTaken` (409
`already_taken`, con `assigneeName`), `invalid` (400), `error`.

**Identificativi del client** (`app/src/task/ids.ts`): `uuidv7()` scritto a mano (48 bit di
millisecondi + casuale da `globalThis.crypto.getRandomValues`), per `id` del task e per ogni
`mutationId`. Un nuovo tentativo dopo un errore di rete rimanda **lo stesso** `id` e `mutationId`
(il server risponde 200 al replay); un invio riuscito ne genera di nuovi per il prossimo.

**Date** (`app/src/task/dates.ts`): `formatDue(task)` con `Intl.DateTimeFormat` e
`timeZone = task.familyTimeZone`, mai il fuso del dispositivo:
- `dueKind: DATE`, `due: "2026-12-20"` → `20/12/2026` (la data si mostra com'è, senza conversioni);
- `dueKind: DATETIME` → `dd/MM/yyyy HH:mm` nel fuso della famiglia, 24 ore, in entrambe le lingue
  (costruito con `formatToParts`, così il testo non dipende dalla versione di ICU);
- senza scadenza → nessuna riga «Scadenza».

**Schermata della famiglia** (`/family?id=…`), sotto «Persone», una sezione con titolo di livello
2 «Task» / "Tasks":
- un campo di testo con etichetta «Titolo del nuovo task» / "New task title" e un pulsante
  «Aggiungi task» / "Add task" (disattivato se il titolo è vuoto dopo trim, e mentre l'invio è in
  corso). Creare un task con il solo titolo = **scrivere il titolo + premere il pulsante: 2
  azioni** dalla schermata della famiglia (SPEC §12: al massimo 3). Il corpo è solo
  `{id, mutationId, title}`; dopo il 201 il campo si svuota e il task compare in elenco;
- l'elenco (`role="list"`, etichetta «Task della famiglia» / "Family tasks"), un `listitem` per
  task, nell'ordine del server, con: titolo; «In coda» / "In queue" oppure «Assegnato a {nome}» /
  "Assigned to {name}" (nome dai membri già caricati); «Criticità: bassa|normale|alta» /
  "Criticality: low|normal|high"; «Scadenza: {data}» / "Due: {date}" se c'è;
  «Nessun task.» / "No tasks." se l'elenco è vuoto;
- in ogni task: pulsante «Prendo io» / "I'll take it" (solo se in coda) → `take`; pulsante
  «Assegna» / "Assign" che apre, dentro lo stesso `listitem`, un pulsante «Assegna a {nome}» /
  "Assign to {name}" per ogni persona della famiglia (risorse comprese) e «Rimetti in coda» /
  "Put back in queue". **Il client non decide i permessi:** mostra le scelte a tutti e manda la
  richiesta; il server risponde;
- dopo ogni risposta 200 il task in elenco si sostituisce con quello restituito; dopo 403 →
  avviso (`role="alert"`) «Non hai il permesso di farlo.» / "You're not allowed to do that.", il
  task resta com'era; dopo 409 `already_taken` → «Già preso da {nome}.» / "Already taken by
  {name}." e il task si mostra assegnato a quella persona; dopo 404 → si ricarica l'elenco; altri
  errori → «Qualcosa non ha funzionato. Riprova.» / "Something went wrong. Try again.";
- un collegamento «Tutte le mie famiglie» / "All my families" verso `/tasks`.

**Vista «tutte le mie famiglie»** (rotta statica `/tasks`, come DECISIONI n. 28): titolo di
livello 1 «Tutte le mie famiglie» / "All my families"; un solo `GET /api/tasks`; elenco con
etichetta «Task di tutte le mie famiglie» / "Tasks of all my families"; ogni `listitem` ha titolo,
nome della famiglia (da `GET /api/families`), stato di assegnazione («In coda» o «Assegnato a
{nome}»; il nome viene da `GET …/members` delle sole famiglie di `GET /api/families`, perché il
task del giro 008 non ha `assigneeName`), criticità e scadenza nel fuso **della famiglia del task**. Collegamento allo stesso
`/tasks` anche dalla schermata `/families`. Senza sessione → `/login`.

Tutte le stringhe con chiavi in `it.json` ed `en.json` (il test esistente sulle chiavi resta
verde).

### Server: i task demo (`DemoDataSeeder`)
Solo i task dell'Appendice A che non richiedono T6, T8 o T10:
| Task | Famiglia | Creato da | Stato | Criticità | Scadenza |
|---|---|---|---|---|---|
| «Prenotare il pranzo di Natale» | Mamma | Anna | in coda | `HIGH` | nessuna |
| «Rinnovare la carta d'identità di Franco» | Babbo | Rosa | in coda | `NORMAL` | `DATE`, oggi + 10 giorni nel fuso della famiglia (oggi dal `Clock` al momento del seed) |

Ogni task demo nasce come una scrittura vera: `version` 1, una riga `change_log`
(`task`/`UPSERT`) con il `family_id` giusto. **Idempotenza:** il seeder aggiunge un task demo solo
se nella sua famiglia non c'è già un task con quel titolo; vale anche quando le persone demo
esistono già (è il caso della produzione, dove le famiglie demo ci sono dal giro 003). Tutto nella
stessa transazione del seeder. «Mettere fuori la carta» (T6), «Lista della spesa» (T8) e
«Preparare lo zaino» (lo crea Giulia nel test; il promemoria è T10) **non** si seminano.

## Fatto quando — controlli eseguibili
Nota: la riga di T5 «nessuno della Famiglia Babbo» la prova il server (P1, giro 008, e qui il
test dei task demo); Playwright prova che l'app non aggiunge nulla e non chiede nulla di Babbo.
- [ ] `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-010-*`
  → tutti verdi, in `it-IT` ed `en-US`, con il browser nel fuso `Asia/Tokyo` (né Roma né New
  York), API finta nel browser come nel giro 007:
  - **creare in al massimo 3 azioni:** Giulia, sulla schermata di «Famiglia Principale», scrive
    «Preparare lo zaino» nel campo «Titolo del nuovo task» e preme «Aggiungi task» (2 azioni) →
    una sola `POST /api/families/{Principale}/tasks` con corpo di esattamente `id`, `mutationId`
    (entrambi UUID versione 7) e `title`, header `X-CSRF-Token`; il task compare nell'elenco
    «Task della famiglia» con «In coda» e «Criticità: normale»; il campo è vuoto;
  - **doppio clic:** due clic rapidi su «Aggiungi task» → una sola `POST`;
  - **riprovare dopo un errore di rete:** la prima `POST` fallisce (rete), Giulia preme di nuovo
    → la seconda `POST` ha lo **stesso** `id` e `mutationId` della prima; il task compare una
    volta;
  - **assegnare a Leo (P4 da gestore):** Giulia preme «Assegna» nel task «Preparare lo zaino»,
    poi «Assegna a Leo» → `PUT …/tasks/{id}/assignee` con `assigneePersonId` di Leo e un
    `mutationId` nuovo; il task mostra «Assegnato a Leo»; «Rimetti in coda» → corpo
    `assigneePersonId: null`, il task mostra «In coda»;
  - **vietato (il server decide):** Luca (membro di Mamma) preme «Assegna a Davide» su
    «Prenotare il pranzo di Natale»; l'API finta risponde 403 → la richiesta è partita, avviso
    «Non hai il permesso di farlo.», il task resta «In coda»;
  - **coda (P5):** Giulia preme «Prendo io» su «Prenotare il pranzo di Natale» → `POST …/take`,
    il task mostra «Assegnato a Giulia»; con l'API finta che risponde 409
    `{"error":"already_taken","assigneeName":"Paolo",…}` → avviso «Già preso da Paolo.» e il task
    mostra «Assegnato a Paolo»;
  - **tutte le mie famiglie:** Giulia apre «Tutte le mie famiglie» → l'elenco «Task di tutte le
    mie famiglie» ha i task di «Famiglia Principale» e di «Famiglia Mamma», ciascuno con il nome
    della sua famiglia, e nessuno di «Famiglia Babbo» (nessun titolo di Babbo e nessuna richiesta
    a un URL con l'id di Babbo); le date nel fuso della famiglia del task: «Preparare lo zaino»
    (Principale, `Europe/Rome`, `DATETIME 2026-11-03T17:30:00Z`) → «Scadenza: 03/11/2026 18:30»;
    «Comprare i regali» (Mamma, nell'API finta `America/New_York`, `DATETIME
    2026-11-01T16:00:00Z`, giorno del cambio dell'ora) → «Scadenza: 01/11/2026 11:00»; «Prenotare
    il pranzo di Natale» (Mamma, `DATE 2026-12-20`) → «Scadenza: 20/12/2026»; in `en-US` le
    stesse date con «Due: …»;
  - **sessione:** senza sessione `/tasks` porta a `/login`.
- [ ] `cd server && ./mvnw -q -Dtest='Giro010*AcceptanceTest' test` → verdi:
  - Anna in `GET /api/families/{Mamma}/tasks` vede «Prenotare il pranzo di Natale» una volta:
    `OPEN`, in coda, `HIGH`, nessuna scadenza, `version` 1, `createdBy` Anna; Luca (membro di
    Mamma) lo vede;
  - Rosa in `GET /api/families/{Babbo}/tasks` vede «Rinnovare la carta d'identità di Franco» una
    volta: in coda, `dueKind: DATE`, `due` = la data del `Clock` del test in `Europe/Rome` + 10
    giorni, `createdBy` Rosa;
  - isolamento: il `GET /api/tasks` di Giulia contiene il task di Mamma e nessun task di Babbo; il
    `GET /api/tasks` di Marco contiene quello di Babbo e non quello di Mamma; Luca su
    `GET /api/families/{Babbo}/tasks` → 404;
  - `change_log` (JDBC): una riga `task`/`UPSERT` per ciascun task demo, con il `family_id` della
    sua famiglia;
  - **idempotenza:** il seeder del contesto rieseguito due volte → ancora un solo task per titolo;
    tolti via JDBC i due task demo (e le loro righe di `change_log`) con le persone demo ancora
    presenti, il seeder rieseguito li ricrea una volta sola.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (anche i test dei giri 003, 006, 008, che
  leggono le famiglie demo).
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi; test Jest di
  `formatDue` (DATE, DATETIME su entrambi i cambi d'ora di Roma e New York, fuso del dispositivo
  diverso) e di `uuidv7` (versione 7, variante, crescente nel tempo).
- [ ] `cd app && npx playwright test` → verdi anche i test dei giri 000, 004, 007.
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Dati demo del giro (inventati)
**App (API finta nel browser, come nel giro 007):** famiglie e persone dell'Appendice A con gli
stessi id del test del giro 007; Giulia (`giulia@example.com`) e Luca (`luca@example.com`),
password `Lanterna-Blu-42`. Fusi nell'API finta: Principale `Europe/Rome`, Mamma
`America/New_York` (inventato per provare il fuso; in produzione è `Europe/Rome`), Babbo
`Europe/Rome`. Task dell'API finta:
| Task | Famiglia | Stato | Scadenza |
|---|---|---|---|
| «Preparare lo zaino» | Principale | creato nel test, poi assegnato a Leo | per la vista: `DATETIME 2026-11-03T17:30:00Z` |
| «Prenotare il pranzo di Natale» | Mamma | in coda, `HIGH` | `DATE 2026-12-20` |
| «Comprare i regali» | Mamma | assegnato a Giulia | `DATETIME 2026-11-01T16:00:00Z` |
| «Rinnovare la carta d'identità di Franco» | Babbo | in coda | `DATE 2026-11-13` |
L'API finta risponde come il server: `GET /api/tasks` solo con i task delle famiglie di chi è in
sessione; 404 su una famiglia altrui; il corpo dei task ha la forma del giro 008 (`id, familyId,
familyTimeZone, title, notes, dueKind, due, criticality, status, assigneePersonId, createdBy,
version, updatedAt`).

**Server:** i due task demo della tabella sopra («Cosa si costruisce → Server»), con le persone
demo dell'Appendice A (password demo del contesto di test).

## Fuori perimetro
- P7, P8, P9 (fatto, riaprire, modificare, annullare) sul server e nell'app; filtri «assegnati a
  me», «in coda», «in scadenza» (T5 parte 3).
- Campi diversi dal titolo nella creazione dall'app (scadenza, criticità, note, assegnatario
  iniziale): l'API li ha, l'app no in questo giro.
- Qualunque cambiamento all'API dei task del giro 008 (forma, codici, ordine dei controlli).
- Task demo «Mettere fuori la carta» (ricorrenza, T6), «Lista della spesa» (T8), «Preparare lo
  zaino» con promemoria a Giulia (T10).
- App su Android: login (`expo-secure-store`, porta a senso unico, DECISIONI n. 22), SQLite, coda
  offline, sincronizzazione (T9).
- Ricorrenze (T6), inoltro (T7), lista della spesa (T8), promemoria e solleciti (T10).
- Le date in formati diversi per lingua; il calendario.
- Difetti minori aperti (`Max-Age` 2591999, famiglie «Verifica 005/009»), PR di Dependabot #2 e #3.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-010-tasks.spec.ts` | creazione in 2 azioni, doppio clic, riprova con gli stessi id, assegnazione a Leo e ritorno in coda, 403 mostrato, «Prendo io» e «Già preso da Paolo», vista «tutte le mie famiglie» con i fusi, `/tasks` senza sessione; in `it-IT` ed `en-US`, browser in `Asia/Tokyo` |
| `server/src/test/java/com/planforhome/acceptance/Giro010DemoTasksAcceptanceTest.java` | i due task demo, visibilità e isolamento, `change_log`, idempotenza del seeder |

Il test server estende `Giro008AcceptanceSupport` (stesso contesto e stesso seed). Le sole letture
non HTTP sono `change_log` e la cancellazione dei task demo per la prova d'idempotenza, via
`JdbcTemplate`; il seeder si richiama dal bean del contesto (`DemoDataSeeder.run`).

## Porte
- Doppio senso previste: rotta `/tasks`; testi e chiavi di traduzione; formato `dd/MM/yyyy HH:mm`
  uguale nelle due lingue; `uuidv7` scritto a mano senza libreria; `PUT` nel client; le scelte
  d'assegnazione mostrate a tutti (decide il server); idempotenza dei task demo per titolo e
  famiglia; quali task dell'Appendice A si seminano adesso.
- Senso unico: nessuna. Nessuna dipendenza nuova, nessuna migrazione, nessuna modifica all'API.
  I task demo in produzione si aggiungono al prossimo avvio del server: sono dati inventati,
  già previsti dall'Appendice A.

## Rischi di concorrenza
- **Doppio invio della creazione:** pulsante disattivato durante l'invio; se il secondo invio
  parte comunque (riprova), ha lo stesso `id` e `mutationId`, e il server risponde 200 con lo
  stesso task (giro 008). Prova: test «doppio clic» e «riprova».
- **Risposte fuori ordine:** una risposta di un'assegnazione arriva dopo un ricaricamento
  dell'elenco; il task in elenco si sostituisce solo se la `version` ricevuta è maggiore di quella
  mostrata. Prova: Jest sulla funzione che fonde un task nell'elenco.
- **Presa contesa:** la decide il server (giro 008); l'app mostra «Già preso da {nome}». Prova:
  Playwright con 409 finto.
- **Seeder:** gira in una transazione all'avvio, con un solo processo; due avvii paralleli non ci
  sono in R0 (un container). L'idempotenza per titolo copre il riavvio.
- **Schermata riusata con un altro `id`** (giro 007): i risultati di un'altra famiglia non si
  mostrano (stesso schema di `fetched.id === id`).

## Budget
Righe di produzione (`app/src`, `app/app`, `server/src/main`) ≤ 600 (app circa 500, server circa
60); file ≤ 10; nessuna migrazione. Una sessione.

## Domande per il ricercatore (al massimo 3)
1. `Intl.DateTimeFormat` con `timeZone` IANA e `formatToParts`: funziona su Hermes nell'APK
   Android (Expo SDK 58, React Native 0.88) come sul web? Se no, qual è il ripiego ufficiale senza
   dipendenze nuove?
2. `globalThis.crypto.getRandomValues` è disponibile su Hermes/Expo SDK 58 senza `expo-crypto`?
   (Per il web basta; per Android serve sapere se T9 avrà una porta.)
3. In react-native-web 0.21: il modo raccomandato per dare a un `TextInput` un'etichetta
   accessibile (`aria-label` / `accessibilityLabel`) e a un `View` il ruolo `list`/`listitem`, così
   che Playwright li trovi con `getByRole`.

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Un'API finta condivisa tra i test Playwright dei giri (oggi ognuno ha la sua): da proporre, non
  da fare qui (i test di accettazione sono intoccabili).
- Formati di data diversi per lingua (`en-US` con mese prima) se l'umano li vuole.
