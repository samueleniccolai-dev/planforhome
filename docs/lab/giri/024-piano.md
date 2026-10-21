---
giro: 024
traguardo: T9
traguardi_extra: []
tipo: costruzione
fase: revisione
inizio: 2026-10-21T18:05:20Z
ricerca: no
accettazione: dce3654
ripreso: no
---
# Piano del giro 024 — T9 parte 2: motore di sync del client 

## RISPOSTA: Opzione A (21/10, decisione 81). DOMANDA per l'umano — dipendenza npm nuova per il database locale su Android

**Contesto.** SPEC §4 e §7: su Android il client ha un database locale SQLite e una coda di
modifiche. La parte server di T9 è fatta (giro 023: snapshot, changes, `version` sul PUT). Il motore
di sync del client ha bisogno di un database locale, e nessuna libreria SQLite è tra le dipendenze
di base (ADR-0001, SPEC §14.1, DECISIONI): è una porta a senso unico (CLAUDE.md regola 2). ADR-0001
cita già `expo-sqlite` come la strada «matura su Android» (righe 46–47), ma non la registra come
dipendenza decisa.

**Opzioni.**

| | Opzione | Pro | Contro |
|---|---|---|---|
| A | `expo-sqlite`, versione dell'SDK 58 (`~58.0.x`, fissata da `npx expo install expo-sqlite`), solo Android | modulo ufficiale Expo, nessun plugin nativo a parte, segue gli aggiornamenti dell'SDK (Dependabot); già indicato da ADR-0001 | il supporto web è alpha (COOP/COEP): non lo usiamo, il web resta online (§7); in Jest non gira, serve un adattatore in memoria |
| B | `@op-sqlite/op-sqlite` (ultima stabile) | più veloce, JSI | libreria di terzi, plugin di Expo e build nativa da gestire; più superficie nell'APK in CI |
| C | Nessuna dipendenza in questo giro | nessuna porta ora | il motore usa solo un archivio in memoria; il «Fatto quando» di T9 (database locale) resta aperto e la domanda torna al giro dopo |

**Raccomandazione: A.** Motivo: è il modulo che ADR-0001 già prevede, versionato con l'SDK; la
logica del motore resta dietro un'interfaccia `LocalStore`, così i test Jest usano un archivio in
memoria e nessun'altra dipendenza (niente `better-sqlite3` in Jest).

**Cosa succede dopo ogni risposta.**
- **A:** il giro riparte con la fetta qui sotto, completa; `app/package.json` cambia, quindi la PR
  va in `revisione-umana`. Decisione da registrare in DECISIONI.
- **B:** stessa fetta con op-sqlite; in più va provata la build dell'APK in CI con il plugin; il
  budget cresce e la fetta potrebbe dividersi.
- **C:** la fetta si riduce al motore con l'archivio in memoria (righe 1–5 del «Fatto quando»);
  l'adattatore SQLite e il cablaggio su Android restano al giro successivo, con la stessa domanda.

## Fetta e traguardo
T9 parte 2 (costruzione): **motore di sync del client e adattatore SQLite**, niente di più. Coda
locale con `mutation_id`, invio in ordine, lettura per `seq` a pagine, fotografia per famiglia
nuova, esiti definitivi e transitori, cascata delle voci, pulizia di una famiglia persa; dietro
un'interfaccia `LocalStore` con due implementazioni: in memoria (test) e `expo-sqlite` (Android,
decisione 81). Il web non cambia. Fonti: SPEC §4, §7; piano e rapporto 023 (dubbio 2).

