---
giro: 008
traguardo: T5
traguardi_extra: []
tipo: costruzione
fase: finale
inizio: 2026-10-20T07:41:00Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 008 — T5 parte 1 (server): task, coda e ritorno in coda

## Domanda chiusa
L'umano ha risposto «Procedi con A» (DECISIONI n. 32). Il giro 008 diventa T5 parte 1, solo
server. T4 resta `in-corso`: la sua ultima frase («i suoi task tornano in coda») si prova qui, poi
serve un giro `verifica-produzione` di T4. Le opzioni B e C sono scartate.

## Fetta e traguardo
T5, parte 1: **il lato server** dei task, delle righe P1–P6 di SPEC §5 e del ritorno in coda di
SPEC §2.2.1. Il modello dei task nasce qui una volta sola, pronto alla sincronizzazione (§7):
`mutation_id`, `version`, `change_log`. T5 intero non sta in una sessione (API P1–P9 + schermate +
vista «tutte le mie famiglie»): si taglia su P1–P6 e sul ritorno in coda.

**Resta per T5 (giri successivi):** P7 (segnare fatto), P8 (riaprire), P9 (modificare o annullare)
sul server; le schermate dei task e i test Playwright (Giulia crea «Preparare lo zaino» in al
massimo 3 azioni e lo assegna a Leo; la vista «tutte le mie famiglie» con le date nel fuso della
famiglia); i task di esempio dell'Appendice A nello script dei dati demo.
**Resta per T4:** un giro `verifica-produzione`.

Fonti: SPEC §2.1, §2.2.1 (righe 101–106), §2.2.2–§2.2.4, §5 (P1–P6), §6, §7, App. A;
`traguardi.json` → T4, T5; `006-rapporto.md`, `007-rapporto.md`; codice in
`server/.../family/` (`MembershipService.onMembershipRemoved` è vuoto), `V1__accounts.sql`.

## Cosa si costruisce

Package nuovo `com.planforhome.task` (logica nel servizio, controller sottile). Una migrazione
nuova, **solo aggiunte**: `V2__tasks.sql`.

### Schema (`V2__tasks.sql`)
| Tabella | Colonne e vincoli |
|---|---|
| `task` | Tutte le colonne di SPEC §6, così nessun giro dopo deve rinominarle: `id uuid pk`, `family_id` (FK `family`), `title text not null`, `notes text`, `due_at timestamptz`, `due_kind` (`DATE`/`DATETIME`, check), `reminder_offset_minutes int not null default 60`, `criticality` (`LOW`/`NORMAL`/`HIGH`, default `NORMAL`), `status` (`OPEN`/`DONE`/`CANCELLED`, default `OPEN`), `assignee_person_id uuid` (nullo = coda), `recurrence jsonb`, `template` (`NONE`/`SHOPPING_LIST`, default `NONE`), `series_id uuid`, `created_by` (FK `person`), `completed_by` (FK `person`), `version bigint not null`, `created_at`, `updated_at timestamptz not null`. **FK composta** `(family_id, assignee_person_id) → membership (family_id, person_id)`. Check: `due_at` e `due_kind` entrambi nulli o entrambi valorizzati. Indici su `(family_id)` e `(family_id, assignee_person_id)`. |
| `change_log` | `seq bigint generated always as identity pk`, `family_id` (FK `family`), `entity text`, `entity_id uuid`, `op` (`UPSERT`/`DELETE`, check), `at timestamptz`. Indice `(family_id, seq)`. |
| `applied_mutation` | `mutation_id uuid pk`, `person_id` (FK `person`), `family_id` (FK `family`), `entity_id uuid`, `op text`, `applied_at timestamptz`. |

### Endpoint
Errori `{"error": codice}` come oggi. Ogni scrittura richiede `mutationId` (UUID): senza, o non
UUID → 400 `invalid_request`.

