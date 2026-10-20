---
giro: 014
traguardo: T6
tipo: costruzione
fase: revisione
inizio: 2026-10-20T21:50:54Z
ricerca: sì
accettazione: 4412692
ripreso: no
---
# Piano del giro 014 — T6 parte 2: ricorrenze nell'app, «Annulla questa volta», «Termina la serie»; dubbi 013 sul server

## Fetta e traguardo
T6, parte 2 e ultima, tipo `costruzione` (T6 `in-corso`; il rapporto 013 dice «parziale, resta il
client»; nessuna integrazione). La fetta chiude **tutto il resto del «Fatto quando» di T6**: la parte
client (`recurrence.ts` con test a orologio finto, scelta della ricorrenza alla creazione, ricorrenza
mostrata sul task, «Annulla questa volta», «Termina la serie») e i due dubbi del revisore 013 sul
server. Dopo questo giro: `verifica-produzione` di T6.

Fonti: SPEC §2.2.3 (scadenza `DATE`/`DATETIME`, fuso della famiglia), §2.2.5, §5 (P9, P10), §6
(`task.recurrence`, `series_id`); `013-piano.md` (formato JSON di `recurrence`, casi del server);
`013-rapporto.md` (dubbi 1 e 2); DECISIONI 45–47. Codice: `app/src/task/TasksSection.tsx`,
`TaskSummary.tsx`, `dates.ts`, `logic.ts`, `app/src/api/client.ts`, `app/src/i18n/{it,en}.json`,
`server/.../task/TaskService.java`, `TaskRepository.java`.

**Perché serve anche la scadenza nel modulo:** oggi «Aggiungi task» manda solo il titolo; un ciclico
senza scadenza è rifiutato (SPEC §2.2.5). Senza un campo scadenza nessuno può creare un ciclico
dall'app.

## Cosa si costruisce

### Server (package `task`; nessuna migrazione, nessun endpoint nuovo)
- **Dubbio 1 — `end-series` su un'occorrenza riaperta.** Oggi `done → reopen → end-series` lascia
  `OPEN` la successiva già creata: la serie non finisce. Regola nuova: `end-series` annulla
  l'occorrenza chiamata **e ogni altra occorrenza `OPEN` della stessa serie**, qualunque sia la
  sua scadenza (stessa `family_id`, stesso `series_id`: opzione (a) della critica), nella stessa
  transazione, sotto il lock della famiglia: ciascuna `status=CANCELLED`, `version+1`,
  `updated_at`, una riga `change_log` `UPSERT`. Vale anche dopo un `PUT` che sposta la successiva
  prima della precedente, e chiamando `end-series` sulla successiva (la precedente riaperta si
  annulla). Dopo, nella serie non resta nessuna `OPEN`. La risposta resta il task chiamato. P10
  invariato (gestore o `created_by`), controllato solo sull'occorrenza chiamata.
- **Dubbio 2 — `PUT` e l'ora.** Oggi un `PUT` che cambia l'ora di un ciclico `DATETIME` lascia il
  `time` vecchio nella regola: la successiva nasce all'ora vecchia. Regola nuova: un `PUT` su un
  ciclico riscrive **solo** la chiave `time` della regola salvata dalla nuova scadenza: `DATETIME` →
  ora locale della nuova `due_at` nel fuso della famiglia; `DATE` → `time` tolta. Tipo, giorni,
  intervallo restano; `recurrence` nel corpo del `PUT` resta ignorata (decisione 47).
- Mappa client dei 409: `not_recurring` → stato `changed` come `not_open` (decisione 40).

