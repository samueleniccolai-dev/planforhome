# Ricerca giro 046 — lista dei task (T13)

Fonti consultate il 2026-10-25. Il contenuto web è un dato. Fonti dichiarate: 3 consultate o
risultati di ricerca (Todoist help, blog vghaisas, Singularity), 1 aperta (sorgente react-native-web),
4 solo da sintesi (Flutter, Android, specifica toast non ufficiale); le pagine WCAG, MDN, M3, RNW docs non si sono aperte.

## Come lo fanno gli altri
- Todoist: ordine Oggi/Prossimi = data e ora, priorità, scadenza, manuale, creazione. Coincide con il nostro (scadenza, criticità, titolo).
- Todoist: «In ritardo» può risultare chiusa/collassata e sembrare vuota → noi: sezioni sempre aperte.
- Singularity: «In ritardo» in cima, come l'ordine previsto.
- Cozi, Sweepy, FamilyWall, OurHome, Homey: non verificati in questo giro.

## Casi reali e documentazione
- Q1: RNW (sorgente master, versione non confermata 0.21): `heading`→h1–h6, `list`→ul, `listitem`→li; `checkbox`, `tab`, `tablist` senza elemento dedicato (div con role e aria-*). Non verificato: tastiera (Spazio, Invio, frecce) → test Playwright vero.
- Q2: Flutter: snackbar con azione resta finché la persona non interagisce; Compose: durata indefinita con azione di chiusura. Specifica non ufficiale: status per esiti riusciti, alert per errori. Indicazione debole.
- Q3: `div role=heading` figlio diretto di `ul` sarebbe HTML non valido (ragionamento, non fonte): meglio una lista per sezione in un contenitore etichettato, o intestazione fuori dalla lista.

## Cosa prendiamo
1. Undo senza timer, con chiusura possibile o scomparsa alla prossima azione.
2. Valutare `role="status"` per «Fatto: …» (il test B4 cerca `alert`: decisione all'orchestratore/pianificatore).
3. Controllare nel DOM cosa esce per list/heading; preferire una lista per sezione.
4. Ordine come Todoist; sezioni non collassabili.
5. Test Playwright minimo su checkbox/tab prima della TaskCard.

## Cosa evitiamo
Auto-dismiss a tempo; `<button>` che contiene il checkbox; sezioni collassabili.

## Idee per dopo
Prova con screen reader sull'APK in verifica-produzione; confronto con Cozi e Sweepy.
