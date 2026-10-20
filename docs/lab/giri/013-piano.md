---
giro: 013
traguardo: T6
traguardi_extra: []
tipo: costruzione
fase: costruzione
inizio: 2026-10-20T20:30:19Z
ricerca: sì
accettazione: 09392f6
ripreso: no
---
# Piano del giro 013 — T6 parte 1: ricorrenze sul server, «Termina la serie» (P10), carta demo; scroll di `/family`

## Fetta e traguardo
T6, parte 1, tipo `costruzione` (T6 è `da-fare`, nessun rapporto di T6, nessuna integrazione).
Il traguardo intero (server + client + interfaccia) non sta comodo in una sessione: questa fetta fa
**tutta la parte server** del «Fatto quando» di T6, più la correzione del difetto **012:maggiore**
(`app/app/family.tsx` senza scroll: «Aggiungi task» irraggiungibile con molti task), che è piccola e
blocca un utente vero.

**Cosa resta per la parte 2 (giro successivo):** modulo `app/src/task/recurrence.ts` con test Jest a
orologio finto (stessi casi del server, ora legale compresa); nell'app web la scelta della
ricorrenza alla creazione, la ricorrenza mostrata sul task, i pulsanti «Annulla questa volta» e
«Termina la serie»; Playwright su queste azioni. Poi `verifica-produzione` di T6.

Fonti: SPEC §2.2.5, §5 (P10), §6 (`task.recurrence`, `series_id`), §7, App. A; `012-rapporto.md`;
codice: `server/.../task/TaskService.java`, `TaskController.java`, `TaskRepository.java`,
`demo/DemoDataSeeder.java`, `V2__tasks.sql`, `app/app/family.tsx`.

**Schema:** `task.recurrence jsonb` e `task.series_id uuid` esistono già in V2. **Nessuna
migrazione** in questo giro (critica: V3 tagliata): la regola «ciclico ⇒ scadenza» la tiene il
servizio, la ricerca per serie usa l'indice per famiglia già presente.

## Cosa si costruisce

### Server (package `task`; il calcolo in una classe pura `Recurrence`, senza Spring)
**Formato di `recurrence`** (JSON nel corpo e nella risposta; `null` o assente = non ciclico):

| Tipo | JSON | Validazione |
|---|---|---|
| ogni giorno | `{"type":"DAILY"}` | — |
| ogni N giorni | `{"type":"EVERY_N_DAYS","interval":3}` | `interval` intero 2–365 |
| settimanale | `{"type":"WEEKLY","days":["TUESDAY","FRIDAY"]}` | 1–7 giorni `java.time.DayOfWeek`, senza doppioni |
| mensile | `{"type":"MONTHLY","dayOfMonth":31}` | intero 1–31 |

Il servizio riceve `recurrence` come albero JSON (`JsonNode`), non come record tipato: così un tipo
ignoto, `days` stringa, `interval` stringa, chiavi in più (anche di un altro tipo), `{}`, una stringa
o un array danno tutti `recurrence_invalid`, e non un 400 generico di Jackson. Si salva la **forma
canonica** (solo le chiavi del tipo, in ordine fisso). Per `DATETIME` il server aggiunge
`"time":"HH:mm"`, l'ora locale della prima scadenza nel fuso della famiglia, **salvata una volta**:
le occorrenze successive usano quella, non la scadenza precedente (dopo il buco di marzo l'ora
torna quella giusta). La risposta riporta la forma salvata (`time` compreso). Il client non manda
`time` (chiave in più → `recurrence_invalid`).

Errori 400: ricorrenza malformata → `recurrence_invalid`; ricorrenza senza scadenza →
`recurrence_needs_due` (alla creazione e in `PUT` che toglie la scadenza a un task ciclico).

Commento della classe `Recurrence`: il mensile fa **clamp a fine mese** (31 → 28/29/30), scelta di
prodotto diversa da RFC 5545 (`BYMONTHDAY=31` salta i mesi corti).

**Endpoint** (stesso schema delle scritture dei giri 008/011: lock famiglia → lock task → 404 →
400 → replay → 403 → 409 → `version+1`, `change_log`, `applied_mutation`):