| Endpoint | Corpo | Esito |
|---|---|---|
| `GET /api/families/{familyId}/tasks` (P1) | — | 200 `[task…]` della famiglia, tutti gli stati. |
| `GET /api/tasks` (P1, «tutte le mie famiglie») | — | 200 `[task…]` di tutte e sole le famiglie di chi chiama. |
| `POST /api/families/{familyId}/tasks` (P2; P3/P4 sull'assegnatario iniziale) | `{mutationId, id?, title, notes?, dueKind?, due?, criticality?, assigneePersonId?}` | 201 task con `version: 1`, `status: OPEN`, `criticality` predefinita `NORMAL`, nessuna scadenza. `title` vuoto dopo trim, con NUL o oltre 200 caratteri → 400 `title_invalid`; `notes` con NUL o oltre 2000 → 400 `notes_invalid`; `criticality` fuori elenco → 400 `criticality_invalid`; scadenza: `dueKind: DATE` con `due: "2026-11-03"`, oppure `dueKind: DATETIME` con `due` istante ISO-8601 con `Z`; uno senza l'altro o formato sbagliato → 400 `due_invalid`. Una scadenza `DATE` si salva come mezzanotte di quel giorno nel fuso della famiglia e si restituisce come data. `assigneePersonId` che non appartiene alla famiglia → 400 `assignee_invalid`; un membro che assegna a un altro → 403 `forbidden` (P4); a sé o in coda → ok. `id` facoltativo (se manca, UUIDv7 del server); già usato da un task di **qualunque** famiglia (o da un'altra entità) → 409 `id_conflict`, nulla creato, il task esistente non cambia. |
| `PUT /api/families/{familyId}/tasks/{taskId}/assignee` (P3, P4, P6) | `{mutationId, assigneePersonId}` (`null` = coda) | 200 task con `version` + 1. Regole sotto. |
| `POST /api/families/{familyId}/tasks/{taskId}/take` (P5) | `{mutationId}` | 200 task assegnato a chi chiama, `version` + 1. Già assegnato a un altro → 409 `{"error":"already_taken","assigneePersonId":…,"assigneeName":…}` («già preso da X»). Già assegnato a chi chiama → 200, nessun cambiamento. |

Forma del task: `{id, familyId, familyTimeZone, title, notes, dueKind, due, criticality, status,
assigneePersonId, createdBy, version, updatedAt}`.

**Regole dell'assegnatario (`PUT …/assignee`).** Il gestore: qualunque persona della famiglia, o
la coda. Il membro (i «propri task» sono quelli creati da lui o assegnati a lui):
| Destinazione | Membro: permesso se | Riga |
|---|---|---|
| sé stesso | il task è **in coda e creato da lui**, oppure è già assegnato a lui | P3 |
| coda (`null`) | il task è assegnato a lui | P3 + P6 |
| un'altra risorsa | mai → 403 | P4 |
Per prendere un task altrui dalla coda c'è `take` (P5), non `PUT …/assignee`. Un task creato da un
membro e poi assegnato da un gestore a un altro non è più «suo» per questa regola: il membro non
se lo riprende (403).

**Un solo controllo degli `id` del client.** Un `id` già usato da una persona, da una famiglia o da
un task → 409 `id_conflict`, nelle tre creazioni: `POST …/tasks`, `POST …/resources`,
`POST /api/families`. Lo stesso metodo di controllo serve le tre (per esempio una query su
`person`, `family`, `task` sotto il lock già preso).

**Ordine dei controlli (fisso):** 1) appartenenza di chi chiama a `{familyId}` → 404 `not_found`;
2) `{taskId}` in quella famiglia → 404 `not_found` (corpo identico a un task inesistente);
3) forma del corpo → 400; 4) `mutationId` già applicato: stessa persona, stessa operazione, stessa
entità → **200 con lo stato attuale del task**, nessuna nuova `version` né riga di `change_log`;
altrimenti → 409 `mutation_conflict`; 5) `assigneePersonId` non della famiglia → 400
`assignee_invalid`; 6) permesso → 403 `forbidden`; 7) stato → 409 (`already_taken`,
`id_conflict`). Il test parametrico del giro 003 (corpo `{}`) vede così 404 da fuori e 400 da
dentro, mai una scrittura.

**Ogni scrittura riuscita**, nella stessa transazione: `version` + 1 (1 alla creazione),
`updated_at = Clock.instant()`, una riga `change_log (family_id, 'task', id, 'UPSERT')`, una riga
`applied_mutation`. Una richiesta rifiutata (400/403/404/409) non scrive nulla e non registra il
`mutationId`.