**Cosa resta di T9 dopo questo giro:** cablaggio del motore nelle schermate Android (scritture che
passano dalla coda, sync all'avvio, al ritorno della rete e ogni 60 s, `clear()` al logout), avviso
discreto nell'interfaccia, prova sull'APK.

## Contratto del motore (i test lo usano alla lettera)
File nuovi in `app/src/sync/`: `engine.ts`, `memoryStore.ts` e `types.ts` sono **TypeScript puro**
(nessun import di `react-native`, `expo-*` o `@/api/client`: i test li caricano in Node);
`sqliteStore.ts` è l'unico che importa `expo-sqlite` e nessun file di `app/app` lo importa ancora.

```ts
type EntityKind = 'task' | 'shopping_item';
type LocalRow = { entity: EntityKind; id: string; familyId: string; taskId: string | null;
  data: Record<string, unknown> };            // data = forma della fotografia/changes (giro 023)
type MutationInput = { familyId: string; entity: EntityKind; entityId: string;
  taskId: string | null; method: 'POST' | 'PUT'; path: string;
  body: Record<string, unknown>;              // inviato come { ...body, mutationId }
  patch: Record<string, unknown> };           // sovrapposto a data finché è in coda
type QueuedMutation = MutationInput & { mutationId: string };
type SyncNotice = { kind: 'conflict' | 'forbidden' | 'notFound' | 'invalid'; familyId: string;
  entity: EntityKind; entityId: string; mutationId: string };
type SyncResult = { status: 'ok' | 'offline' | 'unauthorized' | 'retry'; notices: SyncNotice[] };
type Http = (r: { method: 'GET' | 'POST' | 'PUT'; path: string; body?: unknown })
  => Promise<{ status: number; body: unknown }>;   // rifiuta se la rete cade
createMemoryStore(): LocalStore   // con dump(): Promise<{ rows; queue; cursors: Record<string, number> }>
createSyncEngine({ store, http, newId? }): { enqueue(input): Promise<QueuedMutation>;
  sync(): Promise<SyncResult>; rows(familyId): Promise<LocalRow[]>; clear(): Promise<void> }
```

Regole:
1. **`enqueue`** genera il `mutationId` (UUIDv7, `newId` iniettabile) e salva la voce di coda
   prima di rispondere. La coda è persistente: un motore nuovo sullo stesso archivio la riprende.
2. **Un solo `sync()` alla volta** (lucchetto): una chiamata durante un ciclo attende quel ciclo.
3. **Ordine del ciclo:** prima la coda, dalla più vecchia, una richiesta alla volta; poi
   `GET /api/families`; poi la lettura di ogni famiglia dell'unione «lista del server ∪ famiglie
   con cursore locale»: fotografia se non c'è cursore, altrimenti `changes?after=<cursore>` finché
   `hasMore`.
4. **Esiti dell'invio:** 2xx → tolta dalla coda. 409, 404, 403, 400 → **definitivi**: tolta dalla
   coda, un `SyncNotice` (`conflict`, `notFound`, `forbidden`, `invalid`), la vista torna allo stato
   del server (niente GET singolo: la riga del server non è mai stata toccata e i `changes` portano
   le novità). Rete caduta → resta in coda, ciclo fermo, `offline`. 5xx e 429 → resta in coda,
   ciclo fermo, `retry`. 401 → ciclo fermo subito, `unauthorized`, nulla scartato né cancellato.
5. **Righe del server e modifiche in coda separate:** le righe salvano solo lo stato del server;
   `rows(familyId)` restituisce le righe con le `patch` in coda sovrapposte. Una lettura non
   cancella mai una modifica in coda.
6. **Transazione:** `LocalStore` espone una transazione; ogni pagina (o fotografia) e il suo cursore
   si salvano nella stessa transazione. Una pagina persa lascia il cursore della precedente.
7. **Cascata:** un `DELETE` di un task cancella anche le righe con quel `taskId`.
8. **Famiglia persa:** il solo segnale è **404 su `snapshot` o `changes`** → si cancellano righe,
   coda e cursore di quella famiglia. Rete, 401, 5xx o assenza da `GET /api/families` non bastano.
9. **`clear()`** svuota righe, coda e cursori (da chiamare al logout nel giro del cablaggio).

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx playwright test e2e/acceptance/giro-024-*` → 21 test verdi
  (`giro-024-sync.spec.ts`, server finto `giro-024-fake-sync-server.ts`, in Node, senza pagina):
  - spunte offline di «latte», «pane», «uova» arrivano dopo la riconnessione, in quest'ordine, con i
    `mutationId` della coda;
  - la coda parte prima di ogni lettura del ciclo;
  - rete che cade sulla spunta di «pane» **prima** e **dopo** che il server la applichi: un motore
    nuovo sullo stesso archivio finisce, ogni `mutationId` ha effetto una volta, in ordine;
  - due `sync()` insieme: ogni `mutationId` inviato una volta, una sola fotografia;
  - una spunta fatta durante la lettura non viene sovrascritta dallo stato del server;
  - famiglia nuova: prima la fotografia, poi solo `changes` dopo il suo `seq`;
  - `hasMore`: più pagine in un ciclo; pagina persa → cursore della pagina prima, ripresa da lì;
  - 409 `version_conflict`, 403, 400, 404 → modifica scartata, avviso, vista = stato del server;
  - 503, 429, rete → la modifica resta in coda e riparte; 401 → nessuna richiesta dopo, archivio
    identico;
  - inoltro di «Spesa sabato» fuori dalle famiglie di Luca → nessuna riga del task né delle sue voci;
  - Anna perde Bianchi-Verdi con una modifica in coda → avviso `notFound`, nessuna riga, coda o
    cursore di Bianchi-Verdi; rete, 401 e lista delle famiglie caduta non cancellano nulla;
  - isolamento: Luca non chiede mai Bianchi-Verdi; sullo stesso archivio di Anna, il sync di Luca
    cancella Bianchi-Verdi; `clear()` svuota tutto.
- [ ] `cd app && npm test` verde, con test Jest del costruttore in `src/sync/__tests__/` (almeno:
  transazione della memoria che non salva nulla se la funzione lancia).
- [ ] `cd app && npx tsc --noEmit && npx eslint .` verdi con `sqliteStore.ts`.
- [ ] Build dell'APK in CI verde con `expo-sqlite`.
- [ ] `cd app && npx playwright test` tutto verde (il web resta online e invariato).
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → solo la revisione
  umana attesa (`app/package.json`, `app/package-lock.json`).

## Fuori perimetro
- **Cablaggio nelle schermate** (scritture via coda, avvio del sync, intervallo, logout): giro dopo.
- Avviso discreto nell'interfaccia (il motore espone solo `SyncNotice`).
- Offline sul web; sincronizzazione in tempo reale (`traguardi.json → fuori_perimetro`).
- Template 730, calendario, accesso Google/Apple, iPhone, Play Store, email, dati reali.
- Modifiche al server; GET singolo di un'entità; endpoint batch.
- Qualunque dipendenza oltre a `expo-sqlite` (niente `better-sqlite3` né altri SQLite per i test).
- Nessun traguardo diventa `passato`.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Commit `dce3654`. Playwright in Node (nessuna pagina): CI li esegue già con `npx playwright test`,
mentre `jest.config.js` (protetto) cerca solo in `src/**/__tests__`. Il file carica `src/sync/engine`
e `src/sync/memoryStore` a runtime, quindi compila oggi e fallisce per asserzione
(`createSyncEngine` non esiste). Dati demo inventati: famiglie «Rossi» e «Bianchi-Verdi»;
anna@demo.test (gestore Rossi, membro Bianchi-Verdi), luca@demo.test (membro Rossi); in Rossi la
lista «Spesa sabato» con «latte», «pane», «uova» e «Pagare la bolletta della luce»; in
Bianchi-Verdi «Portare il cane dal veterinario».

## Porte
- Doppio senso: interfaccia `LocalStore`, schema SQLite locale (si ricrea), forma di `SyncNotice`.
- Senso unico: `expo-sqlite` — **risposta A** (decisione 81). Annotare in DECISIONI la versione
  esatta fissata da `npx expo install expo-sqlite`.

## Rischi di concorrenza
Doppio `sync()`: lucchetto (test). Caduta dopo l'applicazione: stesso `mutationId`, replay (test).
Tocco durante la lettura: righe del server e coda separate (test). Pagina e cursore nella stessa
transazione (test con pagina persa). Famiglia persa durante un ciclo: coda di quella famiglia
cancellata con le righe.

## Budget
Righe di produzione in `app/src` ≤ 600; file nuovi ≤ 6; una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`).

