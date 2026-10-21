---
giro: 023
traguardo: T9
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-21T16:51:37Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 023 — T9 parte 1: l'API di sincronizzazione sul server

## Fetta e traguardo
T9 (offline e sincronizzazione), tipo `costruzione`. T9 è il primo traguardo non passato ed è
troppo grande per una sessione: questa fetta fa **solo la metà server**, cioè la parte «test di
accettazione del server con client simulati» del «Fatto quando». È la base su cui il motore del
client si appoggia, e non richiede dipendenze nuove.
Fonti: SPEC §7 (scrittura offline, lettura per `seq`, conflitti, permessi, famiglia nuova e persa),
SPEC §4, SPEC §6 (`change_log`, `version`), decisioni 38 e 56 di `docs/lab/DECISIONI.md`.

**Cosa resta di T9 dopo questo giro:**
- motore di sincronizzazione del client (coda locale, invio in ordine, lettura per `seq`, avvisi
  di conflitto), con test Jest e rete finta che cade a metà;
- spunte della lista della spesa fatte offline che arrivano dopo la riconnessione (Jest);
- pulizia del database locale dopo un inoltro fuori dalle famiglie dell'utente o la perdita di
  un'appartenenza (Jest);
- database locale SQLite su Android: serve una dipendenza npm nuova (per esempio `expo-sqlite`),
  porta a senso unico da chiedere nel giro che la usa, non in questo.

## Fatto quando — controlli eseguibili
Contratto dell'API (il costruttore lo rispetta alla lettera; i test lo usano):