**Ritorno in coda (`MembershipService.onMembershipRemoved`).** Va chiamato **prima** di
`deleteMembership` (la FK composta lo impone). Ogni task di quella persona **in quella famiglia**
perde l'assegnatario: `assignee_person_id = null`, `version` + 1, `updated_at`, una riga di
`change_log` per task. Vale in tutti i casi di `remove`: un gestore toglie qualcuno, un membro
lascia, account disattivato, risorsa cancellata. I task della stessa persona in altre famiglie non
cambiano.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro008*AcceptanceTest' test` → tutti verdi:
  - **P1** permesso: Tea (membro) e Ugo (gestore) vedono in `GET /api/families/{Quercia}/tasks` i
    task di Quercia; Tea in `GET /api/tasks` vede i task di Quercia e di Acero, ciascuno con il
    suo `familyId` e `familyTimeZone` (`Europe/Rome`, `America/New_York`); Ugo vede solo Quercia.
    Vietato: Luca su `GET /api/families/{Quercia}/tasks` → 404 con corpo identico a una famiglia
    inesistente; nessun task di Quercia o Acero nel `GET /api/tasks` di Luca;
  - **P2** permesso: Tea crea «Comprare il pane» con il solo titolo → 201, `version` 1, `OPEN`,
    `NORMAL`, in coda, `createdBy` Tea; con `dueKind: DATE`, `due: "2026-11-03"` → restituito
    uguale; con `DATETIME` `2026-11-03T17:30:00Z` → restituito uguale. **Scadenza `DATE` e ora
    legale:** in Acero (`America/New_York`) `2026-11-03` → `due_at` (JDBC) `2026-11-03T05:00:00Z`;
    `2026-11-01` (giorno del cambio) → `2026-11-01T04:00:00Z`; in `GET /api/tasks` le stesse due
    date. Un `mutationId` usato in una richiesta rifiutata vale ancora per una creazione buona.
    Vietato: Luca su Quercia →
    404 e nessun task creato; senza login → 401; titolo vuoto o di 201 caratteri → 400
    `title_invalid`; `criticality: URGENT` → 400 `criticality_invalid`; `dueKind` senza `due` →
    400 `due_invalid`; senza `mutationId` → 400 `invalid_request`; in tutti i casi l'elenco non
    cambia;
  - **P3** permesso: Tea si assegna il task che ha creato → 200, `version` 2; lo rimette in coda →
    200, `version` 3. Vietato: Tea si assegna un task creato da Vera e assegnato a Ivo → 403, il
    task non cambia (`version`, assegnatario); Tea si assegna un task **creato da lei** e assegnato
    da Vera a Ivo → 403, invariato; Tea si assegna con `PUT` un task di Vera in coda → 403 (per
    quello c'è `take`);
  - **P4** permesso: Vera (gestore) assegna un task a Pia (risorsa senza account) → 200; vietato:
    Tea assegna un task suo a Ivo → 403; Tea crea un task con `assigneePersonId` Ivo → 403 e nulla
    creato; Vera assegna a Rosa (Famiglia Babbo) → 400 `assignee_invalid`;
  - **P5** permesso: Tea prende dalla coda un task creato da Vera → 200, assegnato a Tea; lo
    riprende → 200, `version` invariata; vietato: Ivo prende lo stesso task → 409 `already_taken`
    con `assigneeName` «Tea»; Luca → 404;
  - **P6** permesso: Ivo rimette in coda un task assegnato a lui → 200; Ugo (gestore) rimette in
    coda un task assegnato a Tea → 200; vietato: Tea rimette in coda un task assegnato a Ivo →
    403, il task resta a Ivo;
  - **vincolo nel database:** un `insert` diretto (JDBC del test) di un task di Quercia con
    `assignee_person_id` di Rosa, e un `update` che assegna a Rosa un task esistente → violazione
    della FK composta;
  - **id del client, nei due versi:** Ugo crea in Quercia un task con l'`id` di un task di
    Acero → 409 `id_conflict`; il task di Acero ha titolo, famiglia e `version` invariati; lo
    stesso con l'`id` della persona di Marco e con l'`id` della famiglia Acero → 409; Ugo aggiunge
    una risorsa con l'`id` di un task → 409, nessun membro nuovo; Tea crea una famiglia con l'`id`
    di un task → 409, nessuna famiglia nuova;
  - **mutation_id idempotente:** la stessa creazione inviata 2 volte → 201 poi 200 con lo stesso
    task, una sola riga in elenco e una sola riga di `change_log`; lo stesso per `take` e
    `assignee` (seconda risposta 200, `version` invariata); lo stesso `mutationId` usato da Ugo
    su un altro task, o da Tea, → 409 `mutation_conflict`, nulla cambia;
  - **version e change_log:** dopo creazione, assegnazione, presa e ritorno in coda, `version` vale
    4 e `change_log` (letto via JDBC nel test) ha 4 righe `task`/`UPSERT` per quel task, in ordine
    di `seq`, con il `family_id` di Quercia;
  - **T4, account disattivato:** Ivo (solo Quercia) ha 2 task assegnati; Ugo gli toglie
    l'appartenenza → 204; il login di Ivo è rifiutato; i 2 task sono `OPEN`, in coda, `version` + 1,
    con una riga di `change_log` ciascuno; un task assegnato a Tea non cambia (stessa `version`);
    Ivo che rimanda con il vecchio token la sua `take` → 401, nulla cambia;
  - **T4, risorsa cancellata:** Gino (risorsa senza account) ha un task assegnato; Vera lo toglie
    → 204; Gino non è più tra i membri; il task è in coda;
  - **solo quella famiglia:** Tea (Quercia e Acero) ha un task in ciascuna; Ugo la toglie da
    Quercia → il task di Quercia va in coda, quello di Acero resta a lei; il suo `GET /api/tasks`
    non ha più task di Quercia; Tea che rimanda una sua mutazione su Quercia (una `take` già
    applicata) → 404, nulla cambia; Tea che lascia da sola una famiglia (P15) → stesso effetto;
  - **isolamento:** (oltre al test parametrico del giro 003) Ugo, e Tea che è in entrambe, con il
    `{taskId}` di un task di Acero nell'URL di Quercia → 404 con corpo identico a un task
    inesistente, il task di Acero non cambia;
  - **concorrenza:** vedi «Rischi di concorrenza».
- [ ] `cd server && ./mvnw -q -Dtest='Giro003*AcceptanceTest,Giro006*AcceptanceTest' test` → verdi
  (il test parametrico del giro 003 percorre anche i nuovi endpoint, senza modifiche).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (Spotless compreso).
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Dati demo del giro (inventati)
I test **non modificano** le famiglie dell'Appendice A (contesto e database condivisi): Luca, Rosa,
Marco e la Famiglia Babbo servono solo in lettura, per l'isolamento. Ogni test registra le sue
persone con email uniche `g008-<nome>-<uuid>@example.com`, password `Lanterna-Blu-42`, locale `it`,
ognuna da un IP proprio (`X-Forwarded-For` in `198.18.0.0/15`), come nel giro 006.

| Persona | Ruolo | Note |
|---|---|---|
| Ugo | gestore | registra «Famiglia Quercia» (fuso `Europe/Rome`) |
| Vera | gestore | entra in Quercia con un codice, Ugo la promuove |
| Tea | membro | si registra con un codice di Quercia, poi crea «Famiglia Acero» con `POST /api/families {name, timeZone: America/New_York}` (P14, ne è gestore): 2 famiglie. La registrazione non accetta un fuso, e Quercia usa il predefinito `Europe/Rome` |
| Ivo | membro | registrato con un codice di Quercia: 1 sola famiglia |
| Pia | risorsa senza account | in Quercia, referente Ugo |
| Gino | risorsa senza account | in Quercia, referente Vera; viene cancellato nel test T4 |
| Ada, Bea | membri | concorrenza: ognuna registra la propria famiglia («Famiglia Betulla», «Famiglia Ontano»), poi entra con un codice in «Famiglia Noce», creata da Ugo (P14): 2 famiglie ciascuna, così può lasciare Noce |

Task: «Comprare il pane», «Annaffiare il basilico», «Portare il cane dal veterinario» (Quercia);
«Pagare la bolletta del gas» (Acero); «Riparare la bici» (Noce, in coda, per la presa contesa).

## Fuori perimetro
- P7, P8, P9 (fatto, riaprire, modificare, annullare); `task_event` (arriva con una `V3` additiva
  quando serve); ricorrenze (T6); inoltro (T7); lista della spesa (T8); promemoria e
  `reminder_offset_minutes` usato (T10). Le colonne esistono, l'API non le scrive.
- Controllo dei conflitti sulla `version` letta dal client e lettura di `change_log` per `seq`
  (T9). Qui `version` cresce e si restituisce, non si confronta.
- Schermate dell'app, test Playwright, task demo dell'Appendice A nello script dei dati demo.
- `change_log` delle appartenenze e delle famiglie (T9).
- **Note per T9** (non si fanno qui): `seq` è unico per tutto il database, quindi dentro una
  famiglia i valori **non sono contigui** (ci sono i buchi delle altre famiglie e delle
  transazioni annullate) e **tra famiglie diverse non dicono nulla sull'ordine**; il cursore di
  sync va tenuto per famiglia. La `version` letta dal client arriverà in T9 come campo
  **facoltativo aggiunto** al corpo delle scritture (`expectedVersion`?), così le API di questo
  giro non cambiano forma.
- Login su Android con `expo-secure-store` (DECISIONI n. 22); i difetti minori aperti (`Max-Age`
  2591999, «Famiglia Verifica 005»); le PR di Dependabot #2 e #3.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/src/test/java/com/planforhome/acceptance/Giro008TaskAcceptanceTest.java` | P1, P2, validazione, `id_conflict`, `mutation_id`, `version` e `change_log` |
| `server/src/test/java/com/planforhome/acceptance/Giro008QueueAcceptanceTest.java` | P3, P4, P5, P6, `already_taken` |
| `server/src/test/java/com/planforhome/acceptance/Giro008RequeueAcceptanceTest.java` | le due frasi di T4: account disattivato, risorsa cancellata; solo quella famiglia; P15 |
| `server/src/test/java/com/planforhome/acceptance/Giro008TaskIsolationAcceptanceTest.java` | id altrui nell'URL e nel corpo, vincolo FK nel database, concorrenza |

Le classi estendono `Giro008AcceptanceSupport`, che estende `Giro006AcceptanceSupport`: stesso
contesto, stessi dati demo. Le sole letture non HTTP sono `change_log` e il vincolo FK, via
`JdbcTemplate` del contesto (il «Fatto quando» di T5 chiede un vincolo nel database e un
`change_log` che oggi non ha API).

## Porte
- Doppio senso previste: forma degli endpoint e del task; codici d'errore nuovi (`title_invalid`,
  `notes_invalid`, `criticality_invalid`, `due_invalid`, `assignee_invalid`, `already_taken`,
  `mutation_conflict`); `mutationId` obbligatorio; nome e forma di `applied_mutation`; scadenza
  `DATE` salvata come mezzanotte nel fuso della famiglia; lettura di P3 insieme a P6 (un membro
  rimette in coda solo un task assegnato a sé); `take` separato da `PUT …/assignee`.
