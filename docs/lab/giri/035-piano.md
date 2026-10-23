---
giro: 035
traguardo: T10
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-23T14:53:57Z
ricerca: sì
accettazione:
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
(100 in tutto). `{quando}`: la scadenza nel fuso della famiglia (`family.time_zone`).

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
- Il caso si deduce all'invio dallo stato del task (già ricontrollato da `ReminderJob.claim`):
  senza assegnatario → coda scaduta; destinatario diverso dall'assegnatario → risorsa; altrimenti
  promemoria. Nessuna colonna nuova, nessuna migrazione.
- Invariati: `data` con il solo `taskId`, `android.priority` `high`, `channel_id` `reminders`.

## Fatto quando — controlli eseguibili
Dati demo (inventati, quelli dei supporti 031/032): Famiglia Principale (Europe/Rome) con Giulia
e Marco gestori, Leo risorsa con referente Giulia, Kate membro con locale `en`; FCM finto
(`Giro031FakeFcm`), orologio iniettato.

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
- [ ] C7 Risorsa it: «Preparare lo zaino», `DATE` 2026-11-21, assegnato a Leo → a Giulia
      «Promemoria per Leo» · «Preparare lo zaino · scade 21/11/2026».
- [ ] C8 Coda scaduta: «Lista della spesa», in coda, `DATETIME` `2026-11-20T17:00:00Z` → a Giulia
      e Marco «Task in coda scaduto» · «Lista della spesa».
- [ ] C9 Titolo lungo: un task con titolo di 101 caratteri, sollecitato → testo di 100 caratteri
      che finisce con «…»; con 100 caratteri → testo identico al titolo. Nel promemoria il titolo
      accorciato precede « · scade …».
- [ ] C10 In ogni caso sopra: `data` contiene solo `taskId`, `priority` `high`, `channel_id`
      `reminders` (invariati).
- [ ] C11 I test 031–033 aggiornati al testo nuovo (vedi «Test di accettazione») e verdi:
      `cd server && ./mvnw -q -Dtest='Giro03[1235]*AcceptanceTest' test`.
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
| `Giro035NotificationTextAcceptanceTest.java` | C1–C10: sollecito e promemoria con FCM finto e orologio iniettato → titolo e testo esatti |
| `Giro031NudgeAcceptanceTest.java` (aggiornato) | titolo e testo dei casi 1 e 7 secondo SPEC §8 |
| `Giro032ReminderSendAcceptanceTest.java` (aggiornato) | titolo e testo dei casi 1 e 2 secondo SPEC §8 |
| `Giro033ChannelAcceptanceTest.java` (aggiornato) | titolo secondo SPEC §8 |
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
- Il testo si compone dopo il commit: se il titolo cambia tra `claim` e invio, va il titolo
  nuovo. Accettato, non si prova.
- Il replay del sollecito (stesso `mutationId`) non rimanda nulla: già provato nel 031, invariato.
- Più token dello stesso destinatario: stesso testo su ciascuno (si compone una volta).

## Budget
Righe di produzione (`server/src/main`) ≤ 200; file ≤ 4 (`PushService`, `PushRepository`, una
classe `push/NotificationText` pura, chiamante in `TaskService` per chi sollecita). App: 0 righe.

## Domande per il ricercatore (al massimo 3)
1. Android e FCM: quanti caratteri di titolo e testo si vedono nella notifica chiusa e a schermo
   bloccato; FCM tronca o rifiuta payload `notification` lunghi (limite 4 KB)?
2. JDK 25 con CLDR: `DateTimeFormatter` `d MMM yyyy` e `Locale.ENGLISH` dà «Oct» (senza punto)?
3. Formula inglese corrente per un «sollecito» nelle app di task («is nudging you», «nudged you»).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Testo del sollecito per una risorsa («{chi} sollecita {risorsa}»).
- Testi in chiavi di traduzione condivise con l'app.
