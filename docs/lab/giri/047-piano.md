---
giro: 047
traguardo: T13
traguardi_extra: []
tipo: costruzione
fase: costruzione
inizio: 2026-10-25T12:01:04Z
ricerca: sì
accettazione: 840a91f
ripreso: no
---
# Piano del giro 047 — T13 parte 2: `TasksSection` e vista famiglia sul kit

## Fetta e traguardo
T13 (UI-2: lista dei task), parte 2 di 2, giro `costruzione`. La parte 1 (giro 046, PR #70
mergiata) ha posato il kit della lista e rifatto `/tasks`. Resta la lista della **vista famiglia**
(`/family?id=…`), cioè `app/src/task/TasksSection.tsx`, ancora fatta di `Pressable`, `StyleSheet`
e stili locali. Con questa fetta il «Fatto quando» di T13 è completo in locale; il traguardo
passa solo con il giro `verifica-produzione` successivo.
Fonti: SPEC §2.2.2, §2.2.3, §2.2.4, §5 (P5, P7, P8, P12), §12; DESIGN §2, §4, §5, §6.1, §6.2,
§6.4, §6.5, §7; rapporto 046.

Cosa si costruisce:
- **`TasksSection` riscritta sul kit**: nessun import di `Pressable`, `StyleSheet`, `Text` da
  `react-native`; nessun colore o dimensione letterale; nessun import di `colors` statico (solo
  `useTheme()`). Struttura:
  - heading 2 «Task» (`Text` del kit, `heading={2}`);
  - un solo `InlineNotice` per gli avvisi della sezione (errori `task.forbidden`, `task.changed`,
    `task.taken`, inoltro riuscito, sollecito troppo presto…), con tono `danger`/`notice`/`success`;
    dopo «fatto» e «Prendi» riusciti l'avviso porta l'azione «Annulla» (come in `/tasks`, senza
    timer). **Un solo stato** `last` per avviso e undo: qualunque scrittura nuova o ricarica lo
    azzera (l'«Annulla» vecchio sparisce, F7);
  - `InlineNotice` riceve una prop facoltativa `role?: 'alert' | 'status'` (default `alert`,
    comportamento invariato); con `status` mette anche `aria-live="polite"` e
    `accessibilityLiveRegion="polite"`. L'avviso della coda offline (Android, `offline.notice`) usa
    `role="status"` con «Chiudi avviso» (lo vuole `FamilyAndroid.test.tsx`, «discreet notice»);
  - errore di caricamento → `InlineNotice` tono `danger` **con `role="status"`** «Impossibile
    caricare i task. Riprova.» (`giro-010-tasks.spec.ts:802` vuole zero `alert`);
  - zero task → `EmptyState` «Nessun task.» + riga + azione «Aggiungi», che porta il fuoco sul
    campo titolo di `NewTaskForm` (serve un `ref` o un `autoFocus` comandato: nessun
    comportamento nuovo del form oltre a questo);
  - lista: `TaskSectionList` con etichetta **«Task della famiglia»** (chiave `task.list`, già
    esistente), sezioni In ritardo · Oggi · Prossimi · Senza scadenza · Chiusi nel fuso della
    famiglia; ogni task una `TaskCard` **senza** `FamilyTag` (non è vista aggregata);
  - `TaskCard`: checkbox «Fatto: {titolo}» (target 48 dp) e «Prendi» (solo se aperto e in coda,
    target separato), come in `/tasks`;
  - **azioni secondarie** della riga, che oggi esistono e non si perdono: «Assegna» (e le scelte
    «Assegna a {nome}», «Rimetti in coda»), «Inoltra «{titolo}»», «Sollecita «{titolo}»» (solo
    gestori, task assegnati), «Annulla task»/«Annulla questa volta» con conferma, «Termina serie»
    con conferma, «Riapri» sui task fatti, link «Apri {titolo}» per la lista della spesa. Stanno
    in uno slot nuovo e facoltativo di `TaskCard` (`actions?: ReactNode`, sotto la riga meta),
    composte da `Button` del kit (`secondary` o `text`, alti ≥ 48 dp). Senza `actions` la card è
    identica a oggi (le 21 prove del giro 046 non cambiano). **Etichette invariate**: i test
    vecchi le trovano per nome. Il bottone «Segna fatto» sparisce: lo sostituisce il checkbox.
    «Prendo io» diventa «Prendi» (chiave `task.card.take`).
  - `NewTaskForm` e `ForwardDialog` restano come sono (rifatti in T14); il link «Tutte le mie
    famiglie» resta, come `Button text` o link del kit.
- **Azioni rapide** (fatto, prendi, annulla) nella vista famiglia — **senza** `useQuickActions`:
  si estendono `run`/`change`/`take` di `TasksSection` con lo stato `last` e l'undo.
  - un solo blocco di scrittura per la sezione (`inFlight` ref + `busy`), anche tra task diversi:
    mentre una scrittura è in volo checkbox, «Prendi», «Sollecita» e le altre azioni che scrivono
    sono disattivati (F8);
  - esiti, come oggi: `notFound` → `onStale` (ricarica task **e** persone; un secondo 404 =
    famiglia non trovata, `giro-010-tasks.spec.ts:773`); `changed` → avviso `task.changed` +
    `onStale`; `alreadyTaken` → avviso «Già preso da {nome}» + card aggiornata (e `onReload`);
    ok su un ricorrente (done, cancel, end-series) → `onReload`;
  - `mutationId`: si riusa **solo** dopo un errore di rete (`error`) per la stessa azione sullo
    stesso task; dopo 403, 404, 409, 429 o un'azione diversa se ne genera uno nuovo (F8; Jest su
    `attemptFor` o sulla funzione che decide);
  - undo: dopo «fatto» → riapri (`reopen` del task salvato, mai dell'occorrenza nuova); dopo
    «Prendi» → rimetti in coda (`assigneePersonId: null`);
  - dopo «fatto» la card va subito in «Chiusi» e torna nella sua sezione con l'undo, come in
    `/tasks` (046 B4): una sola regola per le due liste;
  - Android con coda offline (`offline` presente): fatto e prendi passano dalla coda
    (`offline.complete`, `offline.take`) come oggi; undo di «Prendi» = `offline.assign(id,
    null)`; undo di «fatto» = riapri in rete (oggi la coda non ha «riapri»), disabilitato finché
    il task ha mutazioni in coda (`offline.blocked`). Nessuna mutazione nuova nella coda.
    Siccome la lista Android è `offline.tasks`, dopo ogni scrittura diretta in rete (riapri, undo
    di «fatto», annulla, termina serie, sollecito) `useOfflineTasks` espone e la sezione chiama
    `offline.refresh()` (rilettura locale + `session.afterWrite()` per il sync), così il
    cambiamento si vede. Prova Jest in `FamilyAndroid.test.tsx`: undo di «fatto» → POST `reopen`
    e poi `refresh`/sync chiesto.
- `family.tsx`: solo ciò che serve a far stare la sezione (per esempio togliere
  `alignItems: 'center'` che stringe le card) e il moltiplicatore di prova `?fs=` (come
  `/gallery`: `FontScaleContext` dalla query, 1 se assente o non valido, limitato a 1–2) per gli
  screenshot a fontScale 2.0. Il resto della schermata (persone, titolo, `FamilySwitch`) è T15.
- `/gallery?set=list`: invariata.
- Chiavi i18n it/en solo se servono (per esempio «Altre azioni» se la ricerca lo consiglia).

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx playwright test e2e/acceptance/giro-047-*` → tutti verdi:
  sezioni e ordine nella vista famiglia; checkbox e «Prendi» con undo; azioni secondarie
  funzionanti; stato vuoto con «Aggiungi» che porta il fuoco sul titolo; nessun `FamilyTag` nella
  vista famiglia; target ≥ 48×48; screenshot 390×844 e 1280×800 × fontScale 1.0 e 2.0 in
  `app/e2e-screenshots/family-*.png`, senza testo tagliato (nessun elemento della card con
  `scrollWidth > clientWidth`).
- [ ] `cd app && npx playwright test` → tutto verde, compresi i test vecchi adattati (010,
  011-task-actions, 013, 014, 016, 019, 031: solo selettori e nomi, vedi sotto).
- [ ] `cd app && npm test` → verde (Jest), compresi `src/task/__tests__/FamilyAndroid.test.tsx`
  adattato (stessa regola di traduzione) e le prove nuove: blocco unico, riuso del `mutationId`
  solo dopo errore di rete, undo di «fatto» su Android con `refresh` chiesto, `InlineNotice`
  con `role="status"`.
- [ ] `cd app && npx tsc --noEmit && npx eslint .` → verdi.
- [ ] `grep -nE "#[0-9a-fA-F]{3,8}|StyleSheet|from 'react-native'.*(Pressable|Text)" app/src/task/TasksSection.tsx` → nessuna riga.
- [ ] `grep -n "from '@/ui/tokens'" app/src/task/TasksSection.tsx` → nessuna riga (solo `useTheme`).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (server non toccato).

## Fuori perimetro
- `NewTaskForm`, `ForwardDialog`, `Sheet`, `ConfirmDialog` sul kit: T14.
- Resto di `family.tsx` (persone, titolo), `families.tsx`, `me.tsx`, `ShoppingList`: T15.
- Schermata di dettaglio del task (la card non diventa un bottone); spostare «Sollecita» nel
  dettaglio come vuole DESIGN §6.5: senza dettaglio resta sulla riga, come dal giro 031.
- `FilterTabs` nella vista famiglia (oggi non c'è: si aggiunge solo se la ricerca lo chiede,
  ma non in questo giro).
- Mutazione «riapri» nella coda offline Android; sync in tempo reale; offline sul web.
- Tema scuro e stati V8 completi: T16. Set di icone come dipendenza (DESIGN §8).
- Swipe e gesti.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni»; set di
  icone come dipendenza; accesso con Google o Apple, iPhone, Play Store; email (verifica e
  recupero password); sincronizzazione in tempo reale e offline sul web; dati reali (R1).
- Server: nessuna riga.

## Dati demo (inventati; da SPEC Appendice A) — li usano i test di accettazione
API finta di Playwright come nei giri 011–046. Orologio del browser fisso a
**2026-11-03T03:00:00Z** (martedì 04:00 a Roma); fuso del dispositivo `Asia/Tokyo`, così nessun
calcolo può usare il fuso del telefono. Utente: **Giulia**, gestore di Famiglia Principale.

| Famiglia (fuso) | Persone |
|---|---|
| Famiglia Principale (`Europe/Rome`) | Marco, Giulia (gestori), Leo, Sofia (risorse) |
| Famiglia Mamma (`America/New_York`) | Anna, Pietro (gestori), Giulia, Luca, Paolo, Davide |

Vista `/family?id=<Principale>`:

| Task | Stato, assegnatario | Scadenza | Criticità | Sezione attesa |
|---|---|---|---|---|
| Preparare lo zaino | aperto, Leo | DATETIME 2026-11-02T17:30Z (18:30 di ieri) | normale | In ritardo |
| Pagare la mensa | aperto, Giulia | DATETIME 2026-11-03T16:00Z (17:00) | normale | Oggi (1°) |
| Mettere fuori la carta | aperto, Marco, ogni martedì | DATE 2026-11-03 | normale | Oggi (2°) |
| Portare il gatto dal veterinario | aperto, **in coda** | DATE 2026-11-10 | alta | Prossimi |
| Lista della spesa | aperto, **in coda**, `SHOPPING_LIST` | nessuna | normale | Senza scadenza |
| Riparare la bici di Sofia | fatto (da Giulia) | DATE 2026-11-01 | normale | Chiusi |

- Il done di «Mettere fuori la carta» crea l'occorrenza del 2026-11-10 (ricarica unita).
- Stato vuoto: Famiglia Mamma vista da Giulia con zero task.
- «Prendi» su «Portare il gatto dal veterinario» → assegnato a Giulia; «Annulla» → di nuovo in
  coda. Variante: il server risponde 409 «già preso da Marco» → avviso «Già preso da Marco».

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Commit `840a91f`. File: `app/e2e/acceptance/giro-047-family-list.spec.ts` e la sua API finta
`app/e2e/acceptance/giro-047-fake-api.ts` (scritture tenute con `hold()`, risposte scriptate).

| Prova | Dato … quando … allora … |
|---|---|
| F1 | Giulia apre Principale → regione «Task della famiglia», sezioni nell'ordine della tabella, 6 listitem, ciascun task in una sola sezione; nessuna `list` col nome «Task della famiglia» |
| F2 | nessun «Famiglia Principale» dentro la regione; «Alta» solo su «Portare il gatto…»; «In coda» su gatto e spesa; nessun «Segna fatto» né «Prendo io»; checkbox di «Riparare la bici…» spuntato e disattivato |
| F3 | checkbox «Fatto: Pagare la mensa» → POST `done` (solo `mutationId` UUIDv7, CSRF); card in «Chiusi»; «Annulla» → POST `reopen` (id nuovo), card di nuovo in «Oggi», avviso sparito |
| F4 | «Prendi» sul gatto → «Assegnato a Giulia»; «Annulla» → PUT assignee `null`, «In coda» e «Prendi» di nuovo; variante 409 → «Già preso da Marco.», card con Marco, nessun «Annulla» |
| F5 | done di «Mettere fuori la carta» → l'occorrenza del 10/11 compare in «Prossimi» senza ricaricare la pagina; «Annulla» → `reopen` solo dell'id del 03/11, che torna in «Oggi»; il 10/11 resta |
| F6 | 404 su una scrittura → ricarica di task **e** persone (`onStale`), il task sparisce; 409 `not_open` → «Il task è cambiato. Ricarico.», persone ricaricate, vince lo stato del server |
| F7 | done della mensa, poi «Prendi» sul gatto → un solo avviso con «Annulla» (quello del gatto); nessun `reopen` |
| F8 | risposta trattenuta: doppio tocco → una richiesta; «Prendi» del gatto, checkbox e «Sollecita» dello zaino disattivati, i clic forzati non inviano nulla; retry: stesso `mutationId` dopo errore di rete, nuovo dopo 403 |
| F9 | «Assegna» → «Assegna a Leo» (PUT con Leo); link «Apri la lista «Lista della spesa»»; «Annulla task» → «Non annullare»/«Conferma annullamento» → `cancel`, card «Annullato» in «Chiusi»; «Riapri» sulla bici → «In ritardo»; «Sollecita «Preparare lo zaino»» → POST `nudge`; nessun «Sollecita» sui task in coda; «Inoltra «…»», «Annulla questa volta», «Termina la serie» presenti |
| F10 | Famiglia Mamma vuota → «Nessun task.», «Aggiungi il primo task nella tua famiglia.», «Aggiungi» porta il fuoco sul campo «Titolo del nuovo task»; nessuna scrittura |
| F11 | 390×844 e 1280×800 × `?fs=1` e `?fs=2`: titolo a 18×fs px; 6 checkbox ≥ 48×48; ogni bottone della regione alto ≥ 48; nessun testo tagliato; nessun elemento delle card con `scrollWidth > clientWidth`; screenshot `e2e-screenshots/family-<w>-fs<n>.png` |
| F12 | `TasksSection.tsx`: niente `StyleSheet`, colori esadecimali, `@/ui/tokens`, `Pressable` o `Text` da `react-native` |
| F1 en | «Family tasks», sezioni in inglese, «Done: Pagare la mensa», «Take» |

Regola di traduzione dei test vecchi (010, 011-task-actions, 013, 014, 016, 019, 031 e
`src/task/__tests__/FamilyAndroid.test.tsx`), **solo selettori e nomi**, nessuna asserzione di
comportamento tolta:
- `getByRole('list', { name: 'Task della famiglia' })` → `getByRole('region', { name: … })`;
- bottone «Segna fatto»/`task.markDone` → checkbox «Fatto: {titolo}»/`task.card.doneLabel`;
- «Segna fatto» **assente** su un task fatto o annullato (per esempio 011-task-actions:136, 153)
  → checkbox spuntato e disattivato (fatto) o assente (annullato);
- «Prendo io»/`task.take` → «Prendi»/`task.card.take` (in inglese «Take»);
- un conteggio di `alert` resta valido solo per gli avvisi di scrittura: errore di caricamento e
  avviso della coda Android sono `status`, come oggi.

## Porte
- Doppio senso previste:
  - slot `actions` facoltativo in `TaskCard` (togliibile; senza slot la card non cambia);
  - «Sollecita» resta sulla riga (DESIGN §6.5 lo vuole nel dettaglio, che non esiste ancora):
    registrare in `DECISIONI.md`;
  - undo di «fatto» su Android in rete e non in coda;
  - adattamento di 7 test di accettazione vecchi e di `FamilyAndroid.test.tsx`: la PR va in
    revisione umana, come nei giri 018, 035, 046;
  - `?fs=` su `/family` (moltiplicatore di prova, come `/gallery`);
  - `role` facoltativo in `InlineNotice` (default invariato).
- Senso unico: nessuna. Nessuna dipendenza nuova, nessuna migrazione, server intatto.

## Rischi di concorrenza
- **Due blocchi indipendenti**: evitati non usando `useQuickActions`; tutte le scritture passano
  da `run`. Prova: F8 (risposta trattenuta, tocchi su task diversi) e Jest sul blocco unico.
- **Doppio tocco** sul checkbox: guardia sincrona (`ref`), non solo lo stato React. Prova
  Playwright (una sola POST) e mutazione della guardia (dubbio del revisore 046).
- **Retry**: stesso `mutationId` solo per la stessa azione sullo stesso task dopo errore di rete;
  dopo 403/404/409/429 o un'azione diversa uno nuovo. Prova: F8 e Jest.
- **Undo scaduto**: un «Annulla» rimasto dopo un'altra scrittura riaprirebbe il task sbagliato:
  stato unico `last`, azzerato da ogni scrittura e ricarica. Prova: F7.
- **Undo dopo una ricarica** (ricorrente): l'undo riapre il task salvato, non l'occorrenza nuova.
- **Android**: scrittura diretta (riapri) mentre la coda ha mutazioni del task → disabilitata;
  dopo la scrittura diretta `offline.refresh()`, se no la lista locale resta vecchia (Jest).
- **409 «già preso»**: la card si aggiorna con l'assegnatario del server, avviso col nome.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 450 nette cambiate; file di produzione ≤ 8
(`TasksSection.tsx`, `TaskCard.tsx`, `NewTaskForm.tsx` solo per il fuoco, `family.tsx`,
`InlineNotice.tsx`, `useOfflineTasks.ts`, `it.json`, `en.json`). Server: 0. Una sessione.

## Domande per il ricercatore (al massimo 3)
1. Liste di task familiari senza schermata di dettaglio (Todoist, Microsoft To Do, Google Tasks,
   Cozi, OurHome): le azioni secondarie della riga stanno visibili, dietro un menu «Altre
   azioni», o in un riquadro che si apre? Quale regge meglio a fontScale 2.0 e con un lettore di
   schermo (Material 3, Android accessibility, WCAG 2.2)?
2. Stato vuoto di una lista che ha già sotto un form di creazione: l'azione «Aggiungi» deve
   portare il fuoco sul campo, aprire un foglio, o non esserci? Fonti di design system (Material
   3, Apple HIG, GOV.UK).
3. Undo dopo aver segnato fatto in una lista a sezioni: la card resta al suo posto o va subito in
   «Chiusi»? Come lo fanno Todoist e Google Tasks, e cosa dice la guida Material sugli snackbar
   senza timer.

## Critica ricevuta e cosa cambia
Accolto:
1. Esiti nella vista famiglia: `notFound` e `changed` → `onStale`; `onReload` solo per ok su un
   ricorrente e per `alreadyTaken`. Provato da F6 (404 e 409, persone ricaricate) e dal test
   vecchio `giro-010-tasks.spec.ts:773`.
2. Stato unico `last` per avviso e undo, azzerato da ogni scrittura o ricarica (F7).
3. `InlineNotice` con `role` facoltativo, default `alert`; errore di caricamento e avviso della
   coda Android in `status` (`giro-010-tasks.spec.ts:802`, «discreet notice»).
4. Aggiunto `FamilyAndroid.test.tsx` all'elenco; scritta la regola di traduzione, compreso
   «Segna fatto assente» → checkbox spuntato e disattivato.
5. Android: `offline.refresh()` dopo ogni scrittura diretta in rete, prova Jest.
- Più semplice: niente `useQuickActions`, si estendono `run`/`change`/`take`.
- Concorrenza: blocco unico anche tra task diversi (F8, risposta trattenuta); riuso del
  `mutationId` solo dopo errore di rete (F8 e Jest).
- Perimetro: tolta la variante `/gallery?set=list` con `actions`.
- Test: sezione della card dopo il tocco e dopo l'undo (F3), undo del ricorrente (F5), 409 «Già
  preso da Marco» (F4), «Sollecita» assente sui task in coda (F9), doppio tocco con risposta
  trattenuta (F8), 404 come prova del punto 1 (F6).

Deciso qui (non dalla critica): la card fatta va subito in «Chiusi», come in `/tasks` (046 B4);
la ricerca suggeriva di lasciarla al suo posto, ma con una fonte indiretta e contro la regola
già in produzione. Gli screenshot a fontScale 2.0 si fanno con `?fs=2` su `/family`, perché la
variante in galleria è fuori perimetro.

Scartato: niente.

## Idee per dopo
- Menu «Altre azioni» unico per card, quando ci sarà il `Sheet` del kit (T14).
- Mutazione «riapri» nella coda offline Android, per avere l'undo di «fatto» anche offline.
- Schermata di dettaglio del task, dove spostare «Sollecita» (DESIGN §6.5).
