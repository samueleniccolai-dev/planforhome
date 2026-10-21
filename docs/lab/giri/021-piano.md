---
giro: 021
traguardo: T8
traguardi_extra: []
tipo: costruzione
fase: costruzione
inizio: 2026-10-21T15:15:26Z
ricerca: sì
accettazione: 1f1545d
ripreso: no
---
# Piano del giro 021 — il fuoco dopo «Sposta» solo subito dopo il tocco (contestazione 020-a)

## Fetta e traguardo
T8, contestazione **020-a** (commento umano sulla PR #29): il fuoco va sul pulsante «Sposta» solo
subito dopo il tocco su quel pulsante, mai dopo. Il resto di 020-a resta com'è. La fetta è solo
questa (METODO: una contestazione è la fetta). Gli altri controlli del «Fatto quando» di T8 sono
verdi dal giro 020 (rapporto 020); dopo questo giro, il 022 sarà `verifica-produzione` di T8.
Fonti: SPEC §2.2.7 (lista della spesa), §6; decisioni 73 e 74 di `docs/lab/DECISIONI.md`.

**Il difetto, nel codice.** In `app/src/shopping/ShoppingList.tsx` il componente `Action` rimette il
fuoco con `useEffect(…, [focusN, place])`: l'effetto riparte ogni volta che cambia `place`
(l'indice della voce), quindi a ogni riordino successivo al tocco (risposta del server, voce sopra
spuntata, tolta o rigata, voce che torna da «Spuntate»). In più il bersaglio (`focus`) si ricalcola a
ogni render: se la voce smette di stare a un estremo, `focusN` passa all'altro pulsante della stessa
voce, che non l'ha ancora «consumato» e si prende il fuoco.

**Regola nuova (cambia la decisione 74, e la parte «fuoco» di 73).** Un tocco su «Sposta» chiede il
fuoco **una volta sola**: lo consuma il primo render dopo il tocco (il pulsante premuto, o l'altro
della stessa voce se il premuto è ora disabilitato). Nessun render successivo, per nessuna causa,
sposta il fuoco.

**Come (indicazione dalla critica).** Un effetto con dipendenza `[focusN]` dentro `Action` non basta:
in F5 il bersaglio passa da `Mele:up` a `Mele:down` e il `focusN` di quest'ultimo passa da 0 a n,
quindi l'effetto riparte. Il bersaglio va fissato **una volta sola, in `move()`**, che conosce
l'indice nuovo e la lunghezza: `focusAt = { key: "<id>:<up|down>", n }` (già con il pulsante
dell'altra direzione se il premuto è ora a un estremo). Il padre tiene una mappa di ref dei pulsanti
«Sposta» e **un solo** effetto con dipendenza `[focusAt.n]` che dà il fuoco a `refs[focusAt.key]`;
la richiesta si azzera solo dentro l'effetto, mai durante il render. Il calcolo `blocked/other`
nel render sparisce.

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-021-*`
      → tutti verdi (F1–F8 sotto).
- [ ] `cd app && npx playwright test` → tutto verde, compresi `giro-020-reorder.spec.ts` R1–R10
      (R2 e R3: il fuoco subito dopo il tocco c'è ancora) e `giro-020-reorder-retry.spec.ts`.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi, senza nuove disattivazioni
      di regole.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (nessun file del server cambia).
- [ ] `docs/lab/DECISIONI.md`: la decisione 74 è «cambiata (giro 021)» con una riga nuova che
      descrive la regola; la 73 rimanda alla nuova per il fuoco. La riga nuova conserva la nota
      sulla disattivazione di `react-hooks/refs` sulla mappa degli elenchi, oppure dice che non serve
      più (e allora il commento `eslint-disable-next-line` in `ShoppingList.tsx` sparisce).
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Fuori perimetro
- Tutto il resto di 020-a: pulsanti, estremi disabilitati, `PUT` con l'ordine intero, un solo
  riordino in volo, vince il server, ripristino su errore. Non si tocca.
- Annunci ai lettori di schermo della nuova posizione (`announceForAccessibility`), riordino delle
  voci spuntate, trascinamento.
- Prova su Android fisico (resta nella lista «Per l'umano»).
- Offline e sync delle voci (T9); server.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero password;
  sincronizzazione in tempo reale e offline sul web; dati reali (R1).

## Test di accettazione (scritti prima, intoccabili dal costruttore)
File unico `app/e2e/acceptance/giro-021-focus.spec.ts`, Playwright su Expo web, con la fake API del
giro 019 così com'è (`giro-019-fake-api.ts`) e `page.route` del file per trattenere le risposte.
Dati demo (già nella fake API, inventati): Giulia apre «Lista della spesa» (famiglia Principale), voci
«Latte», «Pane», «Mele», «Biscotti» in quest'ordine. «Nuova voce» è il campo di aggiunta.

**Prova «tasti non rubati» (solo F1–F5).** Dopo la risposta trattenuta: prima si controlla l'ordine
finale del server; poi si aspetta oltre il paint e gli effetti passivi (due `requestAnimationFrame`
e 300 ms); poi solo tastiera, `page.keyboard.type('Uova')` e `page.keyboard.press('Enter')`, mai
`locator.fill/type` (rimettono il fuoco da sé); poi «Uova» è in «Da prendere» e il campo è vuoto;
solo alla fine `toBeFocused` sul campo.

| Caso | Dato … quando … allora … |
|---|---|
| F1 | Dato il `PUT …/items/order` trattenuto, quando Giulia preme «Sposta giù «Latte»», il fuoco è su quel pulsante; poi clicca «Nuova voce» e la risposta arriva con un ordine concorrente («Biscotti», «Mele», «Pane», «Latte»), allora l'ordine è quello del server e i tasti vanno al campo |
| F2 | Dato Giulia che ha premuto «Sposta giù «Pane»» e la risposta del `PUT` è arrivata, quando spunta «Latte» (risposta trattenuta), clicca «Nuova voce» e la risposta arriva, allora «Pane» sale di un posto e i tasti vanno al campo |
| F3 | Come F2, ma Giulia toglie «Latte» («Togli «Latte»», risposta trattenuta): la voce esce da «Da prendere», i tasti vanno al campo |
| F4 | Dato «Latte» già spuntata (`api.elsewhere` prima di aprire la lista) e Giulia che ha premuto «Sposta giù «Pane»» (risposta arrivata), quando toglie la spunta a «Latte» in «Spuntate» (risposta trattenuta), clicca «Nuova voce» e la risposta arriva, allora «Latte» torna in testa a «Da prendere» e i tasti vanno al campo |
| F5 | Dato il `PUT` trattenuto, quando Giulia preme «Sposta giù «Mele»» («Mele» ultima, fuoco su «Sposta su «Mele»»), clicca «Nuova voce» e la risposta porta un ordine concorrente in cui «Mele» non è più ultima («Mele», «Latte», «Pane», «Biscotti»), allora i tasti vanno al campo e il fuoco non salta su «Sposta giù «Mele»» |
| F6 | Regressione: premuto «Sposta su «Mele»» due volte, il fuoco è su «Sposta giù «Mele»» subito dopo il secondo tocco (come R3 del giro 020). Nessuna prova sul campo |
| F7 | Dato il primo `PUT` trattenuto, quando Giulia preme «Sposta giù «Latte»» e poi «Sposta su «Biscotti»», il fuoco è su «Sposta su «Biscotti»»; arrivata la prima risposta e partito il secondo `PUT`, l'ordine è «Pane», «Latte», «Biscotti», «Mele» e il fuoco è ancora lì |
| F8 | Da tastiera: con il fuoco su «Sposta giù «Pane»», Invio la sposta e il fuoco resta lì; Invio di nuovo la porta in fondo e il fuoco passa a «Sposta su «Pane»» |

Esito oggi (verificato il 2026-10-21): F1–F5 rossi per asserzione (`toHaveCount(1)` su «Uova»: i
tasti finiscono su un pulsante «Sposta»); F6, F7, F8 verdi (guardie della parte che resta). Con un
fix provvisorio secondo l'indicazione sopra (poi annullato) passano tutti, insieme a R1–R10 e al
test di retry del giro 020.

## Porte
- Doppio senso previste: modifica a `ShoppingList.tsx` (solo il fuoco); riga in `DECISIONI.md`.
- Senso unico: nessuna (nessuna dipendenza, nessuna migrazione, nessun percorso protetto).

## Rischi di concorrenza
- Risposte che arrivano dopo un secondo tocco: il secondo tocco chiede un nuovo fuoco, la risposta
  del primo no. Prova: F7 (R4 del giro 020 prova solo l'ordine, non il fuoco).
- Bersaglio che cambia tra estremo e non estremo dopo il tocco: prova F5.
- Doppio render di React in sviluppo (StrictMode): **non verificato**. Playwright gira sul bundle di
  produzione (`expo export`), dove StrictMode non riesegue gli effetti; l'effetto deve comunque
  essere idempotente (dare il fuoco due volte allo stesso pulsante non cambia nulla).

## Budget
Righe di produzione (`app/src`) ≤ 30; file di produzione ≤ 1 (`ShoppingList.tsx`); test di
accettazione 1 file. Sta in una sessione.

## Domande per il ricercatore (al massimo 3)
1. WAI-ARIA APG / linee guida sui riordini con pulsanti: il fuoco va gestito solo come effetto
   diretto di un'azione dell'utente? Cosa dicono sui cambiamenti asincroni successivi?
2. react-native-web (0.21): `Pressable` espone `focus()` sul ref e un nodo spostato da React perde
   il fuoco nel DOM? Serve rimetterlo anche quando il nodo non si sposta?
3. React 19: modo raccomandato per un effetto «una volta per evento» robusto a StrictMode.

## Idee per dopo
- Annuncio della nuova posizione con una regione `aria-live` sul web.

## Critica ricevuta e cosa cambia
Accolti tutti e 4 i «DA CORREGGERE» e le 4 note:
1. La prova finale sul campo vale solo per F1–F5; F6 finisce col fuoco su «Sposta giù «Mele»».
2. Prova «tasti non rubati» solo con `page.keyboard`, nell'ordine indicato (ordine del server,
   attesa oltre paint ed effetti passivi, tastiera, «Uova» e campo vuoto, poi `toBeFocused`).
3. R4 tolto come prova del fuoco; aggiunto F7 (due tocchi, primo `PUT` trattenuto).
4. Indicazione di implementazione riscritta: bersaglio fissato in `move()`, mappa di ref nel padre,
   un solo effetto su `[focusAt.n]`, azzeramento solo nell'effetto. StrictMode dichiarato non
   verificato.
- F4: `api.elsewhere` prima di `openList`. F2 (e F3, F4): si attende la risposta del `PUT` di
  «Sposta giù «Pane»» prima della spunta. Nota su `react-hooks/refs` nella riga di DECISIONI.md.
- Facoltativo da tastiera: accolto come F8 (il nome F7 è andato al caso dei due tocchi).
Scartato: nulla.
