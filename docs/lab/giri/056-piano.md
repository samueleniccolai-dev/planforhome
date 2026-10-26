---
giro: 056
traguardo: T16
traguardi_extra: []
tipo: costruzione
fase: costruzione
inizio: 2026-10-26T10:36:01Z
ricerca: sì
accettazione: 4b6d328
ripreso: no
---
# Piano del giro 056 — T16 parte 2: stati di schermata V8 e `/` in scuro

## Fetta e traguardo
T16 (UI-5) parte 2 di 2, `costruzione`: gli **stati V8** (vuoto, caricamento, errore,
offline/conflitto) su ogni schermata, dal kit; `LoadingState` nel kit; la schermata `/` composta
dal kit e quindi in tema scuro (dubbio 1 del revisore nel giro 055). Con questa parte T16 è
completo nel codice; diventa `passato` solo con un giro `verifica-produzione`.
Fonti: SPEC §12; DESIGN §2 (V5, V7, V8, V10), §3 (tema via Context), §5 (`LoadingState`,
`EmptyState`, `InlineNotice`), §7 (screenshot, checklist), §8.

Oggi (letto nel codice):
- `LoadingState` non esiste. Mentre i dati arrivano, `/families`, `/family`, `/tasks`, `/me` e
  `/list` (`ShoppingList`) fanno `return null`: schermo vuoto, nessun annuncio. `TasksSection`
  con `tasks === undefined` non mostra nulla.
- Errore: c'è su `/families`, `/family`, `/tasks`, `/list` (`InlineNotice tone="danger"`). Su `/me`
  un errore di `families()` è muto (`FamilySwitch` riceve `undefined`).
- Vuoto: c'è per i task (`/tasks`, `/family`) e per la lista (`list.empty`). Su `/me` una persona
  senza famiglie (dove `landing` la manda) non legge nulla che lo spieghi.
- Offline/conflitto: su Android ci sono già le note della coda offline (`TasksSection`,
  `ShoppingList`); sul web l'offline è fuori perimetro, quindi «offline» sul web = errore di rete,
  che deve finire nello stato di errore, mai in una schermata bianca.
- `app/app/index.tsx` usa `Text`/`View` di React Native con stili propri: resta chiara in scuro.

## Matrice V8 (decisa qui)
| Schermata | Vuoto | Caricamento | Errore (anche rete caduta) | Offline/conflitto |
|---|---|---|---|---|
| `/` | n.a. (statica) | n.a. | n.a. | n.a. |
| `/login` | n.a. | bottone disabilitato durante l'invio (c'è) | c'è (`login.error`) | = errore |
| `/families` | n.a. (`landing` porta a `/me`) | **nuovo** `LoadingState` | c'è | = errore |
| `/family` | c'è (task) | **nuovo** `LoadingState` (schermata e sezione task) | c'è | c'è su Android |
| `/tasks` | c'è | **nuovo** `LoadingState` | c'è | = errore |
| `/me` | **nuovo** `EmptyState` «nessuna famiglia» | **nuovo** `LoadingState` | **nuovo** `InlineNotice` | = errore |
| `/list` | c'è | **nuovo** `LoadingState` | c'è | c'è su Android |

`LoadingState` (kit, `app/src/ui/LoadingState.tsx`): `ActivityIndicator` (decorativo, nascosto
alla a11y) + testo visibile da chiave i18n, dentro un contenitore `role="status"` con
`aria-live="polite"` e nome accessibile uguale al testo. Colore dell'indicatore dai token
(`colors.primary` o equivalente del tema). Compare subito (nessun ritardo: vedi «Idee per dopo»).
Chiavi nuove (it/en): `common.loading` «Caricamento…» / «Loading…»; `me.familiesError`
«Impossibile caricare le tue famiglie. Riprova.» / «Couldn't load your families. Try again.»;
`me.noFamilies.title` «Non fai ancora parte di nessuna famiglia» / «You're not in any family yet»;
`me.noFamilies.hint` «Chiedi a chi gestisce la famiglia di aggiungerti.» / «Ask the family
manager to add you.».

## Dati demo
Quelli inventati del giro 052 (`app/e2e/acceptance/giro-052-fake-api.ts`): Giulia, Famiglia
Principale, Famiglia Mamma, task «Zaino…». Per il vuoto di `/me`: la stessa Giulia con la risposta
di `/api/families` sostituita da `[]` nel test. Nessun dato reale.

## Fatto quando — controlli eseguibili
Ogni caso dice quale endpoint si trattiene o fallisce. `GET /api/me` che fallisce resta «nessuna
sessione» (→ `/login`): `me()` non distingue errore da 401 ed è fuori perimetro (vedi sotto).
Il `LoadingState` sta **dentro** `Screen` (sfondo del tema), mai a schermo intero da solo.

