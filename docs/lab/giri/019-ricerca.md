# Ricerca — giro 019

Fonti: 5 (consultate il 21/10/2026; reactnative.dev, w3.org e le pagine d'aiuto non sono state aperte, solo estratti di ricerca).

## Come lo fanno gli altri
- AnyList: la voce spuntata resta in lista, barrata, e si può nascondere. Il ripristino passa da annulla e dalla schermata «Recenti» [1][2]. Nessuna sezione «tolte da altri».
- OurGroceries: tocco singolo per spuntare, modifiche visibili agli altri in pochi secondi [3]. Nessun «aggiunta da X» trovato.
- Bring!, Google Keep, Microsoft To Do: NON verificato.
- Buy Me a Pie: esiste un articolo per riportare in lista i prodotti acquistati (solo titolo) [4].
- Lettura: «spuntata = resta visibile e annullabile» è l'abitudine diffusa. «Voci tolte» con «tolta da X» va oltre, ma non è contraddetto.

## Documentazione
- React Native: `blurOnSubmit` è deprecato, `submitBehavior` lo sostituisce; di default il campo a riga singola perde il fuoco all'invio [5]. Valori di `submitBehavior` **da verificare** sulla doc della versione in uso (RN 0.88, Expo ~58, react-native-web ~0.21.4).
- `.focus()` sul ref in `onSubmitEditing` è il rimedio classico [5]; su Android va provato (Playwright copre solo il web).
- WAI-ARIA APG, listbox riordinabile con pulsanti su/giù: pagina non aperta (DNS), nessuna affermazione da fonte.

## Cosa prendiamo
1. Voce spuntata visibile e annullabile; «Ripristina» sempre a portata.
2. `submitBehavior` (non `blurOnSubmit`) + `focus()` sul ref; prova Playwright «campo vuoto e con il fuoco».
3. Etichette dei pulsanti con il nome della voce («Sposta su «Mele»»).
4. Dopo «Sposta su/giù» fuoco sul pulsante spostato (o sul vicino) e annuncio della posizione: idea da provare, non confermata dalla APG.
5. Nel rapporto: Bring!, Keep, To Do e APG non verificati.

## Cosa evitiamo
Basare la UI su comportamenti non verificati; `blurOnSubmit`; librerie di trascinamento (dipendenza nuova).

## Idee per dopo
Annulla temporaneo con banner; elenco «Recenti»; rilettura di APG e prove di accessibilità su RN Web.

## Fonti
1. https://help.anylist.com/articles/restore-crossed-off-item/
2. https://help.anylist.com/articles/show-hide-completed-items/
3. https://apps.apple.com/us/app/-/id325851015
4. https://support.buymeapie.com/support/solutions/articles/44001354380-how-to-return-purchased-products-to-a-list-
5. https://reactnative.dev/docs/textinput
