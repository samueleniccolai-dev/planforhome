---
giro: 018
traguardo: T8
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-21T06:35:32Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 018 — lista della spesa

## Fetta e traguardo
T8, parte 1 (server), tipo `costruzione`: T7 è passato nel giro 017, T8 è il primo `da-fare`, senza
integrazioni. T8 intero (tabella, 5 endpoint, fusione concorrente, passaggio delle voci nella serie,
schermata dell'app con Playwright) supera una sessione: questo giro fa **tutta l'API e il
database**; **resta per il giro 019** la parte app (aggiunta rapida, spunta, riordino, «togli le
spuntate» sul web e test Playwright di queste azioni). T8 resta `in-corso`.

Fonti: SPEC §2.2.7, §5 (P9 come riferimento, decisione 018-a sotto), §6 (`task.template`,
`shopping_item`, `change_log`), §7 (`mutation_id`, `version`, fusione voce per voce); Appendice A
(task demo «Lista della spesa»); DECISIONI 33, 34, 46, 58. Codice: `server/.../task/`
(`TaskService.create`, `spawnNext`, `TaskRepository.insertNext`), `demo/DemoDataSeeder.java`,
migrazioni `V1`–`V3`.

## Cosa si costruisce

### Server
- **Migrazione `V4__shopping_items.sql`** (solo aggiunte): tabella `shopping_item` come SPEC §6 —
  `id uuid pk`, `task_id uuid not null references task(id)`, `text text not null`,
  `checked boolean not null default false`, `position int not null`, `version bigint not null`,
  `created_at`, `updated_at timestamptz not null`, `deleted_at timestamptz`; indice su
  `(task_id, position)`.
- **Template alla creazione:** `NewTask` accetta `template` (`NONE` predefinito, `SHOPPING_LIST`);
  altro valore → 400 `template_invalid`. `View` espone `template`. Il `PUT` del task non lo cambia.
- **Package `shopping`** (servizio, repository, controller; nessuna logica nel controller). Voce
  vista come `{ id, taskId, text, checked, position, version, updatedAt }`.
  - `GET /api/families/{f}/tasks/{t}/items` → voci non cancellate, in ordine di `position`.
  - `POST …/items` `{ mutationId, id?, text }` → **201**, voce in fondo (`position` = max + 1),
    `checked=false`, `version=1`. `text` tolti gli spazi, 1–200 caratteri, altrimenti 400
    `text_invalid`. `id` del client già in uso altrove (`FamilyRepository.idInUse`, esteso a
    `shopping_item`) → 409 `id_conflict`.
  - `PUT …/items/{itemId}/checked` `{ mutationId, checked }` → 200; tocca **solo quella riga**
    (`version` +1 della voce, il task non cambia `version`): due spunte su voci diverse non si
    pestano.
  - `PUT …/items/order` `{ mutationId, itemIds: [...] }` → 200 con la lista intera. Vince l'ultimo
    arrivato: le voci elencate prendono le posizioni 0..n-1 nell'ordine dato; le voci vive non
    elencate (aggiunte nel frattempo) seguono, nel loro ordine precedente; id di voci cancellate
    dello stesso task si ignorano; id che non sono voci di quel task → 400 `invalid_request`, nessun
    effetto. `version` +1 su ogni voce che cambia posizione.
  - `POST …/items/clear-checked` `{ mutationId }` → 200 con la lista rimasta; le spuntate prendono
    `deleted_at` (riga `change_log` `DELETE` per ciascuna), le altre restano.
  - **Regole comuni:** chiamante non membro di `{f}`, task non in `{f}`, voce non del task → **404**;
    task con `template=NONE` → 409 `not_shopping_list`; task non `OPEN` → 409 `not_open`;
    `mutationId` mancante o non UUID → 400 `invalid_request`; replay dello stesso `mutationId`
    (stesso chiamante, stessa operazione e stessa entità) → 200 con lo stato attuale e nessun
    effetto nuovo, altrimenti 409 `mutation_conflict`. Ogni scrittura scrive `applied_mutation` e
    `change_log` (`entity = 'shopping_item'`, `family_id` del task) nella stessa transazione, con il
    lock della famiglia come le scritture dei task.
  - **Permessi (decisione 018-a, da ratificare):** ogni utente membro della famiglia, gestore o
    membro, aggiunge, spunta, riordina e toglie le voci di qualunque lista aperta della famiglia.
    SPEC §5 non ha una riga per le voci; P9 («solo i propri task») renderebbe la lista non
    condivisibile. Si cambia con una riga di codice.
- **Lista ciclica:** in `spawnNext`, se il task è `SHOPPING_LIST`, la nuova occorrenza riceve una
  copia delle voci **non spuntate e non cancellate** (id nuovi UUIDv7, stesso testo, stesso ordine,
  `checked=false`, `version=1`, riga `change_log` `UPSERT` ciascuna); le spuntate no. Le voci
  dell'occorrenza chiusa restano com'erano. «Termina la serie» non copia nulla (non crea occorrenze).
- **Dati demo:** «Lista della spesa», Famiglia Principale, creata da Giulia, in coda, senza
  scadenza, `template=SHOPPING_LIST`, voci «Latte», «Pane», «Mele» (Appendice A). Si crea con la
  regola di decisione 37: una volta per titolo nella famiglia.

## Dati demo dei test (inventati)
Persone e famiglie dell'Appendice A (Giulia, Marco gestori di Principale; Anna gestore, Luca e
Davide membri di Mamma; Marco non è in Mamma). Task creati dai test:
- «Spesa del sabato», Famiglia Mamma, creata da Luca, in coda, `SHOPPING_LIST`; voci «Latte»,
  «Pane», «Uova», «Mele».