| Schermata | Endpoint trattenuto (A2) / che fallisce (A3, A4) | Dove sta il `LoadingState` | Errore |
|---|---|---|---|
| `/families` | `GET /api/families` | al posto della lista e del titolo | `alert` «Impossibile caricare le famiglie. Riprova.» |
| `/family` (schermata) | `GET /api/families` | al posto di titolo, persone e task | `alert` «Impossibile caricare la famiglia. Riprova.» |
| `/family` (sezione task) | `GET /api/families/{id}/tasks` | nella sezione task, titolo e persone visibili; **un solo** `status` | nota esistente «Impossibile caricare i task. Riprova.» (`role="status"`, invariata) |
| `/tasks` | `GET /api/tasks` | al posto di titolo e lista | `alert` «Impossibile caricare i task. Riprova.», l'URL resta `/tasks` |
| `/me` (persona) | `GET /api/me` (solo trattenuto, mai fallito) | al posto di tutto: saluto assente | n.a. (fuori perimetro) |
| `/me` (famiglie) | `GET /api/families` | al posto di `FamilySwitch`/stato vuoto; saluto e «Esci» visibili | `alert` «Impossibile caricare le tue famiglie. Riprova.», saluto e «Esci» restano |
| `/list` | `GET /api/families/{id}/tasks/{taskId}/items` | al posto di titolo e voci | `alert` «Qualcosa non ha funzionato. Riprova.» |

- [ ] **A0 — `/` dal kit, in chiaro e in scuro.** Apri `/`: il contenitore che riempie lo schermo
  è `#111418` in scuro e `#F3F5F7` in chiaro; il titolo (`heading` 1 «Benvenuto in planforhome») è
  `#E8ECF1` in scuro e `#14181D` in chiaro; in scuro ogni testo ha contrasto ≥ 4.5:1; il link
  «Accedi» (per ruolo) porta a `/login`; screenshot `t16-home-<light|dark>.png`.
- [ ] **A1 — `LoadingState` nel kit.** `/gallery` mostra un `status` con nome «Caricamento…»
  (`Loading…` con browser inglese), `aria-live="polite"`, testo visibile; il `progressbar` di
  react-native-web dentro lo `status` ha `aria-hidden="true"`. Su Android (sorgente
  `app/src/ui/LoadingState.tsx`): `accessibilityLiveRegion="polite"` e, sull'indicatore,
  `importantForAccessibility="no-hide-descendants"`.
- [ ] **A2 — caricamento.** Per ogni riga della tabella, con l'endpoint trattenuto: un solo `status`
  «Caricamento…»; il titolo non c'è (tranne `/me` famiglie e `/family` sezione task, dove c'è);
  rilasciato, i dati compaiono e lo `status` sparisce. Su `/me` (famiglie) il link «Cambia
  famiglia» compare solo dopo il rilascio.
- [ ] **A3 — errore dopo il caricamento.** Per ogni riga (tranne `/me` persona): endpoint
  trattenuto (lo `status` si vede), poi 500 → il messaggio d'errore della tabella **e insieme**
  nessuno `status` «Caricamento…».
- [ ] **A4 — rete caduta (offline sul web).** `/tasks` (`/api/tasks`) e `/families`
  (`/api/families`): trattenuto, poi `route.abort('internetdisconnected')` → stesso `alert` di A3,
  nessuno `status`, l'URL non cambia.
- [ ] **A5 — vuoto di `/me`.** `GET /api/families` → `[]`: saluto, «Non fai ancora parte di nessuna
  famiglia», il suggerimento, «Esci»; nessun link «Cambia famiglia», nessuno `status`, nessun `alert`.
- [ ] **Concorrenza — `/family`.** Trattenuto solo `/api/families/{id}/tasks`: titolo visibile e
  esattamente 1 `status`; rilasciato, 0 `status` e il task «Preparare lo zaino» visibile.
- [ ] **A6/A7 — stati in chiaro e scuro, screenshot.** Per `families`, `family`, `tasks`, `me`,
  `list` × `loading|error` × `light|dark`, più `me` vuoto: lo sfondo della schermata dietro lo stato
  è quello del tema; in scuro ogni testo ≥ 4.5:1; file
  `e2e-screenshots/t16-state-<schermata>-<loading|error|empty>-<light|dark>.png` non vuoto (mobile).
- [ ] **A8 — Jest.** `cd app && npm test`: verde, con un test nuovo di `LoadingState` (ruolo
  `status`, nome dal testo, indicatore nascosto) e il test delle chiavi it/en verde.
- [ ] **A9 — resto.** `npx tsc --noEmit`, `npx eslint .`, `npx playwright test` completo: verdi.
  Nessun `#` letterale fuori da `tokens.ts`. (Controllo secondario, non bloccante: `grep -n "return
  null"` sulle cinque schermate non trova ritorni nulli durante il caricamento; A2 lo prova già.)

