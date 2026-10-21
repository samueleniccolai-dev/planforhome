---
giro: 020
traguardo: T8
tipo: costruzione
fase: revisione
inizio: 2026-10-21T12:44:20Z
ricerca: sì
accettazione: 3cf90f1
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
  test del 018, decisione 64); la PR va in revisione umana. Modifiche esatte:
  - riga 47: `containsExactly("Pasta", "Caffè", "Zucchero")`;
  - riga 50: `createdBy(copied.get(1))` diventa Davide (è «Caffè»); nuova riga
    `createdBy(copied.get(2))` = Paolo («Zucchero»);
  - riga 52: anche `caffe` tra gli id che le copie non hanno;
  - javadoc (righe 12–14) riscritto con la regola della contestazione 019-b; il metodo diventa
    `theNextSaturdayGetsPastaCaffeAndZuccheroWithTheirAuthors`.

## Il riordino nell'app
- Solo nell'elenco **«Da prendere»**: per ogni voce due pulsanti **«Sposta su «<voce>»»** e
  **«Sposta giù «<voce>»»** (en «Move up «<item>»», «Move down «<item>»»). «Spuntate» e «Voci
  tolte» non si riordinano.
- La prima voce ha «Sposta su» **disabilitato**, l'ultima «Sposta giù» disabilitato (visibili, non
  nascosti; Playwright `toBeDisabled`). Con una sola voce, entrambi disabilitati.
- Uno spostamento scambia la voce con la vicina **in «Da prendere»**. L'ordine mandato al server è
  quello di **tutte** le voci non cancellate della schermata (spuntate e rigate comprese) per
  `position`, con le due voci scambiate di posto: `PUT …/items/order`
  `{ mutationId, itemIds }`. Logica pura `moveItem(items, id, 'up' | 'down') → Item[] | undefined`
  in `app/src/shopping/logic.ts`: restituisce direttamente la lista delle voci con le `position`
  riassegnate 0..n (gli `itemIds` sono quella lista, in ordine); `undefined` se la voce non si può
  spostare. Test Jest.
- Lo spostamento si vede **subito** sulla schermata (posizioni locali aggiornate); un secondo tocco
  parte dall'ordine già aggiornato.
- **Al massimo un riordino in volo** per schermata. I tocchi durante un `PUT` aggiornano solo lo
  stato locale; alla risposta, se l'ordine locale è cambiato rispetto a quello mandato, parte **un**
  nuovo `PUT` con l'ordine locale più recente (nuovo `mutationId`). Così due `PUT` non arrivano mai
  invertiti.
- **Risposta del server:** si applica (con `mergeItems`) solo se non resta nessun riordino in
  attesa; altrimenti le `position` della risposta non si fondono (la risposta del primo `PUT` non
  riporta indietro lo spostamento ottimistico, anche se ha `version` più alta). Senza riordini in
  attesa vince l'ordine del server (l'ultimo arrivato, SPEC §2.2.7). Caso Jest su questo.
- Dopo lo spostamento il **fuoco resta sullo stesso pulsante** della voce spostata; se ora è
  disabilitato (la voce è arrivata in cima o in fondo), passa all'altro pulsante della stessa voce.
- Errori: come le altre scritture della schermata (401 login; 404 → ricarica e avviso «La lista è
  cambiata…»; 409 `not_open` → «La lista è chiusa»; altro, rete compresa → «list.failed» e la
  schermata **torna all'ordine di prima** dello spostamento (o ricarica con `fetchItems()`), mai un
  ordine mai confermato). Nessun permesso nel client: tutti i membri riordinano (P16).
- Annuncio della nuova posizione per i lettori di schermo: rinviato a «Idee per dopo» (la ricerca
  dice che `announceForAccessibility` su react-native-web non fa nulla).

## Dati demo dei test (inventati)
Persone e famiglie dell'Appendice A, come nel giro 019 (Mamma: Anna, Pietro gestori; Giulia, Luca,
Paolo, Davide membri).