| Endpoint | Cambia | Effetto |
|---|---|---|
| `POST /api/families/{f}/tasks` | corpo + `recurrence` | task ciclico: `series_id = id` del task |
| `PUT /api/families/{f}/tasks/{t}` | invariato: `recurrence` nel corpo è **ignorata** | rifiuta `recurrence_needs_due` se toglie la scadenza a un ciclico; non cambia mai la regola (parte 2) |
| `POST …/{t}/done` | — | se ciclico: crea l'occorrenza successiva |
| `POST …/{t}/cancel` («Annulla questa volta») | — | se ciclico: crea l'occorrenza successiva |
| **nuovo** `POST …/{t}/end-series` | `{mutationId}` | `status=CANCELLED`, nessuna occorrenza; P10: gestore sì, membro solo se `created_by` della serie è lui (403 altrimenti); task non ciclico → 409 `not_recurring`; non `OPEN` → 409 `not_open` |

**Occorrenza successiva** (stessa transazione della transizione):
- nuovo task: id UUIDv7 del server, stessa `family_id`, `series_id`, `title`, `notes`,
  `criticality`, `due_kind`, `reminder_offset_minutes`, `template`, `recurrence`, **`created_by`
  della serie** (serve a P10), **stesso assegnatario o coda**; `status=OPEN`, `version=1`, riga
  `change_log` `UPSERT`.
- scadenza = prima data della regola **dopo** il giorno della scadenza precedente, nel fuso della
  famiglia; per `DATETIME` stessa ora locale (le 07:00 restano 07:00 a Roma prima e dopo il cambio).
  Ora locale inesistente (salto di marzo) → `ZonedDateTime.of` la sposta avanti (ricerca:
  confermato, Javadoc). Mensile: giorno della **regola**, non della scadenza precedente (31 gen → 28 feb →
  31 mar → 30 apr).
- periodi persi: `DATE` → finché il giorno trovato è < oggi nel fuso della famiglia, si va al
  successivo (oggi vale); `DATETIME` → finché l'istante è ≤ `clock.instant()`, si va al successivo.
- replay dello stesso `mutationId` → nessuna seconda occorrenza.
- **una sola successiva per serie:** sotto il lock della famiglia, la successiva si crea solo se
  nella serie non esiste già un'occorrenza con `due_at` maggiore di quella chiusa. Così
  `done → reopen → done` non ne crea una seconda (una sola `OPEN` successiva, `version=1`, una sola
  riga `UPSERT`). `reopen` non tocca la successiva già creata.
- ora locale `DATETIME`: data della regola + `time` salvato, `ZonedDateTime.of` (buco: avanti di
  un'ora, solo quel giorno) e `withEarlierOffsetAtOverlap()` (ottobre: la prima delle due 02:30).
- `View` aggiunge `recurrence` (oggetto o `null`) e `seriesId` (additivi).

**Dati demo:** «Mettere fuori la carta», Famiglia Principale, creato da Marco, assegnato a Marco,
`DATE`, `{"type":"WEEKLY","days":["TUESDAY"]}`, scadenza = primo martedì ≥ oggi (fuso della
famiglia). Seminato una volta per titolo, come gli altri task demo (giro 010).

### App: solo il difetto 012:maggiore
`app/app/family.tsx`: il contenuto sotto `FamilySwitch` in una `ScrollView` (o la lista task in un
contenitore che scorre) con altezza limitata (`flex: 1`), così «Aggiungi task» si raggiunge con 10+
task a 1280x720. Nessun cambiamento ad altri testi o controlli.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro013*AcceptanceTest' test` → verde (casi sotto).
- [ ] Test unitari di `Recurrence` (JUnit, senza Spring) per ogni tipo, il 31 a febbraio
      (2031 e 2032 bisestile) e ad aprile, i due cambi d'ora 2031 a `Europe/Rome`, e `DATETIME`
      02:30: 29/03 → 30/03 alle 03:30 CEST → **31/03 di nuovo alle 02:30**.
- [ ] `cd app && npx playwright test e2e/acceptance/giro-013-*` → verde (scroll).
- [ ] `cd server && ./mvnw -B -ntp verify` e `cd app && npm test && npx tsc --noEmit && npx eslint .`
      → verdi; il test di isolamento parametrico trova `end-series`.

Casi di accettazione del server (`AcceptanceClock`, inizio lunedì 2031-01-06T08:00Z; Europe/Rome
salvo dove detto; ora legale 2031: 30 marzo e 26 ottobre). Ogni classe 013 ha un **contesto
Spring suo** (una proprietà in più nel `@SpringBootTest`), quindi un orologio suo; i test girano in
ordine (`@Order`) e spostano l'orologio solo avanti (`AcceptanceClock.setTo`, che rifiuta il
passato). La classe della carta demo ha anche un **PostgreSQL suo** (scrive dati demo).
1. **DAILY**, `DATE` 2031-01-07, fatto il 7 → nuova `OPEN` 2031-01-08, stessa `seriesId`.
2. **EVERY_N_DAYS** 3, `DATE` 2031-01-07, fatto con l'orologio al 2031-01-12 → 2031-01-13
   (01-10 è perso, saltato); fatto al 2031-01-08 → 01-10.
