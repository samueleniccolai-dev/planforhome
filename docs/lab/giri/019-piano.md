---
giro: 019
traguardo: T8
traguardi_extra: []
tipo: costruzione
fase: costruzione
inizio: 2026-10-21T10:13:09Z
ricerca: sì
accettazione: 437c7f1
ripreso: no
---
# Piano del giro 019 — lista della spesa: chi toglie le voci (contesto 018-a) e schermata dell'app

## Fetta e traguardo
T8, parte 2, tipo `costruzione`. Prima la contestazione **018-a** dell'umano (commento sulla PR #25),
che cambia la decisione 61; poi la correzione del replay delle voci sul `taskId` dell'URL (dubbio del
giro 018); poi la parte app di T8 (schermata della lista, Playwright), che il giro 018 ha lasciato a
questo giro. Le tre parti stanno insieme: la schermata deve già mostrare le voci tolte e «aggiunta
da X», altrimenti andrebbe rifatta. Se il budget si sfora, la parte app si ferma e passa al giro 020
(lo si scrive nel rapporto); il server della contestazione no.

Dopo questo giro il «Fatto quando» di T8 è coperto; T8 resta `in-corso` fino alla verifica in
produzione.

Fonti: SPEC §2.2.7, §5 (nessuna riga per le voci: vale la contestazione 018-a), §6 (`shopping_item`),
§7 (`mutation_id`, `version`, `change_log`); Appendice A; DECISIONI 34, 56, 61 (contestata), 62, 63.
Codice: `server/.../shopping/` (`ShoppingService`, `ShoppingRepository`, `ShoppingController`),
`task/TaskService.spawnNext`, `demo/DemoDataSeeder`, migrazioni `V1`–`V4`; app `app/app/family.tsx`,
`app/src/task/` (`TasksSection`, `TaskSummary`, `NewTaskForm`), `app/src/api/client.ts`,
`app/src/i18n/{it,en}.json`.

## La contestazione 018-a, come la si applica
Testo dell'umano (riassunto fedele):
- sulle voci **tutti i membri** aggiungono, spuntano e riordinano;
- **togliere una voce:** il creatore della lista e i gestori la tolgono davvero; un altro membro la
  **riga** («tolta da X»): la voce resta visibile **in fondo alla lista, separata dalle spuntate**, e
  si può **ripristinare**;
- le voci aggiunte da chi non è il creatore della lista mostrano **chi le ha aggiunte**;
- **«Togli le spuntate»** solo per creatore, gestori e assegnatario;
- sulle voci servono `created_by` e `removed_by` (solo colonne aggiunte, migrazione nuova);
- in una lista **inoltrata**, se il creatore non è nella famiglia di arrivo, valgono solo i gestori.

«Creatore della lista» = `task.created_by`. «Gestore» = ruolo `MANAGER` nella famiglia dove sta la
lista **ora**. «Assegnatario» = `task.assignee_person_id`. Il chiamante è sempre già membro della
famiglia della lista (altrimenti 404): quindi la regola dell'inoltro vale da sola, perché un creatore
che non è nella famiglia di arrivo non arriva nemmeno all'endpoint (vedi ratifica 019-a).

