---
giro: 011
traguardo: T5
traguardi_extra: []
tipo: costruzione
fase: revisione
inizio: 2026-10-20T18:28:59Z
ricerca: sì
accettazione: 0e436c2
ripreso: no
---
# Piano del giro 011 — T5 parte 3: fatto, riapri, modifica e annulla (P7–P9), filtri della vista

## Fetta e traguardo
T5, parte 3, tipo `costruzione` (tabella di /giro §1: T5 non è `passato`, il rapporto 010 non dice
«Fatto quando verde, da verificare in produzione», T5 non ha integrazioni → `costruzione`).
Chiude ciò che manca al «Fatto quando» di T5: **P7, P8, P9 sul server** con un caso permesso e uno
vietato ciascuno, idempotenti e con `change_log`; nell'app web **i pulsanti «Segna fatto»,
«Riapri», «Annulla task»** e **i filtri della vista «tutte le mie famiglie»** (SPEC §2.2.2).
Dopo questo giro T5 va in `verifica-produzione`.

Fonti: SPEC §2.2.2, §2.2.3, §5 (P7–P9), §6 (`task.status`, `completed_by`), §7, App. A;
`010-piano.md`, `010-rapporto.md`; codice: `server/.../task/TaskService.java`,
`TaskController.java`, `TaskRepository.java`, `V2__tasks.sql`, `app/src/task/`,
`app/app/tasks.tsx`, `app/e2e/acceptance/giro-010-tasks.spec.ts`.

**Nessuna migrazione:** `task.status` (`OPEN`/`DONE`/`CANCELLED`) e `completed_by` esistono già in V2.

## Cosa si costruisce

### Server (package `task`, logica in `TaskService`, controller sottile)
Stesso schema delle scritture del giro 008: lock famiglia → lock task → controlli in ordine
(appartenenza 404, task 404, corpo 400, replay, permesso 403, stato 409) → `version + 1`,
`updated_at`, riga `change_log` (`UPSERT`) e `applied_mutation`, nella stessa transazione.

| Endpoint | Corpo | Effetto | Permesso (SPEC §5) | Stato richiesto |
|---|---|---|---|---|
| `POST /api/families/{f}/tasks/{t}/done` | `{mutationId}` | `status=DONE`, `completed_by=chiamante` | P7: gestore qualunque task, anche in coda; membro solo se l'assegnatario è lui o una risorsa senza account di cui è referente (un task in coda, anche creato da lui, no) | `OPEN`, altrimenti 409 `not_open` |
| `POST /api/families/{f}/tasks/{t}/reopen` | `{mutationId}` | `status=OPEN`, `completed_by=null`; l'assegnatario resta | P8: gestore sì; membro solo se `completed_by` è lui (l'assegnatario no, se l'ha segnato fatto un altro) | `DONE`, altrimenti 409 `not_done` |
| `PUT /api/families/{f}/tasks/{t}` | `{mutationId, title, notes, dueKind, due, criticality}` | sostituisce i campi (stesse regole e stessi errori 400 della creazione; assente o `null` = nessuna scadenza / nessuna nota / `NORMAL`) | P9: gestore sì; membro solo i propri task (creati da lui **o** assegnati a lui) | `OPEN`, altrimenti 409 `not_open` |
| `POST /api/families/{f}/tasks/{t}/cancel` | `{mutationId}` | `status=CANCELLED` | P9, come sopra | `OPEN`, altrimenti 409 `not_open` |

- Ordine del corpo: `mutationId` prima (assente o non UUID → 400 `invalid_request`, quindi `{}` →
  `invalid_request`), poi `title` (`title_invalid`), `notes`, `criticality`, scadenza.
- Op di `applied_mutation`: `task.done`, `task.reopen`, `task.update`, `task.cancel`. Replay: stessa
  persona, famiglia, task e op → 200 con lo **stato attuale** (anche se nel frattempo è cambiato:
  assunzione da scrivere nel rapporto); altrimenti 409 `mutation_conflict`.
- Un task annullato **non** si riapre (SPEC §2.2.3: si riapre solo un task fatto).
- Coerenza con P3–P6: `PUT …/assignee` e `POST …/take` su un task non `OPEN` → 409 `not_open`.
  In `take` il controllo di stato va **prima** della scorciatoia «già mio → 200»
  (`TaskService.take`): un task fatto e assegnato al chiamante dà 409, non 200.