- `GET /api/sync/families/{familyId}/snapshot` → 200
  `{ "familyId", "seq", "tasks": [...], "shoppingItems": [...], "members": [...] }`.
  Lettura in una transazione `READ COMMITTED` con il `seq` letto **per primo** (massimo
  `change_log.seq` della famiglia, 0 se non ce n'è) e i dati dopo: al massimo un doppione in
  `changes`, mai un buco. `tasks` sono tutti i task della famiglia in ogni stato, con `id`,
  `version`, `status`, `assigneePersonId`, `title`, `dueAt`, `template`; `shoppingItems` sono le
  voci vive dei task della famiglia, comprese le rigate, con `id`, `taskId`, `text`, `checked`,
  `position`, `version` (le cancellate non compaiono, quindi niente `deletedAt`); `members` sono le
  persone della famiglia con `personId`, `displayName`, `role`.
- `GET /api/sync/families/{familyId}/changes?after={seq}&limit={n}` → 200
  `{ "changes": [ { "seq", "entity", "entityId", "op", "data", "deletedAt" } ], "lastSeq", "hasMore" }`.
  - **Pagina grezza:** le righe di `change_log` della famiglia con `seq > after`, in ordine di `seq`,
    al massimo `limit`. `limit` conta le righe **grezze**. `lastSeq` = `seq` più alto della pagina
    grezza (o `after` se è vuota). `hasMore` = esiste una riga della famiglia con `seq > lastSeq`.
  - **Righe restituite:** dalla pagina grezza, una sola riga per entità, con il `seq` più alto della
    pagina; in ordine di `seq` crescente. `entity` è `task` o `shopping_item`.
  - **Regola della famiglia attuale (in lettura):** se la famiglia attuale dell'entità non è
    `{familyId}` (per un task la sua `family_id`; per una voce la `family_id` del suo task), o la
    voce è cancellata, o la riga è un `DELETE`, la riga esce come cancellazione: `op = DELETE`,
    `data` nullo, `deletedAt` valorizzato. **Mai** titolo o testo di un'entità che ora sta in
    un'altra famiglia, in nessuna pagina, qualunque sia `after` o `limit`.
  - Altrimenti `op = UPSERT`, `data` = stato attuale (stessa forma della fotografia), `deletedAt` nullo.
  - `after` predefinito 0, `limit` predefinito 500, massimo 500. `after` negativo o non numerico,
    `limit` < 1, > 500 o non numerico → 400 `invalid_request`.
  - L'inoltro di una lista scrive anche una riga `UPSERT` per ogni voce viva nella famiglia di arrivo.
- `PUT /api/families/{f}/tasks/{t}` accetta un campo facoltativo `version` (numero). Ordine dei
  controlli, tutti dopo `lockFamily` e `lockTask`: (1) replay del `mutationId` già applicato → 200
  con lo stato attuale, qualunque sia `version`; (2) permessi e stato (403, 409 `not_open`); (3) se
  `version` c'è e non è la versione attuale → 409 `{ "error": "version_conflict", "current": { ...task } }`
  e nessuna scrittura. Senza `version` il comportamento resta quello di oggi (decisione 38), per il web.
- Famiglia altrui o inesistente, su entrambi gli endpoint di lettura → 404 identico. Senza login → 401.

Controlli:
- [ ] `cd server && ./mvnw -q -Dtest='Giro023*AcceptanceTest' test` → verde, cioè:
  - **S1 coda in ordine, ripetuta due volte:** Giulia manda 4 scritture con `mutationId` (crea
    «Annaffiare le piante», la prende, la modifica in «Annaffiare le piante del balcone», la segna
    fatta), poi rimanda le stesse 4 con gli stessi `mutationId` → le seconde 4 rispondono 2xx senza
    effetto. Il `PUT` di S1 **non** manda `version` (le scritture in coda sulla stessa entità non
    conoscono la versione prodotta dalle precedenti: lo decide il motore del client nel giro che
    viene). `changes?after=<seq della snapshot prima>` contiene il task una volta sola con
    `data.status = DONE` e `data.version` uguale a quella del primo «fatto»; il `change_log` grezzo
    del task ha 4 righe dopo il primo invio e 4 dopo il secondo; la versione cresce di 1 a ogni
    risposta del primo invio.
  - **S2 lettura per `seq` e paginazione:** dopo una creazione, una modifica di task e la
    cancellazione di una voce di lista, `changes?after=N` restituisce l'UPSERT del task con lo stato
    modificato e la voce con `op = DELETE`, `deletedAt` e `data` nullo; `changes?after=<lastSeq>` →
    `changes` vuoto, `hasMore = false`, `lastSeq` = `after`. Con `limit=1` la sequenza dei `lastSeq`
    è esattamente quella dei `seq` grezzi della famiglia, `hasMore` è vero fino all'ultima pagina.
    Con `limit=2` su un task scritto 3 volte, la prima pagina ha una sola riga del task (seq
    più alto delle due) e `lastSeq` = secondo `seq` grezzo. `limit=0`, `limit=501`, `after=-1`,
    `after=abc` → 400.
  - **S2b regressione con scritture parallele:** Giulia e Marco creano insieme 2 task ciascuno nella
    Famiglia Principale; la lettura a pagine con `limit=1` trova tutti e 4 i task, senza buchi.
  - **S3 inoltro visto dalla famiglia di partenza:** Giulia crea la lista «Comprare il pane» con
    «latte», «uova», «farina» nella Famiglia Principale, poi la inoltra alla Famiglia Mamma. In
    **ogni** pagina dei `changes` della Famiglia Principale (con `limit=1` da `after` = seq prima della
    creazione, e con `limit` predefinito) il task e le tre voci escono solo come `DELETE` con `data`
    nullo: nessun titolo né testo di voce compare nel corpo. Nei `changes` della Famiglia Mamma
    (`after` = seq della Mamma prima dell'inoltro) il task e le tre voci compaiono come UPSERT.
  - **S4 fotografia per chi entra:** Giulia crea «Annaffiare le piante» e «Comprare il pane» con le
    tre voci; Luca entra nella Famiglia Principale con un codice d'invito → la `snapshot` contiene
    i due task, le tre voci, i membri (Giulia, Marco, Luca con il ruolo) e un `seq` > 0; una modifica
    fatta dopo compare in `changes?after=<seq della snapshot>`, nessuna fatta prima vi compare.
  - **S5 conflitto, vince il primo:** Marco e Giulia leggono «Annaffiare le piante» alla versione v;
    Marco manda `PUT` con `version = v` → 200; Giulia manda `PUT` con `version = v` → 409
    `version_conflict` con `current.title` di Marco e `current.version = v+1`; il task conserva la
    modifica di Marco e il `change_log` non ha righe in più. Marco rimanda lo stesso `PUT` con lo
    stesso `mutationId` e `version = v` (ormai vecchia) → 200, replay, nessuna riga in più. Un `PUT`
    senza `version` di Giulia → 200 (decisione 38). «Prendi» concorrente: il secondo riceve 409
    `already_taken` con il nome di chi l'ha preso.
  - **S6 modifica non più permessa:** nella Famiglia Mamma Luca (membro) ha in coda offline, sul task
    «Prenotare il pranzo di Natale» creato da Anna e preso da lui, letto alla versione v: (1)
    rimettilo in coda, (2) modifica il titolo **con `version = v`**. Prima dell'invio Anna assegna il
    task a Pietro → (1) 403, (2) 403 (i permessi vengono prima della `version`); `changes` mostra il
    task di Pietro con il titolo invariato. Variante: «Riparare la bici», creato e preso da Luca alla
    versione v, Anna lo assegna a Pietro → (1) 403; (2) con `version = v` → 409 `version_conflict`
    (permesso valutato sullo stato vero, e Luca da creatore può ancora modificarlo); lo stesso titolo
    con la `version` di `current` → 200.
  - **S7 isolamento parametrico:** Rosa (Famiglia Babbo) chiede `snapshot` e `changes` della
    Famiglia Principale, con l'`id` nell'URL → 404 identico a quello di una famiglia inesistente;
    `changes` e `snapshot` della Famiglia Babbo non contengono nessuna entità delle altre famiglie;
    Giulia, che ha inoltrato «Comprare il pane» dalla Principale alla Mamma ed è in entrambe, non
    vede titolo né voci del task nei `changes` della Principale e Marco (solo Principale) nemmeno;
    senza login → 401. Il test di isolamento parametrico esistente (che percorre tutti gli endpoint
    registrati) resta verde con i due endpoint nuovi.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (tutti i test, Spotless).
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Fuori perimetro
- Tutto il client: motore di sync, SQLite, coda locale, avvisi di conflitto, pulizia locale (resta di T9).
- Qualunque dipendenza nuova (Maven o npm), compreso `expo-sqlite`.
- Endpoint «batch» che riceve tutta la coda in una richiesta: la coda si manda con le scritture
  esistenti, una alla volta, in ordine (Idee per dopo).
- `version` obbligatoria sulle altre scritture (take, done, assignee, voci): resta facoltativa e
  limitata al `PUT` del task; le voci si fondono una per una (SPEC §7) come già fanno.
- `change_log` per appartenenze e persone: chi perde un'appartenenza lo scopre da `GET /api/families`.
- Sincronizzazione in tempo reale; offline sul web (`traguardi.json → fuori_perimetro`).
- Template 730, calendario, accesso Google/Apple, iPhone, Play Store, email, dati reali.
- Promemoria e FCM (T10). Nessun traguardo diventa `passato` in questo giro.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Dati: come dal giro 008, ogni test registra i suoi account e le sue famiglie con i nomi
dell'Appendice A (le famiglie demo non si scrivono mai), con `Giro019AcceptanceSupport.families()`:
- Famiglia Mamma: Anna e Pietro gestori; Giulia, Luca, Paolo e Davide membri;
- Famiglia Principale: Giulia e Marco gestori (Marco non è nella Mamma);
- Famiglia Babbo: Rosa, gestrice, sola (S7).
Task inventati, creati dai test:
- Famiglia Principale: «Annaffiare le piante» (creato da Giulia, in coda), «Comprare il pane»
  (lista della spesa di Giulia, voci «latte», «uova», «farina»);
- Famiglia Mamma: «Prenotare il pranzo di Natale» (creato da Anna, preso da Luca), «Riparare la
  bici» (creato e preso da Luca);
- Famiglia Babbo: «Pulire la grondaia» (creato da Rosa).

| File | Dato … quando … allora … |
|---|---|
| `Giro023SyncAcceptanceSupport` | aiuti comuni: `snapshot`, `changes`, lettura a pagine, `PUT` con `version` |
| `Giro023SyncQueueAcceptanceTest` | S1: coda di 4 scritture rimandata due volte → effetto una volta, versioni in ordine |
| `Giro023SyncChangesAcceptanceTest` | S2, S2b, S3: modifiche, cancellazioni, paginazione grezza, 400, scritture parallele, inoltro |
| `Giro023SyncSnapshotAcceptanceTest` | S4: Luca entra → fotografia completa con `seq` e membri, poi solo le modifiche dopo |
| `Giro023SyncConflictAcceptanceTest` | S5, S6: conflitto di `version`, replay prima della `version`, «già preso» (regressione, già verde), permessi prima della `version` |
| `Giro023SyncIsolationAcceptanceTest` | S7: famiglia altrui con l'`id` nell'URL → 404 identico; Babbo pulita; inoltro senza fughe; 401 |

## Porte
- Doppio senso previste: due endpoint nuovi sotto `/api/sync/`; campo facoltativo `version` nel
  `PUT` del task (cambia la decisione 38 solo quando il campo c'è: va annotato in DECISIONI);
  forma JSON delle righe di `changes`; righe `UPSERT` di `change_log` per le voci scritte
  dall'inoltro nella famiglia di arrivo (solo righe, nessuno schema).
- Nessuna migrazione prevista: `change_log_family_idx (family_id, seq)` esiste già in V2. Se il
  costruttore ne trova bisogno, `V6__…` può solo **aggiungere**.
- Senso unico: nessuna. Niente dipendenze nuove, niente schema che toglie o rinomina.

## Rischi di concorrenza
- **Fotografia e `seq` incoerenti:** la `snapshot` legge il `seq` per primo e i dati dopo, nella
  stessa transazione `READ COMMITTED`: al massimo un doppione nei `changes` successivi, mai un buco
  (S4).
- **Buchi di `seq`:** nessun meccanismo nuovo. Ogni scrittura di `change_log` avviene dopo
  `lockFamily` della famiglia (anche l'inoltro, che blocca entrambe), quindi due transazioni della
  stessa famiglia assegnano e fanno commit dei `seq` in ordine. Va annotato in DECISIONI (con la
  regola: ogni scrittura futura su `change_log` deve passare da `lockFamily`). S2b è solo una
  regressione con due scrittori paralleli.
- **Doppio invio:** il replay di un `mutationId` non aggiunge righe a `change_log` (S1, S5).
- **Conflitto di `version`:** il confronto avviene dopo `lockTask` (riga bloccata `FOR UPDATE`), nello
  stesso ordine replay → permessi e stato → `version`; due `PUT` con la stessa `version` → uno 200,
  l'altro 409 (S5).
- **Inoltro di una lista:** senza le nuove righe `UPSERT` delle voci nella famiglia di arrivo, chi
  legge l'arrivo per `seq` non le vede; senza la regola della famiglia attuale, chi legge la partenza
  vede il titolo e i testi (S3, S7).

## Budget
Righe di produzione (`server/src/main`) ≤ 600; righe aggiunte in tutto (test compresi) ≤ 1.500;
file nuovi ≤ 8; nessuna riga in `app/`. Deve stare in una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna: `ricerca: no` (API del server, nessun cambiamento visibile alla famiglia).

## Critica ricevuta e cosa cambia
Tre punti «DA CORREGGERE», tutti accolti:
1. **Fuga di dati dalla famiglia di partenza** (UPSERT in una pagina diversa dal DELETE; voci senza
   `family_id` e senza DELETE nella partenza). Accolto: regola della famiglia attuale in lettura
   (per le voci, quella del loro task); S3 legge con `limit=1` da prima della creazione e controlla
   che nessun titolo né testo compaia in nessuna pagina; S7 copre il caso.
2. **Ordine dei controlli del `PUT`.** Accolto: replay → permessi e stato → `version`. S1 non manda
   `version`; S6 la manda (vecchia) e riceve 403; la variante di S6 riceve 409 `version_conflict`
   invece di 200 (prima il piano diceva «riesce»: con la `version` vecchia sarebbe stato un
   conflitto ignorato), poi 200 con la versione di `current`. S5 prova il replay con `version`
   vecchia.
3. **Paginazione.** Accolto: `limit` conta le righe grezze, `lastSeq` = `seq` più alto della pagina
   grezza, `hasMore` = esiste un `seq` più alto. S2 lo prova con `limit=1` e `limit=2`.

Punti più semplici, accolti: nessun meccanismo nuovo per i buchi di `seq` (basta `lockFamily`, da
annotare in DECISIONI); confronto di `version` dopo `lockTask`; fotografia in `READ COMMITTED` con
`seq` letto per primo; test parallelo solo di regressione (S2b). Perimetro: niente V6 prevista
(indice già in V2); `members` definiti (`personId`, `displayName`, `role`). Facoltativi accolti:
`after` e `limit` non validi → 400; `shoppingItems.deletedAt` tolto dalla fotografia.
Scartato: niente.

## Idee per dopo
- Endpoint batch `POST /api/sync/mutations` con esito per ogni modifica, se l'invio una per una si
  rivela lento sul telefono.
- `version` attesa anche su assegna, fatto e riapri.
- Versione attesa per scritture in coda concatenate sulla stessa entità (oggi S1 le manda senza
  `version`): da decidere con il motore del client.
- `change_log` per le appartenenze, per far sapere al client di una famiglia persa senza un'altra chiamata.
