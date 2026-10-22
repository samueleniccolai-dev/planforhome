---
giro: 027
traguardo: T9
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-22T06:00:03Z
ricerca: sì
accettazione:
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
   in SQLite) e le espone con `directory(familyId)`. `rows()` resta com'è: solo `task` e
   `shopping_item` (i test dei giri 024–026 non cambiano). `wipeFamily` e `clear` le cancellano
   come il resto. Limite noto: dopo lo snapshot le persone non si aggiornano finché la famiglia
   non viene riletta da zero (in «Idee per dopo»).
2. **Esito con dettaglio** (`SyncNotice`). Su un 409 il motore conserva nel campo facoltativo
   `detail` il corpo della risposta (`error`, `assigneePersonId`, `assigneeName`), così il client
   può dire «già preso da Luca». Il resto delle regole della decisione 84 non cambia.
3. **`src/task/queued.ts`** (puro): costruttori di `MutationInput` per i cinque comandi, con gli
   stessi percorsi e corpi di `client.ts`:
   - `createTaskMutation` → `POST …/tasks` `{ id, title, dueKind?, due?, recurrence?, template? }`,
     patch con la forma dello snapshot (`id`, `familyId`, `title`, `dueKind`, `dueAt`,
     `criticality: 'NORMAL'`, `status: 'OPEN'`, `assigneePersonId: null`, `createdBy`,
     `template`, `version: 0`);
   - `assignTaskMutation` → `PUT …/assignee` `{ assigneePersonId }`, patch uguale;
   - `takeTaskMutation` → `POST …/take` `{}`, patch `{ assigneePersonId: me }`;
   - `completeTaskMutation` → `POST …/done` `{}`, patch `{ status: 'DONE', completedBy: me }`;
   - `forwardTaskMutation` → `POST …/forward` `{ toFamilyId }`, patch `{ forwardedTo }`: il task
     sparisce subito dalla famiglia di partenza e compare in quella d'arrivo solo dopo il sync
     (lo decide il server, P11).
4. **`src/task/offline.ts`** (puro): `tasksFromRows(rows, directory)` → `Task[]` della famiglia
   (`dueAt` → `due`, `familyTimeZone` dalla rubrica, esclusi i task con `forwardedTo`);
   `taskNotice(notice, members)` → `{ key, params? }`:
   `conflict` con `detail.error = 'already_taken'` → `task.taken` con il nome (dalla rubrica,
   poi `assigneeName`, poi `?`); altro `conflict` → `task.changed`; `forbidden` →
   `task.forbidden` (`task.forward.forbidden` se la modifica era un inoltro); `notFound` e
   `invalid` → `task.stale` (chiave nuova, it/en: «Questo task è cambiato: ecco lo stato
   aggiornato»). Solo esiti con `entity: 'task'`.
5. **Hook `useOfflineTasks(familyId)`** (come `useOfflineList`): su Android legge famiglia,
   ruolo, persone e task da `directory()` e `rows()`, mai dall'API all'apertura; un errore di
   rete non porta mai a `/login`; i cinque comandi = `enqueue` + `afterWrite()`; gli esiti del
   ciclo della famiglia diventano l'avviso. Sul web non fa nulla.
6. **Schermata della famiglia su Android** (`app/family.tsx`, `TasksSection.tsx`): con l'hook
   attivo, la schermata usa i dati locali e i comandi in coda; le altre azioni (riapri, annulla,
   termina la serie) restano dirette all'API e sono disabilitate, con etichetta, se l'ultimo
   ciclo è `offline` o se c'è una modifica in coda per quel task (come la lista, `isBlocked`).
   L'avviso discreto è un testo con `role="status"` (non `alert`) e `aria-live="polite"`, che
   sparisce al comando successivo. Sul web nulla cambia. `TasksSection.tsx` (375 righe) cresce
   al più di 40: la logica Android sta nell'hook.
7. **`/tasks` su Android**, sola lettura: la lista di tutte le famiglie da `directory()` e
   `rows()` di ogni famiglia della rubrica, con i filtri esistenti; nessuna chiamata all'API.