- Senso unico: nessuna nuova. Nessuna dipendenza nuova. Lo schema `V2__tasks.sql` è solo
  aggiunta e resta per sempre: è la scelta già presa con l'opzione A (DECISIONI n. 32), con tutte
  le colonne di SPEC §6 perché nessun giro dopo debba rinominarle.

## Rischi di concorrenza
Regola: ogni scrittura su un task prende prima `select … from family where id = ? for update`
(come le appartenenze nel giro 006), poi `select … from task where id = ? for update`. `remove`
tiene l'ordine `family` → `person` → `task`. Ogni controllo (assegnatario, appartenenza, coda) si
fa **dopo** i lock. Il lock su `family` serializza anche le righe di `change_log` di una famiglia,
così `seq` cresce nell'ordine dei commit dentro la famiglia (utile a T9).
- **Due prendono lo stesso task dalla coda:** Ada e Bea prendono «Riparare la bici» in parallelo,
  10 ripetizioni → sempre una 200 e una 409 `already_taken`; le due risposte riguardano lo stesso
  task (`id` della 200); `assigneePersonId` e `assigneeName` della 409 sono il vincitore;
  l'assegnatario è il vincitore; `version` 2; una sola riga di `change_log` per la presa.
- **Stesso `mutationId` in 2 invii paralleli** (creazione e `take`): una 201/200 e l'altra 200 o
  409 `mutation_conflict`; un solo task, una sola riga di `change_log` per l'operazione. Rimedio
  (più semplice): il controllo del passo 4 si fa dopo i lock, quindi un invio ripetuto in
  sequenza vede la riga e risponde 200; un duplicato di chiave su `applied_mutation` (gara che il
  lock non copre) annulla la transazione e risponde 409 `mutation_conflict`, **senza rilettura**.
  Il client lo tratta come «già applicata» e rilegge.
