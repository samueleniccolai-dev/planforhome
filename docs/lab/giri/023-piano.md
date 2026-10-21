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
  `seq` è il massimo `change_log.seq` della famiglia letto **nella stessa transazione** dei dati
  (0 se non ce n'è). `tasks` sono tutti i task della famiglia in ogni stato, con `id`, `version`,
  `status`, `assigneePersonId`, `title`, `dueAt`, `template`; `shoppingItems` sono le voci dei task
  della famiglia, comprese le rigate, con `id`, `taskId`, `text`, `checked`, `position`, `version`,
  `deletedAt` (le cancellate non compaiono).
- `GET /api/sync/families/{familyId}/changes?after={seq}&limit={n}` → 200
  `{ "changes": [ { "seq", "entity", "entityId", "op", "data", "deletedAt" } ], "lastSeq", "hasMore" }`.
  `entity` è `task` o `shopping_item`. Ordine per `seq` crescente. Per ogni entità compare **una
  sola** riga, quella con il `seq` più alto nella pagina. `op = UPSERT` → `data` è lo stato attuale
  (stessa forma della fotografia), `deletedAt` nullo. Cancellazione (voce cancellata, o task uscito
  dalla famiglia per inoltro) → `data` nullo e `deletedAt` valorizzato: **mai** lo stato attuale di
  un task che ora sta in un'altra famiglia. `limit` predefinito 500, massimo 500, `after`
  predefinito 0; `lastSeq` è il `seq` dell'ultima riga restituita (o `after` se vuota).
- `PUT /api/families/{f}/tasks/{t}` accetta un campo facoltativo `version`. Se c'è e non è la
  versione attuale → 409 `{ "error": "version_conflict", "current": { ...task } }` e nessuna
  scrittura. Senza `version` il comportamento resta quello di oggi (decisione 38), per il web.
- Famiglia altrui o inesistente, su entrambi gli endpoint di lettura → 404 identico. Senza login → 401.

Controlli:
- [ ] `cd server && ./mvnw -q -Dtest='Giro023*AcceptanceTest' test` → verde, cioè:
  - **S1 coda in ordine, ripetuta due volte:** Giulia manda 4 scritture con `mutationId` (crea
    «Annaffiare le piante», la prende, la modifica, la segna fatta), poi rimanda le stesse 4 con gli
    stessi `mutationId` → le seconde 4 rispondono 2xx senza effetto; `changes?after=<seq prima>`
    contiene il task una volta sola con `status = DONE` e `version` uguale a quella dopo il primo
    invio; il `change_log` grezzo (test via `changes` con `limit=1` a passi) mostra i `seq` nello
    stesso ordine degli invii e nessuna riga in più dopo il secondo invio.
  - **S2 lettura per `seq`:** dopo una creazione, una modifica di task e la cancellazione di una
    voce di lista, `changes?after=N` restituisce l'UPSERT del task con lo stato modificato e la voce
    con `deletedAt` e `data` nullo; `changes?after=<lastSeq>` → `changes` vuoto, `hasMore = false`;
    con `limit=1` la paginazione percorre tutte le righe senza buchi né doppioni.
  - **S3 inoltro visto dalla famiglia di partenza:** Giulia inoltra «Comprare il pane» dalla
    Famiglia Principale alla Famiglia Mamma → `changes` della Famiglia Principale lo dà con
    `deletedAt` e `data` nullo (nessun titolo), `changes` della Famiglia Mamma lo dà come UPSERT;
    se è una lista della spesa, le sue voci compaiono come UPSERT nei `changes` della Famiglia Mamma.
  - **S4 fotografia per chi entra:** Luca entra nella Famiglia Principale con un codice d'invito →
    la `snapshot` contiene tutti i task e le voci della famiglia e un `seq`; una modifica fatta dopo
    compare in `changes?after=<seq della snapshot>`, nessuna fatta prima vi compare.
  - **S5 conflitto, vince il primo:** Marco e Giulia leggono «Annaffiare le piante» alla versione v;
    Marco manda `PUT` con `version = v` → 200; Giulia manda `PUT` con `version = v` → 409
    `version_conflict` con `current.title` di Marco e `current.version = v+1`; il task conserva la
    modifica di Marco. «Prendi» concorrente: il secondo riceve 409 `already_taken` con il nome di chi
    l'ha preso (già esistente, ricontrollato qui).
  - **S6 modifica non più permessa:** Luca (membro della Famiglia Mamma) ha in coda offline, sullo
    stesso task «Prenotare il pranzo di Natale» assegnato a lui: (1) rimettilo in coda, (2) modifica il
    titolo. Prima dell'invio Anna gli assegna il task a Pietro e Luca non è più creatore né
    assegnatario → (1) 403, (2) 403, valutata sullo stato vero; la `snapshot`/`changes` mostra il task
    di Pietro invariato. Variante: se (1) viene rifiutato ma (2) è ancora permessa sullo stato vero
    (Luca creatore del task), (2) riesce.
  - **S7 isolamento parametrico:** Rosa (Famiglia Babbo) chiede `snapshot` e `changes` della
    Famiglia Principale, con l'`id` nell'URL → 404 identico a quello di una famiglia inesistente;
    `changes` della Famiglia Babbo non contiene nessuna entità delle altre famiglie; senza login → 401.
    Il test di isolamento parametrico esistente (che percorre tutti gli endpoint registrati) resta
    verde con i due endpoint nuovi.
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
Dati demo: quelli dell'Appendice A creati dallo script demo dei test (`Giro003AcceptanceSupport`),
più questi task inventati, creati dai test:
- Famiglia Principale: «Annaffiare le piante» (creato da Giulia, in coda), «Comprare il pane»
  (template lista della spesa, creato da Giulia, voci «latte», «uova», «farina»);
- Famiglia Mamma: «Prenotare il pranzo di Natale» (demo, in coda), «Riparare la bici» (creato da Luca).

| File | Dato … quando … allora … |
|---|---|
| `Giro023SyncQueueAcceptanceTest` | S1: coda di 4 scritture rimandata due volte → effetto una volta, `seq` in ordine |
| `Giro023SyncChangesAcceptanceTest` | S2, S3: creazioni, modifiche, cancellazioni e inoltro nei `changes`, paginazione |
| `Giro023SyncSnapshotAcceptanceTest` | S4: Luca entra → fotografia completa con `seq`, poi solo le modifiche dopo |
| `Giro023SyncConflictAcceptanceTest` | S5, S6: conflitto di `version`, «già preso», modifica non più permessa |
| `Giro023SyncIsolationAcceptanceTest` | S7: famiglia altrui con l'`id` nell'URL → 404 identico; 401 senza login |

## Porte
- Doppio senso previste: due endpoint nuovi sotto `/api/sync/`; campo facoltativo `version` nel
  `PUT` del task (cambia la decisione 38 solo quando il campo c'è: va annotato in DECISIONI);
  forma JSON delle righe di `changes`; eventuale migrazione `V6__…` che **aggiunge** solo un indice
  o righe di `change_log` per le voci quando la lista viene inoltrata.
- Senso unico: nessuna. Niente dipendenze nuove, niente schema che toglie o rinomina.

## Rischi di concorrenza
- **Fotografia e `seq` incoerenti:** se il `seq` è letto fuori dalla transazione dei dati, una
  scrittura in mezzo si perde. Lettura in un'unica transazione `REPEATABLE READ` (o `seq` letto per
  primo, con i dati dopo: al massimo un doppione, mai un buco). S4 lo prova.
- **Buchi di `seq`:** un `seq` di identity può essere assegnato da una transazione che fa commit dopo
  una successiva; un client che ha già letto oltre lo perde. Va almeno annotato nel rapporto; la
  soluzione (per esempio non restituire righe più recenti dell'istante della transazione più vecchia
  aperta, o un lock di famiglia sulla scrittura del `change_log`) la sceglie il costruttore e la
  registra in DECISIONI. Un test con due scritture parallele sulla stessa famiglia e lettura per
  pagine controlla che nessuna riga manchi.
- **Doppio invio:** il replay di un `mutationId` non deve aggiungere righe a `change_log` (S1).
- **Conflitto di `version`:** il controllo e l'aggiornamento stanno nella stessa `UPDATE … WHERE
  version = ?`; due `PUT` paralleli con la stessa `version` → uno 200, l'altro 409 (S5).
- **Inoltro di una lista:** le voci hanno righe di `change_log` nella famiglia di partenza; senza
  nuove righe nella famiglia di arrivo chi legge l'arrivo per `seq` non le vede (S3).

## Budget
Righe di produzione (`server/src/main`) ≤ 600; righe aggiunte in tutto (test compresi) ≤ 1.500;
file nuovi ≤ 8; nessuna riga in `app/`. Deve stare in una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna: `ricerca: no` (API del server, nessun cambiamento visibile alla famiglia).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Endpoint batch `POST /api/sync/mutations` con esito per ogni modifica, se l'invio una per una si
  rivela lento sul telefono.
- `version` attesa anche su assegna, fatto e riapri.
- `change_log` per le appartenenze, per far sapere al client di una famiglia persa senza un'altra chiamata.