## Dati demo
Quelli dei giri 024–026: famiglie Rossi (`0192f0a0-0000-7000-8000-0000000000f1`, fuso
`Europe/Rome`; Anna MANAGER, Luca MEMBER) e Bianchi-Verdi (`…00f2`, fuso `Europe/Rome`; Anna
MEMBER); task «Spesa sabato» (`…0101`, lista con latte, pane, uova), «Pagare la bolletta della
luce» (`…0102`, in coda, nessun incaricato), «Portare il cane dal veterinario» (`…0103`,
Bianchi-Verdi). Utenti `anna@demo.test` e `luca@demo.test` (Luca Rossi), token finti
`tok-anna-demo` e `tok-luca-demo`. Task nuovo creato offline da Anna: «Comprare le lampadine»
(id `0192f0a0-0000-7000-8000-000000000104`, scadenza `2026-10-24`, `DATE`).

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx playwright test e2e/acceptance/giro-027-*` → tutti verdi (Node, senza
  pagina, server finto, archivio in memoria e SQLite con `node:sqlite`):
  - R1 dopo il primo ciclo di Anna `directory(Rossi)` = nome «Rossi», fuso `Europe/Rome`, ruolo
    `MANAGER`, persone Anna e Luca con ruolo; R1b archivio SQLite riaperto con la rete giù → la
    rubrica c'è ancora; R1c Anna perde Bianchi-Verdi → `directory(Bianchi-Verdi)` vuota;
    R1d `rows()` contiene solo `task` e `shopping_item`;
  - Q1 [memoria e SQLite] rete giù: Anna crea «Comprare le lampadine», prende la bolletta, assegna
    «Spesa sabato» a Luca, segna fatto il task nuovo → `tasksFromRows` mostra subito i quattro
    effetti, il server niente; rete su → le quattro modifiche applicate una volta, in ordine; il
    ciclo dopo non rimanda nulla e le righe locali coincidono col server;
  - Q2 conflitto: Anna offline prende la bolletta; intanto Luca la prende online; rete su → il
    ciclo di Anna ha un esito `conflict` con `detail.assigneeName = 'Luca Rossi'`,
    `taskNotice` dà `task.taken` con `name: 'Luca Rossi'`, e la riga locale dice incaricato Luca;
  - Q3 inoltro offline della bolletta da Rossi a Bianchi-Verdi → sparisce subito da
    `tasksFromRows(Rossi)`; dopo il sync è in `rows(Bianchi-Verdi)` e non in `rows(Rossi)`;
  - Q4 permesso perso: Luca (MEMBER) assegna offline la bolletta ad Anna; il server la rifiuta
    (403: un MEMBER non assegna ad altri, SPEC §5 P4) → esito `forbidden`, `taskNotice` →
    `task.forbidden`, la riga locale torna allo stato del server;
  - Q5 `tasksFromRows` → `due` da `dueAt`, `familyTimeZone` dalla rubrica, task con
    `forwardedTo` esclusi; `taskNotice` ignora gli esiti delle voci della lista.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi, con i test Jest nuovi del
  costruttore: schermata della famiglia su Android con motore finto (apertura senza API, rete giù
  senza `/login`, «prendi» e «fatto» mettono in coda, riapri e annulla disabilitati offline e con
  modifica in coda, avviso con `role="status"`); `/tasks` su Android senza API.
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
| `app/e2e/acceptance/giro-027-android-tasks.spec.ts` | R1–R1d, Q1–Q5 qui sopra, con il server finto del giro 026 copiato ed esteso in `giro-027-fake-sync-server.ts` (create, assignee, take con 409 `already_taken`, done, forward, 403 per il MEMBER, `members` nello snapshot); moduli di produzione caricati a run time |

### Contratti per i test
- `engine.directory(familyId)` → `Promise<{ family?: { id, name, timeZone, role }, members:
  { personId, displayName, role }[] }>`.
- `SyncNotice` ha `detail?: Record<string, unknown>` (corpo del 409).
- `src/task/queued.ts` → `createTaskMutation({ familyId, taskId, me, title, dueKind?, due?,
  recurrence?, template? })`, `assignTaskMutation({ familyId, taskId, assigneePersonId })`,
  `takeTaskMutation({ familyId, taskId, me })`, `completeTaskMutation({ familyId, taskId, me })`,
  `forwardTaskMutation({ familyId, taskId, toFamilyId })` → `MutationInput`.
- `src/task/offline.ts` → `tasksFromRows(rows, directory)`, `taskNotice(notice, members)`.
- I moduli non importano `react-native` né `expo-*` al caricamento.

## Porte
- Doppio senso previste: righe `family` e `member` nella tabella locale esistente; campo `detail`
  degli esiti; patch `forwardedTo` per nascondere l'inoltro in coda; avviso con `role="status"`;
  chiave `task.stale`; riapri, annulla e termina la serie dirette e disabilitate offline.
- Senso unico: nessuna.

## Rischi di concorrenza
- «Prendi» da due persone: Anna offline, Luca online. Vince chi arriva prima al server; Anna
  riceve 409 e l'avviso; la riga locale si corregge col `changes` dello stesso ciclo (Q2).
- Doppio tocco su «prendi» o «fatto» offline: due `enqueue` con `mutation_id` diversi; il
  secondo «prendi» della stessa persona è innocuo, il secondo «fatto» riceve 409 `not_open` →
  `task.changed`. Il pulsante «fatto» sparisce appena la patch rende il task `DONE`.
- Inoltro in coda seguito da «fatto» in coda sullo stesso task: il task è già nascosto, quindi
  nessun «fatto» dalla schermata; se arrivasse, il server risponde 404 e l'esito è `task.stale`.
- Ciclo in corso mentre la schermata scrive: `sync()` serializza, `afterWrite()` segna «sporco»
  (giro 026); la rubrica si scrive nella stessa transazione della lettura della famiglia.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 600; file ≤ 12; una sessione. `TasksSection.tsx`
+40 al più, `family.tsx` +40 al più.

## Idee per dopo
- Aggiornare le persone della rubrica a ogni ciclo (`GET /api/families/{id}/members`) o con
  righe `member` nel `change_log` del server.
- Riapri, annulla e termina la serie in coda.

## Domande per il ricercatore (al massimo 3)
1. React Native 0.88 su Android e react-native-web: un `Text` con `role="status"` e
   `aria-live="polite"` viene annunciato da TalkBack e dagli screen reader del web? Serve
   `accessibilityLiveRegion="polite"` su Android?
2. Linee guida Material 3 / Android per un avviso non bloccante dopo un conflitto (snackbar o
   testo in linea): durata, posizione, quando farlo sparire.
3. Come presentano altri gestionali di task offline-first (per esempio Todoist, Microsoft To Do)
   una modifica rifiutata dal server dopo la riconnessione?

## Critica ricevuta e cosa cambia
(dopo il critico)
