---
giro: 056
traguardo: T16
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-26T10:36:01Z
ricerca: sì
accettazione:
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
- [ ] **A0 — `/` in scuro.** Playwright, `emulateMedia({ colorScheme: 'dark' })`, apri `/`: lo
  sfondo è `#111418`, il titolo (`heading` livello 1 «Benvenuto in planforhome») è `#E8ECF1`, ogni
  testo visibile ha contrasto ≥ 4.5:1 sul suo sfondo; il link «Accedi» si trova per ruolo e porta a
  `/login`. In chiaro lo sfondo è `#F3F5F7`.
- [ ] **A1 — `LoadingState` nel kit.** `/gallery` mostra un `status` con nome «Caricamento…»
  (in inglese «Loading…» con `?lang=en` o lingua del browser inglese, come nei giri precedenti).
- [ ] **A2 — caricamento.** Per `/families`, `/family?id=<Principale>`, `/tasks`, `/me`, `/list`:
  con la risposta dell'API trattenuta (`page.route` che non risponde finché il test non la
  rilascia), compare un `status` «Caricamento…» e il titolo della schermata non c'è ancora;
  rilasciata la risposta, lo `status` sparisce e compaiono i dati (stessi contenuti del giro 055).
- [ ] **A3 — errore.** Per le stesse cinque schermate: con l'API che risponde 500, compare un
  `alert` con il testo d'errore della schermata (`/me`: «Impossibile caricare le tue famiglie.
  Riprova.» e il saluto resta); nessun `status` «Caricamento…» resta a schermo.
- [ ] **A4 — rete caduta (offline sul web).** `/tasks` e `/families` con `route.abort('internetdisconnected')`:
  stesso `alert` d'errore di A3, mai una schermata vuota.
- [ ] **A5 — vuoto di `/me`.** Con `/api/families` → `[]`: si leggono «Non fai ancora parte di
  nessuna famiglia» e il suggerimento; il bottone «Esci» resta.
- [ ] **A6 — stati in scuro, contrasto.** A2, A3 e A5 ripetuti in `dark`: ogni testo visibile
  dello stato ha contrasto ≥ 4.5:1 (stessa misura sul DOM del giro 055).
- [ ] **A7 — screenshot.** File `e2e-screenshots/t16-state-<schermata>-<loading|error|empty>-<light|dark>.png`
  per le schermate di A2/A3/A5 (mobile), più `t16-home-<light|dark>.png`; non vuoti.
- [ ] **A8 — niente schermo bianco.** `grep -n "return null" app/app/families.tsx app/app/family.tsx app/app/tasks.tsx app/app/me.tsx app/src/shopping/ShoppingList.tsx`
  → nessuna riga che riguardi il caricamento (atteso: nessun risultato).
- [ ] **A9 — Jest.** `cd app && npm test`: verde, con un test nuovo di `LoadingState` (ruolo
  `status`, nome dal testo, indicatore nascosto alla a11y) e il test delle chiavi it/en verde.
- [ ] **A10 — resto.** `npx tsc --noEmit`, `npx eslint .`, `npx playwright test` completo: verdi.
  Nessun `#` letterale fuori da `tokens.ts` (controllo già esistente).

## Fuori perimetro
- Bottone «Riprova» negli stati d'errore (oggi il testo dice «Riprova»: si ricarica la pagina).
- Ritardo anti-sfarfallio del `LoadingState`, scheletri (skeleton) al posto dello spinner.
- Offline sul web; nuove note di sync su Android oltre a quelle che ci sono.
- Preferenza del tema dentro l'app; ritocchi ai token scuri del giro 055.
- Server: nessuna modifica. Nessuna dipendenza nuova.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni»; set di icone
  come dipendenza; accesso con Google o Apple, iPhone, Play Store; verifica email e recupero
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-056-screen-states.spec.ts` | A0–A7 sopra, con la fake API del giro 052; elementi per ruolo ed etichetta |

Nessun test di accettazione del server: la fetta non tocca l'API.

## Porte
- Doppio senso previste: nuovo componente del kit `LoadingState`; chiavi i18n nuove; `index.tsx`
  riscritto sul kit; nuovo stato vuoto e d'errore di `/me`.
- Senso unico: nessuna. `ActivityIndicator` è di React Native; nessun pacchetto nuovo.

## Rischi di concorrenza
Nessuna scrittura nuova. Rischio: un `LoadingState` che resta a schermo se una delle richieste
parallele fallisce o se il componente si smonta prima (il flag `alive` c'è già): A3 prova che
dopo l'errore lo `status` sparisce. Su `/family` il caricamento della schermata e quello della
sezione task sono separati: non devono comparire due `status` insieme.

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

## Critica ricevuta e cosa cambia
(dopo il critico)
