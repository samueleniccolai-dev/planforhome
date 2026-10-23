---
giro: 032
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: costruzione
inizio: 2026-10-23T06:34:26Z
ricerca: sì
accettazione: 73aabd9
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
  referente Giulia. Kate (locale `en`, registrata come nel giro 031) entra con un codice.
- Famiglia Mamma (`Europe/Rome`): Anna gestore; Luca e Paolo membri; Giulia entra con un codice
  dove serve all'inoltro.
- Famiglia Zio (`America/New_York`): la crea Anna; Giulia entra con un codice (inoltro con altro fuso).
- Token inventati con suffisso casuale per test: `tok-giulia-2`, `tok-marco-2`, `tok-kate-2`,
  `tok-anna-2`, `tok-paolo-2`, `tok-dead-marco-2` (rifiutato dal finto FCM).
- Task creati dai test via API (sempre in Principale salvo dove detto):
  - «Portare il gatto dal veterinario» — `DATETIME`, assegnato a Marco;
  - «Pagare la mensa» — `DATE`, assegnato a Giulia;
  - «Preparare lo zaino» — `DATE`, assegnato a Leo (promemoria a Giulia);
  - «Lavare l'auto» — `DATE`, in coda;
  - «Prendere il treno» — `DATETIME` alle 06:30 locali, assegnato a Marco;
  - «Annaffiare le piante» — `DATETIME` alle 09:00 locali, assegnato a Kate;
  - «Prenotare il pranzo di Natale» — inoltrato da Principale a Mamma.
- Date: sempre nell'**anno dopo** quello dell'orologio, ricalcolato prima di **ogni** test
  (`AcceptanceClock` non torna mai indietro); giorno normale il 10 febbraio; i giorni del cambio
  dell'ora sono l'ultima domenica di marzo e di ottobre di quell'anno.

## Contratto (lo usano i test; il costruttore non lo cambia)
- **Righe in attesa.** Ogni scrittura che tocca un task calcola i suoi promemoria `AUTO` futuri
  come righe `reminder` con `result = 'pending'`, `sent_at` nullo, `due_at` = istante di invio
  calcolato, `recipient_person_id` = destinatario effettivo. Nessuna colonna nuova (`result` è
  `not null`, quindi `pending` è un valore). Migrazione `V7__reminder_pending_idx.sql`: solo un
  indice parziale `on reminder (due_at) where result = 'pending'`.
- **Ricalcolo.** Nella stessa transazione della scrittura (riga del task già bloccata): si cancellano
  le righe `pending` del task e si ricalcolano. Scatta su creazione (anche la prossima occorrenza di
  una serie), `PUT` del task (scadenza, tipo di scadenza), assegnazione, presa dalla coda, rimessa
  in coda, fatto, riapertura, annullamento, inoltro; **rimozione di un membro** (`TaskService.requeue`,
  già sotto il blocco della famiglia: si ricalcolano i task rimessi in coda); **cambio di referente**
  (`setReferent` blocca la famiglia, poi i task aperti della risorsa in quella famiglia, in ordine di
  id, e li ricalcola). Task `DONE`/`CANCELLED` o senza scadenza → nessuna riga. Il sollecito e la
  fine serie non ricalcolano (con la fine serie le righe restano; se non valgono più diventano
  `stale` all'invio). Il cambio di ruolo non ricalcola: lo copre `stale`.
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
  una (un `Set` in memoria, nessun vincolo nuovo). Un istante calcolato `≤` ora dell'orologio non si scrive (**decisione**: niente recupero dei
  promemoria già passati).
- **Ora legale:** gli orari locali si convertono con `ZonedDateTime.of(...)` del fuso della famiglia;
  9:00, 18:00, 7:00 e 21:45 non cadono mai nel buco delle 2–3 di `Europe/Rome`.