- **Un membro prende un task mentre lo tolgono dalla famiglia:** Bea fa `take` mentre Ugo toglie
  Bea da Noce, 10 ripetizioni (Bea rientra con un codice nuovo a ogni ripetizione) → mai 5xx; o
  (200, 204) o (404, 204); in entrambi i casi alla fine il task è in coda, mai assegnato a Bea.
  Rimedio: lock su `family` in entrambi, ritorno in coda prima di `deleteMembership`.
- **Assegnazione a una persona che lascia in parallelo:** Ugo assegna un task di Noce ad Ada
  mentre Ada lascia Noce (ha una seconda famiglia), 10 ripetizioni → mai 5xx; o (200, 204) con il
  task in coda, o (400 `assignee_invalid`, 204) con il task invariato.

## Budget
Righe di produzione (`server/src/main`) ≤ 500; file ≤ 10 (più `V2__tasks.sql`); nessuna riga in
`app/`. Una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`: API senza schermate).

## Critica ricevuta e cosa cambia
| Punto del critico | Esito | Motivo |
|---|---|---|
| 1. P3 scappatoia: Tea crea, Vera assegna a Ivo, Tea se lo riprende | Accolto | «Sé stesso» per un membro solo se il task è in coda e creato da lui, o già suo. Test nuovo → 403. Aggiunto anche il `PUT` su un task altrui in coda → 403. |
| 2. Tea non può registrare Acero con un fuso | Accolto | Tea si registra con il codice di Quercia e crea Acero con `POST /api/families {name, timeZone}`. |
| 3. Scadenza `DATE` sull'ora legale | Accolto | Test in Acero: `2026-11-03` → `05:00Z`, `2026-11-01` → `04:00Z` (JDBC), stesse date in `GET /api/tasks`. |
| 4. `id_conflict` nei due versi | Accolto | Un solo controllo su persona, famiglia, task per le tre creazioni; test task→persona, task→famiglia, risorsa→task, famiglia→task. |
| 4b. Duplicato di `mutationId` → 409 senza rilettura | Accolto | Più semplice; il test parallelo accetta 200 o 409 `mutation_conflict` per il secondo invio, e un solo effetto. |
| Test: `GET /api/tasks` di Tea dopo la rimozione da Quercia | Accolto | Nel test «solo quella famiglia». |
| Test: Ivo rimosso rimanda una mutazione → 404 | Accolto con una modifica | Ivo ha una sola famiglia: la rimozione disattiva l'account e il suo token dà **401**, non 404. Il test di Ivo chiede 401 e nulla cambia; il caso 404 si prova con Tea, rimossa da Quercia ma ancora attiva per Acero. |
| Test: presa contesa sullo stesso task, `assigneeName` del vincitore | Accolto | Nel test di concorrenza. |
| Note per T9 (`seq`, `version` facoltativa) | Accolto | In «Fuori perimetro → Note per T9». |
| Isolamento: solo il caso `{taskId}` di Acero nell'URL di Quercia | Accolto | Tolta la riga «Luca su ogni endpoint» (la copre il test parametrico del giro 003). Restano i «vietato» di Luca dentro P1, P2, P5, che sono righe di SPEC §5. |

## Idee per dopo
- Nel modello del rapporto, un campo esplicito `fatto_quando: verde | parziale`, così
  l'orchestratore non deduce il tipo del giro dalla prosa. Si propone in
  `docs/lab/proposte-metodo.md`, non qui.
- `applied_mutation` cresce senza limite: una pulizia delle righe più vecchie di N giorni quando
  arriva T9.
