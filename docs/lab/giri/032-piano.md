---
giro: 032
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-23T06:34:26Z
ricerca: sì
accettazione:
ripreso: no
---
# Piano del giro 032 — promemoria automatici, silenzio notturno e ricalcolo

## Fetta e traguardo
T10, seconda fetta di tre: i **promemoria automatici** sul server (calcolo, silenzio notturno, ora
legale, ricalcolo, task in coda scaduto ai gestori, lavoro periodico di invio), con lo stesso client
FCM e la stessa tabella `reminder` del giro 031. Nessuna modifica all'app.
Fonti: SPEC §2.2.9, §5, §6 (`reminder`), §8.

**Cosa resta di T10 dopo questo giro:**
1. Giro 033 — Android: `expo-notifications`, permesso, token, `google-services.json`, apertura del
   task dal tocco (si apre con una DOMANDA).
2. Giro `verifica-produzione`: notifica a un dispositivo di prova, `reminder.result` con il `name`.

## Dati della demo (inventati, da Appendice A)
- Famiglia Principale (`Europe/Rome`): Giulia e Marco gestori; Leo risorsa senza account,
  referente Giulia. Kate (locale `en`, email `g032-kate-<uuid>@example.com`) entra con un codice.
- Famiglia Mamma (`Europe/Rome`): Anna gestore; Giulia e Paolo membri (Giulia entra con un codice:
  serve all'inoltro).
- Token inventati con suffisso casuale per test: `tok-giulia-2`, `tok-marco-2`, `tok-kate-2`,
  `tok-anna-2`, `tok-paolo-2`.
- Task creati dai test via API (sempre in Principale salvo dove detto):
  - «Portare il gatto dal veterinario» — `DATETIME`, assegnato a Marco;
  - «Pagare la mensa» — `DATE`, assegnato a Giulia;
  - «Preparare lo zaino» — `DATE`, assegnato a Leo (promemoria a Giulia);
  - «Lavare l'auto» — `DATE`, in coda;
  - «Prendere il treno» — `DATETIME` alle 06:30 locali, assegnato a Marco;
  - «Annaffiare le piante» — `DATETIME` alle 09:00 locali, assegnato a Kate;
  - «Prenotare il pranzo di Natale» — inoltrato da Principale a Mamma.
- Date: sempre nell'**anno dopo** quello dell'orologio dei test (`AcceptanceClock` non torna mai
  indietro); i giorni del cambio dell'ora sono l'ultima domenica di marzo e di ottobre di quell'anno.

## Contratto (lo usano i test; il costruttore non lo cambia)
- **Righe in attesa.** Ogni scrittura che tocca un task calcola i suoi promemoria `AUTO` futuri
  come righe `reminder` con `result = 'pending'`, `sent_at` nullo, `due_at` = istante di invio
  calcolato, `recipient_person_id` = destinatario effettivo. Nessuna colonna nuova (`result` è
  `not null`, quindi `pending` è un valore). Migrazione `V7__reminder_pending_idx.sql`: solo un
  indice parziale `on reminder (due_at) where result = 'pending'`.
- **Ricalcolo.** Nella stessa transazione della scrittura (riga del task già bloccata): si cancellano
  le righe `pending` del task e si ricalcolano. Scatta su creazione (anche la prossima occorrenza di
  una serie), `PUT` del task (scadenza, tipo di scadenza), assegnazione, presa dalla coda, rimessa
  in coda, fatto, riapertura, annullamento, inoltro, fine serie. Task `DONE`/`CANCELLED` o senza
  scadenza → nessuna riga. Il sollecito non ricalcola.
- **Calcolo** (nel fuso della famiglia **attuale** del task):
  - assegnato a una persona con account → a lei; a una risorsa senza account → al referente;
  - `DATETIME`: «prima» a `due_at − reminder_offset_minutes` (il valore della colonna, oggi sempre
    60), «alla scadenza» a `due_at`;
  - `DATE`: «prima» alle 9:00 locali del giorno, «alla scadenza» alle 18:00 locali;
  - in coda: nessun «prima»; «alla scadenza» una riga per **ogni gestore** della famiglia.
- **Silenzio notturno** (solo `AUTO`): un istante con ora locale in `[22:00, 07:00)` slitta alle
  07:00 locali successive; se questo è **strettamente dopo** la scadenza, va alle 21:45 locali della
  sera prima di quelle 07:00. 21:59 non slitta; 22:00 sì; 07:00 no.
- **Doppioni e passato:** due righe dello stesso task con stesso destinatario e stesso istante →
  una. Un istante calcolato `≤` ora dell'orologio non si scrive (**decisione**: niente recupero dei
  promemoria già passati).
- **Ora legale:** gli orari locali si convertono con `ZonedDateTime.of(...)` del fuso della famiglia;
  9:00, 18:00, 7:00 e 21:45 non cadono mai nel buco delle 2–3 di `Europe/Rome`.