La decisione 61 diventa `cambiata (giro 019)`. SPEC §5 non ha una riga per le voci: aggiungerla è
una PR umana (lo si scrive in «Per l'umano» del rapporto).

## Cosa si costruisce

### Server
- **Migrazione `V5__shopping_item_authors.sql`** (solo aggiunte):
  - `created_by uuid references person(id)`; le righe esistenti prendono il `created_by` del loro
    task (`update … from task`); poi `set not null`;
  - `removed_by uuid references person(id)` (nullo).
  - Stati di una voce: **viva** (`removed_by` nullo, `deleted_at` nullo); **tolta da un membro**,
    cioè rigata (`removed_by` valorizzato, `deleted_at` nullo); **cancellata** (`deleted_at`
    valorizzato; `removed_by` = chi l'ha cancellata).
- **Vista della voce:** si aggiungono `createdBy` (uuid) e `removedBy` (uuid o `null`). `GET items`
  restituisce le voci non cancellate (vive e rigate), in ordine di `position`; il raggruppamento
  lo fa l'app.
- **Aggiunta:** `created_by` = chiamante. Spunta e riordino: invariati, per tutti i membri.
- **`POST …/items/{itemId}/remove`** `{ mutationId }` → 200 con la voce:
  - chiamante creatore della lista o gestore → la voce è **cancellata** (`deleted_at`,
    `removed_by` = chiamante, `version` +1, `change_log` `DELETE`); vale anche su una voce già
    rigata;
  - altro membro → la voce è **rigata** (`removed_by` = chiamante, `version` +1, `change_log`
    `UPSERT`); su una voce già rigata → 409 `item_removed`.
- **`POST …/items/{itemId}/restore`** `{ mutationId }` → 200 con la voce: qualunque membro;
  `removed_by` torna nullo, `version` +1, `change_log` `UPSERT`. Su una voce non rigata → 409
  `not_removed`; su una cancellata → 404.
- **Spunta di una voce rigata** → 409 `item_removed` (si ripristina prima).
- **`clear-checked`:** solo creatore della lista, gestore o assegnatario; gli altri → **403
  `forbidden`**, nessun effetto. Cancella le voci vive spuntate (`removed_by` = chiamante); **non
  tocca le rigate**, anche se spuntate.
- **Riordino:** invariato. Le voci rigate non elencate seguono in fondo (regola già in vigore per le
  voci non elencate); se elencate, si spostano come le altre.
- **Lista ciclica (`copyOpenItems`):** passano le voci vive non spuntate, **non le rigate**; la copia
  conserva il `created_by` della voce di origine.
- **Correzione del replay (dubbio 018):** nel replay di aggiunta, spunta, `remove` e `restore`, la
  voce registrata in `applied_mutation` deve appartenere al task dell'URL; se no → **409
  `mutation_conflict`**, nessun effetto. Vale anche per l'aggiunta senza `id` del client.
- **Ordine dei controlli** (come decisione 62, esteso): (1) appartenenza alla famiglia e task nella
  famiglia → 404; (2) `mutationId` mancante o non UUID → 400 `invalid_request`; (3) lock famiglia e
  task; (4) replay (stesso chiamante, operazione, entità **e task dell'URL**) → 200 con lo stato
  attuale, altrimenti 409 `mutation_conflict`; (5) `not_shopping_list`; (6) `not_open`; (7) voce non
  del task o cancellata → 404; (8) `item_removed` / `not_removed`; (9) permesso di `clear-checked`
  → 403; (10) validazione del corpo. Operazioni nuove in `applied_mutation`: `item.remove`,
  `item.restore`.
- **Dati demo:** le 3 voci di «Lista della spesa» hanno `created_by` = Giulia (il seeder passa il
  creatore a `addItems`).

### App (web e Android, testi con chiavi it/en)
- `Task` del client espone `template`. Nella lista dei task della famiglia, un task
  `SHOPPING_LIST` ha il link **«Apri la lista «<titolo>»»** (en «Open the list «<title>»») verso la
  schermata nuova `app/app/list.tsx?family=<f>&task=<t>`.
- **Modulo «Aggiungi task»:** un interruttore (role `switch`) **«Lista della spesa»** (en
  «Shopping list»); acceso → `template: "SHOPPING_LIST"` nel `POST`, spento → campo assente.
- **Schermata della lista** (titolo = titolo del task, heading livello 1), tre elenchi con nome:
  - **«Da prendere»** (en «To get»): voci vive non spuntate, in ordine di `position`;
  - **«Spuntate»** (en «Checked»): voci vive spuntate, in ordine di `position`;
  - **«Voci tolte»** (en «Removed items»): voci rigate, con «tolta da <nome>» (en «removed by
    <name>») e il pulsante **«Ripristina «<voce>»»** (en «Restore «<item>»»).
  - Ogni voce viva: casella (role `checkbox`, nome = testo della voce) e pulsante **«Togli
    «<voce>»»** (en «Remove «<item>»»). Le voci aggiunte da chi non è il creatore mostrano
    «aggiunta da <nome>» (en «added by <name>»). I nomi vengono da `members` della famiglia; una
    persona non più nella famiglia → «qualcuno» (en «someone»).
  - In «Voci tolte», per il creatore della lista (se membro della famiglia) e per i gestori, anche
    **«Togli «<voce>»»** (aiuto alla vista; decide il server): la voce rigata viene cancellata.
  - **Riordino nell'app («Sposta su/giù»): non in questo giro, passa al giro 020** (critica: è il
    pezzo che cade per primo; il server del riordino c'è già dal giro 018).
  - **Aggiunta rapida:** campo **«Nuova voce»** (en «New item»); invio → `POST items` con
    `mutationId` e `id` UUIDv7 del client (`app/src/task/ids.ts`), la voce compare in fondo a «Da
    prendere», il campo si svuota **quando parte la richiesta** e resta col fuoco (`submitBehavior`
    + `focus()`, ricerca); invio su un campo vuoto o di soli spazi non manda nulla, quindi due invii
    rapidi mandano un solo `POST`.
  - **«Togli le spuntate»** (en «Remove checked items»): visibile solo se il chiamante è il creatore
    della lista, gestore della famiglia o assegnatario (aiuto alla vista; decide il server); un 403
    mostra l'avviso (role `alert`) «Solo chi ha creato la lista, un gestore o l'assegnatario
    possono togliere le spuntate».
  - L'esito di `remove` lo dice il server: voce con `deletedAt` → sparisce; con `removedBy` → passa
    in «Voci tolte». L'app non decide da sola se cancellare o rigare.
  - 404 su lettura → avviso «Lista non trovata» (en «List not found»); 409 `not_open` → avviso «La
    lista è chiusa» e ricarica; 401 → login.
  - **Schermata non aggiornata:** una scrittura (spunta, togli, ripristina) che riceve 409
    `item_removed`, 409 `not_removed` o 404 ricarica le voci e mostra l'avviso (role `alert`) «La
    lista è cambiata nel frattempo ed è stata aggiornata» (en «The list changed in the meantime and
    has been updated»).
- Codice: logica pura (raggruppamento in tre elenchi, chi vede «Togli le spuntate» e «Togli» sulle
  rigate) in `app/src/shopping/logic.ts`
  con test Jest; schermata in `app/src/shopping/ShoppingList.tsx`; nessuna logica di permesso oltre
  alla visibilità di «Togli le spuntate».

## Dati demo dei test (inventati)
Persone e famiglie dell'Appendice A: Principale (Marco, Giulia gestori; Leo, Sofia risorse); Mamma
(Anna, Pietro gestori; Giulia, Luca, Paolo, Davide membri); Babbo (Rosa, Franco gestori; Marco
membro). Marco non è in Mamma.

Server:
- **«Spesa del sabato»**, Mamma, creata da Luca, in coda, `SHOPPING_LIST`. Luca aggiunge «Latte»,
  «Pane»; Davide aggiunge «Uova», «Mele».
- **«Spesa della domenica»**, Mamma, creata da Luca, `SHOPPING_LIST`, vuota (per il replay).
- **«Spesa per la nonna»**, Principale, creata da Marco, `SHOPPING_LIST`, in coda; Marco aggiunge
  «Pasta», Giulia aggiunge «Riso», «Olio»; Giulia (gestore in Principale, P11) la inoltra in Mamma.
- **«Spesa settimanale»**, Mamma, creata da Luca, `SHOPPING_LIST`, DATE `2031-02-01` (sabato), ogni
  settimana il sabato, in coda; Luca aggiunge «Pasta», Davide «Riso», «Caffè», Paolo «Zucchero».

App (API finta nel browser, `app/e2e/acceptance/giro-019-fake-api.ts`, id delle persone dei giri
014 e 016):
- Principale, **«Lista della spesa»** creata da Giulia: «Latte», «Pane», «Mele» (Giulia),
  «Biscotti» (Marco). Utente: Giulia (gestore, creatore).
- Mamma, **«Spesa per la nonna»** creata da Marco (inoltrata da Principale; Marco non è in Mamma):
  «Uova» (Marco), «Farina» (Luca), «Zucchero» (Pietro, che non è in Mamma: «aggiunta da qualcuno»;
  spuntata), «Sale» (Anna, rigata da Luca). Utenti: Luca e Giulia (membri), Anna (gestore).
- Mamma, **«Spesa del sabato»** creata da Anna, assegnata a Luca: «Pane» (Anna, spuntata).
- Principale, «Ritirare le foto» (senza template), creata da Marco. Marco (gestore non creatore)
  apre anche «Lista della spesa».

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro019*AcceptanceTest' test` → verde, con:
  - **Tutti scrivono:** Davide e Paolo (membri, non creatori) aggiungono, spuntano e riordinano su
    «Spesa del sabato» → 201/200.
  - **Autore:** `GET items` dà `createdBy` Luca per «Latte», «Pane» e Davide per «Uova», «Mele»;
    `removedBy` `null` per tutte.
  - **Togliere, creatore e gestore:** Luca toglie «Latte» → 200, `deletedAt` valorizzato,
    `removedBy` Luca; non c'è più in `GET items`; `change_log` `DELETE`. Anna (gestore) toglie
    «Pane» → lo stesso.
  - **Rigare, membro:** Davide toglie «Uova» → 200, `deletedAt` `null`, `removedBy` Davide,
    `version` +1; resta in `GET items`; `change_log` `UPSERT`. Paolo toglie di nuovo «Uova» (altro
    `mutationId`) → 409 `item_removed`; Paolo spunta «Uova» → 409 `item_removed`.
  - **Ripristino:** Paolo ripristina «Uova» → 200, `removedBy` `null`, `version` +1; ripristino di
    «Mele» (non rigata) → 409 `not_removed`; ripristino di «Latte» (cancellata) → 404. Luca toglie
    una voce rigata → cancellata.
  - **Togli le spuntate:** spuntate «Uova» e «Mele», Davide → 403 `forbidden`, nessuna voce
    cambia; Luca (creatore) → 200; con nuove spunte, Anna (gestore) → 200; Anna assegna la lista a
    Paolo (P4), Paolo (assegnatario) → 200. Una voce spuntata e poi rigata resta dopo
    `clear-checked`, rigata.
  - **Replay:** stesso `mutationId` di un `remove` → 200 con la voce com'è ora, nessuna riga
    `change_log` nuova; lo stesso per `restore`.
  - **Lista inoltrata:** «Spesa per la nonna» in Mamma: Davide toglie «Pasta» → rigata; Davide
    `clear-checked` → 403; Pietro (gestore di Mamma) toglie «Riso» → cancellata; Anna
    `clear-checked` → 200; le voci tengono `createdBy` Marco e Giulia. Poi Marco entra in Mamma con
    un codice d'invito di Anna (T4) e toglie «Olio» → **cancellata** (ratifica 019-a).
  - **Replay sul `taskId` dell'URL (dubbio 018):** Luca aggiunge «Burro» a «Spesa del sabato» con
    `mutationId` M; stessa richiesta con M sull'URL di «Spesa della domenica» → **409
    `mutation_conflict`**, «Spesa della domenica» resta vuota; lo stesso senza `id` del client; una
    spunta con `mutationId` N su «Mele», ripetuta con N e l'URL di «Spesa della domenica» → 409
    `mutation_conflict`.
  - **Lista ciclica:** in «Spesa settimanale» Davide riga «Caffè», Luca spunta «Riso», Anna segna
    fatto → l'occorrenza del `2031-02-08` ha solo «Pasta» (`createdBy` Luca) e «Zucchero»
    (`createdBy` Paolo), in quest'ordine, vive e non spuntate.
  - **Replay di `remove` e `restore` sull'URL di un'altra lista** → 409 `mutation_conflict`, nessuna
    riga `change_log` nuova (critica, punto 4).
  - **Concorrenza** (barriera, 20 ripetizioni): doppio tocco di Davide su «Togli» → 200 e 409,
    `version` +1 una volta, una sola riga `change_log`; `clear-checked` di Luca insieme alla
    rigatura di Davide di una voce spuntata → o rigata e viva, o cancellata da Luca, mai le due;
    `remove` di Luca insieme alla spunta di Davide → cancellata, spunta 200 o 404, `version`
    coerente; rigatura di Davide insieme al `remove` di Luca → sempre cancellata.
  - **Isolamento parametrico** su `remove` e `restore` (più `clear-checked` col permesso nuovo):
    Marco prima di entrare in Mamma, con gli id veri nell'URL → 404 e nessun effetto; Giulia con
    `{f}` = Principale e un task di Mamma → 404; un `itemId` di un'altra lista nell'URL → 404.
  - **Demo:** dopo il seed le 3 voci di «Lista della spesa» hanno `createdBy` = Giulia.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde, compresi i test dei giri 003/004 che percorrono
  tutti gli endpoint registrati (i due nuovi compresi) e i test del giro 018 (uno aggiornato, vedi
  sotto).
- [ ] `cd app && npx playwright test e2e/acceptance/giro-019-*` → verde, con:
  - **Apertura:** Giulia, Famiglia Principale, «Apri la lista «Lista della spesa»» → heading «Lista
    della spesa»; elenco «Da prendere» con «Latte», «Pane», «Mele», «Biscotti» in quest'ordine;
    «Biscotti» mostra «aggiunta da Marco», «Latte» no.
  - **Aggiunta rapida:** «Nuova voce», scrive «Uova», invio → `POST …/items` con `mutationId` e
    `id` UUID e `text` «Uova»; «Uova» in fondo a «Da prendere»; il campo è vuoto e ha il fuoco;
    invio su campo vuoto → nessuna richiesta.
  - **Spunta:** casella «Pane» → `PUT …/items/{id}/checked` `{ checked: true }`; «Pane» passa in
    «Spuntate»; la casella tolta → torna in «Da prendere».
  - **Doppio invio:** con il `POST` lento, due invii di «Burro» → un solo `POST`, una sola «Burro».
  - **Togli le spuntate:** spuntati «Pane» e «Mele», «Togli le spuntate» → spariscono, «Spuntate»
    è vuoto.
  - **Togliere da creatore:** Giulia, «Togli «Biscotti»» → la voce sparisce (il server risponde con
    `deletedAt`).
  - **Togliere da membro:** Luca, Famiglia Mamma, «Spesa per la nonna»: non vede «Togli le
    spuntate»; «Togli «Uova»» → «Uova» in «Voci tolte» con «tolta da Luca»; «Ripristina «Uova»» →
    torna in «Da prendere»; su «Sale» (rigata) vede «Ripristina» e non «Togli»; «Farina» mostra
    «aggiunta da Luca», «Zucchero» «aggiunta da qualcuno».
  - **L'app segue il server:** se `remove` di Giulia (creatore) risponde con `removedBy` e senza
    `deletedAt`, «Biscotti» va in «Voci tolte».
  - **Lista inoltrata:** Giulia (membro di Mamma) riga «Farina» e non vede «Togli le spuntate»; Anna
    (gestore) toglie le spuntate («Zucchero» sparisce) e toglie «Sale» dalle «Voci tolte».
  - **Chi vede «Togli le spuntate»:** Marco (gestore, non creatore) su «Lista della spesa» sì; Luca
    (assegnatario) su «Spesa del sabato» sì; Luca e Giulia (membri) su «Spesa per la nonna» no.
  - **Schermata non aggiornata:** «Pane» rigata da Marco sul server dopo l'apertura, spunta → avviso
    «La lista è cambiata nel frattempo ed è stata aggiornata», «Pane» in «Voci tolte» con «tolta da
    Marco»; lo stesso per un ripristino (409 `not_removed`) e un «Togli» (404).
  - **Lista non trovata:** id sconosciuto nell'URL → avviso «Lista non trovata».
  - **403:** se il server risponde 403 a «Togli le spuntate» → avviso «Solo chi ha creato la lista,
    un gestore o l'assegnatario possono togliere le spuntate».
  - **Modulo:** Giulia crea «Spesa del weekend» con l'interruttore «Lista della spesa» acceso → il
    `POST` del task ha `template: "SHOPPING_LIST"`; e il link «Apri la lista «Spesa del weekend»»
    compare.
  - **Inglese:** con lingua `en`, gli stessi elenchi e controlli si trovano per «To get», «Checked»,
    «Removed items», «New item», «Remove checked items», «Open the list «…»», «Remove «…»»,
    «Restore «…»», «removed by», «added by», «someone».
- [ ] `cd app && npx tsc --noEmit && npx eslint . && npm test` → verde (Jest su
  `app/src/shopping/logic.ts`: raggruppamento in tre elenchi, visibilità dei pulsanti).
- [ ] `cd app && npx playwright test` → verde (tutti i giri, chiavi di traduzione comprese).
- [ ] CI della PR: build web e build dell'APK verdi.
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → l'unico rilievo atteso
  è la modifica di un test di accettazione del giro 018 (revisione umana).

## Fuori perimetro
- Modifica del testo di una voce; trascinamento per il riordino; «spuntata da X» (`checked_by`).
- Riordino nell'app con «Sposta su/giù» (fuoco dopo lo spostamento, ultima voce, `PUT order` con
  rigate presenti): giro 020.
- Storico delle voci tolte, annulla, notifiche sulle voci.
- Cambio del template di un task esistente; permessi sul task stesso (SPEC §5 invariata).
- Aggiornare SPEC §5 con una riga per le voci: PR umana.
- Voci nella lettura per `seq`, fotografia, offline e spunte offline, replay dopo un inoltro: T9.
- Test specifici dell'interfaccia su Android oltre alla build dell'APK (Playwright solo sul web).
- Promemoria (T10).
- Da `traguardi.json`: template 730, scansione e PDF; calendario come vista dedicata; accesso con
  Google o Apple, iPhone, Play Store; email di verifica e recupero; sincronizzazione in tempo reale e
  offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `Giro019ShoppingRemovalAcceptanceTest.java` | tutti scrivono; autore; togliere da creatore/gestore cancella, da membro riga; ripristino; `item_removed`, `not_removed`; replay di remove/restore |
| `Giro019ClearCheckedAcceptanceTest.java` | `clear-checked` solo creatore, gestore, assegnatario; le rigate restano |
| `Giro019ForwardedListAcceptanceTest.java` | lista inoltrata: valgono i gestori; il creatore che entra dopo nella famiglia di arrivo torna creatore |
| `Giro019ReplayTaskAcceptanceTest.java` | replay di aggiunta e spunta con l'URL di un'altra lista → 409 `mutation_conflict`, nessun effetto |
| `Giro019ShoppingSeriesAcceptanceTest.java` | la nuova occorrenza riceve le vive non spuntate, non le rigate, con `createdBy` conservato |
| `Giro019ShoppingConcurrencyAcceptanceTest.java` | doppio tocco su «Togli»; `clear-checked` contro rigatura; `remove` contro spunta; rigatura contro `remove` del creatore (20 ripetizioni) |
| `Giro019ShoppingIsolationAcceptanceTest.java` | `remove`, `restore`, `clear-checked`: id di altre famiglie e liste nell'URL → 404 |
| `Giro019DemoShoppingAcceptanceTest.java` | voci demo con `createdBy` Giulia |
| `Giro019AcceptanceSupport.java` | supporto: famiglie, liste, chiamate di `remove` e `restore` (riusa `Giro018AcceptanceSupport` dove può) |
| `Giro018ShoppingIsolationAcceptanceTest.java` (aggiornato) | `clear-checked` su «Spesa del sabato» lo fa Anna (gestore), non Giulia (membro): con 018-a contestata Giulia riceve 403 |
| `app/e2e/acceptance/giro-019-shopping.spec.ts` | L1–L17: apertura, aggiunta rapida, doppio invio, spunta, togli le spuntate, togliere (creatore, membro, server che decide), lista inoltrata, chi vede «Togli le spuntate», 403, schermata non aggiornata, lista non trovata, modulo, inglese |
| `app/e2e/acceptance/giro-019-fake-api.ts` | API finta: task, membri, voci e i loro 7 endpoint, con le regole del server sopra |

## Porte
- Doppio senso previste:
  - **ratifica 019-a:** il «creatore della lista» conta solo se è membro della famiglia dove sta la
    lista nel momento dell'azione: dopo un inoltro valgono solo i gestori; se il creatore entra
    poi nella famiglia di arrivo, torna creatore. Alternativa: perdere per sempre i diritti del
    creatore dopo l'inoltro (servirebbe una colonna in più sul task).
  - **ratifica 019-b:** una voce rigata la ripristina qualunque membro; non si spunta (409
    `item_removed`); «Togli le spuntate» non la tocca; non passa alla nuova occorrenza della serie.
  - **ratifica 019-c (interfaccia):** tre elenchi «Da prendere», «Spuntate», «Voci tolte»; riordino
    con pulsanti «Sposta su/giù» invece del trascinamento; «Togli le spuntate» mostrato solo a chi
    può.
  - registro: forma di `remove`/`restore` (`POST`, non `DELETE`), codici `item_removed` e
    `not_removed`, backfill di `created_by` dal task.
- Senso unico: nessuna. Nessuna dipendenza nuova (niente librerie di trascinamento). `V5` aggiunge
  due colonne; il backfill e il `not null` toccano solo la colonna nuova.

## Rischi di concorrenza
- `remove` e `check` in parallelo sulla stessa voce: entrambi sotto il lock della famiglia e del
  task; uno arriva prima. Se il primo cancella, la spunta prende 404; se il primo riga, la spunta
  prende 409 `item_removed`. Test con barriera, 20 ripetizioni: mai una voce cancellata e spuntata
  dopo, mai `version` saltata.
- `remove` di un membro e `remove` del creatore in parallelo sulla stessa voce: alla fine la voce è
  cancellata o rigata-poi-cancellata, mai «viva»; le righe `change_log` sono coerenti con l'ordine.
- `restore` e `clear-checked` in parallelo: la voce ripristinata e spuntata è cancellata solo se
  `clear-checked` arriva dopo il ripristino; mai metà.
- Replay in parallelo dello stesso `mutationId`: la PK di `applied_mutation` ne fa passare uno
  (decisione 34); il controllo del task dell'URL avviene sotto lock.
- `spawnNext` copia sotto lo stesso lock del «fatto»: una rigatura concorrente arriva prima (la voce
  non passa) o dopo (lista chiusa, 409 `not_open`).

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`, traduzioni comprese) ≤ 580: server
≤ 180 (migrazione, servizio, repository, controller, seeder), app ≤ 400 (schermata, logica, client,
link, interruttore, traduzioni). File toccati ≤ 16. Una sessione. Se la parte server supera 180
righe o la sessione non basta, la parte app passa al giro 020.

## Domande per il ricercatore (al massimo 3)
1. Nelle app di liste condivise (Bring!, OurGroceries, AnyList, Google Keep, Microsoft To Do) come
   si mostrano le voci spuntate e quelle tolte da un altro (sezione separata, barrato, ripristino) e
   «aggiunta da X»? Cosa si aspetta chi usa la lista.
2. Riordino accessibile senza trascinamento: schema WAI-ARIA e pratiche consigliate per pulsanti
   «sposta su/giù» (etichette, fuoco dopo lo spostamento, annuncio), anche su React Native Web.
3. Aggiunta rapida con invio in React Native (Expo, web e Android): come tenere il fuoco nel campo
   dopo l'invio (`onSubmitEditing`, `blurOnSubmit`/`submitBehavior`) secondo la documentazione
   ufficiale della versione in uso.

## Critica ricevuta e cosa cambia
Accolti 4 punti DA CORREGGERE su 4, più 6 delle 8 aggiunte; 2 aggiunte rinviate col riordino.
| Punto | Esito | Perché |
|---|---|---|
| 1. 409 `item_removed`/`not_removed`/404 in scrittura su schermata vecchia | accolto | ricarica + avviso; L13, L14 |
| 2. doppio invio nell'aggiunta rapida | accolto | campo svuotato alla partenza; L3 |
| 3. creatore/gestori tolgono una voce rigata | accolto (non fuori perimetro) | «Togli» anche in «Voci tolte» per loro; L8 (Luca no), L10 (Anna sì) |
| 4. replay di `remove`/`restore` sul `taskId` dell'URL | accolto | `Giro019ReplayTaskAcceptanceTest` |
| concorrenza: doppio tocco, `clear-checked` contro rigatura | accolto | più `remove` contro spunta e rigatura contro `remove` (rischi già nel piano) |
| app: server che risponde `removedBy` a un creatore | accolto | L7 |
| visibilità «Togli le spuntate» per le tre ragioni | accolto | L5 creatore, L11 gestore non creatore e assegnatario, L8/L9 membri no |
| lista inoltrata con spuntata che sparisce; Giulia che riga | accolto | L9, L10 (dati demo dell'app cambiati: «Spesa per la nonna» creata da Marco) |
| «Sposta giù» ultima disabilitata; `PUT order` con rigata; fuoco dopo sposta | rinviato al giro 020 | il riordino nell'app è il pezzo che cade per primo (consiglio del critico): con i punti 1–3 il budget app non regge |

Nota: `davideAndPaoloAddCheckAndReorderAListThatIsNotTheirs` controlla anche `createdBy` della voce
nuova, così è rosso per la ragione giusta e non solo una guardia della regola già in vigore.

## Idee per dopo
- Riordino nell'app con «Sposta su/giù», fuoco sul pulsante spostato e annuncio (giro 020).
- «Spuntata da X» (`checked_by`).
- Modifica del testo di una voce.
- Riga di SPEC §5 per le voci (PR umana).
