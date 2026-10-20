---
giro: 013
traguardo: T6
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-20T20:30:19Z
ricerca: sì
accettazione:
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

**Schema:** `task.recurrence jsonb` e `task.series_id uuid` esistono già in V2. Facoltativa una
migrazione **additiva** `V3__recurrence.sql` (indice su `series_id`; `check (recurrence is null or
due_at is not null)`): in produzione non ci sono task ciclici, il vincolo non rompe righe esistenti.

## Cosa si costruisce

### Server (package `task`; il calcolo in una classe pura `Recurrence`, senza Spring)
**Formato di `recurrence`** (JSON nel corpo e nella risposta; `null` o assente = non ciclico):

| Tipo | JSON | Validazione |
|---|---|---|
| ogni giorno | `{"type":"DAILY"}` | — |
| ogni N giorni | `{"type":"EVERY_N_DAYS","interval":3}` | `interval` intero 2–365 |
| settimanale | `{"type":"WEEKLY","days":["TUESDAY","FRIDAY"]}` | 1–7 giorni `java.time.DayOfWeek`, senza doppioni |
| mensile | `{"type":"MONTHLY","dayOfMonth":31}` | intero 1–31 |

Errori 400: ricorrenza malformata → `recurrence_invalid`; ricorrenza senza scadenza →
`recurrence_needs_due` (alla creazione e in `PUT` che toglie la scadenza a un task ciclico).

**Endpoint** (stesso schema delle scritture dei giri 008/011: lock famiglia → lock task → 404 →
400 → replay → 403 → 409 → `version+1`, `change_log`, `applied_mutation`):

| Endpoint | Cambia | Effetto |
|---|---|---|
| `POST /api/families/{f}/tasks` | corpo + `recurrence` | task ciclico: `series_id = id` del task |
| `PUT /api/families/{f}/tasks/{t}` | corpo + `recurrence` (assente = invariata) | rifiuta `recurrence_needs_due`; cambia la regola dell'occorrenza aperta |
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
  Ora locale inesistente (salto di marzo) → `ZonedDateTime.of` la sposta avanti (da verificare dal
  ricercatore). Mensile: giorno della **regola**, non della scadenza precedente (31 gen → 28 feb →
  31 mar → 30 apr).
- periodi persi: `DATE` → finché il giorno trovato è < oggi nel fuso della famiglia, si va al
  successivo (oggi vale); `DATETIME` → finché l'istante è ≤ `clock.instant()`, si va al successivo.
- replay dello stesso `mutationId` → nessuna seconda occorrenza.
- `reopen` di un'occorrenza fatta non tocca la successiva già creata (vedi Fuori perimetro).
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
      (2031 e 2032 bisestile) e ad aprile, e i due cambi d'ora 2031 a `Europe/Rome`.
- [ ] `cd app && npx playwright test e2e/acceptance/giro-013-*` → verde (scroll).
- [ ] `cd server && ./mvnw -B -ntp verify` e `cd app && npm test && npx tsc --noEmit && npx eslint .`
      → verdi; il test di isolamento parametrico trova `end-series`.

Casi di accettazione del server (`AcceptanceClock`, inizio lunedì 2031-01-06T08:00Z; Europe/Rome
salvo dove detto; ora legale 2031: 30 marzo e 26 ottobre):
1. **DAILY**, `DATE` 2031-01-07, fatto il 7 → nuova `OPEN` 2031-01-08, stessa `seriesId`.
2. **EVERY_N_DAYS** 3, `DATE` 2031-01-07, fatto con l'orologio al 2031-01-12 → 2031-01-13
   (01-10 è perso, saltato); fatto al 2031-01-08 → 01-10.
3. **WEEKLY** martedì+venerdì, `DATE` martedì 2031-01-07 → venerdì 01-10 → martedì 01-14.
4. **MONTHLY** 31: `DATE` 2031-01-31 → 2031-02-28 → 2031-03-31 → 2031-04-30.
5. **Ora legale:** `DATETIME` 2031-03-29T06:00Z (07:00 a Roma), DAILY, fatto → 2031-03-30T05:00Z
   (07:00 CEST); idem a ottobre: 2031-10-25T05:00Z → 2031-10-26T06:00Z. Una famiglia in
   `America/New_York` (cambio 9 marzo 2031) per il fuso della famiglia, non del server.
6. **«Annulla questa volta»** (`cancel`) su un ciclico → `CANCELLED` + nuova `OPEN` successiva.
7. **P10:** Giulia (gestore) termina una serie creata da Marco → 200, nessuna `OPEN` nella serie;
   Paolo (membro) termina la serie creata da lui → 200; Luca (membro) su una serie creata da
   Paolo e **assegnata a Luca** → 403, niente cambia.
8. **Ciclico senza scadenza** → 400 `recurrence_needs_due`, nessun task creato; `PUT` che toglie la
   scadenza → 400; ricorrenze malformate (`interval` 1, `days` vuoto, `dayOfMonth` 32, tipo
   ignoto) → 400 `recurrence_invalid`.
9. **Assegnatario:** assegnato a Leo → successiva a Leo; in coda → successiva in coda.
10. **Idempotenza e concorrenza:** `done` ripetuto con lo stesso `mutationId` → una sola
    successiva; due `done` paralleli (gestori diversi) → un 200, un 409 `not_open`, una sola
    successiva. `end-series` ripetuto → 200 replay.
11. **Isolamento:** Rosa (Babbo) su `end-series` di un task di Principale, con l'id nell'URL → 404;
    `recurrence` in un `create` verso una famiglia altrui → 404, nessun task.
12. **Carta demo:** Marco vede «Mettere fuori la carta» con scadenza martedì 2031-01-07, WEEKLY
    TUESDAY, assegnata a lui; orologio a giovedì 2031-01-09, fatto → nuova `OPEN` martedì
    2031-01-14, assegnata a Marco.

Caso Playwright: API finta (come `giro-011-fake-api.ts`) con 12 task in Principale, viewport
1280x720, `/family?id=<Principale>` → il pulsante «Aggiungi task» si porta in vista e si clicca, il
campo del titolo compare.

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
| `server/.../acceptance/Giro013RecurrenceAcceptanceTest.java` | casi 1–6, 9 |
| `server/.../acceptance/Giro013EndSeriesAcceptanceTest.java` | casi 7, 8, 10, 11 |
| `server/.../acceptance/Giro013DemoPaperAcceptanceTest.java` | caso 12 |
| `app/e2e/acceptance/giro-013-family-scroll.spec.ts` | scroll di `/family` |

## Porte
- Doppio senso previste: forma JSON di `recurrence`; endpoint `end-series`; codici d'errore nuovi;
  migrazione additiva V3 (solo indice e `check`); `created_by` copiato nelle occorrenze.
- Senso unico: nessuna (nessuna dipendenza nuova; schema solo in aggiunta).

## Rischi di concorrenza
- Due `done`/`cancel` paralleli sullo stesso ciclico: il lock del task (`lockTask`) serializza; il
  secondo vede `DONE` → 409; una sola successiva (caso 10).
- Replay del `mutationId` dopo la creazione della successiva: il replay esce prima della transizione,
  non ricrea nulla (caso 10).
- `end-series` in parallelo a `done`: chi arriva secondo trova lo stato non `OPEN` → 409; se vince
  `done`, la successiva esiste e la serie si termina su quella.

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
(dopo il critico)

## Idee per dopo
- Occorrenza successiva con id deterministico (da `series_id` + data) per creare offline (T9).
- Mostrare nell'app «prossima: martedì 14» dopo aver segnato fatto un ciclico.