3. **WEEKLY** martedì+venerdì, `DATE` martedì 2031-01-07 → venerdì 01-10 → martedì 01-14.
4. **MONTHLY** 31: `DATE` 2031-01-31 → 2031-02-28 → 2031-03-31 → 2031-04-30.
5. **Ora legale:** `DATETIME` 2031-03-29T06:00Z (07:00 a Roma), DAILY, fatto → 2031-03-30T05:00Z
   (07:00 CEST); idem a ottobre: 2031-10-25T05:00Z → 2031-10-26T06:00Z. «Famiglia Zio» in
   `America/New_York`: 2031-03-08T12:00Z DAILY → **2031-03-09T11:00Z**, `time` = `"07:00"`;
   2031-11-01T11:00Z → 2031-11-02T12:00Z. Buco: 02:30 del 29/03 (01:30Z) → 2031-03-30T01:30Z
   (03:30 CEST) → 2031-03-31T00:30Z (02:30). Sovrapposizione: 02:30 CEST del 25/10 →
   2031-10-26T00:30Z. Istanti persi: 07:00 del 27/10, fatto il 29/10 alle 08:00 → 30/10 06:00Z.
6. **«Annulla questa volta»** (`cancel`) su un ciclico → `CANCELLED` + nuova `OPEN` successiva.
7. **P10:** Giulia (gestore) termina una serie creata da Marco → 200, nessuna `OPEN` nella serie;
   Paolo (membro) termina la serie creata da lui **dalla seconda occorrenza** (`created_by`
   copiato) → 200; Luca (membro) su una serie creata da Paolo e **assegnata a Luca** → 403 sulla
   prima e sulla seconda occorrenza, niente cambia. `end-series` su un non ciclico → 409
   `not_recurring`; su un `DONE` → 409 `not_open`.
7b. **PUT non aggira P10:** Luca (assegnato) fa `PUT` con `"recurrence":null` → 200, il titolo
   cambia, la regola resta `DAILY`; Giulia con una regola `WEEKLY` → la regola resta `DAILY`;
   `done` crea ancora la successiva.
8. **Ciclico senza scadenza** → 400 `recurrence_needs_due`, nessun task creato; `PUT` che toglie la
   scadenza → 400; ricorrenze malformate (`interval` 1, 366, `"3"` o assente; `days` vuoto,
   stringa, doppio, `MARTEDI`; `dayOfMonth` 0 o 32; tipo ignoto; `DAILY` con `interval`; `{}`;
   `"DAILY"`; `[]`) → 400 `recurrence_invalid`, nessun task. Forma canonica: `{"days":[…],
   "type":"WEEKLY"}` → salvata con le sole chiavi `type` e `days`; `"recurrence":null` → task non
   ciclico con `recurrence` e `seriesId` `null` nella risposta.
