---
giro: 047
traguardo: T13
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-25T12:01:04Z
ricerca: sì
accettazione:
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
    timer). L'avviso della coda offline (Android, `offline.notice`) resta un `InlineNotice` con
    «Chiudi»;
  - errore di caricamento → `InlineNotice danger` «Impossibile caricare i task. Riprova.»;
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
- **Azioni rapide** (fatto, prendi, annulla) nella vista famiglia:
  - un solo blocco di scrittura per la sezione: la scrittura rapida e le altre azioni
    condividono lo stesso «una alla volta» (niente due `busy` indipendenti che lasciano partire
    due richieste);
  - web: in rete, riusando `useQuickActions` o la sua logica pura `afterWrite`; stesso
    `mutationId` solo per ritentare la stessa scrittura dopo un errore di rete;
  - undo: dopo «fatto» → riapri; dopo «Prendi» → rimetti in coda (`assigneePersonId: null`);
  - ricorrente fatto → ricarica unita (`onReload`) per far comparire l'occorrenza successiva;
  - Android con coda offline (`offline` presente): fatto e prendi passano dalla coda
    (`offline.complete`, `offline.take`) come oggi; undo di «Prendi» = `offline.assign(id,
    null)`; undo di «fatto» = riapri in rete (oggi la coda non ha «riapri»), disabilitato finché
    il task ha mutazioni in coda (`offline.blocked`). Nessuna mutazione nuova nella coda.
- `family.tsx`: solo ciò che serve a far stare la sezione (per esempio togliere
  `alignItems: 'center'` che stringe le card). Il resto della schermata (persone, titolo,
  `FamilySwitch`) è T15.
- `/gallery?set=list` (giro 046): se serve, una variante della card con `actions`, per lo
  screenshot del kit; altrimenti invariata.
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
- [ ] `cd app && npm test` → verde (Jest, comprese le prove nuove su undo e blocco unico).
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
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-047-family-list.spec.ts` | Giulia apre Principale → regione «Task della famiglia» con le sezioni nell'ordine della tabella, ciascun task in una sola sezione |
| idem | nessuna card della vista famiglia mostra il `FamilyTag`; «Alta» su «Portare il gatto…»; «In coda» sui task senza assegnatario |
| idem | checkbox «Fatto: Pagare la mensa» → POST `done` con un `mutationId`; card fatta; avviso con «Annulla» → POST `reopen`; card aperta |
| idem | «Prendi» su «Portare il gatto…» → assegnato a Giulia; «Annulla» → assign `null` |
| idem | done del ricorrente → compare l'occorrenza del 10/11 senza ricaricare la pagina |
| idem | doppio tocco rapido sul checkbox → una sola richiesta |
| idem | azioni secondarie per nome: «Assegna» → «Assegna a Leo»; «Annulla task» → conferma; «Riapri» su «Riparare la bici…»; «Sollecita «Preparare lo zaino»» visibile a Giulia gestore |
| idem | Famiglia Mamma vuota → `EmptyState` «Nessun task.» con «Aggiungi»; il tocco porta il fuoco sul campo titolo |
| idem | checkbox e «Prendi» hanno box ≥ 48×48; screenshot 2 viewport × fontScale 1.0 e 2.0, nessun testo tagliato |
| test vecchi adattati (010, 011-task-actions, 013, 014, 016, 019, 031) | solo: `getByRole('list', { name: 'Task della famiglia' })` → `getByRole('region', …)`; «Segna fatto» → checkbox «Fatto: {titolo}»; «Prendo io» → «Prendi». Nessuna asserzione di comportamento tolta |

## Porte
- Doppio senso previste:
  - slot `actions` facoltativo in `TaskCard` (togliibile; senza slot la card non cambia);
  - «Sollecita» resta sulla riga (DESIGN §6.5 lo vuole nel dettaglio, che non esiste ancora):
    registrare in `DECISIONI.md`;
  - undo di «fatto» su Android in rete e non in coda;
  - adattamento di 7 test di accettazione vecchi: la PR va in revisione umana, come nei giri
    018, 035, 046.
- Senso unico: nessuna. Nessuna dipendenza nuova, nessuna migrazione, server intatto.

## Rischi di concorrenza
- **Due blocchi indipendenti**: se `useQuickActions` e la `run` di `TasksSection` hanno due
  `busy`, un «Prendi» e un «Assegna» possono partire insieme. Prova: Jest sul blocco unico e
  Playwright con risposta lenta (secondo tocco disattivato, una sola richiesta).
- **Doppio tocco** sul checkbox: guardia sincrona (`ref`), non solo lo stato React. Prova
  Playwright (una sola POST) e mutazione della guardia (dubbio del revisore 046).
- **Retry**: stesso `mutationId` solo per la stessa azione sullo stesso task dopo errore di rete;
  un'azione diversa ne genera uno nuovo.
- **Undo dopo una ricarica** (ricorrente): l'undo riapre il task salvato, non l'occorrenza nuova.
- **Android**: scrittura diretta (riapri) mentre la coda ha mutazioni del task → disabilitata.
- **409 «già preso»**: la card si aggiorna con l'assegnatario del server, avviso col nome.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 450 nette cambiate; file di produzione ≤ 8
(`TasksSection.tsx`, `TaskCard.tsx`, `NewTaskForm.tsx` solo per il fuoco, `family.tsx`,
`useQuickActions.ts`, `it.json`, `en.json`, `gallery.ts`). Server: 0. Una sessione.

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
(dopo il critico)

## Idee per dopo
- Menu «Altre azioni» unico per card, quando ci sarà il `Sheet` del kit (T14).
- Mutazione «riapri» nella coda offline Android, per avere l'undo di «fatto» anche offline.
- Schermata di dettaglio del task, dove spostare «Sollecita» (DESIGN §6.5).
