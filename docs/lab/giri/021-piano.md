---
giro: 021
traguardo: T8
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-21T15:15:26Z
ricerca: sì
accettazione:
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
sposta il fuoco. Il modo (per esempio una richiesta di fuoco in un `ref` azzerata appena eseguita,
effetto che dipende solo dal contatore) lo sceglie il costruttore.

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx playwright test e2e/acceptance/giro-021-*` → tutti verdi (F1–F6 sotto).
- [ ] `cd app && npx playwright test` → tutto verde, compresi `giro-020-reorder.spec.ts` R1–R10
      (R2 e R3: il fuoco subito dopo il tocco c'è ancora) e `giro-020-reorder-retry.spec.ts`.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi, senza nuove disattivazioni
      di regole.
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (nessun file del server cambia).
- [ ] `docs/lab/DECISIONI.md`: la decisione 74 è «cambiata (giro 021)» con una riga nuova che
      descrive la regola; la 73 rimanda alla nuova per il fuoco.
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
«Latte», «Pane», «Mele», «Biscotti» in quest'ordine. «Nuova voce» è il campo di aggiunta. Dopo ogni
caso: il fuoco è sul campo «Nuova voce» (`toBeFocused`) e digitando «Uova» + Invio compare «Uova» in
«Da prendere» (i tasti non sono rubati).

| Caso | Dato … quando … allora … |
|---|---|
| F1 | Dato il `PUT …/items/order` trattenuto, quando Giulia preme «Sposta giù «Latte»», il fuoco è su quel pulsante; poi clicca «Nuova voce» e la risposta arriva con un ordine concorrente («Biscotti», «Mele», «Pane», «Latte»), allora l'ordine è quello del server e il fuoco resta su «Nuova voce» |
| F2 | Dato Giulia che ha premuto «Sposta giù «Pane»» (risposta ok) e poi spunta «Latte» con la risposta trattenuta, quando clicca «Nuova voce» e la risposta arriva, allora «Pane» sale di un posto e il fuoco resta su «Nuova voce» |
| F3 | Come F2, ma Giulia toglie «Latte» (pulsante «Togli «Latte»», risposta trattenuta): la voce esce da «Da prendere», il fuoco resta su «Nuova voce» |
| F4 | Dato «Latte» già spuntata (`api.elsewhere`) e Giulia che ha premuto «Sposta giù «Pane»», quando toglie la spunta a «Latte» in «Spuntate» (risposta trattenuta), clicca «Nuova voce» e la risposta arriva, allora «Latte» torna in testa a «Da prendere» e il fuoco resta su «Nuova voce» |
| F5 | Dato il `PUT` trattenuto, quando Giulia preme «Sposta giù «Mele»» («Mele» ultima, fuoco su «Sposta su «Mele»»), clicca «Nuova voce» e la risposta porta un ordine concorrente in cui «Mele» non è più ultima («Mele», «Latte», «Pane», «Biscotti»), allora il fuoco resta su «Nuova voce» e non salta su «Sposta giù «Mele»» |
| F6 | Regressione: premuto «Sposta su «Mele»» due volte, il fuoco è su «Sposta giù «Mele»» subito dopo il secondo tocco (come R3 del giro 020) |

F1, F4 e F5 devono essere rossi oggi per asserzione (`toBeFocused` sul campo); F2 e F3 rossi se il
fuoco salta, altrimenti il test writer li rende rossi trovando l'ordine di render giusto; F6 verde
già oggi (è la guardia della parte che resta).

## Porte
- Doppio senso previste: modifica a `ShoppingList.tsx` (solo il fuoco); riga in `DECISIONI.md`.
- Senso unico: nessuna (nessuna dipendenza, nessuna migrazione, nessun percorso protetto).

## Rischi di concorrenza
- Risposte che arrivano dopo un secondo tocco: il secondo tocco chiede un nuovo fuoco, la risposta
  del primo no. Prova: R4 del giro 020 resta verde, F1.
- Bersaglio che cambia tra estremo e non estremo dopo il tocco (F5).
- Doppio render di React in sviluppo (StrictMode): la richiesta consumata non deve rieseguirsi.

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
(dopo il critico)
