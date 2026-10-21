---
giro: 020
traguardo: T8
tipo: costruzione
fase: critica
inizio: 2026-10-21T12:44:20Z
ricerca: sì
accettazione:
ripreso: no
---
# Piano del giro 020 — lista ciclica: le rigate passano (contesto 019-b) e riordino «Sposta su/giù» nell'app

## Fetta e traguardo
T8, parte 3, tipo `costruzione`. Prima la contestazione **019-b** dell'umano (commento sulla PR #27),
che cambia la decisione 66; poi l'ultimo pezzo di T8 rimasto dal giro 019: il riordino con
«Sposta su/giù» nella schermata della lista. Dopo questo giro il «Fatto quando» di T8 è coperto anche
nell'app; T8 resta `in-corso` fino al giro `verifica-produzione`.

Fonti: SPEC §2.2.7 (aggiornata dalla PR umana #28: «In una lista ciclica, alla nuova occorrenza
passano le voci non spuntate, anche quelle rigate, che tornano normali: la rigatura vale solo per
quella volta. Le spuntate no, anche se rigate»), §5 P16 (riordinare: tutti i membri), §6
(`shopping_item`), §7; DECISIONI 63, 66, 67; rapporto del giro 019. Codice:
`server/.../shopping/ShoppingRepository.copyOpenItems`, `ShoppingService.order` (invariato),
`app/src/shopping/{ShoppingList.tsx,logic.ts}`, `app/src/api/client.ts`, `app/src/i18n/{it,en}.json`.

## La contestazione 019-b, come la si applica
Testo dell'umano: «in una lista ciclica, alla nuova occorrenza passano tutte le voci non spuntate,
anche quelle rigate, e passano come voci normali (non rigate): la rigatura vale solo per quella
volta. Le spuntate non passano, anche se rigate. Il resto di 019-b va bene.»

- `copyOpenItems`: passano le voci **non cancellate e non spuntate**, rigate comprese; la copia ha
  `removed_by` nullo (come già oggi: `insert` non lo scrive), `checked` falso, `created_by` della
  voce d'origine, posizioni 0..n nell'ordine d'origine. Una voce spuntata e poi rigata non passa.
- L'occorrenza chiusa resta com'è: la voce rigata resta rigata lì.
- Il resto di 019-b resta in vigore: la rigata la ripristina chiunque, non si spunta, «Togli le
  spuntate» non la tocca, creatore e gestori la cancellano.
- **DECISIONI:** la 66 diventa `cambiata (giro 020)`; nuova decisione di livello `registro` che
  riporta la regola della contestazione e di SPEC §2.2.7 (non è una ratifica: l'ha decisa l'umano).
- **Test del giro 019 da correggere:** `Giro019ShoppingSeriesAcceptanceTest` si aspetta solo
  «Pasta» e «Zucchero»; con la contestazione l'attesa giusta è «Pasta», «Caffè», «Zucchero». Lo
  corregge il pianificatore nel commit `test(acceptance)` di questo giro (come il giro 019 fece col
  test del 018, decisione 64); la PR va in revisione umana.

## Il riordino nell'app
- Solo nell'elenco **«Da prendere»**: per ogni voce due pulsanti **«Sposta su «<voce>»»** e
  **«Sposta giù «<voce>»»** (en «Move up «<item>»», «Move down «<item>»»). «Spuntate» e «Voci
  tolte» non si riordinano.
- La prima voce ha «Sposta su» **disabilitato**, l'ultima «Sposta giù» disabilitato (visibili, non
  nascosti; Playwright `toBeDisabled`). Con una sola voce, entrambi disabilitati.
- Uno spostamento scambia la voce con la vicina **in «Da prendere»**. L'ordine mandato al server è
  quello di **tutte** le voci non cancellate della schermata (spuntate e rigate comprese) per
  `position`, con le due voci scambiate di posto: `PUT …/items/order`
  `{ mutationId, itemIds }`. Logica pura `moveItem(items, id, 'up' | 'down') → string[] | undefined`
  in `app/src/shopping/logic.ts`, con test Jest.
- Lo spostamento si vede **subito** sulla schermata (posizioni locali aggiornate); un secondo tocco
  parte dall'ordine già aggiornato. La risposta del server (le voci) si fonde con `mergeItems`
  (vince la `version` più alta): l'ordine finale è quello del server (vince l'ultimo arrivato,
  SPEC §2.2.7).
- Dopo lo spostamento il **fuoco resta sullo stesso pulsante** della voce spostata; se ora è
  disabilitato (la voce è arrivata in cima o in fondo), passa all'altro pulsante della stessa voce.
- Errori: come le altre scritture della schermata (401 login; 404 → ricarica e avviso «La lista è
  cambiata…»; 409 `not_open` → «La lista è chiusa»; altro → «list.failed»). Nessun permesso nel
  client: tutti i membri riordinano (P16).
- Annuncio della nuova posizione per i lettori di schermo: solo se la ricerca lo conferma con una
  API di base di React Native (niente dipendenze); altrimenti «Idee per dopo». Si decide in FINALE.

