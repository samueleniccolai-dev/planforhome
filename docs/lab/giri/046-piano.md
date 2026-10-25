---
giro: 046
traguardo: T13
traguardi_extra: []
tipo: costruzione
fase: costruzione
inizio: 2026-10-25T09:11:47Z
ricerca: sì
accettazione: e0c0660
ripreso: no
---
# Piano del giro 046 — T13 lista dei task (parte 1: kit della lista e vista «tutte le mie famiglie»)

## Fetta e traguardo
T13 (UI-2), parte 1 di 2, tipo `costruzione`: T12 è passato (giro 045) e T13 è il prossimo
traguardo, senza integrazioni. T13 intero non sta in una sessione: `TasksSection` (≈ 400 righe,
nove azioni, coda offline Android, `NewTaskForm`, `ForwardDialog`) è legato a sei file di
accettazione vecchi (010, 011, 013, 014, 016, 031). Questa fetta fa il kit della lista e la
schermata `tasks.tsx`; la parte 2 rifà `TasksSection` sullo stesso kit.
Fonti: SPEC §2.2.2, §2.2.3, §2.2.4, §5 (P5, P7, P8), §12; DESIGN §2 (V1–V10), §4, §5, §6.1,
§6.2, §6.4, §7; PIANO-UI §4 (UI-2) e §5.