- «Spesa settimanale», Famiglia Principale, creata da Giulia, `SHOPPING_LIST`, DATE
  `2031-02-01` (sabato), ogni settimana il sabato, in coda; voci «Pasta», «Riso», «Caffè»,
  «Zucchero».
- «Ritirare le foto», Famiglia Principale, `template` assente (`NONE`).

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro018*AcceptanceTest' test` → verde, con:
  - **Creazione:** Luca crea «Spesa del sabato» con `template: "SHOPPING_LIST"` → 201, `template` =
    `SHOPPING_LIST`; senza `template` → `NONE`; `template: "730"` → 400 `template_invalid`.
  - **Aggiunta con una riga:** Luca aggiunge «Latte», «Pane», «Uova», «Mele» → 4 × 201; `GET items`
    → quell'ordine, `position` crescenti, tutte `checked=false`; testo `"  Latte  "` salvato come
    `Latte`; testo vuoto o di 201 caratteri → 400 `text_invalid`.
  - **Spunta:** Davide (membro, non creatore) spunta «Pane» → 200, `checked=true`, `version` 2;
    `version` del task invariata; rispunta a `false` → `checked=false`.
  - **Riordino:** Anna manda `[Mele, Latte, Uova, Pane]` → 200 e `GET items` in quell'ordine.
  - **Togli le spuntate:** spuntati «Pane» e «Uova», `clear-checked` → 200 con «Mele», «Latte»;
    nel database le due hanno `deleted_at`; `change_log` ha 2 righe `DELETE` `shopping_item`.
  - **Fusione concorrente (server):** due richieste in parallelo (barriera, 2 thread), Luca spunta
    «Latte» e Davide spunta «Mele» → entrambe 200 e alla fine entrambe `checked=true`; due aggiunte
    parallele («Burro», «Sale») → entrambe presenti, `position` distinte.
  - **Riordino concorrente:** Luca manda `[A, B, C]` e poi Davide `[C, B, A]` partendo dalla stessa
    lettura → entrambe 200; vince l'ultimo: ordine finale `C, B, A`. Un riordino che non elenca una
    voce aggiunta nel frattempo la lascia in fondo, viva.
  - **Lista ciclica:** in «Spesa settimanale» Giulia spunta «Riso» e «Caffè» e segna fatto →
    l'occorrenza del `2031-02-08` ha solo «Pasta», «Zucchero», in quest'ordine, non spuntate, con
    id nuovi; l'occorrenza chiusa conserva le sue 4 voci. Con «annulla questa volta» vale lo stesso;
    con «Termina la serie» nessuna voce nuova.
  - **Regole:** voci su «Ritirare le foto» (`NONE`) → 409 `not_shopping_list`; su una lista `DONE`
    → 409 `not_open`; `mutationId` mancante → 400; stesso `mutationId` ripetuto per un'aggiunta →
    200, una voce sola; stesso `mutationId` usato per un'altra voce → 409 `mutation_conflict`;
    `itemIds` con una voce di un'altra lista → 400 `invalid_request`, ordine invariato.
  - **Isolamento parametrico** (ogni endpoint nuovo: GET, POST, PUT checked, PUT order,
    clear-checked): Marco (non in Mamma) con gli id veri nell'URL → 404 e nessun effetto; Giulia
    con `{f}` = Principale e il task di Mamma → 404; un `itemId` di «Spesa settimanale» nell'URL di
    «Spesa del sabato» → 404; un `id` del client che è già un task o una voce altrui → 409
    `id_conflict`; le righe `change_log` delle voci hanno il `family_id` della famiglia del task.
  - **Demo:** dopo il seed, Principale ha «Lista della spesa» in coda, `SHOPPING_LIST`, con
    «Latte», «Pane», «Mele»; un secondo seed non la duplica.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (test esistenti compresi, isolamento di giro 003
  che percorre tutti gli endpoint registrati).
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → verde.