Dati demo per `/list`: la fake API del giro 019 così com'è (Giulia, Famiglia Principale, lista
«Lista della spesa» con «Latte», «Pane», «Mele»); per le altre schermate quella del giro 052. Lo
stato trattenuto/500/rete caduta lo aggiunge il test con una `page.route` registrata dopo la fake
API (in Playwright l'ultima vince; `route.fallback()` passa alla fake API).

## Fuori perimetro
- Bottone «Riprova» negli stati d'errore (oggi il testo dice «Riprova»: si ricarica la pagina).
- Ritardo anti-sfarfallio del `LoadingState`, scheletri (skeleton) al posto dello spinner.
- Offline sul web; nuove note di sync su Android oltre a quelle che ci sono.
- Preferenza del tema dentro l'app; ritocchi ai token scuri del giro 055.
- Server: nessuna modifica. Nessuna dipendenza nuova.
- `GET /api/me` che fallisce per errore o rete: oggi `me()` (`client.ts`) restituisce `undefined`
  sia per 401 sia per errore e le schermate vanno a `/login`. Distinguere i due casi tocca
  `client.ts` e tutte le schermate: giro a parte (vedi «Idee per dopo»).
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni»; set di icone
  come dipendenza; accesso con Google o Apple, iPhone, Play Store; verifica email e recupero
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-056-screen-states.spec.ts` | A0–A7 e concorrenza sopra, fake API dei giri 052 e 019 più un `hold` per endpoint; elementi per ruolo ed etichetta |

Nessun test di accettazione del server: la fetta non tocca l'API.

## Porte
- Doppio senso previste: nuovo componente del kit `LoadingState`; chiavi i18n nuove; `index.tsx`
  riscritto sul kit; nuovo stato vuoto e d'errore di `/me`.
- Senso unico: nessuna. `ActivityIndicator` è di React Native; nessun pacchetto nuovo.

## Rischi di concorrenza
Nessuna scrittura nuova. Rischio: un `LoadingState` che resta a schermo se una delle richieste
parallele fallisce o se il componente si smonta prima (il flag `alive` c'è già): A3 prova che
dopo l'errore lo `status` sparisce. Su `/family` il caricamento della schermata e quello della
sezione task sono separati: non devono comparire due `status` insieme (test «Concorrenza»).
Rischio da dichiarare nel rapporto: una regione `aria-live` montata già piena può non essere
annunciata (web e TalkBack); i test non lo provano.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 220; file ≤ 14 (più i18n e test); una sessione.

## Domande per il ricercatore (al massimo 3)
1. react-native-web 0.21: cosa rende `ActivityIndicator` nel DOM (ruolo `progressbar`? attributi
   ARIA?) e come nasconderlo alla a11y lasciando a un contenitore `role="status"` l'annuncio; su
   Android con TalkBack, `accessibilityLiveRegion="polite"` annuncia il testo di caricamento?
2. Linee guida (Material 3, WCAG 2.2, GOV.UK o simili) per gli stati di caricamento e d'errore
   pensati per persone anziane: testo sempre visibile accanto allo spinner, tono dell'errore,
   quando serve un ritardo prima di mostrare lo spinner.
3. Pattern degli stati vuoti con azione (Material 3 «empty states»): cosa scrivere quando una
   persona non appartiene a nessun gruppo e non può fare nulla da sola.

## Idee per dopo
- Bottone «Riprova» negli `InlineNotice` d'errore delle schermate.
- `LoadingState` con ritardo di ~300 ms per evitare il lampo sulle reti veloci.
- Dubbio del giro 055: il lampo chiaro→scuro del prerender sul web.
- `me()` che distingue 401 da errore/rete, con stato d'errore al posto del rinvio a `/login`.

## Critica ricevuta e cosa cambia
Accolti tutti i punti (4 «DA CORREGGERE», più semplice, concorrenza, accettazione, facoltativi):
1. **`me()` che fallisce:** non tocco `client.ts`; il caso è fuori perimetro e dichiarato. La
   tabella dice per ogni schermata quale endpoint si trattiene o fallisce; su `/tasks` fallisce solo
   `/api/tasks` (500 e rete caduta), l'URL resta `/tasks`.
2. **`/list`:** si usa la fake API del giro 019 (quella di `/items`, già usata nel giro 053).
3. **Due caricamenti:** `/me` ha due righe (persona, famiglie) con la posizione del `LoadingState`;
   `/family` ne ha due (schermata = `/api/families`, sezione = `/api/families/{id}/tasks`).
4. **Indicatore:** A1 verifica `aria-hidden="true"` sul `progressbar` dentro lo `status`; su
   Android `importantForAccessibility="no-hide-descendants"` e `accessibilityLiveRegion`.
- Più semplice: l'ex A8 (grep) è ora un controllo secondario dentro A9.
- Concorrenza: test aggiunto. Accettazione: A3 asserisce sempre errore e assenza dello `status`
  insieme; A5 verifica che non ci sia il link «Cambia famiglia».
- Facoltativi: il rischio `aria-live` montato pieno va nel rapporto; A0 verifica il colore del
  titolo anche in chiaro.
- Cambiato in più: A3, A4 e A6/A7 partono dall'endpoint trattenuto, così provano il passaggio
  caricamento → errore (il rischio del `LoadingState` che resta) e sono rossi oggi anche dove
  l'errore c'è già.
