---
giro: 016
traguardo: T7
tipo: costruzione
fase: critica
inizio: 2026-10-20T23:38:31Z
ricerca: sì
accettazione:
ripreso: no
---
# Piano del giro 016 — T7 intero: inoltro di un task tra famiglie (server e app)

## Fetta e traguardo
T7 intero, tipo `costruzione` (T7 `da-fare`, nessuna integrazione, T6 passato nel giro 015). Ci sta
in una sessione: un endpoint, una tabella nuova, un dialogo nell'app. Dopo: `verifica-produzione` di T7.

Fonti: SPEC §2.2.6, §5 (P11), §6 (`task`, `task_event`, `change_log`), §7 (`mutation_id`,
`version`, `change_log`); Appendice A; DECISIONI 15, 24, 25, 46. Codice: `server/.../task/`
(`TaskService`, `TaskRepository`, `TaskController`), `server/.../family/FamilyRepository.java`,
`app/src/task/TasksSection.tsx`, `app/src/api/client.ts`, `app/src/i18n/{it,en}.json`.

## Cosa si costruisce

### Server (package `task`)
- **Migrazione `V3__task_events.sql`** (solo aggiunte): tabella `task_event` come SPEC §6 —
  `id uuid pk`, `task_id uuid not null references task(id)`, `type text not null check (type in
  ('CREATED','ASSIGNED','TAKEN','DONE','CANCELLED','FORWARDED','NUDGED'))`, `actor_person_id uuid
  not null references person(id)`, `data jsonb not null default '{}'`, `at timestamptz not null`;
  indice su `(task_id, at)`. In questo giro si scrive solo `FORWARDED`.
- **`POST /api/families/{familyId}/tasks/{taskId}/forward`**, corpo `{ "mutationId", "toFamilyId" }`.
  Ordine dei controlli (decisione 24):
  1. chiamante non membro di `{familyId}`, o task non in `{familyId}` → **404** `not_found`;
  2. `mutationId` o `toFamilyId` mancante o non UUID → **400** `invalid_request`;
  3. chiamante non membro di `toFamilyId` (o famiglia inesistente) → **404** `not_found` (non rivela
     nulla della famiglia di arrivo);
  4. `toFamilyId == familyId` → **400** `same_family`;
  5. P11, ruolo nella famiglia **di partenza**: gestore qualunque task; membro solo i propri
     (`created_by` o assegnatario = chiamante) → altrimenti **403** `forbidden`;
  6. task non `OPEN` → **409** `not_open`.
- Effetto, in una transazione, con lock delle due famiglie **in ordine crescente di id** (niente
  deadlock tra due inoltri incrociati; decisione 25 resta: famiglie prima delle persone):
  `family_id = toFamilyId`; `assignee_person_id` invariato se l'assegnatario appartiene alla famiglia
  di arrivo (qualunque ruolo, anche risorsa senza account), altrimenti `null`; `recurrence`,
  `series_id`, `due_at`, `due_kind`, `criticality`, `notes`, `template`, `created_by` invariati;
  `version + 1`; `updated_at = now`. Una riga `task_event` `FORWARDED`, `actor_person_id` =
  chiamante, `data = {fromFamilyId, toFamilyId, previousAssigneeId, assigneeKept}`.
  `change_log`: `DELETE` del task nella famiglia di partenza, `UPSERT` nella famiglia di arrivo.
  `applied_mutation` con op `forward`, `family_id` = partenza. Risposta **200** con la vista del task
  (ora `familyId = toFamilyId`). Ripetere lo stesso `mutationId` → 200, stesso stato, nessun secondo
  evento né seconda riga `change_log`.