- **Lavoro periodico.** `@EnableScheduling` e `@Scheduled(fixedDelayString =
  "${planforhome.reminders.poll:PT30S}")` (Spring, nessuna dipendenza nuova; nei test `PT0.2S`).
  `@EnableScheduling` sta in una `@Configuration` del package `reminder`. Il lavoro è il bean
  **`com.planforhome.reminder.ReminderJob`** con un metodo pubblico **`runDue()`** senza argomenti:
  una corsa; il metodo `@Scheduled` lo chiama. I test lo chiamano anche per riflessione, da due
  thread insieme.
  Una corsa legge senza blocchi al più **100** righe `pending` con `due_at ≤ orologio`, ordinate per
  `due_at`. Per ogni riga, in una transazione, **in quest'ordine**: (1) blocca la riga del task
  (`for update` normale, per id, **mai** la famiglia dopo il task); se il task non c'è più la riga
  diventa `stale`; (2) blocca la riga `reminder` con `for update skip locked` e
  `result = 'pending'` ricontrollato nella stessa select (se non torna nulla, la si salta);
  (3) ricontrolla con **la stessa funzione di calcolo** applicata al task bloccato (senza il filtro
  «passato»): la coppia (destinatario, `due_at`) deve essere nel risultato. Se no `result = 'stale'`,
  `sent_at` nullo, niente invio. Se sì `result = 'sending'`, commit, poi invio con `PushService`
  (fuori dalla transazione), come nel giro 031: il token del primo tentativo aggiorna la riga, ogni
  altro token aggiunge una riga `AUTO` con lo stesso `due_at`; esiti `name`, `no_device`,
  `push_disabled`, `token_rejected` (token cancellato), `error:<codice>`, `error:timeout`,
  `error:network`. `sent_at` = orologio al tentativo; **nullo** per `no_device`, `push_disabled` e
  `stale` (come nel giro 031). Un task inoltrato o sparito, o un errore su una riga, non ferma il
  ciclo.
