---
giro: 011
traguardo: T5
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-20T18:28:59Z
ricerca: sì
accettazione:
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
| `POST /api/families/{f}/tasks/{t}/done` | `{mutationId}` | `status=DONE`, `completed_by=chiamante` | P7: gestore qualunque task, anche in coda; membro solo se assegnatario è lui o una risorsa senza account di cui è referente | `OPEN`, altrimenti 409 `not_open` |
| `POST /api/families/{f}/tasks/{t}/reopen` | `{mutationId}` | `status=OPEN`, `completed_by=null`; l'assegnatario resta | P8: gestore sì; membro solo se `completed_by` è lui | `DONE`, altrimenti 409 `not_done` |
| `PUT /api/families/{f}/tasks/{t}` | `{mutationId, title, notes, dueKind, due, criticality}` | sostituisce i campi (stesse regole e stessi errori 400 della creazione; `null` = nessuna scadenza / nessuna nota / `NORMAL`) | P9: gestore sì; membro solo i propri task (creati da lui o assegnati a lui) | `OPEN`, altrimenti 409 `not_open` |
| `POST /api/families/{f}/tasks/{t}/cancel` | `{mutationId}` | `status=CANCELLED` | P9, come sopra | `OPEN`, altrimenti 409 `not_open` |

- Op di `applied_mutation`: `task.done`, `task.reopen`, `task.update`, `task.cancel`. Replay: stessa
  persona, famiglia, task e op → 200 con lo stato attuale; altrimenti 409 `mutation_conflict`.
- Un task annullato **non** si riapre (SPEC §2.2.3: si riapre solo un task fatto).
- Coerenza con P3–P6: `PUT …/assignee` e `POST …/take` su un task non `OPEN` → 409 `not_open`
  (oggi passerebbero; un task fatto in coda non deve mostrare «Prendo io»).
- La risposta `View` aggiunge `completedBy` (campo nuovo, additivo).
- Il test di isolamento parametrico (giri 003/006/008) percorre da solo i nuovi endpoint: il
  costruttore controlla che li trovi e che ogni nuovo endpoint con `{f}` di un'altra famiglia o
  `{t}` di un'altra famiglia dia 404 senza effetti.

### App (web; compila anche per Android)
- `app/src/api/client.ts`: `completeTask`, `reopenTask`, `cancelTask` (stessa forma di `takeTask`,
  `WriteOutcome`); `Task.completedBy`. Il modulo «modifica» dell'app **non** si fa (vedi Fuori
  perimetro): l'endpoint `PUT` si prova solo dall'API.
