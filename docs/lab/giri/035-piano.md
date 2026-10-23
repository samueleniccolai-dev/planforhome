---
giro: 035
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: costruzione
inizio: 2026-10-23T14:53:57Z
ricerca: sì
accettazione: 0af5124
ripreso: no
---
# Piano del giro 035 — testo delle notifiche (SPEC §8)

## Fetta e traguardo
T10, tipo `costruzione`: risposta B dell'umano al giro 034, primo passo. Oggi `PushService` manda
sempre «planforhome» · «Hai un promemoria» (decisione 106); SPEC §8, aggiornata dall'umano il
23/10/2026, chiede il testo composto dal server, nella lingua del destinatario, con l'ora nel fuso
della famiglia e il nome della risorsa. La fetta è tutto il testo: ci sta in una sessione.
Fonti: SPEC §8 (Canale), §2.2.9; `traguardi.json` → T10 («testo composto dal server secondo SPEC
§8, nella lingua del destinatario»); piano e rapporto 034.

Resta di T10 dopo questo giro: giro 036 (`GET …/reminders` per i gestori), giro 037
`verifica-produzione`.

## Testi decisi (doppio senso; li provano i test)
Lingua: `person.locale` del destinatario effettivo; `en` → inglese, altrimenti italiano (come oggi).
`{titolo}`: il titolo del task; se supera 100 caratteri (code point) diventa i primi 99 più «…»
(100 in tutto; mai una coppia surrogata spezzata). `{quando}`: la scadenza del task
(`task.due_at` e `task.due_kind`, letti sotto il lock del task), **mai** il `due_at` della riga
`reminder` (che è l'istante del promemoria), nel fuso della famiglia (`family.time_zone`).

| Caso | Titolo it · testo it | Titolo en · testo en |
|---|---|---|
| Sollecito | «{chi} ti sollecita» · «{titolo}» | «{chi} is nudging you» · «{titolo}» |
| Promemoria automatico | «Promemoria» · «{titolo} · scade {quando}» | «Reminder» · «{titolo} · due {quando}» |
| Task in coda scaduto, ai gestori | «Task in coda scaduto» · «{titolo}» | «Overdue task in the queue» · «{titolo}» |
| Risorsa senza account, al referente (automatico) | «Promemoria per {risorsa}» · «{titolo} · scade {quando}» | «Reminder for {risorsa}» · «{titolo} · due {quando}» |

- `{chi}` e `{risorsa}`: `person.display_name`.
- `{quando}` it: `DATETIME` `dd/MM/yyyy HH:mm` («25/10/2026 10:30»), `DATE` `dd/MM/yyyy`.
  en: `DATETIME` `d MMM yyyy HH:mm` con `Locale.ENGLISH` («25 Oct 2026 10:30»), `DATE` `d MMM yyyy`.
- Un sollecito su un task di una risorsa va al referente con il testo del sollecito (SPEC non dà
  una variante): resta com'è, idea per dopo.
- Promemoria automatici: caso e testo si compongono **dentro la transazione di `claim`**, che ha
  il lock del task, accanto a `planner.slots`, con una lettura (`info(taskId)`: titolo, `due_at`,
  `due_kind`, fuso, assegnatario, nomi, locale del destinatario); il testo (titolo e corpo) passa a
  `sendReminder`. Senza assegnatario → coda scaduta; destinatario diverso dall'assegnatario →
  risorsa; altrimenti promemoria. Nessuna colonna nuova, nessuna migrazione.
- Sollecito: il testo si compone in `sendNudge`, subito dopo il commit del sollecito.
- Invariati: `data` con il solo `taskId`, `android.priority` `high`, `channel_id` `reminders`.

## Fatto quando — controlli eseguibili
Dati demo (inventati, quelli dei supporti 031/032): Famiglia Principale (Europe/Rome) con Giulia
e Marco gestori, Leo risorsa con referente Giulia, Kate membro con locale `en`, Tom risorsa con
referente Kate; FCM finto (`Giro031FakeFcm`), orologio iniettato. L'orologio dei test parte nel
2031 e va solo avanti: le date qui sotto sono nell'**anno dopo l'orologio** (`year`), con le
stesse ore; il giorno del cambio d'ora è l'ultima domenica di ottobre di quell'anno (nel 2026 il
25/10).