### App (web e Android, stessi componenti; nessuna dipendenza nuova)
- **`app/src/task/recurrence.ts`** (puro, senza React; `now` passato come argomento):
  - `toInstant(date, time, zone)`: data e ora locali nel fuso → istante UTC, con `Intl` (come
    `dates.ts`, niente `formatToParts`); buco di marzo → avanti della durata del buco (02:30 →
    03:30, come `ZonedDateTime.of`); sovrapposizione di ottobre → la prima delle due (offset più
    presto, come `withEarlierOffsetAtOverlap`).
  - `nextDue(task, now)`: la scadenza che il server darebbe all'occorrenza successiva se il task
    fosse chiuso a `now` — stesse regole del server (giro 013): prima data della regola dopo il
    giorno della scadenza; mensile con il giorno della regola e ripiego a fine mese (decisione 45);
    periodi persi saltati (`DATE`: giorno < oggi nel fuso → avanti; `DATETIME`: istante ≤ `now` →
    avanti); `DATETIME` con il `time` della regola.
  - `describe(rule)` → chiave di traduzione e parametri; `buildRule(form)` → il JSON di
    `recurrence` del giro 013 (senza `time`) oppure un errore di validazione (`interval` 2–365,
    almeno un giorno, giorno del mese 1–31); `parseDue(text)` `gg/mm/aaaa` e `parseTime(text)`
    `hh:mm` (date di calendario vere).
- **Modulo «Aggiungi task»** (`TasksSection.tsx`, o un componente `NewTaskForm.tsx` accanto). Il
  fuso arriva come prop `timeZone` da `app/app/family.tsx` (`family.timeZone`), mai dai task: una
  famiglia senza task deve poter creare un `DATETIME`. La chiave di `attemptFor` della creazione
  comprende titolo, `dueKind`, `due` e il JSON di `recurrence` (non solo il titolo): cambiare la
  regola dopo un errore di rete dà ids nuovi; riprovare con gli stessi dati riusa gli stessi.
  sotto il titolo, campi facoltativi «Scadenza (gg/mm/aaaa)» e «Ora (hh:mm, facoltativa)»; gruppo
  «Si ripete» (`role="radiogroup"`, opzioni `role="radio"` con `aria-checked`): «Mai» (predefinita),
  «Ogni giorno», «Ogni N giorni» (+ campo «Ogni quanti giorni»), «Ogni settimana» (+ sette caselle
  `role="checkbox"` «Lunedì» … «Domenica»; `days` sempre in ordine lunedì → domenica, qualunque
  sia l'ordine dei tocchi), «Ogni mese» (+ campo «Giorno del mese»). Ripiego ammesso solo se
  react-native-web non desse i ruoli: `role="button"` con `aria-pressed` (il test accetta i due). Con scadenza:
  `DATE` (`due` = `aaaa-mm-gg`) o, con l'ora, `DATETIME` (`due` = istante UTC da `toInstant` nel
  fuso della famiglia). Ricorrenza senza scadenza → avviso (`role="alert"`) «Un task ciclico ha
  bisogno di una scadenza.» e **nessuna richiesta**. Dati non validi → avviso «Controlla scadenza e
  ricorrenza.», nessuna richiesta. Dopo il 201 il modulo torna vuoto e su «Mai».
- **Task ciclico nella lista** (`TaskSummary.tsx`, quindi anche in «Tutte le mie famiglie»): riga
  «Si ripete: …» e, se `OPEN`, «Prossima: …» da `nextDue(task, new Date())`, formattata come
  `formatDue`.
- **Azioni su un ciclico `OPEN`:** «Segna fatto» (come oggi); «Annulla questa volta» al posto di
  «Annulla task», con la stessa conferma («Conferma annullamento» / «Non annullare») e lo stesso
  `cancel`; «Termina la serie» → conferma «Conferma: termina la serie» / «Non terminare» →
  `POST …/end-series`. Il pulsante si mostra a tutti: decide il server (403 → «Non hai il permesso
  di farlo.»). Un task non ciclico resta identico a oggi (nessun «Termina la serie»).