- **Lavoro periodico.** `@EnableScheduling` e `@Scheduled(fixedDelayString =
  "${planforhome.reminders.poll:PT30S}")` (Spring, nessuna dipendenza nuova; nei test `PT0.2S`).
  Prende le righe `pending` con `due_at ≤ orologio`, ordinate per `due_at`. Per ogni riga, in una
  transazione: blocca la riga (`for update skip locked`) e la riga del task; ricontrolla che il task
  sia `OPEN`, che il destinatario sia ancora quello che il calcolo darebbe adesso (per la coda:
  task ancora in coda e destinatario ancora gestore); se no `result = 'stale'`, `sent_at` nullo, e
  niente invio. Se sì `result = 'sending'`, commit, poi invio con `PushService` (fuori dalla
  transazione), come nel giro 031: il token del primo tentativo aggiorna la riga, ogni altro token
  aggiunge una riga `AUTO` con lo stesso `due_at`; esiti `name`, `no_device`, `push_disabled`,
  `token_rejected` (token cancellato), `error:<codice>`, `error:timeout`, `error:network`.
  `sent_at` = orologio al tentativo. Un errore su una riga non ferma le altre.
- **Messaggio:** identico al sollecito: `data = { taskId }` e basta, testo generico nella lingua del
  destinatario effettivo al momento dell'invio («Hai un promemoria» / «You have a reminder»).
  **Decisione** (punto aperto del giro 031): nessun nome della risorsa nel payload; vince il
  traguardo («solo l'identificativo del task e un testo generico»). Il nome lo mostrerà l'app
  (giro 033). Resta per l'umano la contraddizione di SPEC §8.
- I promemoria non toccano `version`, `change_log` né `task_event`: non sono dati del task.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro032*AcceptanceTest' test` → tutti verdi. FCM finto del
      giro 031 (`Giro031FakeFcm`), orologio `AcceptanceClock`, lettura delle righe `reminder` solo
      dopo una risposta HTTP:
  - [ ] `DATETIME` «Portare il gatto» alle 15:00 locali → 2 righe `pending` a Marco: 14:00 e 15:00
        locali (in UTC).
  - [ ] `DATE` «Pagare la mensa» → 2 righe a Giulia: 9:00 e 18:00 locali.
  - [ ] «Preparare lo zaino» (Leo) → righe a Giulia, nessuna con il `person_id` di Leo.
  - [ ] Silenzio: «Prendere il treno» 06:30 → una sola riga alle 21:45 locali della sera prima
        (doppione tolto); scadenza alle 07:30 → «prima» 06:30 slitta alle 07:00 (non dopo la
        scadenza), «alla scadenza» 07:30;
        scadenza alle 07:00 → una riga alle 07:00; scadenza alle 22:59 → 21:59 e 21:45 (la
        seconda slitta: 07:00 dopo la scadenza); scadenza alle 23:00 → 22:00 slitta → 21:45, una
        riga sola.
  - [ ] Ora legale: `DATE` nell'ultima domenica di marzo → 9:00 = 07:00Z e 18:00 = 16:00Z; il
        sabato prima → 08:00Z; `DATETIME` alle 07:30 locali dell'ultima domenica di ottobre →
        «prima» alle 07:00 locali = 06:00Z.
  - [ ] Coda: «Lavare l'auto» in coda → solo righe alle 18:00 per Marco e Giulia; preso da Giulia
        → righe di Giulia 9:00 e 18:00, nessuna di Marco.
  - [ ] Ricalcolo: cambio di scadenza (`PUT`) → solo le nuove righe `pending`; riassegnazione da
        Giulia a Marco → righe a Marco; fatto e annullato → 0 `pending`; riaperto → di nuovo 2;
        rimesso in coda → righe dei gestori. Le righe già inviate (`kind` `AUTO` o `NUDGE`) non si
        toccano.
  - [ ] Serie: segnato fatto un task ciclico con scadenza → la prossima occorrenza ha le sue righe.
  - [ ] Passato: scadenza `DATETIME` fra 30 minuti → solo la riga «alla scadenza».
  - [ ] Invio: orologio 1 s prima della riga → dopo 1 s di attesa resta `pending`, 0 messaggi;
        orologio sull'istante → entro 5 s `result` = `name`, `sent_at` = orologio, 1 messaggio a
        `tok-marco-2`, `data` solo `taskId`, «Hai un promemoria», priorità `high`.
  - [ ] Lingua: «Annaffiare le piante» a Kate → «You have a reminder».
  - [ ] Referente: «Preparare lo zaino» → messaggio a `tok-giulia-2`; il corpo non contiene titolo,
        «Leo», «Giulia».
  - [ ] Coda scaduta: «Lavare l'auto» alle 18:00 → 1 messaggio a `tok-marco-2` e 1 a
        `tok-giulia-2`; Paolo e Anna (altra famiglia) 0.
  - [ ] Esiti: token rifiutato → `token_rejected`, token cancellato; nessun token → `no_device`.
  - [ ] Stantio: Marco tolto dai gestori dopo il calcolo (cambio di ruolo, che non ricalcola) →
        la riga di Marco diventa `stale`, 0 messaggi a lui.
  - [ ] Isolamento (regola 1): «Prenotare il pranzo di Natale» assegnato a Marco in Principale e
        inoltrato da Giulia a Mamma (Marco non è in Mamma: il task arriva come lo lascia T7) → le
        righe `pending` sono solo di persone di Mamma, nel fuso di Mamma, nessuna di Marco; Anna non ha righe dei task di Principale; i
        promemoria non compaiono nelle modifiche di sincronizzazione né in `GET /api/tasks` di
        Paolo; `version` del task invariata dopo un invio.
  - [ ] Concorrenza: 10 ricalcoli paralleli dello stesso task (riassegnazioni alterne) → righe
        `pending` coerenti con lo stato finale, nessun doppione; due righe dovute insieme con il
        lavoro che gira → ogni riga inviata una volta sola.
- [ ] `cd server && ./mvnw -q -Dtest='Giro031*AcceptanceTest' test` → ancora verde.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi (app non toccata).
- [ ] `git diff --name-only origin/main` non contiene `server/pom.xml`, `app/package.json`,
      `app/package-lock.json`, `app/app.json`, `server/src/main/resources/application.properties`.

## Fuori perimetro
- Android, `expo-notifications`, token sul telefono, apertura dal tocco (giro 033).
- Anticipo modificabile dall'API o dall'app (`reminder_offset_minutes` non è nel contratto del task:
  resta 60); quindi anche il ricalcolo «su anticipo».
- Ricalcolo su cambio di referente, di ruolo, di lingua o di fuso della famiglia: lo copre il
  controllo all'invio (`stale`, lingua letta all'invio).