Server (contesto e orologio propri, `planforhome.acceptance.context=giro020-shopping-series`;
l'orologio è fermo e si sposta a mano):
- **«Spesa di marzo»**, Mamma, creata da Luca, `SHOPPING_LIST`, DATE `2031-03-01` (sabato), ogni
  settimana il sabato, in coda. Alle `2031-01-20T08:00Z` Luca aggiunge «Pasta»; Davide «Riso»,
  «Caffè»; Paolo «Zucchero»; Davide «Sale». Davide riga «Caffè» (non spuntata); Luca spunta «Riso»;
  Paolo spunta «Sale», poi Davide riga «Sale» (spuntata e rigata). Alle `2031-01-20T09:00Z` Anna
  segna fatto (istante diverso, per riconoscere le righe di `change_log` scritte dal «fatto»).
- Attesa: l'occorrenza del `2031-03-08` ha «Pasta», «Caffè», «Zucchero», in quest'ordine, «Caffè»
  di Davide, non spuntata, `removedBy` nullo, id nuovo. Davide spunta «Caffè» nella nuova
  occorrenza → 200 (è una voce normale). Nell'occorrenza chiusa «Caffè» e «Sale» restano rigate da
  Davide.
- Una seconda serie, **«Spesa della dispensa»** (Mamma, Luca, ogni settimana, `2031-03-01`), alle
  `2031-01-21T08:00Z`: Luca aggiunge «Olio» e «Farina»; Paolo riga «Olio», Davide la ripristina;
  Paolo riga «Farina»; Anna segna fatto. Passano «Olio» e «Farina», normali, in ordine. La prova
  della regola nuova è **«Farina»** (rigata e non ripristinata); «Olio» passava già con la regola
  del 019 e non prova nulla di nuovo.

App (API finta del giro 019, `app/e2e/acceptance/giro-019-fake-api.ts`, riusata senza modifiche;
gli interventi del test sul `PUT …/items/order` stanno in un `page.route` del file del giro 020,
registrato dopo l'API finta): Principale, **«Lista della spesa»** di Giulia: «Latte», «Pane»,
«Mele», «Biscotti»; Mamma, **«Spesa per la nonna»** di Marco: «Uova», «Farina» da prendere,
«Zucchero» spuntata, «Sale» rigata da Luca.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro020*AcceptanceTest' test` → verde. Solo i 4 casi nuovi
  (ciò che il 019 corretto prova già non si ripete):
  - **Rigata non spuntata passa, normale:** nuova occorrenza `2031-03-08` = «Pasta», «Caffè»,
    «Zucchero»; «Caffè» con `createdBy` Davide, `checked` falso, `removedBy` nullo, id diverso.
  - **Spuntata (anche rigata) non passa:** «Riso» e «Sale» non ci sono.
  - **La rigatura vale una volta:** Davide spunta «Caffè» nella nuova occorrenza → 200, `checked`
    vero; l'occorrenza chiusa ha ancora «Caffè» e «Sale» con `removedBy` Davide.
  - **Rigata passa anche accanto a una ripristinata:** «Spesa della dispensa» → «Olio», «Farina»,
    normali, in ordine («Farina» è la prova).
  - **`change_log`:** prima di altre scritture sulla nuova occorrenza, per ogni id copiato
    esattamente 1 riga con `entity='shopping_item'` (`UPSERT`); nessuna riga con l'`at` del «fatto»
    (`2031-01-20T09:00Z`) per gli id di «Riso» e «Sale».
- [ ] `cd server && ./mvnw -q -Dtest='Giro019ShoppingSeriesAcceptanceTest' test` → verde con
  l'attesa corretta («Pasta», «Caffè», «Zucchero»; autori Luca, Davide, Paolo).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (tutti i giri, il 018 compreso: «Spesa
  settimanale» del 018 non ha rigate, resta valido).
- [ ] `cd app && npx playwright test e2e/acceptance/giro-020-*` → verde, con:
  - **R1 Pulsanti:** Giulia apre «Lista della spesa»: ogni voce di «Da prendere» ha «Sposta su «…»»
    e «Sposta giù «…»»; «Sposta su «Latte»» e «Sposta giù «Biscotti»» disabilitati, gli altri no;
    toccare (forzato) un pulsante disabilitato non manda nessun `PUT` e non cambia l'ordine.
  - **R2 Sposta giù:** «Sposta giù «Latte»» → «Da prendere» = «Pane», «Latte», «Mele», «Biscotti»;
    un `PUT …/items/order` con `mutationId` UUID e `itemIds` nell'ordine nuovo di tutte le voci; il
    fuoco è su «Sposta giù «Latte»».
  - **R3 Sposta su fino in cima:** «Sposta su «Mele»» due volte → «Mele» prima; «Sposta su «Mele»»
    disabilitato; il fuoco è su «Sposta giù «Mele»».
  - **R4 Doppio tocco, risposte invertite:** il primo `PUT` è trattenuto in `page.route` finché un
    secondo `PUT` non è passato all'API finta (o al più 1,5 s, se il client non lo manda prima della
    risposta: la correzione «un riordino in volo» è ammessa). «Sposta giù «Latte»» due volte →
    «Latte» terza sulla schermata; l'ultimo `PUT` ha «Latte» terza; dopo tutte le risposte e dopo
    una ricarica, «Latte» resta terza.
  - **R5 Con spuntate e rigate:** Luca su «Spesa per la nonna»: «Sposta su «Farina»» → «Farina»,
    «Uova» in «Da prendere»; `itemIds` = Farina, Uova, Zucchero, Sale; «Zucchero» resta in
    «Spuntate», «Sale» in «Voci tolte»; in quei due elenchi nessun pulsante «Sposta».
  - **R6 Vince il server:** la risposta del `PUT` porta un riordino concorrente arrivato dopo
    («Biscotti», «Mele», «Pane», «Latte»): la schermata mostra quell'ordine.
  - **R7 Ricarica:** dopo uno spostamento, ricaricando la pagina l'ordine resta.
  - **R8 Lista chiusa:** `PUT` → 409 `not_open` → avviso «La lista è chiusa».
  - **R9 Errore generico:** `PUT` → 500 → avviso «Qualcosa non ha funzionato. Riprova.» e «Da
    prendere» torna a «Latte», «Pane», «Mele», «Biscotti».
  - **R10 Inglese:** c'è «Move up «Pane»» (una sola asserzione).