- **Dopo `done`, `cancel` o `end-series` riusciti su un ciclico**, la schermata ricarica i task
  della famiglia una volta con `onStale` di `app/app/family.tsx` (la risposta non contiene
  l'occorrenza nuova, e `end-series` cambia altre righe): la successiva compare, o diventa
  «Annullato», senza ricaricare la pagina. La ricarica è **attesa dentro `run`**, prima del
  `finally` che libera `inFlight`; e non sostituisce la lista alla cieca: ogni task ricaricato passa
  da `mergeTask`, così vince la `version` più alta (una scrittura arrivata durante una ricarica
  lenta non torna indietro).
- `client.ts`: `Task` con `recurrence` e `seriesId`; `createTask` con `dueKind`, `due`,
  `recurrence` facoltativi; `endSeries(familyId, taskId, {mutationId})`.
- Testi nuovi, chiavi in `it.json` e `en.json`:

| Chiave (indicativa) | Italiano | English |
|---|---|---|
| `task.dueInput` | Scadenza (gg/mm/aaaa) | Due date (dd/mm/yyyy) |
| `task.timeInput` | Ora (hh:mm, facoltativa) | Time (hh:mm, optional) |
| `recurrence.repeats` | Si ripete | Repeats |
| `recurrence.never` / `daily` / `everyN` / `weekly` / `monthly` | Mai / Ogni giorno / Ogni N giorni / Ogni settimana / Ogni mese | Never / Every day / Every N days / Every week / Every month |
| `recurrence.interval` | Ogni quanti giorni | Every how many days |
| `recurrence.dayOfMonth` | Giorno del mese | Day of the month |
| `recurrence.day.MONDAY` … | Lunedì … Domenica | Monday … Sunday |
| riga della regola | Si ripete: ogni giorno · ogni 3 giorni · ogni martedì, venerdì · ogni mese il giorno 31 | Repeats: every day · every 3 days · every Tuesday, Friday · every month on day 31 |
| `recurrence.next` | Prossima: {date} | Next: {date} |
| `task.cancelOnce` | Annulla questa volta | Cancel this time |
| `task.endSeries` / `confirmEndSeries` / `keepSeries` | Termina la serie / Conferma: termina la serie / Non terminare | End the series / Confirm: end the series / Keep the series |
| `recurrence.needsDue` | Un task ciclico ha bisogno di una scadenza. | A recurring task needs a due date. |
| `task.invalid` | Controlla scadenza e ricorrenza. | Check the due date and the repetition. |

Nella riga della regola i giorni in ordine lunedì → domenica: minuscoli in italiano («ogni martedì,
venerdì»), con la maiuscola in inglese («every Tuesday, Friday»).

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro014*AcceptanceTest' test` → verde (casi S1–S5).
- [ ] `cd app && npx playwright test e2e/acceptance/giro-014-*` → verde (casi A1–A10).
- [ ] `cd app && npx jest src/task/__tests__/recurrence.test.ts` → verde, con `now` fisso, almeno:
      DAILY 07/01 → 08/01; EVERY_N_DAYS 3 dal 07/01 chiuso il 12/01 → 13/01 e chiuso l'08/01 →
      10/01; WEEKLY mar+ven 07/01 → 10/01 → 14/01; carta martedì 07/01 chiusa giovedì 09/01 →
      14/01; MONTHLY 31: 31/01/2031 → 28/02/2031 → 31/03 → 30/04, e 31/01/2032 → 29/02/2032;
      `DATETIME` 07:00 Roma 2031-03-29T06:00Z → 2031-03-30T05:00Z e 2031-10-25T05:00Z →
      2031-10-26T06:00Z; New York 2031-03-08T12:00Z → 2031-03-09T11:00Z; buco: `time` 02:30,
      29/03 01:30Z → 2031-03-30T01:30Z → 31/03 00:30Z; sovrapposizione 25/10 02:30 CEST →
      2031-10-26T00:30Z; istante perso: 07:00 del 27/10 chiuso il 29/10 08:00Z → 2031-10-30T06:00Z
      (gli stessi valori dei test del server 013); `toInstant` nel buco e nella sovrapposizione;
      `buildRule` e `parseDue` su valori validi e non validi.
- [ ] Test Jest del costruttore sulla ricarica (logica pura accanto a `mergeTask`, o la schermata):
      ricarica lenta che parte con la `version` 1 di un task + scrittura che nel frattempo ha dato
      la `version` 2 → resta la 2; un task nuovo della ricarica (la successiva) entra nella lista;
      `409 not_recurring` → stato `changed`.
- [ ] `cd server && ./mvnw -B -ntp verify` e `cd app && npm test && npx tsc --noEmit && npx eslint .`
      → verdi; suite Playwright completa verde (i test 010, 011, 013 non cambiano).

### Casi del server (`AcceptanceClock`, inizio lunedì 2031-01-06T08:00Z; Europe/Rome; famiglie e account nuovi per test, come 013)
- **S1 — end-series dopo una riapertura.** Marco (gestore) crea «Portare fuori il cane» DAILY `DATE`
  2031-01-07; `done` → successiva S `OPEN` 01-08; `reopen` della prima; `end-series` sulla prima →
  200: prima `CANCELLED` (`version` 4); S `CANCELLED` con `version` 2; nessuna `OPEN` nella serie;
  il `change_log` della famiglia ha esattamente due righe nuove `UPSERT` (prima e S), dopo le
  precedenti, senza altre righe; un nuovo `done` impossibile (409 `not_open`). Replay dello stesso
  `mutationId` → 200, nulla cambia (nemmeno il `change_log`). Varianti: `end-series` chiamato su S
  annulla anche la prima riaperta; con S spostata da un `PUT` **prima** della prima (2031-01-10
  contro 2031-01-20) la cascata la annulla lo stesso.
- **S2 — P10 con la cascata.** Paolo (membro) crea «Cambiare le lenzuola» WEEKLY sabato, `DATE`
  2031-01-11 (primo sabato), senza assegnatario; Giulia (gestore) la assegna a Luca (un membro non
  può assegnare altri), la segna fatta (successiva 2031-01-18, a Luca, creata da Paolo) e la riapre;
  Luca `end-series` sulla prima e sulla successiva → 403 e **niente cambia** (stati, versioni,
  `change_log`); Paolo → 200, entrambe `CANCELLED`.
- **S3 — concorrenza.** Dopo `done → reopen` della prima: `end-series` (Giulia) sulla prima ∥ `done`
  (Marco) sulla successiva, 10 giri → `end-series` 200, `done` 200 o 409 `not_open`; alla fine
  **nessuna `OPEN` nella serie** (anche la terza nata dal `done`), nessun 500, `change_log` quanto
  le versioni.
- **S4 — `PUT` sposta l'ora.** Giulia crea «Dare la medicina al gatto» DAILY `DATETIME`
  2031-01-07T06:00Z (07:00 Roma), `time` `"07:00"`; `PUT` con 2031-01-07T17:30Z → 200,
  `recurrence.time` `"18:30"`, tipo `DAILY`; `done` → successiva 2031-01-08T17:30Z. Un altro: `PUT`
  da `DATETIME` a `DATE` 2031-01-07 → `recurrence` senza `time`; `done` → successiva `DATE`
  2031-01-08, e la `recurrence` della successiva è **senza `time`**. Un altro: `PUT` da `DATE`
  2031-01-07 a `DATETIME` 2031-01-07T06:00Z → `time` `"07:00"`; `done` → successiva
  2031-01-08T06:00Z. Un `PUT` con `"recurrence":{"type":"WEEKLY","days":["MONDAY"]}` e l'ora
  spostata lascia `DAILY`, senza `days`, con il `time` nuovo (7b del 013 resta vero).
- **S5 — isolamento.** Rosa (Famiglia Babbo) `end-series` sulla prima occorrenza riaperta di una
  serie di Principale, con l'URL di Principale o di Babbo → 404 identico a un id inesistente; le
  due occorrenze restano come sono, il `change_log` di Principale non cambia. Poi Giulia termina la
  serie: la cascata non tocca una serie di Babbo con lo stesso titolo (filtra per `family_id`).

### Casi Playwright (API finta nel browser, `giro-014-fake-api.ts` sullo stile di 011; orologio del browser fisso con `page.clock`; Giulia entra; Principale Europe/Rome, Mamma America/New_York)
Dati del finto: in Principale «Mettere fuori la carta» (creata da Marco, assegnata a Marco, `DATE`
2031-01-07, WEEKLY TUESDAY), «Pagare l'affitto» (creato da Giulia, in coda, `DATE` 2031-01-31,
MONTHLY 31), «Dare la medicina al gatto» (Giulia, `DATETIME` 2031-03-29T06:00Z, DAILY, `time`
07:00), «Annaffiare le piante» (EVERY_N_DAYS 3, `DATE` 2031-01-07), «Comprare il pane» (non
ciclico); «Portare fuori il cane» (creato da Marco, DAILY): occorrenza del 07/01 fatta e riaperta
(`version` 3) e successiva del 08/01, entrambe `OPEN`; in Mamma «Pulire il frigo» (creato da Anna,
Giulia **membro**, WEEKLY mar+ven); «Famiglia Zio» (America/New_York, Giulia gestore) **senza
task**. Il finto calcola la successiva con il suo orologio `now`, fissato allo stesso istante di
`page.clock` (mai l'orologio di Node).
- **A1 — creazione di ogni tipo.** Titolo, «Scadenza» 07/01/2031, «Si ripete» → «Ogni giorno» /
  «Ogni N giorni» con 3 / «Ogni settimana» con Martedì e Venerdì / «Ogni mese» con 31 (scadenza
  31/01/2031) → corpo della `POST` con `dueKind` `DATE`, `due` giusto, `recurrence` esatta senza
  `time` (giorni toccati Venerdì poi Martedì → `["TUESDAY","FRIDAY"]`), `id` e `mutationId`
  UUIDv7; il task compare con la riga «Si ripete: …»; il modulo torna vuoto e su «Mai».
- **A2 — `DATETIME` nel fuso della famiglia.** In Principale 29/03/2031 ora 07:00, «Ogni giorno» →
  `due` `2031-03-29T06:00:00Z`; in Zio (nessun task) 08/03/2031 07:00 → `2031-03-08T12:00:00Z`.
  Dispositivo in Asia/Tokyo.
- **A3 — senza scadenza.** «Ogni giorno» senza scadenza → avviso «Un task ciclico ha bisogno di una
  scadenza.», nessuna `POST`. «Ogni N giorni» con 1 → «Controlla scadenza e ricorrenza.», nessuna
  `POST`. «Mai» con scadenza 31/02/2031 → «Controlla scadenza e ricorrenza.», nessuna `POST`.
- **A4 — «Prossima» con l'orologio.** Orologio a giovedì 2031-01-09T10:00Z: carta «Si ripete: ogni
  martedì» e «Prossima: 14/01/2031»; affitto «Prossima: 28/02/2031»; piante (chiuse il 09/01) →
  «Prossima: 10/01/2031». Orologio a 2031-03-29T05:00Z: gatto «Prossima: 30/03/2031 07:00».
- **A5 — «Segna fatto» sulla carta** (orologio giovedì 09/01) → la carta del 07/01 «Fatto», e senza
  ricaricare la pagina compare una carta `OPEN` con «Scadenza: 14/01/2031», assegnata a Marco.
- **A6 — «Annulla questa volta»** sull'affitto → conferma → «Annullato» e compare l'affitto `OPEN`
  del 28/02/2031, in coda.
- **A7 — «Termina la serie» permesso** (Giulia gestore, carta creata da Marco) → conferma →
  `POST …/end-series` con `mutationId` UUIDv7 → «Annullato», nessuna nuova carta `OPEN`. Con
  riapertura: «Termina la serie» sul cane del 07/01 → anche il cane del 08/01 diventa «Annullato»,
  senza ricaricare la pagina (una sola `POST`, poi la ricarica dei task).
- **A8 — «Termina la serie» vietato** (Mamma, Giulia membro, serie di Anna; il finto risponde 403
  come P10) → «Non hai il permesso di farlo.», il frigo resta `OPEN`. «Non terminare» chiude la
  conferma senza richieste.
- **A9 — non ciclico e inglese.** «Comprare il pane»: «Annulla task», nessun «Termina la serie»,
  nessuna riga «Si ripete». In `en-US`: «Repeats: every Tuesday», «Next: 14/01/2031», «Cancel this
  time», «End the series», gruppo «Repeats», campi «Due date (dd/mm/yyyy)» e «Time (hh:mm,
  optional)».
- **A10 — riprova della creazione.** Prima `POST` persa in rete → «Qualcosa non ha funzionato.
  Riprova.»; «Aggiungi task» di nuovo con gli stessi dati → corpo identico (stessi `id` e
  `mutationId`); cambiata la regola in «Ogni settimana» + Martedì → `id` e `mutationId` nuovi, il
  task compare con «Si ripete: ogni martedì».

## Fuori perimetro
- Cambiare la regola di un ciclico dall'app o dal server (il `PUT` continua a ignorarla): non è
  nel «Fatto quando» di T6; in «Idee per dopo».
- Modifica di titolo e scadenza dall'app (non esiste oggi; non serve a T6).
- Selettore di date nativo o libreria di date: porta a senso unico, non serve (campi di testo).
- Storico delle serie; `task_event`. Nascondere «Prossima» quando nella lista c'è già un'occorrenza
  successiva (facoltativo della critica): in «Idee per dopo».
- Ricorrenza nell'inoltro (T7), voci della lista ciclica (T8), sync e coda offline su Android (T9),
  promemoria delle occorrenze (T10).
- Login su Android (`expo-secure-store`), build e prova dell'APK: verifica-produzione.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica email e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/.../acceptance/Giro014SeriesAcceptanceTest.java` | S1–S5 (contesto Spring suo, orologio solo in avanti, come 013) |
| `app/e2e/acceptance/giro-014-fake-api.ts` | API finta con ricorrenze: crea la successiva su `done`/`cancel`, `end-series` con P10 |
| `app/e2e/acceptance/giro-014-recurrence.spec.ts` | A1–A10 |

Il test Jest di `recurrence.ts` lo scrive il costruttore (il modulo non esiste: un test che lo
importa non compilerebbe); i suoi casi minimi sono nel «Fatto quando».

## Porte
- Doppio senso previste: cascata di `end-series` sulle successive `OPEN`; `PUT` che riscrive
  `time`; formato `gg/mm/aaaa` e `hh:mm` nei campi; «Prossima» calcolata nel client (il server resta
  la fonte: il client mostra, non decide); ricarica dopo `done`/`cancel` di un ciclico; pulsante
  «Termina la serie» visibile a tutti con 403 dal server; mappa `not_recurring` → `changed`.
- Senso unico: nessuna. Nessuna dipendenza (niente date picker, niente libreria di fusi: `Intl`),
  nessuna migrazione, nessun percorso protetto (`app/package.json` e `server/pom.xml` non si
  toccano).

## Rischi di concorrenza
- `end-series` con cascata ∥ `done` su una successiva: entrambi prendono prima il lock della
  famiglia, quindi si serializzano; se vince il `done`, la terza occorrenza nata è `OPEN` della
  serie e la cascata la annulla; invariante «nessuna `OPEN` nella serie» (S3).
- Replay di `end-series`: esce prima della cascata, nessuna seconda `version+1` (S1).
- Doppio tocco su «Segna fatto», «Annulla questa volta», «Termina la serie»: un'azione alla volta
  (`inFlight`) e stesso `mutationId` sul riprova (`attemptFor`), come 011.
- Ricarica dopo `done`/`cancel`/`end-series`: attesa dentro `run` (nessuna scrittura parte durante
  la ricarica di questa schermata); la lista ricaricata passa da `mergeTask`, vince la `version`
  più alta (test Jest del costruttore con ricarica lenta).

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`, traduzioni comprese) ≤ 550; file ≤ 10;
una sessione. Il grosso è `recurrence.ts` (~180) e il modulo (~150).

## Domande per il ricercatore (al massimo 3)
1. react-native-web ~0.21 (Expo SDK 58): `role="radiogroup"`, `role="radio"`/`"checkbox"` con
   `aria-checked` su `Pressable` danno i ruoli ARIA giusti nel DOM (`getByRole('radio', {name})`
   in Playwright) e su Android (TalkBack)? Documentazione ufficiale React Native e react-native-web.
2. Hermes (Expo SDK 58) e `Intl.DateTimeFormat` con `timeZone`: supporto ufficiale; algoritmo
   documentato per convertire ora locale + fuso in istante UTC senza librerie, con buco e
   sovrapposizione come `java.time.ZonedDateTime.of` (Javadoc Java 25).
3. Google Calendar, Todoist, Promemoria di Apple (documentazione o guide ufficiali): come chiamano e
   confermano «annulla solo questa» e «termina la ripetizione»? Solo per i testi dei pulsanti.

## Critica ricevuta e cosa cambia
| Punto | Esito | Motivo |
|---|---|---|
| 1. chiave di `attemptFor` della creazione | accolto | titolo + `dueKind` + `due` + JSON di `recurrence`; caso A10 |
| 2. ricarica dopo «Termina la serie», A7 con riapertura | accolto | con `onStale` di `family.tsx`; dati del finto con il cane riaperto |
| 3. cascata per `due_at` maggiore fragile dopo un `PUT` | accolto (a) | annulla tutte le `OPEN` di `family_id`+`series_id`: più semplice e regge il `PUT`; S1 con le due varianti |
| 4. fuso nel modulo | accolto | prop `timeZone` da `family.tsx`; A2 in «Famiglia Zio» senza task |
| Concorrenza della ricarica | accolto | attesa dentro `run`, unione con `mergeTask`; test Jest del costruttore (la logica non esiste: un test di accettazione che la importa non compilerebbe) |
| S2 Paolo non può assegnare Luca | accolto | Paolo crea senza assegnatario, Giulia assegna; primo sabato 2031-01-11 |
| S1 `change_log` senza buchi | accolto, adattato | `seq` è un'identity globale: si controlla che il registro **della famiglia** abbia esattamente le due righe nuove, dopo le precedenti; non la contiguità dei numeri (un rollback altrove la rompe) |
| S4 senza `time` esplicito, `PUT` da `DATE` a `DATETIME` | accolto | |
| A1 ordine dei giorni | accolto | tocchi Venerdì poi Martedì |
| A6 orologio del finto | accolto | `FakeApi.now`, uguale a `page.clock` |
| Nascondere «Prossima» se c'è già la successiva | scartato | facoltativo, non nel «Fatto quando» di T6; in «Idee per dopo» |
| Maiuscole in inglese | accolto | «every Tuesday, Friday» |
| Ripiego `button`+`aria-pressed` | accolto | il test accetta `radio`/`checkbox` oppure `button`; `radiogroup` resta obbligatorio |

## Idee per dopo
- Cambiare la regola di una serie (dalla prossima occorrenza in poi), con un endpoint dedicato e P10.
- Occorrenza successiva con id deterministico (da `series_id` + data) per crearla offline (T9).
- Restituire l'occorrenza successiva nella risposta di `done`/`cancel`, invece di ricaricare.
- Nascondere «Prossima» quando nella lista c'è già un'occorrenza successiva della stessa serie.