## Fuori perimetro
- Tutta l'app (schermata della lista, aggiunta rapida con invio, spunta, riordino, «togli le
  spuntate», scelta del template nel modulo «Aggiungi task») e i test Playwright: **giro 019**.
- Modifica del testo di una voce; cancellazione di una singola voce; voci su task non aperti.
- Cambio del template di un task esistente.
- Voci nella lettura per `seq`, fotografia, offline e spunte offline: T9.
- Voci nel `change_log` della famiglia di arrivo dopo un inoltro (le voci seguono il task per
  `task_id`; la loro sincronizzazione è di T9).
- Promemoria (T10). Il dubbio di 017 sull'ora delle serie DATETIME inoltrate tra fusi: non è T8.
- Da `traguardi.json`: template 730, scansione e PDF; calendario; accesso Google/Apple, iPhone,
  Play Store; email di verifica e recupero; sync in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `Giro018ShoppingAcceptanceTest.java` | creazione con template, aggiunta, spunta, riordino, togli le spuntate, regole, idempotenza |
| `Giro018ShoppingConcurrencyAcceptanceTest.java` | spunte e aggiunte parallele si fondono; riordino: vince l'ultimo |
| `Giro018ShoppingSeriesAcceptanceTest.java` | fatto / annulla questa volta passano le non spuntate; termina la serie no |
| `Giro018ShoppingIsolationAcceptanceTest.java` | ogni endpoint nuovo, id nell'URL e nel corpo di un'altra famiglia → 404/409 |
| `Giro018DemoShoppingAcceptanceTest.java` | «Lista della spesa» demo con le 3 voci, nessun duplicato |

## Porte
- Doppio senso previste: decisione 018-a (permessi sulle voci, da ratificare); forma degli
  endpoint e codici d'errore; riordino tollerante alle voci mancanti; limite di 200 caratteri.
- Senso unico: nessuna. Nessuna dipendenza nuova; la migrazione `V4` solo aggiunge.

## Rischi di concorrenza
- Due aggiunte parallele leggono lo stesso `max(position)`: si serializzano con il lock della
  famiglia già usato dalle scritture dei task (o un lock sulla riga del task); il test con barriera
  lo prova (posizioni distinte).
- Spunte parallele su voci diverse: update della sola riga, nessuna lettura-modifica-scrittura della
  lista; il test prova che nessuna si perde.
- Riordino contro aggiunta: le voci non elencate restano vive in fondo; il test lo prova.
- Replay di un `mutationId` in parallelo: la PK di `applied_mutation` ne fa passare uno; l'altro
  vede il replay (decisione 34).
- `spawnNext` copia le voci sotto lo stesso lock del «fatto»: una spunta concorrente arriva prima o
  dopo, mai a metà; dopo il «fatto» la lista chiusa risponde 409 `not_open`.

## Budget
Righe di produzione (`server/src/main`) ≤ 380; app 0; file toccati ≤ 10; una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna: `ricerca: no` (API e database, nessuna schermata in questo giro; la ricerca sull'uso della
lista va nel giro 019).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Giro 019: schermata della lista sul web e su Android, con Playwright.
- Mostrare nella lista «spuntato da X» (servirebbe `checked_by`).
