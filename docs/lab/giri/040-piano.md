---
giro: 040
traguardo: caccia
traguardi_extra: []
tipo: caccia
fase: chiusura
inizio: 2026-10-23T20:53:03Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 040 — caccia ai difetti su `main`

## Fetta e traguardo
T1–T10 sono tutti `passato` (PROGRESS, giro 039). Questo è il giro `caccia`: cerco difetti sul codice
di `main` (`da3d019`) prima del giro di chiusura. Zero righe di produzione: i difetti si registrano
nel rapporto e si correggono in giri di costruzione futuri, se l'umano li vuole.
Fonti: SPEC §5 (permessi P1–P18), §6 (vincoli), §7 (sync), §8 (promemoria), §9 (sicurezza);
rapporti 032, 033, 035; PROGRESS «Per l'umano».

Contestazioni: nessuna. Ho controllato i commenti dei rapporti e `DECISIONI.md`: nessun
`contesto n. X` aperto dopo il giro 020.

## Fatto quando — aree da battere
Ogni area si chiude con un esito: **difetto** (`NNN:gravità`, con passi per riprodurlo e il giro che
l'ha introdotto), **dubbio** (non riprodotto, con motivo) o **pulito** (cosa si è provato).
Le prove si fanno con test esplorativi locali (`server/src/test/java/com/planforhome/hunt/`,
`app/src/**/__tests__/`), lanciati e poi **non committati**: `main` resta verde.

- [ ] **A1. Permessi (SPEC §5).** Per ogni riga P1–P18 esiste un test con un caso permesso e uno
  vietato: `grep -rln "P<n>\b" server/src/test` → almeno un file per riga. Per le righe mancanti,
  prova esplorativa sull'API. Casi di confine da tentare:
  - membro che marca fatto un task di una risorsa di cui **non** è referente (P7);
  - membro che riapre un task segnato fatto da un gestore (P8);
  - P17/P18 dopo un inoltro, quando il creatore non è membro della famiglia nuova (regola del
    «creatore della lista»);
  - ultimo gestore che lascia la famiglia o si toglie il ruolo (P15, §5 «almeno un gestore»);
  - referente nominato tra persone di un'altra famiglia (§6).
- [ ] **A2. Isolamento tra famiglie (SPEC §6, §9).** `cd server && ./mvnw -q -Dtest='*Isolation*' test`
  → verde. Poi, a mano:
  - `id` generato dal client già usato in un'altra famiglia, su task, voce della spesa, serie (§6:
    rifiutato, nessuna upsert);
  - `family_id` nel corpo diverso da quello del percorso;
  - **dubbio del 035:** `PushRepository.titleOf`, `PushRepository.nameOf`,
    `ReminderRepository.words` leggono per `id` senza filtro di famiglia. Va cercato se un
    percorso pubblico ci arriva con un `taskId` o un `personId` di un'altra famiglia (sollecito,
    registrazione del device, inoltro). Esito atteso: «solo percorsi interni» confermato o difetto.
- [ ] **A3. Sincronizzazione (SPEC §7).**
  - stesso `mutation_id` ripetuto due volte, anche con corpo diverso → applicato una volta, stessa
    risposta;
  - stesso `mutation_id` usato da un utente di un'altra famiglia → nessuna fuga della risposta;
  - `GET` modifiche dopo `seq` N: nessuna riga di famiglie non proprie, anche dopo un inoltro o la
    perdita di un'appartenenza;
  - modifica in coda dopo che il ruolo è stato tolto → rifiutata (§7 «Permessi»);
  - **dubbio di PROGRESS:** dati locali dopo un 401 (Android: SQLite e coda restano?) e **PUT
    parziale** di un task: un campo assente si azzera o resta? Esito: comportamento osservato e
    confronto con §7.
- [ ] **A4. Ricorrenze e ora legale (§2.2, T6).** Con `Clock` finto:
  - serie settimanale delle 8:30 `Europe/Rome` a cavallo del 2026-10-25 e del 2027-03-28 → l'ora
    locale resta 8:30;
  - task `DATETIME` alle 2:30 del 2027-03-28 (ora che non esiste) e alle 2:30 del 2026-10-25 (ora
    doppia) → esito definito, nessuna eccezione;
  - fine mese (decisione 45) e terminazione della serie (P10) mentre un'occorrenza è già generata.