- **`GET /api/families/{familyId}/tasks/{taskId}/events`** → lista `[{id, type, actorPersonId,
  actorName, at, data}]` in ordine di `at`. 404 se il chiamante non è membro di `{familyId}` o il task
  non è lì (dopo l'inoltro, la storia si legge solo dalla famiglia di arrivo).
- **Serie dopo l'inoltro:** il controllo «nella serie c'è già una `due_at` maggiore» (decisione 46)
  vale su `series_id` **senza filtro di famiglia** (`series_id` è generato dal server, unico):
  un'occorrenza riaperta inoltrata non crea un doppione nella famiglia di arrivo.

### App (web e Android, stessi componenti; nessuna dipendenza nuova)
- `client.ts`: `forwardTask(familyId, taskId, mutationId, toFamilyId)`, mappa 400/403/404/409 come le
  altre scritture.
- `TasksSection.tsx`: su un task `OPEN`, se l'utente ha almeno 2 famiglie, pulsante con etichetta
  «Inoltra «<titolo>»» / «Forward “<title>”». Apre un pannello (`role="dialog"`, etichetta «Inoltra il
  task») con:
  - gruppo di scelta «Famiglia di arrivo» (`role="radiogroup"`), una voce per ogni altra famiglia;
  - scelta la famiglia, l'app legge `members(toFamilyId)`; se il task ha un assegnatario che non c'è,
    mostra un avviso `role="alert"` con etichetta «Avviso inoltro»: «<Nome> non fa parte di
    <Famiglia>: il task andrà in coda.» (l'avviso informa; decide il server);
  - pulsanti «Conferma inoltro» (disabilitato finché non c'è una famiglia scelta) e «Annulla».
  - Dopo la conferma: il task sparisce dalla lista della famiglia di partenza, messaggio di stato
    «Inoltrato in <Famiglia>»; in «tutte le mie famiglie» compare sotto la famiglia di arrivo.
  - Errori: 403 → «Non puoi inoltrare questo task»; 404/409 → ricarica come gli altri stati `changed`.
- Chiavi i18n `task.forward.*` in `it.json` ed `en.json`.

## Dati demo (Appendice A, più task creati dai test)
| Chi | Famiglie e ruolo |
|---|---|
| Giulia | Principale gestore, Mamma membro |
| Marco | Principale gestore, Babbo membro |
| Luca | solo Mamma, membro |
| Anna | Mamma gestore |

Task che i test creano (titoli inventati): «Ritirare le foto» (Principale, assegnato a Marco),
«Comprare il regalo per la nonna» (Principale, assegnato a Giulia), «Portare Leo dal dentista»
(Principale, assegnato a Leo), «Tagliare la siepe» (Babbo, creato da Marco e assegnato a sé). Seminati:
«Mettere fuori la carta» (Principale, ogni martedì, Marco), «Rinnovare la carta d'identità di Franco»
(Babbo, creato da Rosa).

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro016*AcceptanceTest' test` → verde, con:
  - **P11 gestore permesso:** Giulia inoltra «Ritirare le foto» Principale → Mamma: 200,
    `familyId` = Mamma, `assigneePersonId` null (Marco non è in Mamma), `version` +1; non compare più
    in `GET /api/families/{Principale}/tasks` (Giulia), compare in quello di Mamma (Giulia, Anna).
  - **P11 gestore vietato:** Marco (gestore di Principale, non in Mamma) inoltra un task di Principale
    verso Mamma → 404; il task resta in Principale, `version` invariata.
  - **P11 membro permesso:** Marco inoltra «Tagliare la siepe» Babbo → Principale → 200, resta
    assegnato a Marco.
  - **P11 membro vietato:** Marco inoltra «Rinnovare la carta d'identità di Franco» Babbo → Principale
    → 403 `forbidden`; nulla cambia.
  - **Assegnatario conservato:** Giulia inoltra «Comprare il regalo per la nonna» → Mamma → resta
    assegnato a Giulia. **Risorsa senza account:** «Portare Leo dal dentista» → Mamma → in coda.
  - **Evento:** `GET /api/families/{Mamma}/tasks/{id}/events` → un evento `FORWARDED`, attore Giulia,
    `data.fromFamilyId` = Principale, `data.toFamilyId` = Mamma; lo stesso `GET` su Principale → 404.
  - **Chi non è in entrambe:** Luca (solo Mamma) inoltra un task di Mamma verso Principale → 404;
    Anna inoltra «Prenotare il pranzo di Natale» verso Principale → 404.
  - **Ciclico:** Giulia inoltra «Mettere fuori la carta» → Mamma: `recurrence` e `series_id` invariati,
    in coda; segnato fatto in Mamma (Giulia), la successiva nasce in Mamma, martedì dopo, stessa
    regola, in coda; nessuna nuova occorrenza in Principale.
  - **Validazioni:** `toFamilyId` = partenza → 400 `same_family`; `toFamilyId` non UUID → 400; task
    `DONE` → 409 `not_open`.
  - **Idempotenza:** stesso `mutationId` due volte → 200 e 200, un solo evento; stesso `mutationId`
    su un altro task → 409 `mutation_conflict`.
  - **Isolamento parametrico** (regola 1) sui due endpoint nuovi: estraneo con `id` di famiglia e task
    nell'URL o con `toFamilyId` altrui nel corpo → 404, nessun effetto; `change_log` di Principale ha
    `DELETE`, di Mamma `UPSERT` per quel task, nessuna riga in Babbo.
- [ ] `cd app && npx playwright test e2e/acceptance/giro-016-*` → verde (API finta come giro 014):
  - Giulia, «Ritirare le foto» (assegnato a Marco), «Inoltra», sceglie «Famiglia Mamma» → avviso
    «Avviso inoltro» visibile **prima** di «Conferma inoltro»; nessuna richiesta `forward` partita.
  - «Comprare il regalo per la nonna» (assegnato a Giulia) → Mamma → nessun avviso.
  - Conferma → una `POST …/forward` con `toFamilyId` di Mamma; il task non è più nella lista di
    Principale; messaggio di stato visibile. «Annulla» → nessuna richiesta.
  - Utente con una sola famiglia (Luca) → nessun pulsante «Inoltra».
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (Spotless compreso).
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi.
- [ ] CI della PR verde.

## Fuori perimetro
- Mostrare la storia degli eventi nell'app (l'API c'è; la vista arriva dopo).
- Eventi diversi da `FORWARDED` (creato, assegnato, preso, fatto, annullato, sollecitato).
- Inoltro di più occorrenze o di tutta la serie passata; le occorrenze `DONE`/`CANCELLED` già chiuse
  restano nella famiglia di partenza.
- Voci della lista della spesa (T9: `shopping_item` non esiste ancora), promemoria (T10),
  sincronizzazione e offline (T8): qui solo le righe `change_log`.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali (R1).

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/src/test/java/com/planforhome/acceptance/Giro016ForwardAcceptanceTest.java` | i casi P11, assegnatario, risorsa, evento, ciclico, validazioni, idempotenza del «Fatto quando» |
| `server/src/test/java/com/planforhome/acceptance/Giro016ForwardIsolationAcceptanceTest.java` | estranei e `toFamilyId` altrui → 404, nessun effetto; `change_log` |
| `app/e2e/acceptance/giro-016-forward.spec.ts` | avviso prima della conferma, nessun avviso, conferma, annulla, una sola famiglia |

## Porte
- Doppio senso previste: migrazione `V3` che aggiunge `task_event`; due endpoint nuovi; codici
  d'errore nuovi `same_family`; chiavi i18n nuove; filtro di famiglia tolto dal controllo della serie.
- Senso unico: nessuna.

## Rischi di concorrenza
- **Inoltri incrociati** (A→B e B→A insieme): lock delle due famiglie in ordine di id; test con due
  thread facoltativo, almeno revisione.
- **Inoltro contro presa/fatto/modifica** nella famiglia di partenza: il lock di partenza serializza;
  chi arriva dopo trova il task in un'altra famiglia → 404.
- **Assegnatario rimosso dalla famiglia di arrivo nel frattempo:** l'appartenenza si legge sotto il
  lock della famiglia di arrivo.
- **Doppio invio:** `mutation_id` idempotente, un solo evento e una sola coppia di righe `change_log`.
- **Serie spezzata** (occorrenza riaperta inoltrata, successiva rimasta in partenza): controllo della
  serie senza filtro di famiglia, niente doppioni.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`) ≤ 450 (server ≤ 220, app ≤ 230);
file toccati ≤ 14; una sessione.

## Domande per il ricercatore (al massimo 3)
1. Come gli strumenti noti (Todoist, Asana, Trello, GitHub transfer issue) avvisano che spostare un
   elemento in un altro progetto toglie l'assegnatario: prima della conferma, con quale testo?
2. Dialogo di conferma accessibile in React Native / Expo web: `role="dialog"` o `alertdialog`, focus
   iniziale e ritorno, annuncio dell'avviso a TalkBack e ai lettori web (documentazione ufficiale).
3. Scelta di una sola voce tra poche (2–3 famiglie): radio group o elenco di pulsanti, per accessibilità
   e per il tocco su Android.

## Critica ricevuta e cosa cambia
(dopo il critico)