## Dati demo dei test (inventati)
Persone e famiglie dell'Appendice A, come nel giro 019 (Mamma: Anna, Pietro gestori; Giulia, Luca,
Paolo, Davide membri).

Server (contesto e orologio propri, `planforhome.acceptance.context=giro020-shopping-series`):
- **«Spesa di marzo»**, Mamma, creata da Luca, `SHOPPING_LIST`, DATE `2031-03-01` (sabato), ogni
  settimana il sabato, in coda. Luca aggiunge «Pasta»; Davide «Riso», «Caffè»; Paolo «Zucchero»;
  Davide «Sale». Davide riga «Caffè» (non spuntata); Luca spunta «Riso»; Paolo spunta «Sale», poi
  Davide riga «Sale» (spuntata e rigata). Anna segna fatto.
- Attesa: l'occorrenza del `2031-03-08` ha «Pasta» (Luca), «Caffè» (Davide), «Zucchero» (Paolo), in
  quest'ordine, posizioni 0, 1, 2, non spuntate, `removedBy` nullo, id nuovi. Davide spunta «Caffè»
  nella nuova occorrenza → 200 (è una voce normale). Nell'occorrenza chiusa «Caffè» e «Sale» restano
  rigate da Davide.
- Una seconda serie, **«Spesa della dispensa»** (Mamma, Luca, ogni settimana, `2031-03-01`), con «Olio»
  rigata da Paolo e poi ripristinata da Davide, e «Farina» rigata da Paolo: alla nuova occorrenza
  passano entrambe, normali (la rigata non vale «di più» della ripristinata).

App (API finta del giro 019, `app/e2e/acceptance/giro-019-fake-api.ts`, riusata): Principale,
**«Lista della spesa»** di Giulia: «Latte», «Pane», «Mele», «Biscotti»; Mamma, **«Spesa per la
nonna»** di Marco: «Uova», «Farina» da prendere, «Zucchero» spuntata, «Sale» rigata da Luca.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro020*AcceptanceTest' test` → verde, con:
  - **Rigata non spuntata passa, normale:** «Spesa di marzo» come sopra → nuova occorrenza
    `2031-03-08` con «Pasta», «Caffè», «Zucchero», `createdBy` Luca, Davide, Paolo; `checked` falso,
    `removedBy` nullo per tutte; id diversi dalle voci d'origine.
  - **Spuntata e rigata non passa:** «Sale» e «Riso» non ci sono.
  - **La rigatura vale una volta:** Davide spunta «Caffè» nella nuova occorrenza → 200,
    `checked` vero; l'occorrenza chiusa ha ancora «Caffè» e «Sale» con `removedBy` Davide.
  - **Rigata e ripristinata:** «Spesa della dispensa» → «Olio» e «Farina» passano, normali, in ordine.
  - **`change_log`:** una riga `UPSERT` per ogni voce copiata (3 per «Spesa di marzo»).
- [ ] `cd server && ./mvnw -q -Dtest='Giro019ShoppingSeriesAcceptanceTest' test` → verde con
  l'attesa corretta («Pasta», «Caffè», «Zucchero»).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (tutti i giri, il 018 compreso: «Spesa
  settimanale» del 018 non ha rigate, resta valido).
- [ ] `cd app && npx playwright test e2e/acceptance/giro-020-*` → verde, con:
  - **Pulsanti:** Giulia apre «Lista della spesa»: ogni voce di «Da prendere» ha «Sposta su «…»» e
    «Sposta giù «…»»; «Sposta su «Latte»» e «Sposta giù «Biscotti»» disabilitati, gli altri no.
  - **Sposta giù:** «Sposta giù «Latte»» → «Da prendere» = «Pane», «Latte», «Mele», «Biscotti»; un
    `PUT …/items/order` con `mutationId` UUID e `itemIds` nell'ordine nuovo di tutte le voci; il
    fuoco è su «Sposta giù «Latte»».
  - **Sposta su fino in cima:** «Sposta su «Mele»» due volte → «Mele» prima; «Sposta su «Mele»»
    disabilitato; il fuoco è su «Sposta giù «Mele»».
  - **Doppio tocco veloce:** con il `PUT` lento, «Sposta giù «Latte»» due volte → «Latte» terza;
    due `PUT`, il secondo con «Latte» terza in `itemIds`; dopo le risposte l'ordine resta quello.
  - **Con spuntate e rigate:** Luca su «Spesa per la nonna»: «Sposta su «Farina»» → «Farina»,
    «Uova» in «Da prendere»; `itemIds` contiene anche «Zucchero» e «Sale»; «Zucchero» resta in
    «Spuntate», «Sale» in «Voci tolte»; in quei due elenchi nessun pulsante «Sposta».
  - **Vince il server:** se la risposta del `PUT` dà un ordine diverso (riordino concorrente
    arrivato dopo), la schermata mostra l'ordine della risposta.
  - **Ricarica:** dopo uno spostamento, ricaricando la pagina l'ordine resta (l'API finta lo tiene).
  - **Lista chiusa:** se il `PUT` risponde 409 `not_open` → avviso «La lista è chiusa».
  - **Inglese:** «Move up «Latte»», «Move down «Latte»».