- Promemoria per i task esistenti prima del deploy (nessun riempimento iniziale).
- Recupero dei promemoria passati, ritentativi, righe `sending` rimaste da un arresto, più istanze
  del server.
- Nome della risorsa nel testo della notifica (vedi Decisione).
- Il difetto del `PUT` parziale; il token riassegnabile tra utenti (giro 033).
- `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica email e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `Giro032ReminderScheduleAcceptanceTest.java` | calcolo, silenzio, ora legale, coda, referente, passato |
| `Giro032ReminderRecalcAcceptanceTest.java` | scadenza, assegnatario, stato, serie, inoltro, concorrenza |
| `Giro032ReminderSendAcceptanceTest.java` | invio a tempo, lingua, referente, coda ai gestori, esiti, `stale` |

## Porte
- Doppio senso previste: migrazione V7 (solo un indice); `@EnableScheduling` (Spring già presente);
  proprietà `planforhome.reminders.poll` con valore predefinito nel codice (non si tocca
  `application.properties`); valori `pending`, `sending`, `stale` in `reminder.result`; decisione
  sul payload generico.
- Senso unico: nessuna.

## Rischi di concorrenza
- Ricalcolo e invio sulla stessa riga: entrambi bloccano la riga del task, quindi sono in serie;
  una riga già `sending` non si cancella. Finestra residua: un cambio subito dopo il commit di
  `sending` → una notifica sullo stato di un attimo prima (accettato).
- Lavoro periodico ripetuto o lento: `for update skip locked` e il passaggio a `sending` evitano il
  doppio invio. Provato con due righe dovute insieme.
- Contesto di test condiviso: il lavoro gira anche durante i test di altri giri. Un messaggio `AUTO`
  parte solo verso persone con un token registrato e task con scadenza: i test del giro 031 non
  hanno scadenze; da verificare in FINALE che nessun conteggio di messaggi si rompa.

## Budget
Righe di produzione (`server/src/main`) ≤ 450; file ≤ 10; app 0. Deve stare in una sessione.

## Domande per il ricercatore (al massimo 3)
1. Spring Framework 7 / Boot 4.1: `@Scheduled(fixedDelayString)` accetta una durata ISO-8601
   (`PT30S`) e un segnaposto con valore predefinito? Come si spegne nei test?
2. PostgreSQL: `select … for update skip locked` insieme a un blocco della riga di un'altra tabella
   nella stessa transazione: ordine dei blocchi per evitare stalli con il ricalcolo.
3. `java.time`: comportamento di `ZonedDateTime.of` nei buchi e nelle sovrapposizioni dell'ora
   legale, e come calcolare «le 07:00 successive» e «le 21:45 della sera prima» in modo sicuro.

## Idee per dopo
- Anticipo personalizzabile nell'app; promemoria scaduti da recuperare dopo un fermo del server.

## Critica ricevuta e cosa cambia
(dopo il critico)