## Critica ricevuta e cosa cambia
Accolti tutti e 5 i «DA CORREGGERE»:
1. Esiti definitivi (409/404/403/400) e transitori (rete, 5xx, 429), 401 che ferma il ciclo:
   regola 4, cinque test. Ho tenuto anche 403 tra i definitivi (era nel «Fatto quando» della bozza).
2. Famiglia persa solo con 404 su `snapshot`/`changes`: regola 8; test con rete, 401 e lista caduta.
3. Cascata delle voci al `DELETE` del task: regola 7; il controllo parla di task e voci.
4. Prima la coda, poi la lettura; righe del server e `patch` separate: regole 3 e 5, due test.
5. `mutationId` all'ingresso in coda, cursore nella transazione della pagina, `hasMore`: regole 1 e
   6; test con motore nuovo sullo stesso archivio e con pagina persa.
Accolti anche i «più semplice» (un solo `sync()` con lucchetto, niente GET singolo), il perimetro
(cablaggio fuori), i test chiesti (ordine latte/pane/uova, caduta prima e dopo, isolamento Luca/Anna,
coda di famiglia persa) e i facoltativi: `clear()` nel contratto (il logout che lo chiama è del
cablaggio) e versione di `expo-sqlite` in DECISIONI. Non accolto nulla di diverso: i test sono in
Playwright e non in Jest perché la cartella dei test di accettazione è `app/e2e/acceptance` e la
configurazione di Jest è protetta.

## Idee per dopo
- Legare la coda all'utente (oltre a `clear()` al logout) per un telefono condiviso.
- Usare `current` del 409 per aggiornare subito la riga, senza attendere i `changes`.