- La risposta `View` aggiunge `completedBy` (campo nuovo, additivo).
- **Più semplice:** un metodo privato `transition(caller, familyId, taskId, mutationId, op, from,
  error, permission, to)` in `TaskService` per done, reopen e cancel; un solo `setStatus(taskId,
  status, completedBy, now)` in `TaskRepository`.
- Il test di isolamento parametrico (giri 003/006/008) percorre da solo i nuovi endpoint: il
  costruttore controlla che li trovi.

### App (web; compila anche per Android)
- `app/src/api/client.ts`: `completeTask`, `reopenTask`, `cancelTask` (stessa forma di `takeTask`,
  `WriteOutcome`); `Task.completedBy`; `me()` con `personId` se non c'è già. Il modulo «modifica»
  dell'app **non** si fa (vedi Fuori perimetro): l'endpoint `PUT` si prova solo dall'API.
- `TasksSection` (schermata della famiglia), dentro ogni `listitem`:
  - task `OPEN`: pulsante «Segna fatto» / «Mark done»; pulsante «Annulla task» / «Cancel task», che
    chiede conferma con «Conferma annullamento» / «Confirm cancellation» e «Non annullare» /
    «Keep task» (nessuna richiesta finché non si conferma);
  - task `DONE`: testo a sé «Fatto» / «Done» e pulsante «Riapri» / «Reopen»; nessun altro
    pulsante (niente «Prendo io», «Assegna», «Annulla task»);
  - task `CANCELLED`: testo a sé «Annullato» / «Cancelled», nessun pulsante.
  - Pulsanti mostrati a tutti (decide il server): 403 → avviso `role="alert"` con la chiave già
    esistente `task.forbidden` («Non hai il permesso di farlo.» / «You're not allowed to do
    that.»); 409 `not_open`/`not_done` → «Il task è cambiato. Ricarico.» / «The task has changed.
    Reloading.» e un nuovo `GET …/tasks`; errore di rete → «Qualcosa non ha funzionato. Riprova.»
    (esistente); 404 → come nel giro 010.
  - Stessa regola di `mutationId` del giro 010: stesso tentativo dopo un errore di rete → stesso
    `mutationId`; pulsante disattivato durante l'invio (doppio clic = una richiesta).
- `/tasks` («Tutte le mie famiglie»): carica anche `/api/me` per il `personId`; gruppo `View
  role="group"` con etichetta «Filtro» / «Filter»; dentro, quattro `Pressable role="button"` con
  `aria-pressed`, uno solo premuto:
  - «Tutti» / «All» (predefinito): tutti i task, con il loro stato;
  - «Assegnati a me» / «Assigned to me»: `OPEN` e assegnatario = la persona connessa;
  - «In coda» / «In queue»: `OPEN` e senza assegnatario;
  - «In scadenza» / «Due soon»: `OPEN`, con scadenza, e giorno di scadenza nel fuso della famiglia
    del task ≤ oggi nel fuso della famiglia + 7 giorni; compresi gli scaduti. Una scadenza `DATE`
    è già un giorno; una `DATETIME` si porta al giorno nel fuso della famiglia.
  - Filtro vuoto: «Nessun task con questo filtro.» / «No tasks match this filter.».
  - Logica in `app/src/task/filters.ts` (funzione pura, `now` iniettato), con Jest (vedi sotto).
- `aria-pressed` su react-native-web 0.21.4: verificato nel sorgente installato
  (`createDOMProps` copia `aria-pressed` nel DOM); niente ripiego su `accessibilityState`.
- Chiavi di traduzione nuove in `it.json` ed `en.json`.

## Dati demo dei test (inventati)
**Server:** nomi dell'Appendice A, ma account e famiglie **nuovi a ogni test** (come il giro 008):
le famiglie demo non si scrivono mai (sono condivise da tutte le classi del contesto).
- «Famiglia Mamma» (Europe/Rome): Anna gestore; Paolo, Luca, Davide membri; **Nina**, risorsa
  senza account, referente Luca.
- Task: «Comprare il pane» (creato da Paolo, assegnato a Paolo); «Portare Nina in piscina» (creato
  da Anna, assegnato a Nina); «Pagare la bolletta della luce» (Anna, in coda); «Annaffiare le
  piante» (Davide, assegnato a Davide); «Comprare il latte» (Davide, in coda).