Cosa si costruisce:
- **Kit** in `app/src/ui/` (solo token, `role` e `aria-*` piatte come in T12):
  - `PersonBadge`: cerchio di `size.avatar` con le **iniziali** (prime lettere di al massimo due
    parole del nome; il cerchio è `aria-hidden`) su `color.person[i]`, più il testo visibile in
    `type.meta`. La tinta viene da una funzione pura `personTint(personId)`: FNV-1a dell'id,
    modulo 8, stabile senza campi nuovi. Il colore delle iniziali, bianco o nero, lo sceglie
    `onPersonTint(i)` col contrasto WCAG più alto (≥ 4.5:1 per tutte e 8, provato in Jest).
  - `FamilyTag`: testo neutro su `color.tagBg`, testo `textSecondary`.
  - `CriticalityBadge`: solo per `HIGH`, testo «Alta»/«High» bianco su `color.danger`.
  - `SectionHeader`: `type.section`, `role="heading"`, `aria-level={2}`.
  - `FilterTabs`: `role="tablist"` con `aria-label`, ogni opzione `role="tab"` con
    `aria-selected`, target ≥ 48 dp, spazio ≥ 8 (DESIGN §5). Opzioni: «Tutti · Assegnati a me ·
    In coda · In scadenza» (resta «Tutti», che c'è da giro 011).
  - `EmptyState`: titolo `bodyStrong`, una riga `meta`, azione facoltativa (`Button primary`).
  - `TaskCard` (DESIGN §6.1): checkbox (`role="checkbox"`, `aria-checked`, nome «Fatto:
    {titolo}», segno di `size.checkbox` = 28 dentro un target ≥ 48×48); titolo `body` (`bodyStrong`
    se aperto); riga meta con `PersonBadge` («Assegnato a {nome}») oppure il testo «In coda»,
    scadenza col testo di oggi («Scadenza: 03/11/2026 18:30», in `color.danger` se scaduto),
    regola ciclica, «Sollecitato alle …»; criticità: `HIGH` → `CriticalityBadge`, `LOW` → testo
    «Criticità: bassa» in meta, `NORMAL` → niente (DESIGN §4); `FamilyTag` se riceve il nome della
    famiglia; «Prendi» (`Button secondary`, alto ≥ 56) solo se aperto e in coda, target separato
    dal checkbox. Stato `DONE`: checkbox selezionato, testo «Fatto». Stato `CANCELLED`: nessun
    checkbox né bottone, testo «Annullato». La card **non** è un bottone in questo giro (non c'è
    una schermata di dettaglio e un `<button>` non può contenere il checkbox): vedi Porte.
  - `InlineNotice` acquista un'azione facoltativa (`action?: { label, onPress }`, un `Button
    text` dentro l'avviso), per l'undo. Senza azione resta identico (giro 044 intatto).
- **Logica pura** in `app/src/task/sections.ts` (con Jest): `sectionOf(task, now)` →
  `overdue | today | upcoming | none | closed` e `sortInSection`. Regole, sempre nel fuso della
  famiglia del task (riusa `dayIn` di `filters.ts`):
  - `closed`: `DONE` o `CANCELLED`, qualunque scadenza;
  - `overdue`: aperto, `DATETIME` con istante < ora, oppure `DATE` con giorno < oggi;
  - `today`: aperto, giorno della scadenza = oggi e non scaduto;
  - `upcoming`: aperto, giorno > oggi; `none`: aperto, senza scadenza.
  - Ordine: istante di fine della scadenza (`DATETIME` = l'istante; `DATE` = fine di quel giorno
    nel fuso della famiglia, cioè inizio del giorno dopo), poi criticità `HIGH > NORMAL > LOW`,
    poi titolo; senza scadenza dopo, con lo stesso criterio.
- `app/src/task/TaskSectionList.tsx`: compone il kit. Un contenitore `role="region"` con
  l'etichetta che riceve (in `tasks.tsx`: «Task di tutte le mie famiglie»); dentro, per ogni
  sezione non vuota, nell'ordine «In ritardo · Oggi · Prossimi · Senza scadenza · Chiusi», un
  `SectionHeader` (heading 2) **fuori** dalla lista e subito dopo un `role="list"` con
  `aria-label` = nome della sezione, con un `role="listitem"` per task e la sua `TaskCard`. Nessun
  heading dentro un `list` (HTML valido, critica n. 5). I `listitem` della regione sono
  esattamente i task mostrati. La regione c'è sempre quando i task sono caricati, anche vuota. La
  usa anche la galleria.
- `app/src/task/useQuickActions.ts`: done, undo e take dalla vista aggregata, con la famiglia del
  task (`completeTask/reopenTask/takeTask/assignTask(task.familyId, …)`). Lo stato è **uno solo
  per schermata**: la card nella regione «Aperto dalla notifica» e quella della lista leggono lo
  stesso task e lo stesso `inFlight`. Una scrittura per volta: durante l'attesa tutti i checkbox,
  tutti i «Prendi» e «Annulla» sono disabilitati (anche il doppio tocco su «Annulla» manda una
  sola richiesta). Identificativi: `attemptFor(previous, key)` con chiave `azione:taskId`; dopo un
  errore di rete il retry riusa lo stesso `mutationId`; **dopo ogni `ok` l'attempt si azzera**,
  quindi done → Annulla → done sono tre `mutationId` diversi (critica n. 3). Esiti → avviso
  (`InlineNotice`, sempre `role="alert"` come nel kit di giro 044):
  - `ok` dopo done → `success` «Fatto: {titolo}.» con azione «Annulla» → `reopenTask`;
  - `ok` dopo take → `success` «Preso: {titolo}.» con azione «Annulla» → `assignTask(…,
    { assigneePersonId: null })` (P6: chi ha preso può rimettere in coda; critica n. 4);
  - `ok` dopo un undo → l'avviso sparisce; `forbidden` → «Non hai il permesso di farlo.»;
  - `alreadyTaken` → `notice` «Già preso da {nome}.» e **ricarica**;
  - `changed` → «Il task è cambiato. Ricarico.» e **ricarica**; `notFound` → «Questo task non è
    più disponibile» e **ricarica**; `unauthorized` → `/login`; altro → «Qualcosa non ha
    funzionato. Riprova.».
  «Ricarica» vuol dire `GET /api/tasks` che **sostituisce** l'elenco (niente `mergeAll`: un task
  sparito deve sparire; critica n. 2). Done su un task ciclico → ricarica (arriva l'occorrenza
  nuova). Con un `ok` la card si aggiorna col task della risposta. L'avviso resta finché la
  persona non fa un'altra azione: niente timer (DESIGN §1, nonna di 78 anni).
  Il client non decide permessi: il checkbox c'è su ogni task aperto, il server risponde.
- **Android** (critica n. 1): le scritture della vista aggregata vanno dirette in rete, ma un task
  con mutazioni ancora nella coda offline (`queued.ts`) ha checkbox e «Prendi» **disabilitati**,
  così una scrittura diretta non scavalca la coda. Funzione pura `quickBlocked(taskId,
  queue)` con Jest; sul web la coda non c'è e non blocca nulla.
- `app/app/tasks.tsx` riscritta: `Screen` del kit, nessun import da `react-native`, nessuno
  `StyleSheet`. Heading 1 «Tutte le mie famiglie», `FamilySwitch` (com'è, il `FamilySwitcher` del
  kit non è in T13), regione «Aperto dalla notifica» con la `TaskCard` del task (giro 033),
  `FilterTabs` «Filtro», `TaskSectionList`. Ogni `TaskCard` ha il `FamilyTag`. Stati: errore di
  caricamento → `InlineNotice danger` «Impossibile caricare i task. Riprova.»; nessun task →
  `EmptyState` «Nessun task.» + riga «Aggiungi il primo task nella tua famiglia.» + azione
  «Aggiungi» (con una famiglia va a `/family?id=…`, con più famiglie a `/families`); filtro vuoto
  → `EmptyState` «Nessun task con questo filtro.» senza azione; caricamento → come oggi (nulla,
  `LoadingState` è di UI-5).
- **Galleria**: `/gallery?set=list` (stesso file, stesso gate, stesso `?fs=`) mostra solo i
  componenti di T13; `/gallery` senza `set` resta identica (i conteggi di giro 044 non cambiano).
- Chiavi i18n it/en nuove sotto `task.section.*`, `task.card.*`, `task.empty.*`,
  `gallery.list.*`.

### Dati demo (inventati; da SPEC Appendice A) — li usano i test di accettazione
API finta di Playwright come nei giri 011–044. Orologio del browser fisso a
**2026-11-03T03:00:00Z** (martedì 04:00 a Roma, lunedì 22:00 a New York); fuso del dispositivo
`Asia/Tokyo`, così nessun calcolo può usare il fuso del telefono.

| Famiglia (fuso) | Persone viste da Giulia |
|---|---|
| Famiglia Principale (`Europe/Rome`) | Marco, Giulia (gestori), Leo, Sofia (risorse) |
| Famiglia Mamma (`America/New_York`) | Anna, Pietro (gestori), Giulia, Luca, Paolo, Davide |
| Famiglia Babbo | Giulia non ne fa parte: nulla deve comparire |

| Task | Famiglia | Stato, assegnatario | Scadenza | Criticità | Sezione attesa |
|---|---|---|---|---|---|
| Preparare lo zaino | Principale | aperto, Leo | DATETIME 2026-11-02T17:30Z (18:30 di ieri a Roma) | normale | In ritardo |
| Portare le foto alla nonna | Mamma | aperto, Giulia | DATE 2026-11-02 (oggi a New York) | alta | Oggi (1°) |
| Restituire i libri | Mamma | aperto, Giulia | DATE 2026-11-02 | bassa | Oggi (2°: stessa scadenza, criticità minore) |
| Pagare la mensa | Principale | aperto, Giulia | DATETIME 2026-11-03T16:00Z (17:00 a Roma) | normale | Oggi (3°) |
| Mettere fuori la carta | Principale | aperto, Marco, ogni martedì | DATE 2026-11-03 | normale | Oggi (4°) |
| Comprare il regalo per Anna | Mamma | aperto, Giulia | DATE 2026-11-03 (domani a New York) | normale | Prossimi (1°) |
| Prenotare il pranzo di Natale | Mamma | aperto, **in coda** | DATE 2026-12-20 | alta | Prossimi (2°) |
| Lista della spesa | Principale | aperto, **in coda** | nessuna | normale | Senza scadenza |
| Riparare la bici di Sofia | Principale | fatto (da Giulia) | DATE 2026-11-01 | normale | Chiusi |
| Spostare il divano | Mamma | annullato, in coda | nessuna | normale | Chiusi |
| Rinnovare la carta d'identità di Franco | Babbo | aperto | DATE 2026-11-13 | normale | mai mostrato |

Ricorrenza di «Mettere fuori la carta»: `WEEKLY` martedì («Si ripete: ogni martedì»); il done
crea l'occorrenza del 10/11/2026 (aperta, Marco). Giulia è `MEMBER` della Famiglia Mamma: il done
sul pranzo (in coda) le è negato da P7 (403). Stato vuoto: Luca (solo Famiglia Mamma) con la
Famiglia Mamma **senza** task. Paolo è chi «prende prima» nel caso 409 `already_taken`. Gli id
dei task sono in `app/e2e/acceptance/giro-046-fake-api.ts`.

Dati finti della galleria `?set=list` (chiavi `gallery.list.*`, it/en): heading 1 «Galleria del
kit — lista»/«Kit gallery — list»; `PersonBadge` di Marco, Giulia, Leo e Sofia; `FamilyTag`
«Famiglia Principale»; `CriticalityBadge`; `FilterTabs` funzionanti in locale; `EmptyState` con
«Aggiungi» e senza azione; `TaskCard` in ogni stato (assegnato, in coda con «Prendi», scaduto,
alta, bassa, ciclico, sollecitato, fatto, annullato, titolo lungo «Rinnovare la carta d'identità
di Franco prima della scadenza fra dieci giorni»); una `TaskSectionList` con i task della tabella
sopra. Le azioni in galleria sono locali (nessuna rete): il checkbox cambia stato e mostra
l'avviso con «Annulla».

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx playwright test e2e/acceptance/giro-046-*` → verde (righe B1–B10).
- [ ] B1 sezioni: `/tasks` come Giulia → nella `region` «Task di tutte le mie famiglie» gli
      heading 2 sono, in ordine, «In ritardo, Oggi, Prossimi, Senza scadenza, Chiusi»; ogni
      sezione è una `list` col suo nome e i `listitem` nell'ordine della tabella; nell'ordine del
      DOM ogni heading è seguito esattamente dai task della sua sezione; 10 `listitem`; nessuna
      traccia di Famiglia Babbo; un solo `GET /api/tasks`. In inglese: «Overdue, Today, Upcoming,
      No due date, Closed», regione «Tasks of all my families», checkbox «Done: {title}».
- [ ] B2 card: ogni `listitem` ha il `FamilyTag` col nome della famiglia; «Pranzo di Natale»
      mostra il badge «Alta» (sfondo `rgb(153, 27, 27)`) e nessun «Criticità: normale» compare
      nella lista; «Restituire i libri» dice «Criticità: bassa»; «Mettere fuori la carta» dice
      «Assegnato a Marco», le iniziali «M» e «Si ripete: ogni martedì»; la scadenza dello zaino
      («Scadenza: 02/11/2026 18:30») è in `rgb(153, 27, 27)`; quella della mensa
      («Scadenza: 03/11/2026 17:00») no.
- [ ] B3 target: 9 `checkbox`, ognuno ≥ 48×48 px; «Prendi» solo sui due task in coda aperti, alto
      ≥ 56 px, etichetta ≥ 18 px, distanza ≥ 8 px dal checkbox della sua card; «Spostare il
      divano» dice «Annullato» e non ha né checkbox né bottoni; «Riparare la bici» ha
      `aria-checked="true"`.
- [ ] B4 fatto e undo: checkbox «Fatto: Pagare la mensa» → un `POST
      /api/families/{Principale}/tasks/{mensa}/done` con il solo `mutationId` UUIDv7 e
      `X-CSRF-Token`; la card passa sotto «Chiusi», selezionata; `alert` «Fatto: Pagare la mensa.»
      con «Annulla» → un `POST …/reopen`; la card torna sotto «Oggi», non selezionata, l'avviso
      sparisce; un nuovo done → tre `mutationId` tutti diversi. Da `/tasks?task={mensa}` il
      checkbox della regione «Aperto dalla notifica» (con `FamilyTag`) seleziona anche la card
      della lista, con un solo `POST`.
- [ ] B5 doppio tocco e retry: con `done` ritardato, doppio clic sul checkbox → disabilitato, anche
      «Prendi» del pranzo è disabilitato, 1 sola richiesta e nessun `reopen`; doppio clic su
      «Annulla» ritardato → 1 solo `reopen`; con un errore di rete su «Restituire i libri» →
      «Qualcosa non ha funzionato. Riprova.» e il secondo tentativo riusa lo **stesso**
      `mutationId`.
- [ ] B6 rifiuti e ricariche: 403 sul pranzo (P7) → `alert` «Non hai il permesso di farlo.», card
      ferma, nessun nuovo `GET`; 409 `not_open` sui libri (fatti da Anna) → «Il task è cambiato.
      Ricarico.», secondo `GET /api/tasks`, i libri sotto «Chiusi»; 404 sul regalo → «Questo task
      non è più disponibile», secondo `GET`, il regalo sparisce (9 `listitem`); done sulla carta
      ciclica → secondo `GET`, la fatta sotto «Chiusi» e l'occorrenza del 10/11 sotto «Prossimi».
- [ ] B7 prendere: «Prendi» sul pranzo → un `POST …/{Mamma}/tasks/{pranzo}/take`; la card dice
      «Assegnato a Giulia» senza «Prendi»; `alert` «Preso: Prenotare il pranzo di Natale.» con
      «Annulla» → `PUT …/assignee` con `assigneePersonId: null` e un `mutationId` diverso; la card
      torna «In coda» con «Prendi». Con Paolo arrivato prima → 409 `already_taken` → «Già preso da
      Paolo.», secondo `GET`, la card dice «Assegnato a Paolo» senza «Prendi».
- [ ] B8 filtri: `tablist` «Filtro» con 4 `tab` («Tutti, Assegnati a me, In coda, In scadenza»);
      solo «Tutti» selezionato all'inizio; «In coda» → solo lui selezionato, heading «Prossimi,
      Senza scadenza», pranzo e spesa nelle loro liste; nessun nuovo `GET`.
- [ ] B9 stato vuoto: Luca, Famiglia Mamma senza task → «Nessun task.», «Aggiungi il primo task
      nella tua famiglia.», nessun `listitem`, «Aggiungi» alto ≥ 56 px che porta a
      `/family?id={Mamma}`.
- [ ] B10 galleria e fontScale: `/gallery?set=list` a 390 e 1280 px, fs 1 e 2: heading 1
      «Galleria del kit — lista», `tablist` «Filtro», nomi delle persone, «Famiglia Principale»,
      «Alta», «Annullato»; titolo lungo a 18·fs px; nessun overflow né testo tagliato (misura di A5
      di giro 044); checkbox ≥ 48×48, «Prendi» ≥ 56; un checkbox aperto mostra l'avviso «Fatto: …»
      con «Annulla»; screenshot `e2e-screenshots/tasks-list-{390,1280}-fs{1,2}.png`; poi
      `/gallery` senza `set` ha ancora gli heading «Testo, Bottoni, Campi, Avvisi», nessun
      checkbox né `tablist`. Screenshot di `/tasks`: `e2e-screenshots/tasks-{390,1280}.png` (B1).
- [ ] Sorgente: `app/app/tasks.tsx` non importa da `react-native` e non usa `StyleSheet`
      (controllo nel file di accettazione); nessun `#…` fuori da `tokens.ts`
      (`cd app && npm test -- src/ui` → verde, test di giro 044).
- [ ] Jest del costruttore: `cd app && npm test -- sections PersonBadge quick` → verde:
      `sectionOf` col cambio dell'ora legale (un `DATE` del 25/10/2026 a Roma è «Oggi» fino alle
      23:00Z del 25; un `DATETIME` 2026-10-25T22:30Z a Roma è «Oggi» alle 22:00Z e «In ritardo»
      alle 22:31Z; a `America/Santiago`, dove la mezzanotte del 2026-09-06 non esiste, la fine del
      `DATE` 2026-09-05 è 2026-09-06T04:00Z e un `DATE` del 06/09 è «Oggi» dalle 04:00Z del 6);
      ordine con criticità e titolo; `personTint` stabile; contrasto delle iniziali ≥ 4.5:1 su
      tutte e 8; `quickBlocked` vero per un task con una mutazione in coda, falso altrimenti.