- [ ] `cd app && npx tsc --noEmit && npx eslint . && npm test` → verde. Jest su `moveItem`: su,
  giù, estremi → `undefined`, una sola voce → `undefined`, vicina in «Da prendere» con spuntate o
  rigate in mezzo, voce rigata o spuntata → `undefined`; `position` riassegnate 0..n. Jest sulla
  regola della risposta: con un riordino in attesa la risposta (anche con `version` più alta) non
  riporta indietro le `position` locali; senza riordini in attesa vince la risposta.
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
| `Giro020ShoppingSeriesAcceptanceTest.java` | «Spesa di marzo»: rigata non spuntata passa normale, spuntata (anche rigata) no, la rigatura vale una volta, `change_log` per id; «Spesa della dispensa»: «Farina» rigata passa accanto a «Olio» ripristinata |
| `Giro019ShoppingSeriesAcceptanceTest.java` (corretto) | attesa «Pasta», «Caffè», «Zucchero» (contesto 019-b) |
| `app/e2e/acceptance/giro-020-reorder.spec.ts` | R1–R10: pulsanti e disabilitati (tocco senza `PUT`), sposta giù, sposta su fino in cima con fuoco, doppio tocco con risposte invertite, spuntate e rigate nel `PUT`, vince il server, ricarica, lista chiusa, errore 500 con ordine ripristinato, inglese |

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
- Riordino concorrente di due persone: vince l'ultimo arrivato (server già provato nel 018); nel
  client lo prova R6.
- Due `PUT` dello stesso schermo: due richieste in volo possono arrivare al server invertite, e
  `mergeItems` (vince la `version` più alta) riporterebbe indietro lo spostamento ottimistico. Per
  questo: al massimo un riordino in volo, i tocchi intanto restano locali, alla risposta si manda
  l'ordine locale più recente se è cambiato; la risposta si fonde solo senza riordini in attesa.
  Prova: R4 (primo `PUT` trattenuto) e Jest sulla regola della risposta.
- Doppio tocco: il secondo parte dallo stato locale già spostato; ogni `PUT` ha il suo
  `mutationId`.

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
Accolti tutti i 5 «DA CORREGGERE», le semplificazioni e le note sui test:
1. **Due `PUT` invertiti:** accolto. Un riordino in volo per schermata; i tocchi intanto restano
   locali; alla risposta si manda l'ordine locale più recente se è cambiato. R4 riscritto: primo
   `PUT` trattenuto in `page.route` finché il secondo non è passato all'API finta (al più 1,5 s,
   così la correzione non è vietata); atteso «Latte» terza, anche dopo la ricarica.
2. **`mergeItems` riporta indietro lo spostamento:** accolto. La risposta si fonde solo senza
   riordini in attesa; caso Jest.
3. **Errore generico:** accolto. Rete o 500 → «list.failed» e ordine di prima (o `fetchItems()`);
   nuovo R9.
4. **Test del 019:** accolto; le modifiche esatte sono scritte nella sezione della contestazione.
5. **`change_log`:** accolto. Conteggio per `entity='shopping_item'` ed `entity_id` di ogni copia
   (1 riga ciascuna); nessuna riga con l'`at` del «fatto» per «Riso» e «Sale» (il «fatto» avviene a
   un istante suo).
- **Più semplice:** `moveItem` restituisce le voci con le `position` riassegnate; il test server
  si limita ai casi nuovi (il resto lo prova il 019 corretto).
- **Test:** tocco forzato sul pulsante disabilitato senza `PUT` (R1); Jest con una sola voce →
  `undefined`; «Inglese» con una sola asserzione; annuncio in «Idee per dopo», deciso.
- **Rapporto:** «Olio» ripristinata non è la prova della regola nuova; lo è «Farina».
Scartato: niente.

## Idee per dopo
- Riordino delle spuntate; «sposta in cima».
- Annuncio della nuova posizione ai lettori di schermo (`aria-live` sul web,
  `announceForAccessibility` su Android), dopo le fonti ufficiali; verifica con TalkBack.
- «Spuntata da X» (`checked_by`); modifica del testo di una voce.
