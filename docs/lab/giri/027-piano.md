---
giro: 027
traguardo: T9
traguardi_extra: []
tipo: costruzione
fase: finale
inizio: 2026-10-22T06:00:03Z
ricerca: sì
accettazione: app/e2e/acceptance/giro-027-android-tasks.spec.ts
ripreso: no
---
# Piano del giro 027 — T9 parte 4: task su Android via coda e avviso discreto

## Fetta e traguardo
T9 parte 4 (costruzione), l'ultima prima della verifica-produzione: sulla schermata della famiglia,
su Android, i task si leggono dall'archivio locale e «crea», «assegna», «prendi», «fatto» e
«inoltra» passano dalla coda; gli esiti del server (per esempio «già preso da Luca») arrivano con
un avviso discreto. Fonti: SPEC §4, §5 (P11 inoltro), §7 («Conflitti», «Famiglia persa»);
piani 024–026; decisioni 84, 86, 88, 89.

Perché ora: la lista della spesa offline c'è (giro 026); i task sono il resto della promessa di
SPEC §7 sul telefono. Il server non cambia: gli endpoint dei task hanno già `mutation_id`.

**Cosa resta di T9 dopo questo giro:** prova dell'APK su telefono e giro `verifica-produzione`.

## Progetto (i nomi sotto «Contratti» sono fissati dai test; il resto è libero)
1. **Rubrica locale nel motore** (`src/sync/engine.ts`). Offline la schermata deve sapere nome e
   fuso della famiglia, il ruolo di chi usa l'app e le persone (per «assegna a»). Oggi il motore
   butta via due cose che già riceve: la lista di `GET /api/families` (`id`, `name`, `timeZone`,
   `role`) a ogni ciclo e `members` dello snapshot. Il motore le salva come righe interne con
   `entity` `family` e `member` nella stessa tabella (`entity` è già `TEXT`: nessuno schema nuovo
   in SQLite) e le espone con `directory(familyId)` e `families()` (le righe `family` di tutte le
   famiglie: servono a `FamilySwitch` e ai bersagli dell'inoltro offline). La chiave primaria
   locale è `(entity, id)` senza famiglia: una riga `member` ha `id = <familyId>:<personId>`,
   altrimenti Anna, che sta in due famiglie, ne perderebbe una. `rows()` restituisce solo `task` e
   `shopping_item` (i test dei giri 024–026 non cambiano). `wipeFamily` e `clear` le cancellano
   come il resto. Limite noto: dopo lo snapshot le persone non si aggiornano finché la famiglia
   non viene riletta da zero (in «Idee per dopo»).
2. **Esito con dettaglio** (`SyncNotice`). Ogni esito porta `path` (il percorso della modifica
   rifiutata: distingue un inoltro da un'assegnazione). Su un 409 il motore conserva nel campo
   facoltativo `detail` il corpo della risposta (`error`, `assigneePersonId`, `assigneeName`),
   così il client può dire «già preso da Luca». Il resto delle regole della decisione 84 non
   cambia.
   **Niente righe fantasma:** `rows()` crea una riga da una modifica in coda senza riga locale
   solo se è una creazione (la patch ha `title`); un «prendi», «fatto» o «inoltra» su un task che
   non c'è non produce una riga. In più `tasksFromRows` scarta le righe senza `title`.
3. **`src/task/queued.ts`** (puro): costruttori di `MutationInput` per i cinque comandi, con gli
   stessi percorsi e corpi di `client.ts`. Ogni modifica ha `entity: 'task'`, `entityId` **e
   `taskId`** uguali all'id del task: così `isBlocked` (che guarda `taskId`) blocca riapri e
   annulla anche con un «fatto» in coda.
   - `createTaskMutation` → `POST …/tasks` `{ id, title, dueKind?, due?, recurrence?, template? }`,
     patch `id`, `familyId`, `title`, `dueKind`, `due` (il giorno o l'istante scritto, **non**
     `dueAt`), `criticality: 'NORMAL'`, `status: 'OPEN'`, `assigneePersonId: null`, `createdBy`,
     `template`, `version: 0`;
   - `assignTaskMutation` → `PUT …/assignee` `{ assigneePersonId }`, patch uguale;
   - `takeTaskMutation` → `POST …/take` `{}`, patch `{ assigneePersonId: me }`;
   - `completeTaskMutation` → `POST …/done` `{}`, patch `{ status: 'DONE', completedBy: me }`;
   - `forwardTaskMutation` → `POST …/forward` `{ toFamilyId }`, patch `{ forwardedTo }`: il task
     sparisce subito dalla famiglia di partenza e compare in quella d'arrivo solo dopo il sync
     (lo decide il server, P11).
4. **`src/task/offline.ts`** (puro): `tasksFromRows(rows, directory)` → `Task[]` della famiglia,
   ordinati per `id` (SQLite non garantisce l'ordine senza `ORDER BY`); `familyTimeZone` dalla
   rubrica; esclusi i task con `forwardedTo` e le righe senza `title`. La scadenza: se la riga ha
   `due` (creazione in coda) si usa quello; altrimenti da `dueAt` dello snapshot: per un `DATE`
   `due = dayIn(new Date(dueAt), familyTimeZone)` (`filters.ts`; il server salva la mezzanotte
   del giorno nel fuso della famiglia, per esempio il 25/10/2026 a Roma è `2026-10-24T22:00:00Z`),
   per un `DATETIME` `due = dueAt`;
   `taskNotice(notice, members)` → `{ key, params? }`:
   `conflict` con `detail.error = 'already_taken'` → `task.taken` con il nome (dalla rubrica,
   poi `assigneeName`, poi `?`); altro `conflict` → `task.changed`; `forbidden` →
   `task.forbidden` (`task.forward.forbidden` se `path` finisce con `/forward`); `notFound` e
   `invalid` → `task.stale` (chiave nuova, it/en: «Questo task è cambiato: ecco lo stato
   aggiornato»). Esiti con `entity` diversa da `task` → `undefined`.
5. **Hook `useOfflineTasks(familyId)`** (come `useOfflineList`): su Android legge famiglia,
   ruolo, persone e task da `directory()` e `rows()`, mai dall'API all'apertura; un errore di
   rete non porta mai a `/login`; i cinque comandi = `enqueue` + `afterWrite()`; gli esiti del
   ciclo della famiglia diventano l'avviso. **Guardia anti doppio tocco:** finché un comando sullo
   stesso task è in corso (`enqueue` non ancora risolto), un secondo tocco non accoda nulla (un
   solo `enqueue` per due tocchi rapidi su «fatto»). Sul web non fa nulla.
6. **Schermata della famiglia su Android** (`app/family.tsx`, `TasksSection.tsx`): con l'hook
   attivo, la schermata usa i dati locali e i comandi in coda; le altre azioni (riapri, annulla,
   termina la serie) restano dirette all'API e sono disabilitate, con etichetta, se l'ultimo
   ciclo è `offline` o se c'è una modifica in coda per quel task (come la lista, `isBlocked`).
   L'avviso discreto è un testo con `role="status"` (non `alert`), `aria-live="polite"` e
   `accessibilityLiveRegion="polite"` (ricerca: su Android non ci si fida del solo `role`), che
   sparisce al comando successivo o con «chiudi» etichettato, mai a tempo. Il `ForwardDialog`,
   su Android, prende le famiglie da `families()` e le persone della famiglia d'arrivo da
   `directory(target).members` invece che dall'API (una prop per il caricatore, poche righe).
   Sul web nulla cambia. `TasksSection.tsx` (375 righe) cresce
   al più di 40: la logica Android sta nell'hook.
7. ~~`/tasks` su Android in sola lettura~~: **rimandato** (critica, «più semplice»); va in «Idee
   per dopo». `families()` resta, perché serve già all'inoltro offline.

## Dati demo
Quelli dei giri 024–026: famiglie Rossi (`0192f0a0-0000-7000-8000-0000000000f1`, fuso
`Europe/Rome`; Anna MANAGER, Luca MEMBER) e Bianchi-Verdi (`…00f2`, fuso `Europe/Rome`; Marco Verdi MANAGER, Anna
MEMBER); task «Spesa sabato» (`…0101`, lista con latte, pane, uova), «Pagare la bolletta della
luce» (`…0102`, in coda, nessun incaricato), «Portare il cane dal veterinario» (`…0103`,
Bianchi-Verdi, creato da Marco). Persone: Anna (`…00a1`, «Anna»), Luca (`…00a2`, «Luca Rossi»),
Marco (`…00a3`, «Marco Verdi», `marco@demo.test`, nuovo in questo giro). Le scadenze di prova di
Q5: un `DATE` del 25/10/2026 (`dueAt` `2026-10-24T22:00:00Z`), un `DATE` del 26/10/2026
(`2026-10-25T23:00:00Z`, dopo il cambio dell'ora), un `DATETIME` `2026-10-25T08:30:00Z`. Task nuovo creato offline da Anna: «Comprare le lampadine»
(id `0192f0a0-0000-7000-8000-000000000104`, scadenza `2026-10-24`, `DATE`).

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx playwright test e2e/acceptance/giro-027-*` → tutti verdi (Node, senza
  pagina, server finto, archivio in memoria e SQLite con `node:sqlite`):
  - R1 dopo il primo ciclo di Anna `directory(Rossi)` = nome «Rossi», fuso `Europe/Rome`, ruolo
    `MANAGER`, persone Anna e Luca Rossi con ruolo; `directory(Bianchi-Verdi)` = Anna MEMBER e
    Marco MANAGER (Anna in tutte e due); `families()` = le due famiglie; R1b archivio SQLite
    riaperto con la rete giù → rubrica e `families()` ci sono ancora; R1c [memoria e SQLite] Anna
    perde Bianchi-Verdi → `directory(Bianchi-Verdi)` vuota, `families()` solo Rossi, Anna ancora
    nella rubrica di Rossi; R1d `rows()` contiene solo `task` e `shopping_item`;
  - M1 i cinque costruttori: percorsi, metodi e corpi di `client.ts`; `entity: 'task'`,
    `entityId` e `taskId` uguali all'id del task; la patch di creazione ha `due`/`dueKind`;
  - Q1 [memoria e SQLite] rete giù: Anna crea «Comprare le lampadine», prende la bolletta, assegna
    «Spesa sabato» a Luca, segna fatto il task nuovo → `tasksFromRows` mostra subito i quattro
    effetti (il task nuovo con `due` `2026-10-24`), il server niente; rete su → le quattro
    modifiche applicate una volta, in ordine (sul server `dueAt` `2026-10-23T22:00:00Z`); il ciclo
    dopo non rimanda nulla, le righe locali coincidono col server e `tasksFromRows` dà ancora
    `due` `2026-10-24`;
  - Q2 conflitto: Anna offline prende la bolletta; intanto Luca la prende online; rete su → il
    ciclo di Anna ha un esito `conflict` con `path` …`/take` e `detail.assigneeName = 'Luca Rossi'`,
    `taskNotice` dà `task.taken` con `name: 'Luca Rossi'`, e la riga locale dice incaricato Luca;
  - Q3 inoltro offline della bolletta da Rossi a Bianchi-Verdi → sparisce subito da
    `tasksFromRows(Rossi)`; dopo il sync è in `rows(Bianchi-Verdi)` e non in `rows(Rossi)`;
  - Q4 permesso perso: Luca (MEMBER) assegna offline la bolletta ad Anna; il server la rifiuta
    (403: un MEMBER non assegna ad altri, SPEC §5 P4) → esito `forbidden`, `taskNotice` →
    `task.forbidden`, la riga locale torna allo stato del server;
  - Q4b ruolo tolto offline: Anna passa da MANAGER a MEMBER di Rossi mentre è offline e assegna
    la bolletta a Luca → `forbidden`, riga ripristinata, `directory(Rossi).family.role = MEMBER`;
  - Q4c inoltro rifiutato: Anna (MEMBER di Bianchi-Verdi) inoltra offline il task di Marco a
    Rossi → 403, esito con `path` …`/forward`, `taskNotice` → `task.forward.forbidden`, il task
    torna in Bianchi-Verdi e non compare in Rossi;
  - Q6 un «prendi», un «fatto» o un «inoltra» in coda per un task senza riga locale (ciascuno da
    solo) → nessun task fantasma in `tasksFromRows`;
  - Q5 `tasksFromRows` → `DATE` del 25/10/2026 (cambio dell'ora a Roma) → `2026-10-25`, `DATE`
    del 26/10 → `2026-10-26`, `DATETIME` invariato, `DATE` di una creazione in coda dal campo
    `due`, `familyTimeZone` dalla rubrica, esclusi `forwardedTo` e righe senza `title`, ordine per
    `id`; Q5b `taskNotice` → nome dalla rubrica, poi `assigneeName`, poi `?`; `task.changed`,
    `task.stale`, `task.forbidden`, `task.forward.forbidden`; esiti della lista → `undefined`.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi, con i test Jest nuovi del
  costruttore: schermata della famiglia su Android con motore finto (apertura senza API, rete giù
  senza `/login`, «prendi» e «fatto» mettono in coda, riapri e annulla disabilitati offline;
  **annulla disabilitato con un «fatto» in coda e la rete su**; **due tocchi rapidi su «fatto» →
  un solo `enqueue`**; avviso con `role="status"`, `aria-live="polite"` e
  `accessibilityLiveRegion="polite"`).
- [ ] `cd app && npx playwright test` → tutto verde: il web resta online e invariato.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (server non toccato).
- [ ] Job `apk` della CI verde.
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessuna revisione
  umana attesa (nessun percorso protetto toccato).
- [ ] Prova a mano sull'APK (per l'umano, nel rapporto): Anna in modalità aereo prende la
  bolletta; Luca dal web la prende; rete su → entro 60 s Anna vede «Già preso da Luca Rossi» e
  la bolletta assegnata a Luca.

## Fuori perimetro
- Modifiche al server e ai suoi test; aggiornamento delle persone dopo lo snapshot.
- `/tasks` su Android (resta com'è oggi).
- Riapri, annulla e termina la serie in coda (restano dirette, disabilitate offline); modifica di
  titolo, note, scadenza e criticità di un task esistente; ricorrenza visibile offline (lo
  snapshot non la porta).
- Rilevazione della rete con NetInfo o `expo-network`; promemoria e notifiche (T10).
- Dipendenze nuove di qualunque tipo.
- `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; email; sincronizzazione in tempo reale
  e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-027-android-tasks.spec.ts` | R1–R1d, M1, Q1–Q6 qui sopra (16 test), con un server finto ridotto in `giro-027-fake-sync-server.ts` (solo `Http`, senza fetch: create 201, assignee con le regole di `memberMayAssign`, take con 409 `already_taken`, done, forward con 403/404 come `TaskService`, `members` nello snapshot, `DATE` come mezzanotte a Roma); moduli di produzione caricati a run time |

### Contratti per i test
- `engine.directory(familyId)` → `Promise<{ family?: { id, name, timeZone, role }, members:
  { personId, displayName, role }[] }>`.
- `engine.families()` → `Promise<{ id, name, timeZone, role }[]>` (tutte le famiglie della
  rubrica).
- `SyncNotice` ha `path: string` (percorso della modifica) e `detail?: Record<string, unknown>`
  (corpo del 409).
- Ogni `MutationInput` dei task: `entity: 'task'`, `entityId = taskId = <id del task>`.
- `src/task/queued.ts` → `createTaskMutation({ familyId, taskId, me, title, dueKind?, due?,
  recurrence?, template? })`, `assignTaskMutation({ familyId, taskId, assigneePersonId })`,
  `takeTaskMutation({ familyId, taskId, me })`, `completeTaskMutation({ familyId, taskId, me })`,
  `forwardTaskMutation({ familyId, taskId, toFamilyId })` → `MutationInput`.
- `src/task/offline.ts` → `tasksFromRows(rows, directory)` (ordinati per `id`),
  `taskNotice(notice, members)` → `{ key, params? } | undefined`.
- I moduli non importano `react-native` né `expo-*` al caricamento.

## Porte
- Doppio senso previste: righe `family` e `member` nella tabella locale esistente (`member` con
  `id = <familyId>:<personId>`); campi `path` e `detail` degli esiti; `families()`; patch `forwardedTo` per nascondere l'inoltro in coda; avviso con `role="status"`;
  chiave `task.stale`; riapri, annulla e termina la serie dirette e disabilitate offline.
- Senso unico: nessuna.

## Rischi di concorrenza
- «Prendi» da due persone: Anna offline, Luca online. Vince chi arriva prima al server; Anna
  riceve 409 e l'avviso; la riga locale si corregge col `changes` dello stesso ciclo (Q2).
- Doppio tocco su «prendi» o «fatto» offline: la guardia dell'hook accoda una sola volta; il
  pulsante «fatto» sparisce appena la patch rende il task `DONE`. Se due `enqueue` passassero
  comunque, il secondo «fatto» riceve 409 `not_open` → `task.changed`.
- Inoltro in coda seguito da «fatto» in coda sullo stesso task: il task è già nascosto, quindi
  nessun «fatto» dalla schermata; se arrivasse, il server risponde 404 e l'esito è `task.stale`.
- Ciclo in corso mentre la schermata scrive: `sync()` serializza, `afterWrite()` segna «sporco»
  (giro 026); la rubrica si scrive nella stessa transazione della lettura della famiglia.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 600 (tolto `/tasks` su Android, aggiunti
`families()`, guardie e `ForwardDialog`); file ≤ 11; una sessione. `TasksSection.tsx`
+40 al più, `family.tsx` +40 al più.

## Idee per dopo
- Aggiornare le persone della rubrica a ogni ciclo (`GET /api/families/{id}/members`) o con
  righe `member` nel `change_log` del server.
- Riapri, annulla e termina la serie in coda.
- `/tasks` su Android in sola lettura dall'archivio locale (rimandato in questo giro).
- Stato «in attesa di sync» sul task in coda; azione «riprova» sull'avviso (ricerca).
- Prova con TalkBack sull'APK reale della live region.

## Domande per il ricercatore (al massimo 3)
1. React Native 0.88 su Android e react-native-web: un `Text` con `role="status"` e
   `aria-live="polite"` viene annunciato da TalkBack e dagli screen reader del web? Serve
   `accessibilityLiveRegion="polite"` su Android?
2. Linee guida Material 3 / Android per un avviso non bloccante dopo un conflitto (snackbar o
   testo in linea): durata, posizione, quando farlo sparire.
3. Come presentano altri gestionali di task offline-first (per esempio Todoist, Microsoft To Do)
   una modifica rifiutata dal server dopo la riconnessione?

## Critica ricevuta e cosa cambia
Accolti tutti e 5 i «DA CORREGGERE» e le note aggiuntive:
1. **Scadenza `DATE`**: `due = dayIn(new Date(dueAt), familyTimeZone)` per i `DATE`; la patch di
   creazione scrive `due`/`dueKind`; Q5 con un `DATE` del 25/10/2026, uno del 26/10 e un
   `DATETIME`; Q1 controlla `dueAt` sul server e `due` dopo il sync.
2. **Righe `member`**: `id = <familyId>:<personId>`; R1 controlla Anna in tutte e due le rubriche,
   R1c che resti in quella di Rossi dopo la perdita di Bianchi-Verdi (memoria e SQLite).
3. **`families()`**: aggiunto al contratto, provato in R1, R1b, R1c.
4. **`SyncNotice.path`**: aggiunto; Q4c (403 su un inoltro → `task.forward.forbidden`), Q5b.
5. **`taskId` dei task**: nel contratto e in M1; test Jest «annulla disabilitato con "fatto" in
   coda e rete su».
- Righe fantasma: `rows()` crea righe solo per le creazioni e `tasksFromRows` scarta le righe
  senza `title`; Q6 prova ogni comando da solo (un inoltro successivo le nasconderebbe).
- Guardia anti doppio tocco: nell'hook, con test Jest. Ruolo tolto offline: Q4b. Ordine per
  `id`: Q5. `accessibilityLiveRegion="polite"` nel test Jest.
- «Più semplice»: tolto il punto 7 (`/tasks` su Android) e ridotto il budget dei file a 11.
- Facoltativo accolto: `ForwardDialog` su Android con `families()` e `directory(target).members`.
  Gli altri facoltativi vanno in «Idee per dopo».
- Dati demo: aggiunto Marco Verdi (MANAGER di Bianchi-Verdi, autore del veterinario) per avere un
  inoltro che il server rifiuta con 403. Il server finto del giro 027 è una copia ridotta (solo
  `Http`), non un'estensione di quello del 026: i test del giro non usano fetch e token.
Scartato: nulla.
