---
giro: 016
traguardo: T7
tipo: costruzione
fase: revisione
inizio: 2026-10-20T23:38:31Z
ricerca: sì
accettazione: 1c138c0
ripreso: no
---
# Piano del giro 016 — T7 intero: inoltro di un task tra famiglie (server e app)

## Fetta e traguardo
T7 intero, tipo `costruzione` (T7 `da-fare`, nessuna integrazione, T6 passato nel giro 015). Ci sta
in una sessione: un endpoint, una tabella nuova (solo scritta), un dialogo nell'app. Dopo: `verifica-produzione` di T7.

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
  indice su `(task_id, at)`. In questo giro si scrive solo `FORWARDED`; nessun endpoint di lettura
  (la storia nell'app è fuori perimetro; i test la leggono dalla tabella).
- **`POST /api/families/{familyId}/tasks/{taskId}/forward`**, corpo `{ "mutationId", "toFamilyId" }`.
  Ordine dei controlli (decisione 24), tutti dentro la transazione:
  1. chiamante non membro di `{familyId}` → **404** `not_found`;
  2. `mutationId` mancante o non UUID → **400** `invalid_request`;
  3. **replay**: se `applied_mutation` ha già `mutationId` →
     - stesso chiamante, `family_id` = `{familyId}`, `entity_id` = `{taskId}`, op `task.forward`: se il
       chiamante è **ancora membro della famiglia dove il task sta ora** → **200** con la vista
       attuale; altrimenti **404** `not_found`;
     - altrimenti → **409** `mutation_conflict` (solo se il task è in `{familyId}`; se non c'è → 404).
     Il replay si guarda **prima** del «task non in `{familyId}`»: dopo l'inoltro il task non è più
     nella partenza, e il secondo invio deve avere 200, non 404;
  4. task non in `{familyId}` → **404** `not_found`;
  5. `toFamilyId` mancante o non UUID → **400** `invalid_request`;
  6. chiamante non membro di `toFamilyId` (o famiglia inesistente) → **404** `not_found` (non rivela
     nulla della famiglia di arrivo);
  7. `toFamilyId == familyId` → **400** `same_family`;
  8. P11, ruolo nella famiglia **di partenza**: gestore qualunque task; membro solo i propri
     (`created_by` o assegnatario = chiamante) → altrimenti **403** `forbidden`;
  9. task non `OPEN` → **409** `not_open`.
- **Lock:** le due famiglie si bloccano **in ordine crescente di id** prima di leggere il task (niente
  deadlock tra due inoltri incrociati; decisione 25 resta: famiglie prima delle persone); il lock del
  task viene dopo. È obbligatorio e c'è un test con due thread.
- **Effetto**, in una transazione, con **un solo `UPDATE`** (la FK composta
  `(family_id, assignee_person_id)` su `membership` non regge due `UPDATE` separati):
  `family_id = toFamilyId`, `assignee_person_id` invariato se l'assegnatario è membro della famiglia
  di arrivo (qualunque ruolo, anche risorsa senza account; letto sotto il lock della famiglia di
  arrivo), altrimenti `null`; `version + 1`; `updated_at = now`; per `due_kind = 'DATE'`
  `due_at` = **la stessa data locale a mezzanotte nel fuso della famiglia di arrivo** (la data che
  la persona vede non cambia; un `DATETIME` è un istante e resta com'è). `recurrence`, `series_id`,
  `due_kind`, `criticality`, `notes`, `template`, `created_by` invariati. Una riga `task_event`
  `FORWARDED`, `actor_person_id` = chiamante, `data = {fromFamilyId, toFamilyId, previousAssigneeId,
  assigneeKept}` (`previousAssigneeId` è voluto: la storia dirà chi ha perso l'assegnazione).
  `change_log`: `DELETE` del task nella famiglia di partenza, `UPSERT` nella famiglia di arrivo.
  `applied_mutation` con op `task.forward`, `family_id` = partenza. Risposta **200** con la vista del
  task (ora `familyId = toFamilyId`). Ripetere lo stesso `mutationId` → 200, stesso stato, nessun
  secondo evento, nessuna riga `change_log` o `applied_mutation` in più.
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
  - pulsanti «Conferma inoltro» (disabilitato finché non c'è una famiglia scelta **e mentre la
    richiesta è in corso**: due click rapidi mandano al massimo una `POST`) e «Annulla».
  - Focus: all'apertura dentro il dialogo; con «Annulla» torna al pulsante «Inoltra «<titolo>»»
    (ricerca, APG dialog modal).
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
    in `GET /api/families/{Principale}/tasks` (Giulia), compare in quello di Mamma (Giulia, Anna);
    `change_log` del task = `UPSERT` Principale, `DELETE` Principale, `UPSERT` Mamma.
  - **P11 gestore vietato:** Marco (gestore di Principale, non in Mamma) inoltra un task di Principale
    verso Mamma → 404; il task resta in Principale, `version` invariata.
  - **P11 membro permesso:** Marco inoltra «Tagliare la siepe» Babbo → Principale → 200, resta
    assegnato a Marco.
  - **P11 membro vietato:** Marco inoltra «Rinnovare la carta d'identità di Franco» Babbo → Principale
    → 403 `forbidden`; nulla cambia.
  - **Assegnatario conservato:** Giulia inoltra «Comprare il regalo per la nonna» → Mamma → resta
    assegnato a Giulia. **Risorsa senza account:** «Portare Leo dal dentista» → Mamma → in coda.
  - **Evento** (letto dalla tabella `task_event`): un evento `FORWARDED`, attore Giulia,
    `data.fromFamilyId` = Principale, `data.toFamilyId` = Mamma, `data.assigneeKept` = `false`
    (`true` per «Comprare il regalo per la nonna»).
  - **Chi non è in entrambe:** Luca (solo Mamma) inoltra un task di Mamma verso Principale → 404;
    Anna inoltra «Prenotare il pranzo di Natale» verso Principale → 404.
  - **Ciclico:** Giulia inoltra «Mettere fuori la carta» (DATE martedì 4 febbraio 2031, ogni martedì,
    Marco) → Mamma: `recurrence` e `series_id` invariati, in coda; **Anna** (gestore di Mamma; Giulia
    è membro e P7 non le fa chiudere un task in coda) lo segna fatto; la successiva nasce in Mamma,
    martedì 11 febbraio, stessa regola, in coda, una riga `change_log` `UPSERT` in Mamma; nessuna
    occorrenza in Principale.
  - **Fusi diversi:** Giulia crea «Famiglia Zio» (America/New_York); un task DATE «2031-01-20» di
    Principale (Europe/Rome) inoltrato lì ha ancora `due` = `2031-01-20` e `due_at` =
    `2031-01-20T05:00:00Z`; un task DATETIME `2031-01-20T17:30:00Z` resta lo stesso istante.
  - **Validazioni:** `toFamilyId` = partenza → 400 `same_family`; `toFamilyId` non UUID o `null` → 400
    `invalid_request`; `mutationId` mancante o non UUID → 400; task `DONE` → 409 `not_open`; nessun
    effetto.
  - **Idempotenza:** stesso `mutationId` due volte → 200 e 200, `version` salita una volta, `change_log`
    = una `UPSERT` di creazione, una `DELETE` in partenza e una `UPSERT` in arrivo, una sola riga
    `applied_mutation`, un solo evento; stesso `mutationId` su un altro task → 409 `mutation_conflict`.
    **Replay dopo che il chiamante ha perso la famiglia di arrivo** (Anna toglie Giulia da Mamma) →
    404, nulla cambia.
  - **Concorrenza:** Principale→Mamma e Mamma→Principale insieme (due thread, latch, 5 volte) →
    200 e 200, nessun deadlock; inoltro e «Prendo io» sullo stesso task insieme (5 volte) → inoltro
    200, presa 200 o 404, task in Mamma senza assegnatario, dopo la `DELETE` in partenza solo la
    `UPSERT` in Mamma.
  - **Isolamento parametrico** (regola 1), sei casi: task di Babbo con `familyId` = Principale
    nell'URL (Marco); estranea (Rosa) con Principale nell'URL; Rosa con la sua famiglia nell'URL e il
    task di Principale; `toFamilyId` altrui (Babbo per Giulia); `toFamilyId` inesistente; Luca (solo
    Mamma) col suo task → 404 `not_found`, task, `version`, `change_log` invariati, nessun
    `applied_mutation`, nessun evento; poi l'inoltro legittimo funziona e il `change_log` del task non
    ha righe in Babbo.
- [ ] `cd app && npx playwright test e2e/acceptance/giro-016-*` → verde (API finta come giro 014):
  - Giulia, «Ritirare le foto» (assegnato a Marco), «Inoltra», sceglie «Famiglia Mamma» → avviso
    «Avviso inoltro» visibile **prima** di «Conferma inoltro»; nessuna richiesta `forward` partita.
  - «Comprare il regalo per la nonna» (assegnato a Giulia) → Mamma → nessun avviso.
  - Conferma → una `POST …/forward` con `toFamilyId` di Mamma; il task non è più nella lista di
    Principale; messaggio «Inoltrato in Famiglia Mamma» visibile; in «tutte le mie famiglie» il task
    mostra «Famiglia Mamma».
  - Due click rapidi su «Conferma inoltro» (risposta lenta) → al massimo una `POST`; pulsante
    disabilitato durante la richiesta.
  - «Annulla» → nessuna richiesta, il task resta nella lista, focus sul pulsante «Inoltra».
  - Risposta 403 → «Non puoi inoltrare questo task», il task resta.
  - Utente con una sola famiglia (Luca) → nessun pulsante «Inoltra» (Giulia sullo stesso task lo vede).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (Spotless compreso).
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi.
- [ ] CI della PR verde.

## Fuori perimetro
- Mostrare la storia degli eventi nell'app, e l'endpoint `GET …/events` che la leggerebbe.
- Un endpoint di anteprima dell'inoltro: l'avviso usa `members(toFamilyId)`.
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
| `server/src/test/java/com/planforhome/acceptance/Giro016AcceptanceSupport.java` | famiglie e persone del piano, `forward(...)`, letture di `task`, `task_event`, `applied_mutation` |
| `server/src/test/java/com/planforhome/acceptance/Giro016ForwardAcceptanceTest.java` | 13 test: P11 (4), assegnatario e risorsa, chi non è in entrambe, ciclico, fusi, validazioni, idempotenza, replay dopo l'uscita, due test di concorrenza |
| `server/src/test/java/com/planforhome/acceptance/Giro016ForwardIsolationAcceptanceTest.java` | 6 casi parametrici → 404, nessuna traccia; poi inoltro legittimo e `change_log` |
| `app/e2e/acceptance/giro-016-fake-api.ts` | API finta del giro (famiglie, membri, task, `forward` con P11) |
| `app/e2e/acceptance/giro-016-forward.spec.ts` | F1 avviso prima della conferma e focus nel dialogo; F2 nessun avviso; F3 conferma; F4 doppio click; F5 annulla e focus; F6 403; F7 una sola famiglia |

## Porte
- Doppio senso previste: migrazione `V3` che aggiunge `task_event`; un endpoint nuovo; codice
  d'errore nuovo `same_family`; chiavi i18n nuove; filtro di famiglia tolto dal controllo della serie.
- Senso unico: nessuna.

## Rischi di concorrenza
- **Inoltri incrociati** (A→B e B→A insieme): lock delle due famiglie in ordine di id; test con due
  thread obbligatorio.
- **Inoltro contro presa/fatto/modifica** nella famiglia di partenza: il lock di partenza serializza;
  chi arriva dopo trova il task in un'altra famiglia → 404; nessuna `UPSERT` in partenza dopo la
  `DELETE` (test con «Prendo io»).
- **Assegnatario rimosso dalla famiglia di arrivo nel frattempo:** l'appartenenza si legge sotto il
  lock della famiglia di arrivo.
- **Doppio invio:** `mutation_id` idempotente (replay guardato prima del 404 «task non qui»), un solo
  evento e una sola coppia di righe `change_log`; nell'app il pulsante è disabilitato durante la
  richiesta.
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

## Idee per dopo
- `GET …/events` e la storia del task nell'app, con gli altri tipi di evento.
- Inoltro di una serie intera (occorrenze chiuse comprese).

## Critica ricevuta e cosa cambia
| Punto | Esito | Motivo |
|---|---|---|
| 1. Replay → 404 invece di 200 | accolto | ordine dei controlli riscritto (passo 3): `applied_mutation` prima del «task non qui»; 200 solo se il chiamante è ancora membro della famiglia dove il task sta ora; test del replay dopo l'uscita da Mamma → 404 |
| 2. «Ciclico»: Giulia non può chiudere un task in coda | accolto | lo segna fatto Anna, gestore di Mamma; la successiva resta in coda |
| 3. DATE con fusi diversi | accolto | `due_at` ricalcolato a mezzanotte locale nel fuso di arrivo; test con «Famiglia Zio» (America/New_York) e controllo che un DATETIME non si sposti |
| 4. FK composta, un solo `UPDATE` | accolto | scritto nell'effetto |
| Più semplice: niente `GET …/events` | accolto | la vista è fuori perimetro; i test leggono `task_event` dalla tabella; un endpoint in meno e metà isolamento in meno |
| Più semplice: niente anteprima | accolto | l'avviso usa `members(toFamilyId)`, come già nel piano |
| Concorrenza: lock in ordine e test a due thread obbligatorio | accolto | test con `together(...)` (latch), 5 ripetizioni |
| Concorrenza: inoltro contro presa | accolto | test: dopo la `DELETE` in partenza solo la `UPSERT` in arrivo |
| App: doppio click | accolto | pulsante disabilitato durante la richiesta; F4 con risposta lenta e `dblclick` |
| Test: idempotenza completa, isolamento con task di Babbo e Principale nell'URL, Playwright 403 e «Annulla» che lascia il task | accolto | tutti nei test |
| Facoltativo: `previousAssigneeId` | non tolto, dichiarato voluto | la storia futura deve dire chi ha perso l'assegnazione; i test non lo controllano |
| Facoltativo: focus nel dialogo | accolto | F1 (focus dentro il dialogo all'apertura), F5 (`toBeFocused` sul pulsante «Inoltra» dopo «Annulla») |
| Facoltativo: `cancelOpenOfSeries` filtra per famiglia in DECISIONI | rimandato al costruttore | è una nota per DECISIONI, che si scrive nel rapporto del giro; il piano lo dice: dopo un inoltro «Termina la serie» agisce solo nella famiglia dove sta l'occorrenza |

Test rossi alla consegna: server 19 su 19 (13 + 6 parametrici) per asserzione (l'endpoint non
esiste: 401 invece di 200/400/403/404); Playwright 7 su 7 per asserzione (manca il pulsante «Inoltra»).
