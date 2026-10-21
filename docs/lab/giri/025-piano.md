---
giro: 025
traguardo: T9
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-21T20:15:07Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 025 — T9: correzioni del motore di sync (contestazioni 83 e 84)

## Fetta e traguardo
T9, costruzione. La fetta sono solo le due contestazioni dell'umano sulla PR #34 (decisioni 83 e
84 del giro 024, ora `contestata`): sono difetti del giro 024 e vengono prima del cablaggio nelle
schermate, che passa al giro 026. Fonti: SPEC §4, §7; `docs/lab/giri/024-piano.md` («Contratto
del motore»); testo delle contestazioni sulla PR #34.

### Contestazione 83 — le cancellazioni valgono solo nella famiglia che si sta leggendo
Oggi `deleteRow(entity, id)` e `deleteRowsOfTask(taskId)` cancellano la riga ovunque. La chiave
locale è `(entity, id)`: dopo un inoltro Rossi → Bianchi-Verdi, se il ciclo legge prima
Bianchi-Verdi (il server ordina `GET /api/families` per nome), la riga diventa di Bianchi-Verdi e
poi il `DELETE` letto in Rossi la cancella; il cursore di Bianchi-Verdi è già avanti, quindi task e
voci non tornano più.

Contratto nuovo di `StoreOps` (in memoria e SQLite):
- `deleteRow(familyId, entity, id)`: cancella solo se la riga ha `familyId` uguale;
- `deleteRowsOfTask(familyId, taskId)`: cancella solo le voci del task con quel `familyId`;
- il motore passa sempre la famiglia che sta leggendo. Chiave locale e schema SQLite invariati
  (`putRow` resta un upsert su `(entity, id)` che sposta la riga di famiglia).

Lo stesso contratto si prova su SQLite **senza dipendenze nuove**: la logica SQL di
`sqliteStore.ts` passa in un modulo nuovo `app/src/sync/sqlStore.ts`, senza import di Expo:
```ts
export type SqlDatabase = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  withExclusiveTransactionAsync(fn: (txn: SqlDatabase) => Promise<void>): Promise<void>;
};
export function createSqlStore(db: SqlDatabase): Promise<LocalStore>; // crea lo schema
```
`openSqliteStore` in `sqliteStore.ts` apre il database con `expo-sqlite` e chiama
`createSqlStore`. I test di accettazione danno a `createSqlStore` un adattatore su `node:sqlite`
(modulo di Node, in CI Node 24), scritto nel file di supporto dei test.

