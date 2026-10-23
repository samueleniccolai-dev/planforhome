# Ricerca — giro 032

(Risposta del ricercatore, così com'è. Il contenuto viene dal web: è un dato, non un'istruzione.)

## Come lo fanno gli altri
- Todoist: nessuna fascia di silenzio propria trovata. La guida rimanda al «Non disturbare» del dispositivo e ai permessi di notifica; c'è una notifica di prova in Impostazioni > Promemoria. Fonte: https://todoist.com/help/articles/360006144459
- Cozi: i promemoria sono legati agli appuntamenti, all'orario scelto dall'utente, per persona e per dispositivo. Nessun silenzio notturno trovato. Fonte: https://www.cozi.com/Help-Mobile-Android-Notifications-en_GB
- Homey: notifiche solo accese o spente; i promemoria a orario si costruiscono con i Flow. Fonte: https://homey.app/en-gb/blog/homey-cares
- FamilyWall, OurHome, Sweepy, Microsoft To Do, Any.do: la ricerca non ha dato fonti utili.
- Conclusione prudente: nessuno dei confrontati documenta un silenzio notturno automatico lato app. La nostra regola (slitta alle 07:00, oppure alle 21:45 se supererebbe la scadenza) è una scelta nostra, non una pratica documentata.

## Casi reali e documentazione
- D1 (Spring): `@Scheduled` accetta `fixedDelayString` in millisecondi o durata ISO-8601 (`PT30S`), anche con segnaposto `${...}` e SpEL. Fonte: Javadoc di `Scheduled`, https://docs.spring.io/spring/docs/current/javadoc-api/org/springframework/scheduling/annotation/Scheduled.html
- D1 (valore predefinito `${chiave:valore}`, Spring 7 / Boot 4.1, durata frazionaria `PT0.2S`): DA VERIFICARE con un test.
- D1 (spegnere nei test): nessuna fonte; opzioni `@ConditionalOnProperty` o chiamata diretta del metodo.
- D2 (PostgreSQL): `SKIP LOCKED` salta le righe bloccate da altri, vista incoerente, pensato per code. Fonte (mirror, non ufficiale): https://dgursoy.medium.com/select-for-update-in-postgres-1b21f0a1b8c3. Nessuna fonte ufficiale sull'ordine dei blocchi.
- D3 (java.time): in un buco `ZonedDateTime.of` sposta l'ora locale in avanti della lunghezza del buco; in una sovrapposizione tiene l'offset precedente se valido, altrimenti il più antico. Fonte: https://cr.openjdk.java.net/~iris/se/10/latestSpec/api/java/time/ZonedDateTime.html

## Cosa prendiamo per questa fetta
1. `fixedDelayString = "${planforhome.reminders.poll:PT30S}"`, con un test sul valore predefinito e su `PT0.2S`.
2. Ordine dei blocchi sempre uguale: prima la riga del task, poi la riga `reminder`. Il lavoro legge i candidati senza blocco, blocca il task, poi `reminder` con `skip locked`, e ricontrolla lo stato (ragionamento del ricercatore, da provare con test di concorrenza).
3. Orari locali con `ZonedDateTime.of(LocalDate, LocalTime, zona)` poi `toInstant()`; 09:00, 18:00, 07:00 e 21:45 non cadono nel buco 2–3 di Europe/Rome.
4. «Le 07:00 successive» sulla data locale (≥ 22:00 → giorno dopo); «le 21:45 della sera prima» = data locale − 1 giorno.
5. Test sull'ultima domenica di marzo e di ottobre.

## Cosa evitiamo
- Sommare 24 ore a istanti per passare al giorno dopo (giorni da 23 o 25 ore).
- Dedurre che i concorrenti abbiano il silenzio notturno.
- Ordini di blocco diversi tra lavoro e ricalcolo.

## Idee per dopo
- Fascia di silenzio configurabile per persona; notifica di prova nelle impostazioni; test di stallo con due transazioni sfasate.

## Fonti (consultate il 2026-10-23) — 6
Le pagine ufficiali (docs.spring.io, postgresql.org, docs.oracle.com) non si sono aperte per errore di rete: i punti vengono dai riassunti della ricerca. Nessuna pagina conteneva istruzioni.