- [ ] Regressione: `cd app && npx playwright test` tutto verde, con i tre file vecchi adattati
      (vedi Test) e giro 033 (regione «Aperto dalla notifica») intatto; `npm test` (test delle
      chiavi it/en compreso), `npx tsc --noEmit`, `npx eslint .` verdi.
- [ ] Il server non cambia: `git diff --stat origin/main -- server/` → vuoto.
- [ ] Prova sul telefono a fontScale di sistema 2.0 (APK): rimandata al giro
      `verifica-produzione` di T13, dopo la parte 2.

## Fuori perimetro
- **Parte 2 di T13** (giro successivo): `TasksSection` e `family.tsx` sul kit, con sezioni,
  checkbox, «Prendi» e undo; adattamento dei test vecchi della vista famiglia (010, 011, 013, 014,
  016, 031). In questo giro `TasksSection`, `TaskSummary` e la vista famiglia non cambiano (lì
  resta «Prendo io»).
- Schermata di dettaglio del task e card premibile; `DueLabel` e `RecurrenceLabel` (formato «mar 21
  ott»): non sono in T13.
- `AppHeader`, `FamilySwitcher` del kit, `LoadingState`, stati offline (UI-5); `Sheet`,
  `ConfirmDialog`, `NewTaskForm`, `ForwardDialog` (UI-3).