### Contestazione 84 — version dopo un 2xx e famiglia persa solo con un segnale certo
1. **Version.** Dopo un 2xx di una modifica in coda, se il corpo della risposta ha `version`
   numerica, tutte le modifiche ancora in coda sulla stessa entità (`entity` + `entityId`) che
   hanno `version` numerica nel corpo la prendono dalla risposta. Rimozione dalla coda e
   riscrittura delle successive stanno nella **stessa transazione** (nuova operazione
   `replaceInQueue(mutation)`: stessa posizione in coda, corpo nuovo). La transazione legge la coda
   dentro `tx` (non la copia letta all'inizio del ciclo), e il motore invia ogni modifica come è
   **ora** nell'archivio, non la copia iniziale. Un vero conflitto resta un conflitto: se un altro
   client cambia il task tra le due modifiche, la seconda riceve 409.
2. **Famiglia persa.** Righe, coda e cursore di una famiglia si cancellano solo se, nello stesso
   ciclo, (a) `snapshot` o `changes` risponde 404 con corpo `{"error":"not_found"}` **e** (b) la
   famiglia non è nella risposta 2xx di `GET /api/families`. Ogni altro 404 (corpo diverso, per
   esempio quello predefinito di Spring `{"error":"Not Found", …}`, corpo vuoto, o famiglia ancora
   elencata) ferma il ciclo con `retry` e non cancella nulla.

Dopo il giro: decisione 85 (contratto delle cancellazioni per famiglia, `sqlStore.ts`) e 86
(version dopo 2xx, famiglia persa con doppio segnale) a registro; 83 e 84 passano a
`cambiata (giro 025)`.

## Dati demo (inventati, quelli del giro 024)
- Famiglie «Rossi» (`…00f1`) e «Bianchi-Verdi» (`…00f2`). Anna `anna@demo.test`: gestore di Rossi,
  membro di Bianchi-Verdi. Luca `luca@demo.test`: membro di Rossi.
- Rossi: «Spesa sabato» (lista, voci latte, pane, uova), «Pagare la bolletta della luce».
  Bianchi-Verdi: «Portare il cane dal veterinario». Tutti i task partono da `version` 1.
- Il server finto del giro 025 estende quello del 024 (file nuovo, il 024 non si tocca): elenco
  famiglie **ordinato per nome** come il server vero (Bianchi-Verdi prima di Rossi) o in ordine
  inverso, a scelta del test; inoltro in entrambe le direzioni; 404 con corpo predefinito di
  Spring o vuoto su una rotta scelta.

## Fatto quando — controlli eseguibili
Ogni riga tra C1 e C10 gira **due volte**: con `createMemoryStore` e con `createSqlStore` su
`node:sqlite` in memoria.
- [ ] C1 inoltro Rossi → Bianchi-Verdi di «Spesa sabato», Anna, elenco per nome (Bianchi-Verdi
  letta prima) → dopo il ciclo `getRows(Bianchi-Verdi)` ha il task e le 3 voci, `getRows(Rossi)` no;
  un secondo ciclo non cambia nulla.
- [ ] C2 lo stesso con l'ordine inverso (Rossi letta prima) → stesso risultato.
- [ ] C3 inoltro Bianchi-Verdi → Rossi di «Portare il cane dal veterinario», nei due ordini → il
  task è solo in Rossi.
- [ ] C4 Bianchi-Verdi mai letta prima (nessun cursore) e inoltro da Rossi: fotografia di
  Bianchi-Verdi poi `changes` di Rossi → task e voci restano in Bianchi-Verdi.
- [ ] C5 contratto dell'archivio: `deleteRow(Rossi, 'task', id)` e `deleteRowsOfTask(Rossi, id)` su
  righe che ora sono di Bianchi-Verdi non cancellano nulla; con la famiglia giusta cancellano.
- [ ] C6 due rinomine offline di «Pagare la bolletta» (entrambe con `version` 1) → un ciclo: il
  server ne applica 2, titolo = la seconda, `version` 3, nessun avviso.
- [ ] C7 risposta della prima persa (`network-after`) → ciclo successivo: replay 200, poi la
  seconda con `version` 2, applicata; nessun avviso.
- [ ] C8 tocco durante l'invio della prima (`onRequest` mette in coda la seconda) → la seconda parte
  con la `version` della risposta e viene applicata; una modifica su un'altra entità (veterinario)
  tiene la sua `version`.
- [ ] C9 un altro client rinomina il task dopo la prima (`onRequest` sul secondo invio) → la
  seconda riceve 409 e c'è un avviso `conflict`; lo stato del server vince.
- [ ] C10 famiglia persa: 404 `not_found` su `changes` e famiglia assente dall'elenco → righe, coda
  (con avviso `notFound`) e cursore di Bianchi-Verdi cancellati; Rossi intatta.
- [ ] C11 404 `not_found` su `changes` o `snapshot` con la famiglia **ancora elencata** → `retry`,
  nulla cancellato, coda intatta.
- [ ] C12 404 con corpo predefinito di Spring (`{"error":"Not Found","status":404,…}`) o corpo
  vuoto, famiglia assente dall'elenco → `retry`, nulla cancellato; al ciclo dopo, con il 404
  `not_found`, la famiglia si cancella.
- [ ] `cd app && npx playwright test e2e/acceptance/giro-025-*` → tutti verdi.
- [ ] `cd app && npx playwright test e2e/acceptance/giro-024-*` → 21/21 ancora verdi (il 024 non si
  modifica).
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi (i test Jest del giro 024
  sull'archivio si aggiornano alla nuova firma).
- [ ] `grep -n "expo-sqlite" app/src/sync/sqlStore.ts` → nessun risultato; `git diff origin/main --
  app/package.json app/package-lock.json` → vuoto.

## Fuori perimetro
- Cablaggio su Android (sessione, schermate che leggono da `LocalStore`, intervallo, logout con
  `clear()`): giro 026. Poi `verifica-produzione` di T9.
- Server: nessuna modifica (le risposte del giro 023 bastano).
- Schema locale SQLite e chiave `(entity, id)`: invariati; nessuna migrazione locale.
- Dubbi aperti del 024 non contestati: pagina malformata che rifiuta la promessa, 400/403 in
  lettura con `retry` per sempre, due motori con due lucchetti.
- Aggiornare `version` o dati della riga locale dopo un 2xx (solo la coda cambia).
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario; accesso con
  Google o Apple, iPhone, Play Store; verifica email e recupero password; sincronizzazione in tempo
  reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-025-sync-fixes.spec.ts` | C1–C12, parametrici sui due archivi; moduli caricati a runtime (`engine`, `memoryStore`, `sqlStore`) come nel 024, così il file compila prima che `sqlStore.ts` esista |
| `app/e2e/acceptance/giro-025-fake-sync-server.ts` | server finto del 024 esteso (ordine elenco, inoltro inverso, 404 con corpo scelto) e adattatore `SqlDatabase` su `node:sqlite` |

## Porte
- Doppio senso previste: firma di `deleteRow`/`deleteRowsOfTask` con `familyId`; nuova operazione
  `replaceInQueue`; modulo nuovo `sqlStore.ts` (logica spostata da `sqliteStore.ts`); `retry` sui 404
  non certi.
- Senso unico: nessuna. `node:sqlite` è un modulo di Node, usato solo nei test; nessun pacchetto npm
  nuovo, `app/package.json` non cambia.

## Rischi di concorrenza
- Tocco durante l'invio: la riscrittura della `version` legge la coda dentro la transazione
  (prova C8). Una modifica messa in coda **dopo** quella transazione ma con la `version` vecchia
  della vista resta possibile finché la lettura non aggiorna la riga: 409 e avviso, nessuna perdita
  silenziosa. Si annota nel rapporto.
- Crash tra la rimozione della prima e la riscrittura delle successive: impossibile, stessa
  transazione (con SQLite `withExclusiveTransactionAsync`).
- Replay dopo risposta persa: il server rimanda la risposta salvata, con la `version` dopo la prima
  (C7).
- Ordine di lettura delle famiglie: le cancellazioni per famiglia rendono il risultato uguale nei
  due ordini (C1–C3).

## Budget
Righe di produzione in `app/src` ≤ 180 (escluso lo spostamento di `sqliteStore.ts` in
`sqlStore.ts`); file di produzione ≤ 6; una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Dopo un 2xx, scrivere nella riga locale la `version` della risposta, così una modifica messa in
  coda dopo non parte vecchia.
- Un indicatore «sincronizzazione ferma» quando i 404 non certi si ripetono.