- Isolamento: Giulia fonda la sua «Famiglia Principale» (gestore) ed entra in Mamma come membro;
  Rosa fonda la sua «Famiglia Babbo».

**App (API finta, `app/e2e/acceptance/giro-011-fake-api.ts`):** id del giro 007; Principale in
Europe/Rome, Mamma in **America/New_York**; browser in Asia/Tokyo; nei filtri orologio fisso a
`2026-11-02T10:00:00Z` (oggi = 2 novembre a Roma e a New York; limite «In scadenza» = 9 novembre).

| Task | Famiglia | Stato, assegnatario | Scadenza | Filtri |
|---|---|---|---|---|
| Preparare lo zaino | Principale | aperto, Leo | DATE 2026-11-04 | Tutti, In scadenza |
| Comprare il regalo per Sofia | Principale | aperto, Giulia | DATE 2026-11-05 | Tutti, Assegnati a me, In scadenza |
| Riordinare la cantina | Principale | fatto (da Giulia), Giulia | DATE 2026-11-03 | Tutti |
| Spostare il divano | Principale | annullato, in coda | DATE 2026-11-03 | Tutti |
| Pagare la mensa | Principale | aperto, in coda | DATE 2026-11-06 | Tutti, In coda, In scadenza |
| Ritirare le foto | Principale | aperto, Marco | DATE 2026-11-09 (7 giorni esatti) | Tutti, In scadenza |
| Restituire i libri | Principale | aperto, Marco | DATE 2026-10-30 (scaduto) | Tutti, In scadenza |
| Rinnovare l'abbonamento del bus | Principale | aperto, Marco | DATE 2026-11-10 (8 giorni) | Tutti |
| Prenotare il pranzo di Natale | Mamma | aperto, in coda | DATE 2026-12-20 | Tutti, In coda |
| Comprare i regali | Mamma | aperto, Giulia | DATETIME 2026-11-10T03:00Z (9/11 22:00 a New York, già 10/11 a Roma e Tokyo) | Tutti, Assegnati a me, In scadenza |
| Rinnovare la carta d'identità di Franco | Babbo | aperto, in coda | DATE 2026-11-04 | mai (Giulia non è in Babbo) |

Luca (solo Mamma) vede il pranzo e i regali; «Assegnati a me» per lui è vuoto.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro011*AcceptanceTest' test` → verde (32 test), con almeno:
  - P7 permesso: Anna (gestore) segna fatto la bolletta in coda → 200, `DONE`, `completedBy=Anna`,
    `version` 2, 2 righe `change_log`; Paolo segna fatto il pane → 200; Luca segna fatto la
    piscina di Nina → 200.
  - P7 vietato (403, nessun effetto): Luca sul pane di Paolo; Davide (non referente) sulla
    piscina; Paolo sulla bolletta in coda; Davide sul latte in coda creato da lui.
  - P8 permesso: Paolo riapre il pane segnato da lui → 200, `OPEN`, `completedBy=null`,
    assegnatario Paolo; Luca riapre la piscina (fatta da lui, non assegnata a lui) → 200; Anna
    riapre la piscina fatta da Luca → 200.
  - P8 vietato: Davide riapre il pane fatto da Paolo → 403; Anna segna fatto il pane, Paolo
    (assegnatario) prova a riaprirlo → 403; riaprire un task `OPEN` o `CANCELLED` → 409 `not_done`.
  - Stato: segnare fatto un task `DONE` o `CANCELLED` → 409 `not_open`.
  - P9 permesso: Davide modifica le piante (titolo, note, `DATE`, `HIGH`) → 200; Davide modifica il
    latte creato da lui e assegnato a Luca da Anna → 200; Luca modifica la bolletta creata da Anna e
    assegnata a lui (`DATETIME`) → 200; Anna modifica il pane di Paolo → 200; `PUT` con il solo
    titolo azzera note e scadenza e porta la criticità a `NORMAL`; Anna annulla il pane → 200
    `CANCELLED`; Davide annulla le piante → 200.
  - P9 vietato: Luca modifica o annulla le piante o la bolletta in coda → 403, nessun effetto;
    modifica o annullamento di un task `DONE` o `CANCELLED` → 409 `not_open`.
  - Corpo: titolo vuoto o assente → 400 `title_invalid`; `{}` o senza `mutationId` → 400
    `invalid_request`; criticità `URGENT` → `criticality_invalid`; `DATE` 2026-13-01 →
    `due_invalid`; nessun effetto.
  - Idempotenza: done, reopen, PUT e cancel ripetuti con lo stesso `mutationId` → 200, stessa
    `version`, nessuna riga in più in `change_log` né in `applied_mutation`; replay tardivo di un
    «done» dopo la riapertura → 200 con lo stato attuale (`OPEN`), nulla si riapplica; stesso
    `mutationId` su un'altra op, un altro task o da un'altra persona → 409 `mutation_conflict`.
  - Concorrenza (10 giri): due «Segna fatto» insieme → 200 e 409 `not_open`, `version` 2;
    «Segna fatto» e «Annulla» insieme → 200 e 409 `not_open`.
  - `take` su un task `DONE` in coda e su un `DONE` già del chiamante → 409 `not_open`; `assign` di
    un gestore su `DONE` e su `CANCELLED` → 409 `not_open`.
  - Isolamento: Giulia (gestore in Principale, membro in Mamma) su done, reopen, PUT, cancel con
    `{f}`=Principale e `{t}`=task di Mamma (aperto e fatto) → 404 con corpo identico a un task
    inesistente; Rosa (Babbo) con `{f}` di Mamma e con `{f}` di Babbo → 404 identico; `version`,
    `change_log` e `applied_mutation` invariati.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (compreso il test parametrico del giro 003, che
  ora include i nuovi endpoint).