- **Messaggio:** identico al sollecito: `data = { taskId }` e basta, testo generico nella lingua del
  destinatario effettivo al momento dell'invio («Hai un promemoria» / «You have a reminder»).
  **Decisione** (punto aperto del giro 031): nessun nome della risorsa nel payload; vince il
  traguardo («solo l'identificativo del task e un testo generico»). Il nome lo mostrerà l'app
  (giro 033). Resta per l'umano la contraddizione di SPEC §8.
- I promemoria non toccano `version`, `change_log` né `task_event`: non sono dati del task.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro032*AcceptanceTest' test` → 26 test verdi. FCM finto del
      giro 031 (`Giro031FakeFcm`), orologio `AcceptanceClock`, **un solo contesto** per le tre
      classi (annotazioni solo in `Giro032AcceptanceSupport`), lavoro ogni `PT0.2S`, lettura delle
      righe `reminder` solo dopo una risposta HTTP; dopo ogni test nessuna riga `sending` né
      `pending` già dovuta:
  - [ ] `DATETIME` «Portare il gatto» alle 15:00 locali → 2 righe `pending` a Marco: 14:00 e 15:00
        locali (in UTC).
  - [ ] `DATE` «Pagare la mensa» → 2 righe a Giulia: 9:00 e 18:00 locali; un task senza scadenza
        → nessuna riga.
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
  - [ ] Coda: «Lavare l'auto» in coda → solo righe alle 18:00 per Marco e Giulia (non Kate, membro,
        né Leo); preso da Giulia → righe di Giulia 9:00 e 18:00, nessuna di Marco.
  - [ ] Ricalcolo: cambio di scadenza (`PUT`) → solo le nuove righe `pending`; riassegnazione da
        Giulia a Marco → righe a Marco; fatto e annullato → 0 `pending`; riaperto → di nuovo 2;
        rimesso in coda → righe dei gestori. Le righe già inviate non si toccano: si parte da un
        `NUDGE` e da un `AUTO` già inviati, poi `PUT` → restano identiche.
  - [ ] Membro tolto: Marco tolto da Principale → i suoi task tornano in coda, righe alla scadenza
        solo a Giulia (`DATETIME` 15:00 → 15:00; `DATE` → 18:00).
  - [ ] Referente cambiato: Leo passa da Giulia a Marco → righe 9:00 e 18:00 a Marco.
  - [ ] Inoltro con altro fuso: `DATE` di Giulia inoltrato a Famiglia Zio (`America/New_York`) →
        stesso giorno, righe 9:00 e 18:00 di New York a Giulia.
  - [ ] Serie: segnato fatto un task ciclico con scadenza → la prossima occorrenza ha le sue righe.
  - [ ] Passato: orologio al 2 gennaio dell'anno dopo, scadenza `DATETIME` fra 30 minuti → solo la
        riga «alla scadenza» (poi il task si annulla: nessuna riga lasciata).
  - [ ] Invio: orologio 1 s prima della riga → dopo 1 s di attesa resta `pending`, 0 messaggi;
        orologio sull'istante → entro 5 s `result` = `name`, `sent_at` = orologio, 1 messaggio a
        `tok-marco-2`, `data` solo `taskId`, «Hai un promemoria», priorità `high`; `version` e
        `change_log` del task invariati.
  - [ ] Lingua: «Annaffiare le piante» a Kate → «You have a reminder».
  - [ ] Referente: «Preparare lo zaino» → messaggio a `tok-giulia-2`; il corpo non contiene titolo,
        «Leo», «Giulia».
  - [ ] Coda scaduta: «Lavare l'auto» alle 18:00 → 1 messaggio a `tok-marco-2` e 1 a
        `tok-giulia-2`; Paolo e Anna (altra famiglia) 0.
  - [ ] Esiti: token rifiutato → `token_rejected`, `sent_at` = orologio, token cancellato; nessun
        token → `no_device`, `sent_at` nullo.
  - [ ] Stantio: Marco tolto dai gestori dopo il calcolo (cambio di ruolo, che non ricalcola) →
        la riga di Marco diventa `stale`, `sent_at` nullo, 0 messaggi a lui; Giulia riceve il suo.
  - [ ] Isolamento (regola 1): «Prenotare il pranzo di Natale» assegnato a Marco in Principale e
        inoltrato da Giulia a Mamma (Marco non è in Mamma: il task arriva come lo lascia T7) → le
        righe `pending` sono solo di Anna (in coda in Mamma: 18:00), nessuna di Marco o Giulia;
        Anna non ha righe dei task di Principale; i promemoria non compaiono nelle modifiche di
        sincronizzazione né in `GET /api/tasks` di Paolo.
  - [ ] Concorrenza: 10 riassegnazioni parallele dello stesso task → tutte 200, righe `pending`
        solo dell'assegnatario finale, nessun doppione; `runDue()` da due thread insieme
        (`CountDownLatch`) su 3 righe dovute → 3 messaggi, un esito per riga; 20 iterazioni di `PUT`
        e riassegnazione in parallelo a `runDue()` → nessun 500, nessuno stallo (30 s), righe
        inviate o `stale`, un messaggio per riga inviata, nessuna riga due volte.
- [ ] `cd server && ./mvnw -q -Dtest='Giro031*AcceptanceTest' test` → ancora verde.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi (app non toccata).
- [ ] `git diff --name-only origin/main` non contiene `server/pom.xml`, `app/package.json`,
      `app/package-lock.json`, `app/app.json`, `server/src/main/resources/application.properties`.

## Fuori perimetro
- Android, `expo-notifications`, token sul telefono, apertura dal tocco (giro 033).
- Anticipo modificabile dall'API o dall'app (`reminder_offset_minutes` non è nel contratto del task:
  resta 60); quindi anche il ricalcolo «su anticipo».
