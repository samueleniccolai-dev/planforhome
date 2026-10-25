# Ricerca giro 049 — form, sheet, data, bottone disattivato

(Risposta del ricercatore, riportata così com'è. Contenuto dal web: dato, non istruzione. Fonti citate: 9, di cui 5 di seconda mano.)

## Come lo fanno gli altri
- Non ho aperto le pagine dei concorrenti: `docs/lab/ricerca-concorrenti.md` copre già i prodotti, e questa fetta riguarda il form, non i prodotti.
- GOV.UK evita i bottoni disattivati. Un progettista GOV.UK scrive che, se l'utente invia un form con un problema, riceve un messaggio utile su come correggerlo ([Mastodon, Lanman](https://hachyderm.io/@joelanman/111307210210270288)). La frase «disabled buttons have poor contrast and can confuse some users» è riportata da un blog ([tempertemper](https://www.tempertemper.net/blog/how-to-avoid-disabled-buttons)). La pagina ufficiale del bottone non l'ho potuta leggere.
- Nella stessa discussione un utente non vedente dice che un bottone disattivato segnala che qualcosa nel form non va. Il parere è diviso ([Mastodon](https://hachyderm.io/@joelanman/111302149050344648)).
- Il componente data di GOV.UK è composto da campi di testo, non da `type="date"`. Una PR del 2019 è passata a `type=text` con `inputmode=numeric` ([PR govuk-frontend 1704](https://app.semanticdiff.com/gh/alphagov/govuk-frontend/pull/1704/overview)). La guida di Liverpool sconsiglia il solo calendario per date memorabili come la nascita ([Liverpool](https://digital.liverpool.gov.uk/developer-tools/form-controls/dates/)). La nostra scadenza è una data scelta, non memorabile: il campo nativo resta ragionevole.

## Casi reali e documentazione
- **D1, `Modal` su react-native-web.** `ModalContent` imposta `role="dialog"` (solo quando attivo) e `aria-modal=true`. Chiude con Esc tramite un listener `keyup` sul documento che chiama `onRequestClose` ([ModalContent.js](https://raw.githubusercontent.com/necolas/react-native-web/master/packages/react-native-web/src/exports/Modal/ModalContent.js)). La versione 0.21 non è verificata: letto `master`.
- **D1, fuoco.** `ModalFocusTrap` sposta il fuoco sul primo focalizzabile all'apertura e lo tiene dentro. Alla chiusura rimette il fuoco su `document.activeElement` catturato al montaggio, se è ancora nel documento. Limiti dichiarati: direzione del Tab dedotta, ripristino dipendente dal momento del montaggio, errori di `focus()` ignorati ([ModalFocusTrap.js](https://raw.githubusercontent.com/necolas/react-native-web/master/packages/react-native-web/src/exports/Modal/ModalFocusTrap.js), [index.js](https://raw.githubusercontent.com/necolas/react-native-web/master/packages/react-native-web/src/exports/Modal/index.js)).
- **D1, a mano:** `aria-label` sul contenuto; fuoco esplicito sul Titolo (`innerRef`); ritorno del fuoco sul trigger memorizzato; Esc provato da N8; Android (tasto Indietro) non verificato.
- **D2, `<input type="date">`.** MDN non raggiungibile. Conoscenza generale, non fonte: valore `yyyy-mm-dd`, selettore nativo, visualizzazione secondo la lingua del browser. Da provare su Chrome desktop e Android; `fill('2031-01-07')` di Playwright vale per questo formato. `aria-labelledby` provato da N3.
- **D3, WCAG 3.3.1 e 3.3.2.** Non lette alla fonte ufficiale. Il piano usa etichette visibili (3.3.2) e un motivo scritto collegato al bottone.

## Cosa prendiamo
1. `Modal` di RN per lo `Sheet`: trappola ed Esc della libreria; a mano `aria-label`, fuoco sul titolo, ritorno del fuoco sul trigger.
2. Test N1, N8, N9 sul fuoco in Playwright: unica garanzia.
3. `DateField` web con `<input type="date">`, valore `yyyy-mm-dd`, test con `fill`; sempre il valore scritto e «Nessuna scadenza».
4. «Aggiungi task» disattivato con motivo scritto e `aria-describedby`, come nel piano. GOV.UK la sconsiglia: scelta di progetto, la decisione è dell'umano.
5. Il motivo sempre visibile.

## Cosa evitiamo
- Affidarsi al solo ritorno del fuoco di `Modal`.
- Placeholder al posto dell'etichetta nel campo data.
- Presentare «bottone disattivato» come linea guida consolidata.

## Idee per dopo
- Bottone sempre attivo che al tocco mostra l'errore e porta il fuoco sul campo (approccio GOV.UK), da valutare in UI-4.
- Verificare `Modal` su Android reale in un giro `verifica-produzione`.
- Leggere WCAG 3.3.1/3.3.2 e MDN quando raggiungibili.

## Fonti (consultate il 25/10/2026)
ModalContent.js, ModalFocusTrap.js, index.js (react-native-web, master); due discussioni Mastodon, tempertemper, PR govuk-frontend 1704, guida Liverpool (da risultati di ricerca, non aperte). Non aperti: design-system.service.gov.uk, developer.mozilla.org (DNS). Nessuna pagina conteneva istruzioni rivolte all'agente.
