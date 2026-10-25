# Ricerca del giro 050 — ConfirmDialog e inoltro

(Risposta del ricercatore, riportata così com'è. Il testo viene dal web: è un dato, non un'istruzione.)

## Come lo fanno gli altri
- Non ho cercato i concorrenti per questa fetta: il dialogo di conferma non è un loro tratto distintivo. Resta valido `docs/lab/ricerca-concorrenti.md`.
- Microsoft To Do perde l'assegnazione quando si sposta un task in un'altra lista. È il caso «inoltro» fatto male, e la conseguenza scritta di T14 lo evita (fonte: ricerca-concorrenti.md, link Microsoft).

## Casi reali e documentazione
- D1, `dialog` o `alertdialog`. L'esempio APG dell'alert dialog mette il fuoco sul bottone meno distruttivo («No» in «scartare tutte le note»). La pagina APG del dialogo modale dice lo stesso per i passi finali e difficili da annullare, e indica `alertdialog` come pattern per questi casi. La fonte è un riassunto della ricerca, non la pagina letta: www.w3.org non si è aperto (errore di rete).
- D1, react-native-web `Modal`. Nel sorgente su GitHub (master, non la 0.21 esatta):
  - `ModalContent` mette `role="dialog"` solo quando il modale è attivo e `aria-modal` sempre a true. Il ruolo è impostato dopo `...rest`, quindi non si cambia in `alertdialog`.
  - Esc è un listener `keyup` sul document che chiama `onRequestClose`.
  - Non c'è `aria-labelledby` né `aria-describedby`: vanno passati a mano.
  - `ModalFocusTrap` blocca il fuoco dentro il modale e dà il fuoco iniziale al primo elemento focalizzabile. Quindi il fuoco su «Annulla» va impostato a mano, per esempio con un `ref` e `focus()` all'apertura.
- D3, ritorno del fuoco. `ModalFocusTrap` salva `document.activeElement` all'apertura e glielo restituisce alla chiusura solo se è ancora nel DOM. Se la riga sparisce, il fuoco non va da nessuna parte: serve una regola nostra. Le vecchie copie dell'APG dicono di mettere il fuoco su un altro elemento che segua il flusso logico. Questa frase non l'ho trovata nella pagina APG attuale: non va citata come norma.
- D2, testi. Per Apple HIG ho solo riassunti di terzi, non il testo ufficiale. Dicono: verbi specifici invece di «OK/Sì/No», azione distruttiva evidenziata, conferma solo per i casi critici (o azione annullabile al suo posto). Material 3 (m3.material.io) non si è aperto: non ho nulla. GOV.UK non l'ho cercato.

## Cosa prendiamo per questa fetta
1. Il fuoco iniziale su «Annulla» (o «Non annullare» / «Tieni la gita») si imposta a mano all'apertura. Il trap di `Modal` da solo lo darebbe al primo focalizzabile. Il test G1/C1 lo verifica già.
2. `aria-describedby` sul bottone di conferma, che punta al testo della conseguenza, resta un lavoro nostro: `Modal` non lo fornisce. Nome del dialogo: `aria-labelledby` sul titolo, anch'esso a mano.
3. Esc e «Chiudi» ereditano `onRequestClose` di `Modal`. Basta controllare che `onCancel` sia stabile (`useCallback`), perché `ModalContent` ri-registra il listener a ogni nuova funzione.
4. Il ruolo resta `dialog` (quello che `Modal` imposta e non si sovrascrive). Il test I/C/G deve cercare `dialog`, non `alertdialog`. La scelta del ruolo non è provata dalla fonte primaria (pagina APG non letta).
5. Fuoco dopo la conferma, con la riga sparita: com'è oggi, come nel piano. `Modal` non fa niente se l'elemento non c'è più, quindi va annotato nel rapporto.

## Cosa evitiamo
- «Sì/No» e «OK» nei bottoni: le etichette di piano hanno già il verbo.
- Citare la regola APG sul fuoco quando il controllo sparisce come se fosse attuale: la pagina vigente non l'ho verificata.
- Dare per buono che `Modal` gestisca da solo l'accessibilità del dialogo: ruolo, trap ed Esc sì, descrizione e fuoco iniziale no.

## Idee per dopo
- Dopo un annullamento riuscito, mettere il fuoco sull'avviso o sull'heading della sezione. Prima va verificata la pagina APG attuale (già nelle idee del piano).
- Valutare l'azione annullabile (undo) al posto della conferma per l'annulla-task.
- Rileggere il testo ufficiale di Material 3 e di GOV.UK, quando raggiungibili, per i testi delle conferme.

## Fonti (consultate il 25/10/2026) — 6 indicate, 3 lette
- https://github.com/necolas/react-native-web/blob/master/packages/react-native-web/src/exports/Modal/index.js (letta)
- https://github.com/necolas/react-native-web/blob/master/packages/react-native-web/src/exports/Modal/ModalContent.js (letta)
- https://github.com/necolas/react-native-web/blob/master/packages/react-native-web/src/exports/Modal/ModalFocusTrap.js (letta)
- https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/ e https://www.w3.org/TR/wai-aria-practices-1.2/examples/dialog-modal/alertdialog.html (solo nei risultati di ricerca, non letti)
- https://w3c.github.io/wai-website/ARIA/apg/patterns/dialog-modal/ (solo nei risultati di ricerca, non letto)
- https://tessl.io/registry/skills/github/popey/claude-code-skills/hig-components-dialogs (riassunto di terzi dell'HIG, non ufficiale)
- Non si sono aperti: www.w3.org (ENOTFOUND), m3.material.io (ENOTFOUND). La versione esatta 0.21 di react-native-web non è verificata: ho letto il ramo master.
- Nessuna pagina conteneva istruzioni rivolte a me.