- [ ] `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-011-*`
  → verde (28 test), con almeno, in italiano e in inglese:
  - ogni task mostra il suo stato: aperto con «Segna fatto» e «Annulla task»; fatto con «Fatto» e
    solo «Riapri»; annullato con «Annullato» e nessun pulsante;
  - «Segna fatto» su «Preparare lo zaino» → «Fatto» e «Riapri», corpo `{mutationId}` UUIDv7 con
    CSRF; «Riapri» → di nuovo «Segna fatto», `mutationId` nuovo;
  - «Annulla task» chiede conferma; «Non annullare» non manda nulla; «Conferma annullamento»
    manda una richiesta e il task mostra «Annullato» senza pulsanti;
  - 403 → «Non hai il permesso di farlo.», il task resta aperto;
  - 409 `not_open` e 409 `not_done` → «Il task è cambiato. Ricarico.» e un secondo `GET …/tasks`;
  - doppio clic su «Segna fatto» lento → una sola richiesta (contata sull'API finta);
  - errore di rete e nuovo clic → stesso corpo, stesso `mutationId`;
  - `/tasks`: «Tutti» premuto all'inizio (10 task); «Assegnati a me» → regalo per Sofia e regali;
    «In coda» → mensa e pranzo; «In scadenza» → zaino, regalo per Sofia, mensa, foto, libri,
    regali; ritorno a «Tutti»; un solo pulsante con `aria-pressed=true`; Luca con «Assegnati a
    me» → «Nessun task con questo filtro.» e un solo `GET /api/tasks`.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi. Jest su `filters.ts` scritto
  dal costruttore, con almeno: orologio `2026-11-02T23:30:00Z` (a Roma è già il 3, a New York
  ancora il 2: una `DATE` 2026-11-10 è «in scadenza» in una famiglia di Roma e non in una di New
  York); scadenze `DATE` e `DATETIME`; una scadenza a cavallo del cambio dell'ora legale del
  2026-10-25 in `Europe/Rome`.
- [ ] `cd app && npx playwright test` → verde (i test del giro 010 restano verdi).
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Fuori perimetro
- Il modulo di **modifica** del task nell'app (titolo, note, scadenza, criticità): l'API `PUT` c'è
  e si prova, l'interfaccia viene dopo (non è nel «Fatto quando» di T5).
- Controllo di `version` sul `PUT` (modifica concorrente: l'ultima vince): rinviato a T9
  (DECISIONI n. 38).
- Ricorrenze, «annulla questa volta», «termina la serie» (T6, P10); inoltro (T7); lista della spesa
  (T8); conflitti per `version` letta dal client e sync (T9); promemoria e solleciti (T10);
  `task_event` (non c'è ancora la tabella: niente migrazione in questo giro).
- Login su Android (`expo-secure-store`, porta a senso unico).
- Scroll dell'elenco lungo e difetto 010 (id e `mutationId` dopo cambio famiglia).
- Filtri lato server (query string): i filtri sono sul client, sui dati di `GET /api/tasks`.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; email (verifica e recupero password);
  sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Commit `0e436c2`. Tutti rossi per asserzione (server: 401 sugli endpoint che non esistono, 200
atteso; app: controllo non trovato).

| File | Dato … quando … allora … |
|---|---|
| `server/.../acceptance/Giro011AcceptanceSupport.java` | famiglia Mamma nuova a ogni test, chiamate dei nuovi endpoint, `assertState` (stato, `version`, `change_log`, `applied_mutation`) |
| `server/.../acceptance/Giro011DoneReopenAcceptanceTest.java` (18) | P7 e P8 permesso e vietato, stati sbagliati, idempotenza e replay tardivo, `mutation_conflict`, concorrenza, take/assign su non `OPEN` |
| `server/.../acceptance/Giro011EditCancelAcceptanceTest.java` (12) | P9 modifica e annullamento, permesso e vietato, sostituzione completa, 400 sul corpo, 409 su non `OPEN`, idempotenza |
| `server/.../acceptance/Giro011TaskIsolationAcceptanceTest.java` (2) | Giulia in due famiglie e Rosa: 404 identico al task inesistente, nessun effetto |
| `app/e2e/acceptance/giro-011-fake-api.ts` | API finta condivisa (non è un test) |
| `app/e2e/acceptance/giro-011-task-actions.spec.ts` (16) | stati, fatto/riapri, annulla con conferma, 403, 409 ×2, doppio clic, riprova dopo errore di rete |
| `app/e2e/acceptance/giro-011-filters.spec.ts` (12) | i quattro filtri con `aria-pressed`, ritorno a «Tutti», filtro vuoto |

## Porte
- Doppio senso previste: forma degli endpoint (`/done`, `/reopen`, `/cancel`, `PUT` sul task) e
  codici `not_open`/`not_done`; `PUT` come sostituzione completa (assente o `null` = vuoto);
  **`PUT` senza controllo di `version`: l'ultima modifica vince, rinvio a T9** (DECISIONI n. 38);
  replay dopo un cambio di stato = 200 con lo stato attuale (assunzione, nel rapporto);
  annullato non riapribile; `take`/`assign` rifiutati su task non aperti; «in scadenza» = entro 7
  giorni, scaduti compresi, nel fuso della famiglia; «Assegnati a me» senza le risorse di cui si è
  referente; filtri sul client; pulsanti mostrati a tutti; conferma solo per l'annullamento;
  campo additivo `completedBy`; testi e chiavi di traduzione.
- Senso unico: nessuna. Nessuna dipendenza nuova, nessuna migrazione, nessun campo tolto o
  rinominato nell'API.

## Rischi di concorrenza
- **Due «Segna fatto» insieme:** lock sul task (come `take`); il secondo trova `DONE` → 409
  `not_open`. Prova: `twoMarkDoneTogetherAndOnlyOneApplies`, 10 giri.
- **Fatto e annulla insieme:** stesso lock; il secondo → 409 `not_open`. Prova:
  `doneAndCancelTogetherAndOnlyOneApplies`, 10 giri.
- **Riapri mentre un altro riassegna:** l'`assign` su `DONE` è rifiutato (409); dopo la riapertura
  passa. Prova: `aManagerDoesNotAssignATaskThatIsNotOpen`.
- **Due `PUT` insieme:** nessun controllo di `version`, l'ultima vince (rinvio a T9, n. 38).
- **Replay dopo risposta persa:** stesso `mutationId` → 200 con lo stato attuale, nessuna riga
  in più. Replay tardivo dopo un cambio di stato: 200 con lo stato attuale, non riapplica.
- **`mutationId` riusato su un'altra op, un altro task, un'altra persona:** 409
  `mutation_conflict`.
- **Client:** doppio clic → pulsante disattivato durante l'invio; riprova dopo errore di rete con
  lo stesso `mutationId`; risposta fuori ordine → `mergeTask` per `version` (giro 010).

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`) ≤ 600 (server circa 230, app circa
370); file di produzione ≤ 11 (più `/api/me` in `tasks.tsx` e `filters.ts`); nessuna migrazione.
Una sessione.

## Domande per il ricercatore (al massimo 3)
1. react-native-web 0.21: `aria-pressed` nel DOM e gruppo con etichetta. → Chiusa: il sorgente
   installato (0.21.4, `createDOMProps`) copia `aria-pressed`; `role="group"` passa come ruolo.
2. Playwright `page.clock` e `Intl`. → I test usano `setFixedTime`; il fuso si calcola con
   `Intl.DateTimeFormat` e `timeZone` esplicito, mai quello del browser (Tokyo nei test).
3. Spring Boot 4 / Jackson 3 e corpo vuoto. → Nessuna fonte; validazione esplicita in
   `TaskService`, provata dai test 400. [DA VERIFICARE] nel rapporto.

## Idee per dopo
- «Assegnati a me» che comprende le risorse di cui si è referente (Leo per Giulia).
- Modulo di modifica del task nell'app.
- Ordinamento della vista per scadenza.
- `requeue` (uscita da una famiglia) su task `DONE`/`CANCELLED`: oggi toglie l'assegnatario anche
  ai task chiusi; decidere se lasciarli com'erano.
- «Annulla» temporaneo dopo «Segna fatto» (ricerca).
- Controllo di `version` sul `PUT` (T9).

## Critica ricevuta e cosa cambia
Accolti 14 punti su 15 (uno spostato altrove, nessuno respinto).

| Punto della critica | Esito | Dove |
|---|---|---|
| DA CORREGGERE 1: P7/P8/P9 che separano le regole | accolto | P7: latte in coda creato da Davide → 403, Davide non referente → 403; P8: Luca riapre la piscina, Paolo non riapre il pane fatto da Anna; P9: creato da lui e assegnato ad altri, assegnato a lui e creato da altri |
| DA CORREGGERE 2: Giulia in due famiglie | accolto | `aTaskOfMammaThroughTheUrlOfPrincipaleIsNotFound`, su task aperto e fatto, corpo identico al task inesistente |
| DA CORREGGERE 3: take/assign su DONE | accolto | take su DONE in coda e DONE del chiamante (controllo prima della scorciatoia); assign del gestore su DONE e CANCELLED |
| DA CORREGGERE 4: «Assegnati a me» e `/api/me` | accolto | `/tasks` carica `/api/me`; l'API finta dà il `personId`; budget file 11 |
| DA CORREGGERE 5: casi di «In scadenza» | accolto | mensa in coda (dentro), bus a 8 giorni (fuori), foto a 7 giorni esatti (dentro), libri scaduti (dentro); più regali `DATETIME` a New York |
| PIÙ SEMPLICE: `transition(...)` e un `setStatus` | accolto | sezione Server |
| PIÙ SEMPLICE: togliere «nessun task di Babbo» da Playwright | accolto | tolto; il filtro è sul client sopra `GET /api/tasks`, il cui isolamento è già provato dai giri 008/010 |
| CONCORRENZA: `PUT` senza version | accolto | Porte, Fuori perimetro, DECISIONI n. 38 |
| CONCORRENZA: replay dopo cambio di stato | accolto | assunzione esplicita; in più un test (replay tardivo di «done» dopo la riapertura) |
| TEST: Jest su `filters.ts` (23:30Z, fuso diverso, DATE e DATETIME) | spostato | i test Jest li scrive il costruttore (il modulo non esiste ancora); elencati nel «Fatto quando» |
| TEST: idempotenza su `applied_mutation`, `mutationId` di un'altra persona | accolto | `assertState` conta `applied_mutation`; Anna con il `mutationId` di Paolo/Davide → `mutation_conflict` |
| TEST: `PUT` `{}`, senza `mutationId`, criticità assente → NORMAL | accolto | `aBadBodyIsRefusedWithoutEffects`, `thePutReplacesTheWholeTask` |
| TEST: doppio clic contato sull'API finta | accolto | `api.calls(...)` = 1 dopo 1 s |
| FACOLTATIVO: budget file 10–11; `requeue` su DONE nelle idee | accolto | Budget, Idee per dopo |
| FACOLTATIVO: `aria-pressed` RNW 0.21 | accolto | chiuso leggendo il sorgente installato, non con un test a parte |

Altre scelte di questa fase: account e famiglie nuovi a ogni test server (le famiglie demo restano
in sola lettura, come dal giro 006); testo del 403 = chiave esistente `task.forbidden`; testo
inglese del 409 deciso qui («The task has changed. Reloading.»); aggiunti due test app oltre al
piano (riprova con lo stesso `mutationId`, 409 `not_done` su «Riapri»).