- [ ] `cd app && npx tsc --noEmit && npx eslint . && npm test` → verde (Jest su `moveItem`: su, giù,
  estremi → `undefined`, vicina in «Da prendere» con spuntate o rigate in mezzo, voce rigata o
  spuntata → `undefined`).
- [ ] `cd app && npx playwright test` → verde (tutti i giri, chiavi di traduzione comprese).
- [ ] CI della PR: build web e build dell'APK verdi.
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → l'unico rilievo atteso
  è la modifica di un test di accettazione del giro 019 (revisione umana).

## Fuori perimetro
- Riordino di «Spuntate» e «Voci tolte»; trascinamento; «sposta in cima/in fondo».
- Cambiare il server del riordino (decisione 63: niente compattazione) o della rigatura oltre a
  `copyOpenItems`.
- «Spuntata da X», modifica del testo di una voce, storico, notifiche sulle voci.
- Dubbi aperti del giro 019 (doppio tocco su «Togli» di un membro, UUID di persone fuori famiglia,
  fuoco su Android): restano nel rapporto 019, non in questa fetta.
- Verifica in produzione di T8: giro successivo (`verifica-produzione`).
- Offline e sync delle voci (T9), promemoria (T10).
- Da `traguardi.json`: template 730, scansione e PDF; calendario come vista dedicata; accesso con
  Google o Apple, iPhone, Play Store; email di verifica e recupero; sincronizzazione in tempo reale e
  offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `Giro020ShoppingSeriesAcceptanceTest.java` | «Spesa di marzo»: rigata non spuntata passa normale, spuntata-e-rigata no, la rigatura vale una volta, `change_log`; «Spesa della dispensa»: rigata e ripristinata passano |
| `Giro019ShoppingSeriesAcceptanceTest.java` (corretto) | attesa «Pasta», «Caffè», «Zucchero» (contesto 019-b) |
| `app/e2e/acceptance/giro-020-reorder.spec.ts` | R1–R9: pulsanti e disabilitati, sposta giù, sposta su fino in cima con fuoco, doppio tocco, spuntate e rigate nel `PUT`, vince il server, ricarica, lista chiusa, inglese |

## Porte
- Doppio senso previste:
  - **ratifica 020-a (interfaccia):** «Sposta su/giù» solo in «Da prendere»; agli estremi i pulsanti
    restano visibili e disabilitati; il `PUT` manda l'ordine di tutte le voci; spostamento mostrato
    subito, poi vince la risposta del server.
  - registro: decisione 66 `cambiata (giro 020)` e regola nuova di `copyOpenItems`.
- Senso unico: nessuna. Nessuna dipendenza nuova, nessuna migrazione (cambia solo una condizione in
  `copyOpenItems`).

## Rischi di concorrenza
- Rigatura contro «fatto»: stesso lock della famiglia e del task; ora la voce passa in ogni caso se
  non spuntata, quindi l'ordine conta solo per spunta contro «fatto» (già coperto dal 018).
- Riordino concorrente di due persone: vince l'ultimo arrivato (server già provato nel 018). Nel
  client: due `PUT` dello stesso schermo in volo; la risposta del primo, se arriva dopo il secondo,
  non deve riportare indietro l'ordine: `mergeItems` tiene la `version` più alta. Prova: R4 con il
  `PUT` lento e risposte in ordine inverso, se l'API finta lo permette (altrimenti Jest su
  `mergeItems` con posizioni).
- Doppio tocco: ogni tocco ha il suo `mutationId`; il secondo parte dallo stato locale già spostato.

## Budget
Righe di produzione (`server/src/main`, `app/src`, `app/app`, traduzioni comprese) ≤ 140: server
≤ 5 (`copyOpenItems`), app ≤ 135 (`moveItem`, pulsanti, fuoco, `PUT order` nel client se manca,
4 chiavi it/en). File toccati ≤ 8 (più DECISIONI e documenti del giro). Una sessione.

## Domande per il ricercatore (al massimo 3)
1. Riordino accessibile con pulsanti «sposta su/giù» (WAI-ARIA APG, GOV.UK, Adobe Spectrum o
   simili, fonti ufficiali): agli estremi pulsante disabilitato o nascosto? Dove va il fuoco dopo lo
   spostamento? Si annuncia la nuova posizione, e con quale testo?
2. React Native Web 0.21 e React Native 0.8x: come tenere il fuoco su un `Pressable` dopo che la
   lista si riordina (chiavi stabili, `ref.focus()`), e `disabled` di `Pressable` su web produce
   `disabled`/`aria-disabled` riconosciuto da Playwright `toBeDisabled`?
3. Annuncio della nuova posizione senza dipendenze: `AccessibilityInfo.announceForAccessibility`
   su Android e il suo comportamento su react-native-web (o una regione `aria-live`), dalla
   documentazione ufficiale.

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Riordino delle spuntate; «sposta in cima».
- «Spuntata da X» (`checked_by`); modifica del testo di una voce.