- `TasksSection` (schermata della famiglia), dentro ogni `listitem`:
  - task `OPEN`: pulsante «Segna fatto» / «Mark done»; pulsante «Annulla task» / «Cancel task», che
    chiede conferma con un secondo pulsante «Conferma annullamento» / «Confirm cancellation» e
    «Non annullare» / «Keep task»;
  - task `DONE`: testo «Fatto» / «Done» e pulsante «Riapri» / «Reopen»; niente «Prendo io» né
    assegnazione;
  - task `CANCELLED`: testo «Annullato» / «Cancelled», nessun pulsante.
  - Pulsanti mostrati a tutti (decide il server): 403 → «Non hai il permesso per questa azione.»
    (chiave già esistente se c'è, altrimenti nuova); 409 `not_open`/`not_done` → «Il task è
    cambiato. Ricarico.» e ricarica dell'elenco; 404 → stesso comportamento del giro 010.
  - Stessa regola di `id`/`mutationId` del giro 010: stesso tentativo → stesso `mutationId`.
- `/tasks` («Tutte le mie famiglie»): gruppo di pulsanti filtro, `role="button"` con
  `aria-pressed`, uno solo premuto, nel gruppo con etichetta «Filtro» / «Filter»:
  - «Tutti» / «All» (predefinito): tutti i task, con il loro stato;
  - «Assegnati a me» / «Assigned to me»: `OPEN` e assegnatario = la persona connessa;
  - «In coda» / «In queue»: `OPEN` e senza assegnatario;
  - «In scadenza» / «Due soon»: `OPEN`, con scadenza, e giorno di scadenza (nel fuso della famiglia
    del task) ≤ oggi + 7 giorni nel fuso della famiglia; compresi gli scaduti.
  - Filtro vuoto: «Nessun task con questo filtro.» / «No tasks match this filter.».
  - Logica dei filtri in `app/src/task/filters.ts` (funzione pura, orologio iniettato), con Jest.
- Chiavi di traduzione nuove in `it.json` ed `en.json`.

## Dati demo dei test (inventati)
Appendice A con gli id del giro 007/010. In più, solo nei test server:
- **Nina**, risorsa senza account nella Famiglia Mamma, referente **Luca** (membro): serve al caso
  «membro referente» di P7. La aggiunge Anna (gestore) con l'API di T4.
- Task: «Comprare il pane» (Mamma, creato da Paolo, assegnato a Paolo); «Portare Nina in piscina»
  (Mamma, assegnato a Nina); «Pagare la bolletta della luce» (Mamma, in coda, creato da Anna);
  «Annaffiare le piante» (Mamma, creato da Davide, assegnato a Davide).
- Per i filtri (Playwright, API finta): orologio del browser fissato a `2026-11-02T10:00:00Z`;
  «Prenotare il pranzo di Natale» (Mamma, in coda, scadenza 2026-12-20), «Preparare lo zaino»
  (Principale, Leo, scadenza 2026-11-04), «Comprare il regalo per Sofia» (Principale, assegnato a
  Giulia, scadenza 2026-11-05), «Riordinare la cantina» (Principale, assegnato a Giulia, fatto).

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro011*AcceptanceTest' test` → verde, con almeno:
  - P7 permesso: Anna (gestore) segna fatto «Pagare la bolletta della luce» in coda → 200,
    `status=DONE`, `completedBy=Anna`, `version` +1, una riga `change_log` in più;
    Paolo segna fatto «Comprare il pane» → 200; Luca segna fatto «Portare Nina in piscina» → 200.
  - P7 vietato: Luca segna fatto «Comprare il pane» (di Paolo) → 403, nessun effetto; Paolo segna
    fatto «Pagare la bolletta della luce» (in coda) → 403.
  - P8 permesso: Paolo riapre il pane che ha segnato lui → 200, `OPEN`, `completedBy=null`,
    assegnatario Paolo; Anna (gestore) riapre un task segnato fatto da Luca → 200.
  - P8 vietato: Davide riapre il pane segnato fatto da Paolo → 403; riaprire un task `OPEN` → 409
    `not_done`; riaprire un task annullato → 409 `not_done`.
  - P9 permesso: Davide modifica «Annaffiare le piante» (titolo, criticità `HIGH`, scadenza `DATE`)
    → 200 con i campi nuovi; Anna (gestore) annulla un task di Paolo → 200 `CANCELLED`.
  - P9 vietato: Luca modifica o annulla «Annaffiare le piante» → 403, nessun effetto; modifica di un
    task `DONE` → 409 `not_open`; titolo vuoto → 400 `title_invalid`.
  - Idempotenza: ogni nuovo endpoint ripetuto con lo stesso `mutationId` → 200, stessa `version`,
    nessuna nuova riga `change_log`; stesso `mutationId` su un'altra op o un altro task → 409
    `mutation_conflict`.
  - Concorrenza: due «Segna fatto» in parallelo (mutationId diversi) → uno 200, l'altro 409
    `not_open`; `version` +1 una volta sola.
  - `take` e `assign` su un task `DONE` → 409 `not_open`.
  - Isolamento: Rosa (Famiglia Babbo) su ogni nuovo endpoint con un task Mamma, sia con `{f}` di
    Mamma sia con `{f}` di Babbo e `{t}` di Mamma → 404, nessun effetto.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (compreso il test di isolamento parametrico,
  che ora include i nuovi endpoint).
- [ ] `cd app && npx playwright test e2e/acceptance/giro-011-*` → verde, con almeno:
  - Giulia, nella Famiglia Principale, preme «Segna fatto» su «Preparare lo zaino»: il task mostra
    «Fatto» e il pulsante «Riapri»; «Riapri» lo riporta aperto con «Segna fatto».
  - «Annulla task» chiede conferma; «Non annullare» non manda nulla; «Conferma annullamento»
    manda la richiesta e il task mostra «Annullato» senza pulsanti.
  - 403 sul «Segna fatto» → «Non hai il permesso per questa azione.», il task resta aperto.
  - 409 `not_open` → «Il task è cambiato. Ricarico.» e un nuovo `GET …/tasks`.
  - Doppio clic su «Segna fatto» con risposta lenta → una sola richiesta.
  - `/tasks` di Giulia: «Tutti» premuto all'inizio; «Assegnati a me» → solo «Comprare il regalo per
    Sofia»; «In coda» → solo «Prenotare il pranzo di Natale»; «In scadenza» → «Preparare lo zaino»
    e «Comprare il regalo per Sofia», non il pranzo di Natale né il task fatto; un filtro senza
    risultati mostra «Nessun task con questo filtro.»; stesse prove in inglese sulle etichette.
  - Nessun task della Famiglia Babbo in nessun filtro.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi (Jest su `filters.ts`, con
  scadenza a cavallo del cambio dell'ora legale del 2026-10-25 in `Europe/Rome`).
- [ ] `cd app && npx playwright test` → verde (i test del giro 010 restano verdi).
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Fuori perimetro
- Il modulo di **modifica** del task nell'app (titolo, note, scadenza, criticità): l'API `PUT` c'è
  e si prova, l'interfaccia viene dopo (non è nel «Fatto quando» di T5).
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
| File | Dato … quando … allora … |
|---|---|
| `server/.../acceptance/Giro011DoneReopenAcceptanceTest.java` | P7 e P8 permesso e vietato, stati sbagliati, idempotenza, «Segna fatto» concorrente, take/assign su `DONE` |
| `server/.../acceptance/Giro011EditCancelAcceptanceTest.java` | P9 modifica e annullamento, permesso e vietato, 400 sul corpo, 409 su non `OPEN`, idempotenza |
| `server/.../acceptance/Giro011TaskIsolationAcceptanceTest.java` | Rosa (Babbo) sui nuovi endpoint con task Mamma → 404 senza effetti |
| `app/e2e/acceptance/giro-011-task-actions.spec.ts` | pulsanti fatto/riapri/annulla con conferma, 403, 409, doppio clic |
| `app/e2e/acceptance/giro-011-filters.spec.ts` | i quattro filtri di `/tasks` in italiano e in inglese, filtro vuoto, niente Babbo |

## Porte
- Doppio senso previste: forma degli endpoint (`/done`, `/reopen`, `/cancel`, `PUT` sul task) e
  codici `not_open`/`not_done`; `PUT` come sostituzione completa (`null` = vuoto); annullato non
  riapribile; `take`/`assign` rifiutati su task non aperti; «in scadenza» = entro 7 giorni,
  scaduti compresi, nel fuso della famiglia; «Assegnati a me» senza le risorse di cui si è
  referente; filtri sul client; pulsanti mostrati a tutti; conferma solo per l'annullamento;
  campo additivo `completedBy`; testi e chiavi di traduzione.
- Senso unico: nessuna. Nessuna dipendenza nuova, nessuna migrazione, nessun campo tolto o
  rinominato nell'API.

## Rischi di concorrenza
- **Due «Segna fatto» insieme:** lock sul task (come `take`); il secondo trova `DONE` → 409
  `not_open`. Prova: test server in parallelo con `version` controllata.
- **Fatto e annulla insieme:** stesso lock; il secondo → 409 `not_open`. Coperto dallo stesso schema.
- **Riapri mentre un altro riassegna:** l'`assign` su `DONE` è rifiutato (409); dopo la riapertura
  passa. Prova: test `assign` su `DONE`.
- **Replay dopo risposta persa:** stesso `mutationId` → 200 con lo stato attuale, nessuna riga
  `change_log` in più. Prova: test idempotenza per ogni endpoint.
- **`mutationId` riusato su un'altra op:** 409 `mutation_conflict`. Prova: test.
- **Client:** doppio clic → pulsante disattivato durante l'invio, stesso `mutationId` alla
  riprova; risposta fuori ordine → `mergeTask` per `version` (giro 010). Prova: Playwright doppio
  clic.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`) ≤ 600 (server circa 230, app circa
370); file di produzione ≤ 10; nessuna migrazione. Una sessione.

## Domande per il ricercatore (al massimo 3)
1. react-native-web 0.21: `Pressable` con `role="button"` e `aria-pressed` produce un
   `aria-pressed` nel DOM che Playwright legge con `getByRole('button', { pressed: true })`? E il
   modo raccomandato per un gruppo con etichetta (`role="group"` + `aria-label`) su un `View`.
2. Playwright `page.clock` (`setFixedTime`/`install`) con Expo web: influenza `Date.now()` e
   `Intl.DateTimeFormat` così che «oggi» nel fuso di una famiglia sia prevedibile? Limiti noti.
3. Spring Boot 4 / Spring MVC: `@PutMapping` con un corpo record in cui i campi assenti diventano
   `null` (Jackson 3): c'è un modo ufficiale per rifiutare campi sconosciuti o un corpo vuoto senza
   dipendenze nuove?

## Idee per dopo
- «Assegnati a me» che comprende le risorse di cui si è referente (Leo per Giulia).
- Modulo di modifica del task nell'app.
- Ordinamento della vista per scadenza.

## Critica ricevuta e cosa cambia
(dopo il critico)