- [ ] **A5. Promemoria (SPEC §8).**
  - **difetto maggiore del 032:** un `PUT` tra il `due_at` di una riga e la corsa del lavoro (30 s)
    cancella la riga dovuta e non inviata. Prova: orologio finto oltre `due_at`, `PUT` del titolo,
    poi corsa del lavoro → atteso dalla SPEC: promemoria inviato; osservato: perso. Si conferma come
    `032:maggiore` già noto (non si conta due volte);
  - silenzio notturno: promemoria alle 23:00 con scadenza alle 7:30 → 21:45 della sera prima;
    sollecito alle 23:00 → non slitta;
  - sollecito ripetuto entro 5 minuti → rifiutato; su un task in coda → rifiutato;
  - task in coda alla scadenza → un solo promemoria ai gestori, non all'assegnatario;
  - **dubbi minori del 033:** «ricorda solo dopo un 2xx» senza test (M4); doppia navigazione se il
    layout si rimonta; registrazione ferma se `getDevicePushTokenAsync()` non risolve; `sendReminder`
    che sovrascrive con `error:network` (dubbio 2 del 032). Esito per ciascuno.
- [ ] **A6. Sicurezza e token (SPEC §9, PROGRESS).**
  - **token FCM dopo il logout:** dopo `POST /api/auth/logout` il device resta registrato e riceve
    promemoria della persona uscita? Esito: comportamento e confronto con §9 (rischio aperto);
  - token di sessione revocato dopo il logout → `401` su `GET /api/families`;
  - **Browser key Firebase** nel bundle web: si registra cosa è esposto e se ha restrizioni
    documentate; nessuna chiave si stampa nel rapporto.
- [ ] **A7. Verde di partenza.** `cd server && ./mvnw -B -ntp verify` e `cd app && npm test &&
  npx tsc --noEmit && npx eslint .` → verdi su `main`; a fine giro `git diff --stat origin/main --
  server app` → vuoto.
- [ ] **A8. Rapporto.** `docs/lab/giri/040-rapporto.md` con una riga per area, `difetti:` con le voci
  `NNN:gravità` nuove (non quelle già note), e le correzioni proposte come fette future.

## Fuori perimetro
- Correggere qualunque difetto, compreso il `032:maggiore`: 0 righe di produzione in `caccia`.
- Commit di test esplorativi; modifiche a test di accettazione esistenti.
- Le PR #34 (`expo-sqlite`), #44 e Dependabot #2 e #3: decisioni dell'umano, non si toccano.
- Comandi sui server di produzione, prove di carico, attacchi alla produzione: si prova in locale.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista;
  accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali (R1).

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: in `caccia` non si scrivono test di accettazione. Dati per le prove: solo quelli
dell'Appendice A già nel seeder (Marco, Giulia, Leo, Sofia; Anna, Pietro, Luca, Paolo, Davide;
Rosa, Franco) e task inventati al momento, per esempio «Annaffiare il basilico» nella Famiglia
Principale, assegnato a Leo, scadenza 2026-10-25T08:30 `Europe/Rome`.

## Porte
- Doppio senso previste: test esplorativi locali non committati.
- Senso unico: nessuna. Nessuna dipendenza, nessuna migrazione, nessuna integrazione nuova.

## Rischi di concorrenza
Da cercare, non da correggere: due persone che prendono dalla coda lo stesso task insieme (una
sola vince, l'altra «già preso da X»); lo stesso `mutation_id` in due richieste parallele (una sola
applicazione); `ReminderJob` che gira mentre un `PUT` ricalcola i promemoria (finestra del
`032:maggiore`); due solleciti nello stesso secondo (limite 1 ogni 5 minuti). Prova: richieste
parallele con `CompletableFuture` nei test esplorativi.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`): **0**; file di produzione: 0.
Solo `docs/lab/` (piano, rapporto, PROGRESS). Deve stare in una sessione: se il tempo manca, le
aree non battute si dichiarano tali nel rapporto, nell'ordine A5, A2, A3, A1, A6, A4.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Una fetta di costruzione che chiuda insieme `032:maggiore` (`due_at > now` in `deletePending`) e
  i filtri di famiglia su `titleOf`/`nameOf`/`words`.
- Cancellare i device della persona al logout (SPEC §9).