- Ricalcolo su cambio di ruolo, di lingua o di fuso della famiglia e su fine serie: lo copre il
  controllo all'invio (`stale`, lingua letta all'invio). Perdita accettata: un membro che diventa
  gestore non riceve le righe di un task in coda già calcolato.
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
| `Giro032AcceptanceSupport.java` | contesto unico, date «anno dopo», righe, attesa dell'invio, `runDue()` per riflessione, nessuna riga dovuta lasciata |
| `Giro032ReminderScheduleAcceptanceTest.java` (7) | calcolo, senza scadenza, silenzio, ora legale, coda, referente, passato |
| `Giro032ReminderRecalcAcceptanceTest.java` (11) | `PUT`, assegnatario, stato, coda, già inviate, serie, inoltro con altro fuso, isolamento, membro tolto, referente, 10 riassegnazioni parallele |
| `Giro032ReminderSendAcceptanceTest.java` (8) | invio a tempo, lingua, referente, coda ai gestori, esiti, `stale`, due corse insieme, 20 ricalcoli durante il lavoro |

## Porte
- Doppio senso previste: migrazione V7 (solo un indice); `@EnableScheduling` (Spring già presente);
  proprietà `planforhome.reminders.poll` con valore predefinito nel codice (non si tocca
  `application.properties`); valori `pending`, `sending`, `stale` in `reminder.result`; decisione
  sul payload generico.
- Senso unico: nessuna.

## Rischi di concorrenza
- Ordine dei blocchi: scritture famiglia → task → righe `reminder`; lavoro task → riga `reminder`
  (`skip locked`), mai la famiglia. Nessun ciclo possibile.
- Ricalcolo e invio sulla stessa riga: entrambi bloccano la riga del task, quindi sono in serie;
  una riga già `sending` non si cancella. Finestra residua: un cambio subito dopo il commit di
  `sending` → una notifica sullo stato di un attimo prima (accettato).
- Lavoro periodico ripetuto o lento: `for update skip locked` e il passaggio a `sending` evitano il
  doppio invio. Provato con due righe dovute insieme.
- Contesti di test: ogni contesto ha il suo orologio e il suo lavoro, la base dati è una. Le tre
  classi 032 condividono un contesto (un orologio); le loro righe sono nell'anno dopo, oltre gli
  orologi degli altri contesti (fermi al 2031), e dopo ogni test nessuna riga dovuta resta in
  attesa. Il lavoro 032 può smaltire righe di altri contesti già dovute: vanno a persone senza
  token (`no_device`) o diventano `stale`; nessun messaggio raggiunge i token del giro 031, i cui
  task non hanno scadenza, quindi i controlli globali di `Giro031NudgeAcceptanceTest` tengono.

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
Accolti **tutti e 3** i DA CORREGGERE, le **3** semplificazioni, i **2** test di concorrenza, i
**5** test chiesti e i **3** facoltativi (16 punti su 16).
- DA CORREGGERE 1 (ordine dei blocchi): accolto. Prima il task (`for update` per id), poi la riga
  con `skip locked` e `result = 'pending'` ricontrollato; task sparito o inoltrato → `stale` senza
  fermare il ciclo; mai la famiglia dopo il task.
- DA CORREGGERE 2 (rimozione e referente): accolto. Ricalcolo in `requeue` e in `setReferent`;
  «Fuori perimetro» corretto; il cambio di ruolo resta una perdita accettata.
- DA CORREGGERE 3 (contesti): accolto. Un solo contesto per le tre classi (annotazioni nella classe
  base), date ricalcolate a ogni test, `@AfterEach` che aspetta fino a 10 s che nessuna riga sia
  `sending` o `pending` già dovuta; ragionamento sui controlli globali del giro 031 nei «Rischi».
- PIÙ SEMPLICE: accolte tutte e tre (stessa funzione di calcolo all'invio; `Set` in memoria; fine
  serie fuori dai trigger).
- CONCORRENZA: accolti. Per chiamare il lavoro da due thread il contratto fissa
  `ReminderJob.runDue()`; il test lo trova per riflessione, così compila prima che esista.
- TEST: accolti tutti (Zio a New York, membro tolto, referente, già inviate da `NUDGE` e `AUTO`,
  `stale` con `sent_at` nullo).
- FACOLTATIVI: accolti (`sent_at` nullo per `no_device`/`push_disabled`/`stale`; 100 righe per
  corsa; `@EnableScheduling` in una `@Configuration` del package). Il limite di 100 non ha un test
  dedicato.