9. **Assegnatario:** assegnato a Leo → successiva a Leo; in coda → successiva in coda.
10. **Idempotenza e concorrenza:** `done` ripetuto con lo stesso `mutationId` → una sola
    successiva; due `done` paralleli (gestori diversi) → un 200, un 409 `not_open`, una sola
    successiva; `end-series` in parallelo a `done` (10 giri) → mai due 200: o `CANCELLED` senza
    successiva, o `DONE` con una successiva. `end-series` ripetuto → 200 replay, `version` 2.
    `done → reopen → done` → una sola successiva (vedi sopra).
11. **Isolamento:** Rosa (Babbo) su `end-series` di un task di Principale, con l'id nell'URL di
    Principale o di Babbo → 404, corpo identico a un id inesistente; Giulia (in Principale e in
    Mamma) con l'URL di Principale su un task di Mamma → 404 identico a un id inesistente, task
    intatto; `recurrence` in un `create` verso una famiglia altrui → 404, nessun task.
12. **Carta demo:** Marco vede «Mettere fuori la carta» con scadenza martedì 2031-01-07, WEEKLY
    TUESDAY, assegnata a lui; orologio a giovedì 2031-01-09, fatto → nuova `OPEN` martedì
    2031-01-14, assegnata a Marco.

Caso Playwright: API finta di `giro-011-fake-api.ts` più 12 task aperti in Principale (20 in
tutto), viewport 1280x720, `/family?id=<Principale>` → «Aggiungi task» non è in vista; con la
rotella del mouse (`mouse.wheel`) il campo del titolo e il pulsante entrano in vista
(`toBeInViewport`), il campo si riempie, il pulsante si abilita. In `it-IT` e `en-US`.

## Dati demo dei test (inventati)
Nomi dell'Appendice A, ma famiglie e account **nuovi per ogni test** (giri 008/011), tranne il caso
12 che legge la carta demo seminata all'avvio.
- «Famiglia Principale» di test (Europe/Rome): Giulia e Marco gestori; Paolo e Luca membri; Leo
  risorsa senza account, referente Giulia.
- «Famiglia Zio» (America/New_York): Davide gestore.
- «Famiglia Babbo» di test: Rosa gestore.
- Task ciclici: «Portare fuori il cane» (DAILY), «Annaffiare le piante» (ogni 3 giorni), «Pulire
  il frigo» (martedì e venerdì), «Pagare l'affitto» (mensile, 31), «Dare la medicina al gatto»
  (DATETIME 07:00, DAILY), «Cambiare le lenzuola» (P10), «Preparare lo zaino» (assegnato a Leo).

## Fuori perimetro
- Tutta l'interfaccia delle ricorrenze e i test Jest/Playwright del client (parte 2).
- Riapertura di un'occorrenza fatta: non cancella né sposta la successiva già creata.
- Modifica della regola che riallinea occorrenze già create; storico delle serie; `task_event`.
- Inoltro di un ciclico (T7), voci della lista ciclica (T8), sync/offline (T9), promemoria (T10).
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista;
  accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero; sync in tempo
  reale e offline sul web; dati reali.
