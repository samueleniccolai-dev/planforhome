# planforhome — Documento di progetto

Versione 0.3 · 17/10/2026 · approvata al CANCELLO 2

## In breve

planforhome è il gestionale delle cose da fare di una famiglia, anzi di più famiglie che si
sovrappongono: la famiglia di casa, quella dei nonni materni, quella dei nonni paterni. Una persona può
stare in più famiglie. I task hanno una scadenza e una criticità. Si assegnano a una persona oppure
vanno in una coda da cui qualcuno li prende. Possono ripetersi, passare da una famiglia all'altra e
mandare promemoria sul telefono.

Le persone senza telefono, per esempio i bambini piccoli, sono «risorse»: ricevono task, e i loro
promemoria vanno a un adulto di riferimento.

Si parte con **dati finti** (R0). L'uso reale (R1) ha una porta dedicata (§3).

## Indice

0. Come usare questo documento
1. Contesto e obiettivi
2. Il prodotto
3. Rilasci: R0 dati finti → R1 uso personale
4. Architettura
5. Famiglie, ruoli e permessi
6. Modello dati
7. Offline e sincronizzazione
8. Promemoria e notifiche
9. Sicurezza
10. Infrastruttura e consegna
11. Privacy
12. Requisiti non funzionali
13. Qualità e test
14. Rischi e domande aperte
- Appendice A — Dati della demo
- Appendice B — Glossario
- Registro delle versioni

## 0. Come usare questo documento

- È la fonte del **prodotto**; i traguardi stanno in `docs/lab/traguardi.json` e citano le sezioni (§).
- Le funzioni nuove dopo la fase 0 nascono con `/speckit-specify` e `/speckit-clarify` in
  `specs/NNN-nome/spec.md` (proposta n. 10). Quando una funzione entra nel prodotto, la sezione di qui
  che la riguarda si aggiorna con un rimando.
- Gli agenti non cambiano questo file: è un percorso protetto. Una differenza trovata in un giro va in
  `docs/lab/DECISIONI.md` come proposta.
- Le decisioni prese nella fase 0, con il loro esito, sono in `docs/lab/fase0-decisioni.md`.
- Le porte a senso unico già decise sono in §14.1.

## 1. Contesto e obiettivi

**I problemi che risolve** (intervista, blocco 1):
- documenti da ricordare;
- cose cicliche dimenticate;
- cose da fare al momento dimenticate.

**Obiettivo di R0:** una demo con dati finti, installabile su Android come APK e usabile dal web. Deve
mostrare:
- task creati e assegnati;
- promemoria automatici all'assegnatario;
- solleciti mandati da chi ha il ruolo.

**Obiettivo dell'esperimento:** misurare il metodo v4 su un prodotto nuovo (`docs/ESPERIMENTO.md`).

**Dove sta il valore** (inferenza dalla ricerca, `docs/lab/ricerca-concorrenti.md`): famiglie che si
sovrappongono, coda dei task, inoltro tra famiglie, risorse senza app. Il rischio principale è
l'adozione, quindi creare un task deve costare pochi tocchi.

## 2. Il prodotto

### 2.1 Concetti

| Concetto | Definizione |
|---|---|
| **Persona** | chiunque possa ricevere task. Ogni persona è una **risorsa**. |
| **Utente** | una persona con un account: email e password, app sul telefono o web. Ogni utente è una risorsa; non ogni risorsa è un utente. |
| **Risorsa senza account** | una persona che non entra nell'app (es. un bambino). Ha un **referente**: un utente della stessa famiglia che riceve i suoi promemoria. |
| **Famiglia** | un gruppo di persone con i propri task. Le famiglie si sovrappongono. |
| **Appartenenza** | il legame persona–famiglia, con un ruolo (§5). Una persona appartiene a una o più famiglie. |
| **Task** | una cosa da fare in una famiglia, con titolo, note facoltative, scadenza, criticità, assegnatario o coda, ricorrenza facoltativa, template facoltativo. |
| **Coda** | i task di una famiglia senza assegnatario. Un membro può prenderne uno. |
| **Template** | un tipo di task con contenuto proprio. In R0: «lista della spesa», con voci da spuntare. |