- Coda offline Android nella vista aggregata: qui le scritture vanno in rete anche su Android
  (offline danno l'errore generico); un task con mutazioni in coda ha solo i controlli
  disabilitati.
- Undo di «Annulla task», inoltro e altre azioni della vista famiglia (parte 2). Swipe e gesti;
  timer sull'undo; tinta della persona configurabile (spec da scrivere, PIANO-UI §7).
- Tema scuro (T16); set di icone (porta, DESIGN §8).
- Qualsiasi modifica al server, a `.github/`, a `app/package.json`.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni» a griglia;
  set di icone come dipendenza; accesso Google/Apple, iPhone, Play Store; verifica email e
  recupero password; sync in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-046-fake-api.ts` | API finta con le famiglie, le persone e i task della tabella; P6 e P7 per un `MEMBER`; occorrenza nuova al done della carta; script per ritardi, errori di rete, 403, 404, 409 |
| `app/e2e/acceptance/giro-046-task-list.spec.ts` | dato Giulia alle 03:00Z del 3/11, quando apre `/tasks`, allora sezioni, ordine nel DOM e card come B1–B3 (it ed en) |
| idem | dato un task suo di oggi, quando spunta, preme «Annulla» e rispunta, allora done, reopen, done con tre `mutationId` diversi (B4); dalla card della notifica lo stato è condiviso |
| idem | dato un `done` lento o perso, quando tocca due volte (anche «Annulla») o riprova, allora una richiesta sola o lo stesso `mutationId` (B5) |
| idem | dato un 403, un 409, un 404 o un ciclico, quando spunta, allora l'avviso giusto e la card ferma o l'elenco ricaricato (B6) |
| idem | dato un task in coda, quando preme «Prendi» e «Annulla» (o Paolo è stato più veloce), allora `take`, `PUT …/assignee` null o la ricarica con Paolo (B7) |
| idem | dato «In coda», quando lo sceglie, allora due task nelle loro sezioni e nessun `GET` nuovo (B8) |
| idem | dato Luca senza task, quando apre `/tasks`, allora `EmptyState` con «Aggiungi» verso la sua famiglia (B9) |
| idem | dato `tasks.tsx`, quando si scansiona, allora niente `react-native` né `StyleSheet` |
| `app/e2e/acceptance/giro-046-list-kit.spec.ts` | dati 390/1280 × fs 1/2, quando si apre `/gallery?set=list`, allora misure, niente tagli, checkbox funzionante, screenshot; `/gallery` senza `set` invariata (B10) |
| `app/e2e/acceptance/giro-011-filters.spec.ts` (adattato) | i filtri diventano `tablist`/`tab` con `aria-selected` (DESIGN §5) al posto di `group`/`button` con `aria-pressed`; la lista diventa la `region` omonima; il resto identico |
| `app/e2e/acceptance/giro-010-tasks.spec.ts` (adattato, solo il caso «tutte le mie famiglie») | `region` al posto di `list`; lo zaino non mostra più «Criticità: normale» e il pranzo mostra il badge «Alta» (DESIGN §4); la vista famiglia non cambia |
| `app/e2e/acceptance/giro-016-forward.spec.ts` (adattato, una riga di F3) | `region` «Task di tutte le mie famiglie» al posto di `list` |

I tre file vecchi si cambiano nel commit `test(acceptance)` del pianificatore, come nei giri 018 e
035 (DECISIONI n. 64 e 114); la PR va in revisione umana.

## Porte
- Doppio senso previste (in `DECISIONI.md` come registro):
  - T13 diviso in due parti; questa senza `TasksSection`.
  - Quinta sezione «Chiusi» per fatti e annullati (DESIGN §6.2 ne prevede quattro, ma il filtro
    «Tutti» mostra anche i chiusi da giro 011, e un task fatto non sta «In ritardo»).
  - `TaskCard` non premibile finché non c'è un dettaglio (proposta di nota a DESIGN §6.1).
  - «Tutti» come quarta tab di `FilterTabs` (DESIGN §5 ne elenca tre).
  - Tinta per hash dell'id (nessun campo nuovo); ordine dei `DATE` come fine del giorno.
  - Galleria della lista su `/gallery?set=list`; avviso di undo senza timer.
  - Scritture dirette dalla vista aggregata anche su Android, con i controlli disabilitati per i
    task che hanno mutazioni in coda.
  - Lista a sezioni come `region` con una `list` per sezione (non più un'unica `list`).
  - Undo di «Prendi» con `PUT …/assignee` null (P6), stesso avviso dell'undo del done.
  - Avvisi di esito sempre `role="alert"` (come il kit di giro 044), anche per i successi.
  - Tinta della persona per hash: nota in `DECISIONI.md` (il colore cambia se cambia l'id, non
    è scelto dalla famiglia; resta stabile tra famiglie e dispositivi).
  - Tre test di accettazione vecchi adattati alla nuova UI (revisione umana).
- Senso unico: nessuna. Nessuna dipendenza nuova (V9: RN puro), nessuno schema, nessun
  endpoint, nessuna integrazione, nessun segreto.

## Rischi di concorrenza
- Doppio tocco sul checkbox, su «Prendi» o su «Annulla»: una scrittura per volta (`inFlight` e
  controlli disabilitati); prova B5.
- Stessa card due volte (regione della notifica e lista): un solo stato per schermata; prova B4.
- Android: una scrittura diretta che scavalca una mutazione in coda per lo stesso task: controlli
  disabilitati finché la coda non si svuota; Jest `quickBlocked`.
- Rete persa dopo che il server ha salvato: il retry riusa il `mutationId`, il server risponde
  idempotente; prova B5.
- Undo mentre `done` è in volo: «Annulla» compare solo dopo il 200 di `done`; prova B4.
- Due persone prendono lo stesso task: vince il server (409 `already_taken`); prova B7.
- Il task cambiato o sparito altrove: 409 o 404 → avviso e ricarica che **sostituisce** l'elenco;
  prova B6.
- Done su un task ciclico: l'occorrenza nuova arriva con la ricarica di `/api/tasks`; l'undo
  riapre solo l'occorrenza fatta (comportamento del server invariato).

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 1000; file toccati ≤ 21 (7 componenti e
`InlineNotice` in `app/src/ui`, 3–4 in `app/src/task`, `tasks.tsx`, `gallery.tsx`, 2 dizionari,
2–3 test Jest, `DECISIONI.md`, il rapporto); una sessione.

## Domande per il ricercatore (al massimo 3)
1. react-native-web 0.21 con `Pressable`: `role="checkbox"` + `aria-checked` e `role="tab"` +
   `aria-selected` dentro `role="tablist"` escono nel DOM? Playwright li trova con
   `getByRole('checkbox', { checked })` e `getByRole('tab', { selected })`? Spazio/Invio
   funzionano? Un `role="checkbox"` dentro un `listitem` dentro un `list` crea problemi?
2. Undo accessibile: un `role="alert"` che contiene un bottone «Annulla» va bene (WAI-ARIA, WCAG
   2.2.1 sul tempo) o serve `role="status"`? Cosa dicono Material e le linee guida per anziani
   sulla durata di uno snackbar/undo (persistente o a tempo)?
3. Lista a sezioni: heading dentro un unico `role="list"` (non `listitem`) è accettabile per i
   lettori di schermo, o meglio un `list` per sezione dentro un contenitore etichettato? Come
   rende `SectionList` di react-native-web 0.21 (ruoli nel DOM)?

## Idee per dopo
- Schermata di dettaglio del task: la card diventa premibile (DESIGN §6.1) e «Sollecita» ci va
  dentro (DESIGN §6.5).
- `DueLabel` con data relativa leggibile («oggi alle 17:00», «mar 21 ott»).
- Coda offline anche nella vista aggregata su Android.
- Proposta a DESIGN §6.2: sezione «Chiusi» e «Tutti» tra i filtri.
- `role="status"` per gli avvisi di successo (ricerca, Q2): cambia il kit di giro 044 e il suo
  test A3, quindi va deciso in DESIGN.
- Prova con lettore di schermo sull'APK in `verifica-produzione`.

## Critica ricevuta e cosa cambia
Accolto:
1. Android: le scritture dirette non scavalcano la coda → checkbox e «Prendi» disabilitati per i
   task con mutazioni in coda (`quickBlocked`, Jest; Playwright non vede la coda).
2. Ricarica dopo `notFound`, `changed` e `alreadyTaken`: `GET /api/tasks` che sostituisce
   l'elenco (B6, B7).
3. Attempt azzerato dopo ogni `ok`: done → Annulla → done con tre `mutationId` diversi; il retry
   riusa il suo (B4, B5).
4. Undo anche per «Prendi», con `PUT …/assignee` null (P6 lo consente a chi ha preso): è piccolo
   e l'endpoint c'è già (B7).
5. Una `list` per sezione dentro una `region` etichettata, heading fuori dalle liste (B1). Costa
   l'adattamento di una riga di giro 016, oltre a 010 e 011.
- Doppio tocco su «Annulla» = un solo `reopen`; card della notifica con lo stato condiviso (B5,
  B4). Test aggiunti: ordine nel DOM, 404 sul done, done sul ciclico, tre `mutationId`; righe Jest
  sul cambio dell'ora (DATETIME 2026-10-25T22:30Z, America/Santiago 2026-09-06).
- Nota in `DECISIONI.md` sui colori delle persone (Porte).

Scartato, con motivo:
- Nome «Annulla fatto» per l'undo: c'è un solo avviso per volta, il bottone sta dentro l'avviso
  che dice già cosa annulla, e il nome resta uguale al testo visibile (WCAG 2.5.3); i test lo
  cercano dentro l'`alert`.
- `role="status"` per i successi: `InlineNotice` del kit di giro 044 è sempre `alert` e il suo
  test A3 lo fissa; cambiarlo è una decisione di DESIGN («Idee per dopo»).