- Login su Android (`expo-secure-store`): porta a senso unico, non in questo giro.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/.../acceptance/Giro013AcceptanceSupport.java` | famiglia Principale di test, `createRecurring`, `endSeries`, `nextOf` |
| `server/.../acceptance/Giro013RecurrenceAcceptanceTest.java` | casi 1–6, 9, `done→reopen→done`, buco e sovrapposizione (12 test) |
| `server/.../acceptance/Giro013EndSeriesAcceptanceTest.java` | casi 7, 7b, 8, 10, 11 (15 test) |
| `server/.../acceptance/Giro013DemoPaperAcceptanceTest.java` | caso 12, DB suo |
| `app/e2e/acceptance/giro-013-family-scroll.spec.ts` | scroll di `/family` (2 test) |
| `AcceptanceClock.java` | `setTo(Instant)`, solo in avanti |
| `Giro010DemoTasksAcceptanceTest.java` | tolta «Mettere fuori la carta» dalla lista dei task che non esistono ancora |

Stato al commit `09392f6`: server 28 test, 27 rossi per asserzione, 1 verde
(`case11ARecurringTaskIsNotCreatedInAFamilyOfOthers`: l'isolamento della creazione esiste già dal
giro 008; resta come guardia). Playwright 2 rossi per asserzione (`toBeInViewport`, rapporto 0).
In locale: Docker Hub ha dato 429, immagine presa da `mirror.gcr.io`; Chromium 1194 di
`/opt/pw-browsers` (il download della 1248 è bloccato dal proxy).

## Porte
- Doppio senso previste: forma JSON di `recurrence` (con `time` per `DATETIME`); endpoint
  `end-series`; codici d'errore nuovi; `created_by` copiato nelle occorrenze; `PUT` che ignora la
  regola. Nessuna migrazione.
- Senso unico: nessuna (nessuna dipendenza nuova; schema solo in aggiunta).

## Rischi di concorrenza
- Due `done`/`cancel` paralleli sullo stesso ciclico: il lock del task (`lockTask`) serializza; il
  secondo vede `DONE` → 409; una sola successiva (caso 10).
- Replay del `mutationId` dopo la creazione della successiva: il replay esce prima della transizione,
  non ricrea nulla (caso 10).
- `end-series` in parallelo a `done`: chi arriva secondo trova lo stato non `OPEN` → 409; se vince
  `done`, la successiva esiste e la serie si termina su quella (test a 10 giri).
- `done → reopen → done`: il controllo «esiste già un'occorrenza con `due_at` maggiore» sta sotto il
  lock della famiglia, quindi due chiusure della stessa occorrenza non creano due successive.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`) ≤ 450; file ≤ 10; una sessione.

## Domande per il ricercatore (al massimo 3)
1. `java.time`: `ZonedDateTime.of(LocalDate, LocalTime, ZoneId)` nel buco (salto di marzo) e nella
   sovrapposizione (ottobre) a `Europe/Rome` e `America/New_York`: cosa fa, e conviene
   `withEarlierOffsetAtOverlap`? Fonte: Javadoc ufficiale Java 25.
2. React Native Web (versione di `app/package.json`): una `ScrollView` dentro uno `Stack` di
   expo-router scorre sul web solo con altezza limitata? Come lo dice la documentazione ufficiale
   di React Native / react-native-web.
3. RFC 5545 (`BYMONTHDAY`) e app note (Google Calendar, Todoist): come trattano «ogni mese il 31»
   nei mesi corti e i completamenti in ritardo? Solo per confermare che SPEC §2.2.5 non ha sorprese.

## Critica ricevuta e cosa cambia
Accolti tutti e 5 i «DA CORREGGERE», più semplice, concorrenza e test:
1. **Orologio condiviso:** accolto. Ogni classe 013 ha un contesto suo (proprietà
   `planforhome.acceptance.context`), test in ordine, `setTo` solo in avanti. In parte diverso dal
   modello: Recurrence ed EndSeries usano il PostgreSQL del giro 003 (creano solo famiglie nuove; un
   secondo `@ServiceConnection` nella stessa gerarchia darebbe due `JdbcConnectionDetails`); la carta
   demo, che scrive dati demo, ha un DB suo come `Giro010DemoTasksSeedAcceptanceTest`.
2. **Giro010 diventa rosso:** accolto, la carta tolta dalla lista nello stesso commit `test(acceptance)`.
3. **`done→reopen→done`:** accolto, regola «una sola successiva per serie» e test.
4. **Deriva dopo il buco:** accolto, `time` salvato una volta nel JSON; test di accettazione e test
   unitario nel «Fatto quando».
5. **`PUT` e ricorrenza:** accolto, `PUT` non tocca mai la regola (parte 2); test con Luca (7b).
- Più semplice: V3 tagliata. Concorrenza: test `end-series` ∥ `done`. Test: casi 5 (New York
  concreto), 7 (seconda occorrenza), 8 (`JsonNode`, forma canonica), 11 (URL incrociato) come
  richiesto; Playwright con `mouse.wheel` e `toBeInViewport`; commento RFC 5545 in `Recurrence`.
- Scartato: nulla.

## Idee per dopo
- Occorrenza successiva con id deterministico (da `series_id` + data) per creare offline (T9).
- Mostrare nell'app «prossima: martedì 14» dopo aver segnato fatto un ciclico.