### 2.2 Funzioni di R0

1. **Accesso.** Registrazione pubblica e login con email e password.
   - **Nessuna persona esiste senza famiglia**: né un utente né una risorsa (decisione dell'umano).
     Per questo la registrazione si completa in uno di due modi:
     - **crea una famiglia:** dai il nome, e chi si registra ne diventa gestore;
     - **usa un codice d'invito:** chi si registra entra come membro nella famiglia del codice.
   - Il codice d'invito lo genera un gestore per la propria famiglia. È monouso e vale 7 giorni.
   - Un utente già registrato usa un codice per entrare in un'altra famiglia, oppure crea una famiglia
     nuova.

   Dopo il login:
   - con una sola famiglia entra lì;
   - con più famiglie sceglie quale.

   Da qualunque schermata si cambia famiglia.

   **L'ultima appartenenza:**
   - un utente non può lasciare la sua ultima famiglia;
   - se un gestore gli toglie l'ultima appartenenza, l'account viene disattivato (`disabled_at`) e non
     entra più. I suoi task in quella famiglia tornano in coda;
   - una risorsa senza account che perde l'ultima appartenenza viene cancellata, e i suoi task tornano
     in coda.

   Altre regole:
   - Ognuno cambia la propria password dal profilo.
   - La lingua (`person.locale`) si fissa alla registrazione da quella del dispositivo e si cambia dal
     profilo.
2. **Vista «tutte le mie famiglie».** I task delle sole famiglie a cui si appartiene, filtrabili per
   «assegnati a me», «in coda», «in scadenza». **Non esiste un profilo che veda le famiglie altrui**
   (proposta n. 3, accettata).
3. **Task.**
   - Si creano con il solo titolo obbligatorio. La scadenza predefinita è «nessuna»; la criticità
     predefinita è «normale».
   - Criticità: `bassa`, `normale`, `alta`.
   - Stati: `aperto` (assegnato o in coda) → `fatto`, oppure `annullato`. Un task fatto si può
     riaprire (§5).
   - In R0 i task non si cancellano: «annullato» è la cancellazione visibile. `deleted_at` serve solo
     alle voci della lista della spesa e alla sincronizzazione.
   - La scadenza è una data (`due_kind = DATE`) oppure una data con ora (`DATETIME`). Tutte le date
     sono mostrate nel fuso della famiglia del task, anche nella vista «tutte le mie famiglie».
4. **Assegnazione e coda.** Un task si assegna a una risorsa della famiglia o resta in coda. Un membro
   prende un task dalla coda; se due lo prendono insieme, vince il primo che arriva al server (§7).
5. **Task ciclici.**
   - **Tipi di ricorrenza:** ogni giorno, ogni N giorni, ogni settimana in giorni scelti (es.
     martedì), ogni mese in un giorno. Se il mese non ha quel giorno, vale l'ultimo del mese.
   - **Serve una scadenza:** un task ciclico deve averla. Fuso orario: quello della famiglia, con
     predefinito `Europe/Rome`.
   - **Quando nasce l'occorrenza successiva:** quando un'occorrenza diventa `fatto` o `annullato`.
     - È ancorata alla **scadenza**, non al giorno in cui il task è fatto: è la prima data della
       regola dopo la scadenza precedente.
     - I periodi persi si saltano: se la prima data trovata è già passata nel momento in cui il task è
       fatto, si prende la prima data futura. Esempio: la carta del martedì fatta giovedì ricompare il
       martedì dopo, e non si accumulano arretrati.
     - L'assegnatario si conserva; un task in coda resta in coda.
   - **«Annulla questa volta»** annulla l'occorrenza e crea la successiva.
   - **«Termina la serie»** annulla l'occorrenza e non crea la successiva. Lo fanno un gestore o chi ha
     creato la serie.
6. **Inoltro tra famiglie.** Lo fa chi appartiene a entrambe le famiglie. Il task si **sposta** nella
   famiglia di arrivo:
   - l'assegnatario si conserva solo se appartiene anche a quella famiglia, altrimenti il task va in
     coda, e lo si dice a chi inoltra prima di confermare;
   - resta la storia «inoltrato da X a Y il …»;
   - un task ciclico si inoltra con la sua ricorrenza.
7. **Template «lista della spesa».**
   - Voci con casella da spuntare, aggiunta rapida (una riga, invio), riordino, «togli le spuntate».
   - Ogni voce ricorda chi l'ha aggiunta: «aggiunta da X» per chi non è il creatore della lista.
   - Togliere una voce (§5 P17): il creatore della lista e i gestori la cancellano; un altro membro
     la **riga** («tolta da X»): la voce resta visibile in fondo, separata dalle spuntate, e
     chiunque la ripristina. Una voce rigata non si spunta e «togli le spuntate» non la tocca.
   - Su un riordino concorrente vince l'ultimo arrivato al server.
   - In una lista ciclica, alla nuova occorrenza passano le voci non spuntate, anche quelle rigate,
     che tornano normali: la rigatura vale solo per quella volta. Le spuntate no, anche se rigate.
   - L'uso offline arriva con il traguardo dell'offline (§7).
8. **Promemoria e solleciti** (§8).
9. **Lingue:** italiano e inglese. Ogni testo, notifiche comprese, è nella lingua di chi lo riceve
   davvero: per una risorsa senza account, il referente.

### 2.3 Fuori da R0

- Template «730», con scansione e PDF: dati fiscali e archivio di file (proposta n. 4).
- Calendario come vista dedicata. In R0 i task futuri si vedono nella lista per scadenza.
- Accesso con Google o Apple; iPhone; pubblicazione su Play Store (si usa l'APK).
- Email (verifica dell'indirizzo, recupero della password). In R0 una password dimenticata si
  reimposta **solo con lo script di amministrazione** sul server, eseguito dall'umano. Un gestore non può
  reimpostare la password di un altro: l'utente potrebbe stare in famiglie dove quel gestore non è.
- Dati bancari, sanitari e in generale troppo personali.
- Suggerimenti e funzioni «intelligenti»: brainstorming dopo R0.

## 3. Rilasci: R0 dati finti → R1 uso personale

| | R0 — dati finti | R1 — uso personale |
|---|---|---|
| Dati | solo inventati (Appendice A); lo script dei dati demo li ricrea | reali, della famiglia dell'umano |
| Chi la usa | l'umano e chi riceve l'APK di prova, con account demo | la famiglia dell'umano |
| Identità della catena su GitHub | quella dell'umano | **GitHub App separata** con permessi minimi |
| Titolare del trattamento | non serve | l'umano, con un registro minimo dei trattamenti |
| Distribuzione | APK installato a mano; web su un sottodominio di planforhome.com | come R0, poi Play Store |

**La porta per R1** si apre solo quando sono vere tutte queste condizioni, verificate dall'umano:
1. la catena gira con una GitHub App propria, e non c'è più nessun token personale nei segreti;
2. c'è un backup cifrato del database, con una prova di ripristino;
3. §11 è soddisfatto per R1: informativa, minori, cancellazione ed esportazione;
4. le chiavi di produzione sono diverse da quelle di R0 e tutti i segreti di R0 sono stati ruotati; i
   dati demo sono stati cancellati;
5. una revisione di sicurezza indipendente:
   - perimetro: autenticazione, permessi, isolamento tra famiglie, sincronizzazione;
   - la fa una sessione o una persona che non ha scritto il codice;
   - l'umano legge e firma il rapporto;
6. le notifiche FCM non contengono dati personali: solo un identificativo, e il testo lo scarica il
   client dal server. FCM passa da server di Google fuori dall'UE;
7. i log del server si conservano al massimo 30 giorni e non contengono il contenuto dei task.

Aprire R1 è una porta a senso unico: i dati reali non si ritirano. È fuori dall'esperimento 2.

## 4. Architettura

Fonte: `docs/adr/0001-stack.md`.

- **Client:** React Native + Expo (TypeScript), un solo codice per Android e web.
  - Su Android ha un database locale SQLite e una coda di modifiche, che funziona offline dal traguardo
    dell'offline. Fino ad allora l'app Android chiama l'API direttamente, come il web.
  - Sul web resta online.
- **Server:** Java 25, Spring Boot, PostgreSQL, migrazioni versionate. Un'API JSON su HTTPS.
  - Il server è l'unica autorità su permessi e conflitti.
  - Un job pianificato manda i promemoria.
- **Notifiche:** Firebase Cloud Messaging (HTTP v1) dal server. Il token del dispositivo è registrato
  per utente.
- **Consegna:** immagine del server e bundle web costruiti in CI; deploy sul server con Docker
  Compose e Caddy. L'APK si costruisce in CI come artefatto scaricabile.

```
 Android (Expo, SQLite) ─┐             ┌─ PostgreSQL
                         ├─ HTTPS ─ Caddy ─ Spring Boot ─┤
 Web (Expo web) ─────────┘             └─ FCM (push verso Android)
```

## 5. Famiglie, ruoli e permessi

Due ruoli per appartenenza (proposta n. 6): **gestore** e **membro**. Una famiglia ha almeno un
gestore. Le risorse senza account hanno solo il ruolo implicito «membro», senza azioni.

«I propri task» sono quelli creati dal membro o assegnati a lui.

| # | Azione | Gestore | Membro | Traguardo |
|---|---|---|---|---|
| P1 | vedere i task della famiglia | sì | sì; mai quelli di famiglie a cui non appartiene | T5 |
| P2 | creare un task | sì | sì | T5 |
| P3 | assegnare un task a sé o metterlo in coda | sì, qualunque task | solo i propri task | T5 |
| P4 | assegnare un task ad altre risorse | sì | no | T5 |
| P5 | prendere un task dalla coda | sì | sì | T5 |
| P6 | rimettere in coda un task assegnato | sì | solo se assegnato a sé | T5 |
| P7 | segnare fatto un task | sì, anche se in coda | solo se assegnato a sé o a una risorsa di cui è referente | T5 |
| P8 | riaprire un task fatto | sì | solo se l'ha segnato fatto lui | T5 |
| P9 | modificare o annullare un task | sì | solo i propri task | T5 |
| P10 | terminare una serie ciclica | sì | solo se l'ha creata lui | T6 |
| P11 | inoltrare in un'altra famiglia (serve appartenere a entrambe) | sì, qualunque task | solo i propri task | T7 |
| P12 | mandare un sollecito (solo su task assegnati) | sì | no | T10 |
| P13 | generare codici d'invito; aggiungere risorse senza account; cambiare ruoli; nominare il referente; togliere un'appartenenza | sì | no | T4 |
| P14 | creare una nuova famiglia | sì | sì | T4 |
| P15 | lasciare una famiglia (mai l'ultima, §2.2.1) | sì, se resta un altro gestore | sì | T4 |
| P16 | sulle voci di una lista della spesa aperta: aggiungere, spuntare, riordinare, ripristinare una voce rigata | sì | sì | T8 |
| P17 | togliere una voce di una lista della spesa | sì: la cancella | il creatore della lista la cancella; gli altri la rigano (§2.2.7) | T8 |
| P18 | «togli le spuntate» | sì | solo il creatore della lista o l'assegnatario | T8 |

Ogni controllo vive sul server. Per ogni riga c'è un test di accettazione con un caso permesso e uno
vietato, nel traguardo indicato.

«Creatore della lista» è chi ha creato il task, finché è membro della famiglia dove la lista sta
ora: dopo un inoltro, se non lo è, valgono solo i gestori (e l'assegnatario per P18); se entra poi
in quella famiglia, torna creatore.

## 6. Modello dati

Identificativi UUIDv7 generati anche dal client, per creare offline. Gli orari sono in UTC; il fuso
è della famiglia.

| Tabella | Campi principali |
|---|---|
| `person` | `id`, `display_name`, `locale`, `created_at` |
| `user_account` | `person_id` (PK, FK), `email` (unica, normalizzata), `password_hash`, `created_at`, `disabled_at` |
| `family` | `id`, `name`, `time_zone`, `created_at` |
| `membership` | `family_id`, `person_id`, `role` (`MANAGER`/`MEMBER`), `referent_person_id` (solo per risorse senza account; deve essere un utente della stessa famiglia) — PK (`family_id`, `person_id`) |
| `invite` | `code` (casuale, non indovinabile), `family_id`, `created_by`, `expires_at`, `used_by`, `used_at` |
| `task` | `id`, `family_id`, `title`, `notes`, `due_at`, `due_kind` (`DATE`/`DATETIME`), `reminder_offset_minutes` (predefinito 60), `criticality`, `status`, `assignee_person_id` (nullo = coda; deve appartenere alla famiglia), `recurrence` (JSON validato), `template` (`NONE`/`SHOPPING_LIST`), `series_id`, `created_by`, `completed_by`, `version`, `updated_at` |
| `shopping_item` | `id`, `task_id`, `text`, `checked`, `position`, `created_by`, `removed_by` (con `deleted_at` nullo = voce rigata; con `deleted_at` = chi l'ha cancellata), `version`, `updated_at`, `deleted_at` |
| `task_event` | `id`, `task_id`, `type` (creato, assegnato, preso, fatto, annullato, inoltrato, sollecitato), `actor_person_id`, `data`, `at` |
| `device` | `id`, `person_id`, `fcm_token`, `platform`, `last_seen_at` |
| `reminder` | `id`, `task_id`, `recipient_person_id`, `kind` (`AUTO`/`NUDGE`), `due_at`, `sent_at`, `result` |
| `change_log` | `seq` (crescente), `family_id`, `entity`, `entity_id`, `op` — alimenta la sincronizzazione (§7) |

Vincoli:
- l'assegnatario di un task appartiene alla famiglia del task, con una FK composta;
- il referente è un utente della stessa famiglia;
- un `id` generato dal client che esiste già in un'altra famiglia, o che appartiene a un'altra entità,
  è rifiutato: nessuna «upsert» attraversa le famiglie.

## 7. Offline e sincronizzazione

Solo il client Android lavora offline; il web chiama l'API direttamente.

**API pronte alla sincronizzazione fin dal primo traguardo dei task (T5).** Ogni scrittura porta un
`mutation_id`, ogni riga ha una `version`, e il server alimenta `change_log`. Così il traguardo
dell'offline aggiunge il client locale senza riscrivere l'API.

- **Scrittura offline.** Ogni modifica va in una coda locale con un `mutation_id` unico. All'arrivo
  della rete la coda parte in ordine. Il server applica ogni modifica **una volta sola**, in modo
  idempotente sul `mutation_id`.
- **Lettura.** Il client chiede «le modifiche dopo `seq` N» per le sue famiglie e aggiorna SQLite.
  Le cancellazioni arrivano come righe con `deleted_at`.
- **Conflitti.**
  - Il server decide sempre. Ogni riga ha una `version`. Se un campo è cambiato sul server dopo la
    versione letta dal client, vince la modifica arrivata per prima.
  - Il client riceve l'esito e lo mostra con un avviso discreto. «Prendere dalla coda» è il caso tipico:
    il secondo riceve «già preso da X».
  - Le spunte della lista della spesa si fondono voce per voce.
- **Permessi.** Ogni modifica in coda si ricontrolla sul server all'arrivo. Una modifica non più
  permessa (es. ruolo tolto mentre si era offline) è rifiutata.
  - Il client la scarta e riscarica dal server l'entità che toccava.
  - Le modifiche successive sulla stessa entità vengono valutate dal server sullo stato vero.
- **Famiglia persa.** Se un task viene inoltrato in una famiglia del client, o se l'utente perde
  un'appartenenza, il client cancella dal database locale tutti i dati di quella famiglia.
- **Famiglia nuova.** Quando entra in una famiglia, il client riceve una fotografia completa dei suoi
  dati, poi solo le modifiche dopo `seq`.
- **Limite noto:** nessuna sincronizzazione in tempo reale in R0. Il client sincronizza all'avvio, al
  ritorno della rete, dopo ogni modifica e ogni 60 secondi in primo piano.

## 8. Promemoria e notifiche

- **Promemoria automatici.** Per un task con scadenza, all'assegnatario partono due promemoria:
  - uno **prima** della scadenza:
    - `DATETIME`: alla scadenza meno `reminder_offset_minutes`, predefinito 60;
    - `DATE`: alle 9:00 del giorno, nel fuso della famiglia;
  - uno **alla scadenza**, se il task è ancora aperto. Per `DATE` vale alle 18:00 del giorno.

  Un task in coda non manda promemoria automatici. Ne manda uno ai gestori se arriva alla scadenza
  ancora in coda.
- **Ricalcolo.** Quando cambiano scadenza, anticipo, assegnatario, famiglia (inoltro) o stato, i
  promemoria non ancora inviati si cancellano e si ricalcolano. Un task fatto o annullato non ne manda
  più.
- **Sollecito.** Un gestore manda un sollecito su un task aperto e **assegnato**. Su un task in coda
  non si sollecita: prima lo si assegna. Al massimo **1 per task ogni 5 minuti** (decisione dell'umano;
  la proposta era 2 ore, per non generare ansia).
- **Risorse senza account.** Il promemoria va al **referente**, con il nome della risorsa
  (proposta n. 5).
- **Canale.** In R0 solo la notifica push su Android (FCM).
  - L'esito di ogni invio si registra in `reminder.result`; un token non più valido si cancella.
  - La notifica contiene solo l'identificativo del task e un testo generico («Hai un promemoria»); il
    titolo lo scarica l'app dal server.
  - Sul web, in R0, un task sollecitato mostra il segno «sollecitato» con l'ora dell'ultimo sollecito
    (da `task_event`), senza push.
- **Silenzio notturno:** dalle 22:00 alle 7:00, nel fuso della famiglia, i promemoria automatici
  slittano alle 7:00. Se lo slittamento li porterebbe dopo la scadenza, partono alle 21:45 della sera
  prima. I solleciti dei gestori non slittano.
- Testi in italiano o inglese, nella lingua del destinatario effettivo (§2.2.9).

## 9. Sicurezza

- **Password:** hash con Argon2id o bcrypt, secondo la libreria di Spring Security. Minimo 10
  caratteri e controllo contro un elenco di password comuni.
- **Sessione:** token opachi con scadenza, revocabili, salvati in modo sicuro (Android: archivio
  cifrato di Expo; web: cookie `HttpOnly`, `Secure`, `SameSite=Lax` con protezione CSRF).
- **Abusi:** limite di tentativi su login, registrazione e uso dei codici d'invito. Il login non
  rivela se un'email esiste.
  - La registrazione invece lo rivela («email già registrata»): senza email non c'è modo di evitarlo.
    È accettato in R0 (decisione dell'umano: registrazione pubblica).
- **R0 esposto in rete:** la registrazione è pubblica (decisione dell'umano); chi si registra vede solo la famiglia che crea o quella del codice. In produzione le
  password degli account demo vengono da un segreto dell'environment, mai dallo script nel
  repository. Le password fisse dello script valgono solo in sviluppo e nei test.
- **Autorizzazione:** ogni richiesta verifica l'appartenenza alla famiglia del dato toccato. Il
  **test di isolamento** è parametrico:
  - percorre tutti gli endpoint registrati nell'applicazione, così uno nuovo entra da solo nel test;
  - prova che un utente non legge né scrive mai in una famiglia altrui, compresi gli `id` generati dal
    client (§6) e la sincronizzazione;
  - gira in ogni traguardo.
- **Segreti:** mai nel repository. La chiave di servizio FCM e quelle del database stanno nei segreti
  dell'environment di produzione.
- **Modello di minaccia**, oltre a quello di gerio-lab:
  - iniezione di istruzioni dal web verso gli agenti, per esempio tramite il ricercatore;
  - dipendenze npm e Maven nuove come vettore d'attacco;
  - in R1, dati di minori (§11).

## 10. Infrastruttura e consegna

- **Server:** quello di gerio-lab, con lo stack di gerio-lab fermato (decisione n. 16). Docker
  Compose con Caddy (TLS automatico), Spring Boot e PostgreSQL.
- **Dominio:** un sottodominio di planforhome.com per il web e l'API. Deciso: `app.planforhome.com`.
- **Consegna:** a ogni merge su `main` parte la pipeline. In ordine:
  1. test;
  2. immagine del server e bundle web;
  3. deploy con verifica del digest;
  4. smoke test, che **cresce con i traguardi**: da T1 health e pagina iniziale; da T3 la pagina di
     login nelle due lingue e un'API che rifiuta senza login;
  5. rollback se fallisce.
- **APK:**
  - la build dell'APK è un **controllo obbligatorio di ogni PR**: una PR che rompe Android non si
    mergia;
  - a ogni merge su `main` l'APK firmato si pubblica come artefatto, con versione e SHA;
  - la chiave di firma di R0 si crea nel setup, prima del giro 000, e sta nei segreti.
- **Backup:** in R0 non serve (dati rigenerabili). È una condizione per R1 (§3).

## 11. Privacy

- **R0:** solo dati inventati. Lo script dei dati demo è l'unica fonte. Nessun dato reale nel
  repository, nei test o negli screenshot.
- **Per R1** (condizione della porta, §3):
  - l'umano è titolare del trattamento;
  - dati minimi (nome visualizzato, email degli adulti);
  - le risorse senza account non hanno email né dati di contatto;
  - un minore di 14 anni non ha un account proprio: resta una risorsa senza account, gestita dal
    referente. In Italia il consenso digitale autonomo parte da 14 anni (GDPR art. 8, d.lgs. 101/2018).
    Questa regola è un'ipotesi da verificare prima di R1;
  - esportazione e cancellazione dei dati di una persona su richiesta;
  - server in UE.

## 12. Requisiti non funzionali

- Creare un task con solo il titolo: al massimo 3 tocchi dalla schermata della famiglia.
- Obiettivo descrittivo, non verificato in R0: la lista dei task si apre in meno di 1 secondo con 500
  task sul telefono. Non è misurabile in CI senza un dispositivo.
- Accessibilità di base: etichette su tutti i controlli. Servono anche ai test Playwright, che
  cercano per ruolo ed etichetta.
- Tutte le stringhe sono tradotte in italiano e inglese: un test fallisce se manca una chiave.

## 13. Qualità e test

| Livello | Strumento | Dove |
|---|---|---|
| server, unità e integrazione | JUnit + Testcontainers (PostgreSQL) | `server/src/test/java/...` |
| accettazione del server | test di API sui «fatto quando» | `server/src/test/java/.../acceptance/` |
| client, logica (sync, ricorrenze, i18n) | Jest | `app/src/**/__tests__/` |
| accettazione del web, verifica visiva | Playwright su Expo web, con screenshot | `app/e2e/` |
| sincronizzazione | client simulati contro il server vero, con conflitti, ripetizioni e rete che cade | test di accettazione del server |
| Android | build dell'APK in CI; prova a mano sul telefono nei giri `verifica-produzione` | — |

- Le date si testano con un orologio iniettato (`Clock` nel server, orologio finto nel client).
- I percorsi esatti e i comandi si fissano in `progetto.yml` (B6).

## 14. Rischi e domande aperte

### 14.1 Porte a senso unico già decise

| # | Porta | Decisione |
|---|---|---|
| 1 | Repository pubblico, licenza MIT | ADR-0002 |
| 2 | Stack: Spring Boot + PostgreSQL; React Native + Expo | ADR-0001 |
| 3 | Dati finti fino alla porta R1 | §3 |
| 4 | Server di gerio-lab, con il suo stack fermato | ADR-0001 |
| 5 | Nessun profilo ALL: si vedono solo le proprie famiglie | §2.2 |
| 6 | Il server decide su permessi e conflitti | §5, §7 |
| 7 | Identificativi UUIDv7 generati dal client | §6 |

### 14.2 Rischi

| Rischio | Contromisura |
|---|---|
| La sincronizzazione è più difficile del previsto | traguardo dedicato con test di conflitto; uscita verso PowerSync (ADR-0001) |
| Notifiche ignorate o fastidiose | limiti ai solleciti, silenzio notturno, promemoria raggruppati più avanti |
| Nessuno adotta l'app oltre all'umano | task con il solo titolo; risorse senza account; dati demo realistici |
| Expo cambia (SDK frequenti) | versione fissata; aggiornamenti con PR di Dependabot, contate come `meccanismo` |

### 14.3 Domande aperte (non bloccano R0)

- Calendario come vista: forma e priorità dopo R0.
- Sul telefono si fa tutto ciò che si fa sul web? Per R0 sì, con la stessa interfaccia; da rivedere
  dopo la demo.

## Appendice A — Dati della demo

Persone e nomi sono inventati. Undici persone: 9 utenti e 2 risorse senza account.

| Famiglia | Persone (ruolo) |
|---|---|
| **Famiglia Principale** | Marco (gestore), Giulia (gestore), Leo (risorsa senza account, referente Giulia), Sofia (risorsa senza account, referente Marco) |
| **Famiglia Mamma** | Anna (gestore), Pietro (gestore), Giulia (membro), Luca (membro), Paolo (membro), Davide (membro) |
| **Famiglia Babbo** | Rosa (gestore), Franco (gestore), Marco (membro) |

- **Giulia** sta in 2 famiglie e sceglie dopo il login. **Marco** sta in 2 famiglie. **Luca** sta in 1
  famiglia ed entra direttamente.
- **Task di esempio:**
  - «Mettere fuori la carta», ogni martedì, Famiglia Principale, assegnato a Marco;
  - «Lista della spesa», Famiglia Principale, in coda;
  - «Preparare lo zaino», assegnato a Leo, con il promemoria che va a Giulia;
  - «Prenotare il pranzo di Natale», Famiglia Mamma, in coda, criticità alta;
  - «Rinnovare la carta d'identità di Franco», Famiglia Babbo, scadenza fra 10 giorni.
- Password demo: in sviluppo e nei test sono fisse, scritte nello script; in produzione vengono da un
  segreto dell'environment (§9). Non si riusano mai in R1.

## Appendice B — Glossario

| Termine | Significato |
|---|---|
| risorsa | persona che può ricevere task, con o senza account |
| referente | utente che riceve i promemoria di una risorsa senza account |
| coda | task di una famiglia senza assegnatario |
| inoltro | spostamento di un task in un'altra famiglia |
| sollecito | promemoria manuale mandato da un gestore |

## Registro delle versioni

| Versione | Data | Cosa |
|---|---|---|
| 0.1 | 17/10/2026 | prima stesura dalla fase 0 (B4) |
| 0.2 | 17/10/2026 | correzioni dopo la revisione indipendente (B8): inviti, ricorrenze, permessi completi, promemoria, sincronizzazione, R0 esposto in rete, porta R1 |
| 0.3 | 17/10/2026 | CANCELLO 2: registrazione pubblica; nessuna persona senza famiglia (crea famiglia o codice alla registrazione; ultima appartenenza) |