- [ ] C1 Sollecito it: Marco sollecita «Comprare il pane» assegnato a Giulia → titolo
      «Marco ti sollecita», testo «Comprare il pane».
- [ ] C2 Sollecito en: Marco sollecita «Comprare il pane» assegnato a Kate → «Marco is nudging
      you» · «Comprare il pane».
- [ ] C3 Promemoria `DATETIME` it, ora solare: «Dare da mangiare al gatto», scadenza
      `2026-10-25T09:30:00Z` (giorno del cambio d'ora), a Marco → al promemoria di prima
      (`08:30Z`) «Promemoria» · «Dare da mangiare al gatto · scade 25/10/2026 10:30».
- [ ] C4 Promemoria `DATETIME` it, ora legale: «Annaffiare le piante», scadenza
      `2026-10-24T09:30:00Z`, a Marco → «… · scade 24/10/2026 11:30».
- [ ] C5 Promemoria en: «Annaffiare le piante», scadenza `2026-10-24T09:30:00Z`, a Kate →
      «Reminder» · «Annaffiare le piante · due 24 Oct 2026 11:30».
- [ ] C6 Promemoria `DATE` it: «Portare la bici dal meccanico», `DATE` 2026-11-21, a Marco → alle
      9:00 «Promemoria» · «Portare la bici dal meccanico · scade 21/11/2026».
- [ ] C6en Lo stesso a Kate → «Reminder» · «Portare la bici dal meccanico · due 21 Nov 2026»
      (mese CLDR `en` senza punto, su JDK 25).
- [ ] C7 Risorsa it: «Preparare lo zaino», `DATE` 2026-11-21, assegnato a Leo → a Giulia
      «Promemoria per Leo» · «Preparare lo zaino · scade 21/11/2026».
- [ ] C7en Risorsa en: lo stesso task assegnato a Tom → a Kate «Reminder for Tom» · «Preparare lo
      zaino · due 21 Nov 2026».
- [ ] C8 Coda scaduta: «Lista della spesa», in coda, `DATETIME` `2026-11-20T17:00:00Z` → a Giulia
      e Marco «Task in coda scaduto» · «Lista della spesa» (senza {quando}); Kate, membro, niente.
- [ ] C9 Titolo lungo: 98 caratteri, poi 😀 (code point 99) e 🐱 (100), poi «Z» (101).
      Sollecitato, il titolo di 101 dà esattamente «<98>😀…»; quello di 100 resta identico. Nel
      promemoria `DATETIME` il titolo accorciato precede « · scade 10/02/<anno> 15:00».
- [ ] C10 In ogni caso sopra: `data` contiene solo `taskId`, `priority` `high`, `channel_id`
      `reminders` (invariati).
- [ ] C11 I test 031–033 aggiornati al testo nuovo (vedi «Test di accettazione») e verdi:
      `cd server && ./mvnw -q -Dtest='Giro03[1235]*AcceptanceTest' test`.
- [ ] C13 Test unitario puro su `NotificationText` (scritto dal costruttore): i quattro casi in
      it e en, `DATE` e `DATETIME`, i due lati del cambio d'ora, il troncamento in code point.
- [ ] C12 `cd server && ./mvnw -B -ntp verify` verde; `cd app && npm test && npx tsc --noEmit`
      verdi (l'app non cambia).

## Fuori perimetro
- `GET /api/families/{f}/tasks/{t}/reminders` (giro 036); verifica in produzione (giro 037).
- Qualsiasi cambiamento dell'app (Android o web) e del segno «sollecitato».
- Varianti di testo non scritte in SPEC (sollecito a nome di una risorsa, testi per iOS).
- Localizzazione lato client di FCM (`title_loc_key`), notifiche senza dati personali (condizione
  6 di §3, prima di R1).
- Difetti e dubbi noti: `due_at > now` in `deletePending` (032), token dopo il logout (SPEC §9),
  dubbi 2–4 del revisore 033, M4 senza test.
- Migrazioni, dipendenze nuove, configurazioni.
- T1–T9, già `passato`.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; verifica dell'email e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `Giro035NotificationTextAcceptanceTest.java` | C1–C10 (con C6en, C7en): sollecito e promemoria con FCM finto, contesto e orologio del 032 → titolo e testo esatti, `data`, priorità, canale |
| `Giro031NudgeAcceptanceTest.java` (aggiornato) | casi 1 e 7: titolo e testo secondo SPEC §8; caso 6: titolo «Marco ti sollecita», testo «Zaino di Leo», le note restano escluse |
| `Giro032ReminderSendAcceptanceTest.java` (aggiornato) | casi 1 e 2: titolo e testo secondo SPEC §8, con la scadenza del task; caso 3: «Promemoria per Leo» · «Preparare lo zaino · scade …» |
| `Giro033ChannelAcceptanceTest.java` (aggiornato) | titolo «Anna ti sollecita» |
| `Giro031AcceptanceSupport.java` (aggiornato) | via le costanti `TITLE`, `IT_BODY`, `EN_BODY` |

I test 031–033 sono già su `main`: cambiano solo le asserzioni sul testo, nel commit
`test(acceptance)`, perché SPEC §8 è cambiata. La PR va in `revisione-umana` (precedente: decisione
64, giro 018).

## Porte
- Doppio senso previste: i testi e i formati della data qui sopra; il caso dedotto dallo stato del
  task all'invio; una lettura in più in `PushRepository` (task, famiglia, persone); aggiornamento
  delle asserzioni dei test 031–033 (revisione umana).
- Senso unico: nessuna (nessuna dipendenza, nessuna migrazione).

## Rischi di concorrenza
- Promemoria: il testo si compone in `claim`, sotto il lock del task, insieme al ricontrollo:
  caso, titolo, scadenza e destinatario sono coerenti tra loro. Se il task cambia tra il commit di
  `claim` e l'invio, parte il testo del momento del claim (come la riga, già `sending`).
- Sollecito: il testo si compone subito dopo il commit; un cambio di titolo in quei millisecondi
  manda il titolo nuovo. Accettato, non si prova.
- Il replay del sollecito (stesso `mutationId`) non rimanda nulla: già provato nel 031, invariato.
- Più token dello stesso destinatario: stesso testo su ciascuno (si compone una volta).

## Budget
Righe di produzione (`server/src/main`) ≤ 200; file ≤ 5 (`PushService`, `PushRepository` o
`ReminderRepository`, una classe `push/NotificationText` pura, `ReminderJob` per il claim,
chiamante in `TaskService` per chi sollecita). Più il test unitario di C13. App: 0 righe.

## Domande per il ricercatore (al massimo 3)
1. Android e FCM: quanti caratteri di titolo e testo si vedono nella notifica chiusa e a schermo
   bloccato; FCM tronca o rifiuta payload `notification` lunghi (limite 4 KB)?
2. JDK 25 con CLDR: `DateTimeFormatter` `d MMM yyyy` e `Locale.ENGLISH` dà «Oct» (senza punto)?
3. Formula inglese corrente per un «sollecito» nelle app di task («is nudging you», «nudged you»).

## Critica ricevuta e cosa cambia
| Punto del critico | Esito | Motivo |
|---|---|---|
| 1. Aggiornare anche 031 caso 6 e 032 caso 3 (asserzioni su titolo e nomi) | accolto | con SPEC §8 nuova sarebbero rossi; invertiti in asserzioni esatte, le note restano escluse. Stesso commit `test(acceptance)` |
| 2. `{quando}` dalla scadenza del task, mai dal `due_at` della riga | accolto | scritto nei «Testi decisi»; 032 caso 1 e C3–C5 lo provano (il promemoria parte un'ora prima) |
| 3. Testo composto in `claim`, sotto il lock; budget a 5 file | accolto | nella forma semplice: `info(taskId)` accanto a `planner.slots`, testo passato a `sendReminder` |
| 3b. Test unitario puro su `NotificationText` | accolto come C13 | non lo scrivo io: la classe non esiste e i test devono compilare adesso |
| Test mancanti: C9 con emoji e stringa esatta, Kate referente, `DATE` in inglese, C8 solo gestori senza {quando} | accolti | C9 rifatto, C7en, C6en, C8 con Kate membro che non riceve nulla |
| (mio) date 2026 assolute | cambiato | l'orologio dei test è nel 2031 e va solo avanti: anno dopo l'orologio, stesse ore |

## Idee per dopo
- Testo del sollecito per una risorsa («{chi} sollecita {risorsa}»).
- Testi in chiavi di traduzione condivise con l'app.
