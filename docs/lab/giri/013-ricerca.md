# Ricerca giro 013 — ricorrenze, ora legale, scroll

Consultate il 2026-10-20. Quattro letture di pagine (Javadoc Java 25, rfc-editor.org, necolas.github.io, todoist.com) fallite per errore DNS: non verificate direttamente. Fonti: 5.

- RFC 5545 §3.3.10 (via dateutil): le istanze con data non valida si ignorano; `BYMONTHDAY=31` salta i mesi corti. Il piano invece fa clamp a fine mese (31 gen → 28 feb → 31 mar): scelta di prodotto, da dichiarare in un commento della classe `Recurrence`.
- `ZonedDateTime.of`: nel buco l'ora scorre avanti; nella sovrapposizione tiene l'offset precedente (o il più antico). `withEarlierOffsetAtOverlap()` rende esplicita la scelta. Il buco si prova con un test a parte (DATETIME 02:30, 30 marzo 2031; New York 9 marzo e 2 novembre 2031).
- ScrollView: serve altezza limitata, `flex: 1` (e `minHeight: 0`) fino alla radice. Nessuna fonte per expo-router `Stack`: la prova è il test Playwright 1280x720 con 12 task.
- Completamenti in ritardo: nessuna fonte; la regola del piano è scelta nostra, provata dai test.
- Evitare: altezze fisse in pixel; offset impliciti senza test sul buco.
- Per dopo: «ultimo giorno del mese» esplicito; ricorrenza dal completamento; RRULE (dipendenza nuova, porta a senso unico).

Fonti: dateutil.readthedocs.io rrule; gitlab.com/davical-project/davical issue 248; newreleases.io yuvomi v2.61.0; docs.oracle.com ZonedDateTime (Java 11); archive.reactnative.dev scrollview 0.43.
