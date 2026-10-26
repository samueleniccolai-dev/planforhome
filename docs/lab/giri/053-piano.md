---
giro: 053
traguardo: T15
traguardi_extra: []
tipo: costruzione
fase: costruzione
inizio: 2026-10-26T04:38:29Z
ricerca: sì
accettazione: 7289dd84adba88b6898e8f74e9b512f67562a19b
ripreso: no
---
# Piano del giro 053 — T15 parte 2: la lista della spesa dal kit, voci spuntate e tolte distinte non solo dal colore

## Fetta e traguardo
T15 (UI-4: famiglia, profilo, spesa e lingua del web), parte 2 di 2, giro `costruzione`: la
parte 1 (giro 052, PR #76 mergiata) ha fatto la lingua dell'account, `LinkRow` e
`family`/`families`/`me` dal kit. Resta `ShoppingList`, che da sola sta in una sessione. Con
questa fetta il «Fatto quando» di T15 è tutto coperto; il giro dopo è la `verifica-produzione`.
Fonti: SPEC §2.2.7 (lista della spesa: spuntare, togliere/rigare, ripristinare, ordinare),
§2.2.9 e §12 (testi solo da chiavi), §5 P17–P18 (chi toglie e chi rigata: invariati, li decide
il server); DESIGN §1, §2 (V1, V3, V4, V5, V7, V8, V10), §3, §5; giro 047 (F12) e giro 052 (S1,
V1): il controllo statico «fatto dal kit» e gli screenshot.

Cosa si costruisce:
- **Kit, `Text` con `struck`** (`app/src/ui/Text.tsx`): prop `struck?: boolean` →
  `textDecorationLine: 'line-through'`. È il segno della voce rigata che non dipende dal colore.
  Test Jest in `app/src/ui/__tests__/`.
- **Kit, `ListRow`** (`app/src/ui/ListRow.tsx`, nuovo): una `View` con `role="listitem"`,
  `children` in colonna (`gap: space.xs`, `paddingVertical: space.sm`, bordo inferiore
  `colors.border`) e, se c'è, `actions?: ReactNode` in una riga che va a capo
  (`flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: space.sm` ≥ 8 dp, V1). **Ogni azione sta
  in un contenitore con `maxWidth: '100%'` e `flexShrink: 1`**: il `Button` del kit ha
  `paddingHorizontal: space.xxl` e da solo non si restringe, così a `fs` 2 su 390 px
  «Sposta giù «Farina»» (~428 px) e «Ripristina «Sale»» (~390 px) supererebbero i 358 px utili;
  con il vincolo il testo va a capo dentro il bottone. Nessun colore letterale. Test Jest:
  ruolo `listitem`, azioni presenti solo se passate, **ogni azione avvolta in un contenitore con
  `maxWidth: '100%'` e `flexShrink: 1`**.
- **`app/src/shopping/ShoppingList.tsx` dal kit**, logica invariata (`write`, `sendOrder`,
  `move`, `fetchItems`, offline, guardie di focus):
  - `Screen` al posto di `ScrollView`; titolo `Text variant="title" heading={1}` (titolo del
    task);
  - ogni sezione ha un titolo **visibile** `SectionHeader` (heading 2) «Da prendere»,
    «Spuntate», «Voci tolte», seguito dalla `View role="list" aria-label=…` di oggi (nome
    accessibile invariato; il titolo sta fuori dalla lista, così i `listitem` restano solo voci);
  - ogni voce viva è una `ListRow`: la `CheckRow` del kit (ruolo `checkbox`, nome = testo della
    voce, `aria-checked`; il segno di spunta disegnato, non solo il colore); sotto, «aggiunta da
    {name}» in `Text variant="meta" tone="secondary"`; nelle `actions` i `Button` del kit
    variante `text` «Togli «{item}»», «Sposta su «{item}»», «Sposta giù «{item}»» (il ref per il
    focus passa da `innerRef`; `disabled` come oggi: «Sposta su» della prima voce e «Sposta giù»
    dell'ultima restano visibili e disabilitati, quindi rigati dal `Button` del kit — non si
    nascondono, per non toccare il focus del giro 021); nome accessibile con `aria-label` come
    oggi (niente `aria-labelledby` in questo giro);
  - ogni voce tolta è una `ListRow`: testo con `Text struck`, «tolta da {name}» in `meta`, nelle
    `actions` «Ripristina «{item}»» e, se `canRemoveStruck`, «Togli «{item}»»;
  - «Nuova voce» = `TextField` del kit (etichetta visibile sopra, nome accessibile invariato),
    con `onSubmitEditing`, `submitBehavior="submit"`, `blurOnSubmit={false}` e `innerRef`;
  - «Togli le spuntate» = `Button` variante `secondary`;
  - avvisi: `notice` con `InlineNotice` (`role="alert"`, `tone="notice"`; `list.forbidden` e
    `list.failed` con `tone="danger"`); errore di caricamento (`shownProblem`) con `Screen` +
    `InlineNotice tone="danger"`, dentro il provider di `fs`; «In attesa della rete…» con `InlineNotice role="status"`; «Nessuna voce.»
    in `Text variant="meta"`; il caricamento resta `return null` (come 052, `LoadingState` non è
    nel kit).
- **`app/app/list.tsx`**: accetta `?fs=` come `family.tsx` (`FontScaleContext` +
  `parseFontScale`).
- **Statico, per** `app/src/shopping/ShoppingList.tsx` e `app/app/list.tsx`: nessun
  `StyleSheet`, nessun `style=`, nessun `Text`/`Pressable`/`ScrollView`/`TextInput` importato da
  `react-native`, nessun import da `@/ui/tokens`, nessun colore `#…`. `ListRow.tsx` senza `#…`.

## Fatto quando — controlli eseguibili
Dati demo (inventati): la fake API del giro 019, `app/e2e/acceptance/giro-019-fake-api.ts`,
importata così com'è (nessuna modifica). Già contiene:
- **«Spesa per la nonna»** (`NONNA_ID`) in «Famiglia Mamma», creata da Marco (non membro di
  Mamma): «Uova» (Marco) e «Farina» (Luca) da prendere; «Zucchero» (Pietro) spuntata; «Sale»
  (Anna) tolta da Luca;
- **«Lista della spesa»** (`LISTA_ID`) in «Famiglia Principale», creata da Giulia: Latte, Pane,
  Mele, Biscotti (Biscotti aggiunta da Marco);
- **Anna**, gestore di Mamma: vede «Togli le spuntate» e «Togli «Sale»» sulla voce tolta.
Browser `it-IT`, fuso `Europe/Rome`, orologio fisso `MONDAY` della fake API.

- [ ] S1 Statico (Playwright, lettura dei sorgenti come 052 S1): `src/shopping/ShoppingList.tsx`
      e `app/list.tsx` senza `StyleSheet`, `style=`, `Text`/`Pressable`/`ScrollView`/`TextInput`
      da `react-native`, import da `@/ui/tokens`, `#[0-9a-fA-F]{3,8}`; `src/ui/ListRow.tsx`
      esiste e non ha `#…`.
- [ ] D1 Anna su `/list?family=<Mamma>&task=<NONNA_ID>`: tre titoli visibili `heading` livello
      2 «Da prendere», «Spuntate», «Voci tolte», e tre `list` con gli stessi nomi.
      Giulia su `/list?family=<Principale>&task=<LISTA_ID>` (quattro voci da prendere, nessuna
      spuntata o tolta): `heading` «Da prendere» visibile, nessun `heading` «Spuntate» né «Voci
      tolte». Giulia su `/list?family=<Mamma>&task=<SABATO_ID>` (solo «Pane» spuntata): `heading`
      «Da prendere» con «Nessuna voce.» nella `list` «Da prendere», `heading` «Spuntate», nessun
      `heading` «Voci tolte».
- [ ] D2 Voce spuntata distinta non solo dal colore: in «Spuntate», `checkbox` «Zucchero» con
      `aria-checked="true"`; in «Da prendere» `checkbox` «Uova» e «Farina» non spuntati; la
      riga di «Zucchero» contiene un elemento disegnato in più rispetto a «Uova» dentro la
      casella (il segno di spunta), misurato nel DOM della `checkbox` (numero di discendenti
      visibili con area > 0).
- [ ] D3 Voce tolta distinta non solo dal colore: in «Voci tolte», il testo «Sale» (`exact`) ha
      `text-decoration-line` calcolato `line-through`, la riga mostra «tolta da Luca» con un
      carattere più piccolo di «Sale» (`meta` 16 contro `body` 18) e i `button` «Ripristina
      «Sale»» e «Togli «Sale»»; il testo «Uova» (`exact`) **dentro la `checkbox` «Uova»** non ha
      `line-through` (si misura nella casella, non nella riga: i bottoni disabilitati della
      riga sono rigati dal kit).
- [ ] D4 Bersagli: ogni `checkbox` e ogni `button` della schermata è alto ≥ 48 px, a `fs` 1 e
      2 (a `fs` 2 si aspetta prima, con `expect.poll`, che il titolo sia a 48 px); i `button`
      «Togli «Uova»», «Sposta su «Uova»», «Sposta giù «Uova»» a due a due non si sovrappongono
      e distano ≥ 8 px su almeno un asse (V1).
- [ ] D5 «Nuova voce» ha un'etichetta visibile (`getByText('Nuova voce', { exact: true })`)
      sopra il `textbox` con lo stesso nome; Invio con «Burro» → un solo `POST …/items` con
      `text: "Burro"`, «Burro» compare in «Da prendere», il campo resta vuoto e con il focus.
- [ ] D6 Spunta da kit: la `checkbox` «Uova» contiene il testo «Uova» (`exact`, la riga intera è
      la `checkbox`); un clic su quel **testo** manda un `PUT …/items/<id>/checked` con
      `checked: true` e «Uova» passa in «Spuntate».
- [ ] D7 Doppio tocco: un doppio clic sul testo «Uova» → al massimo 2 `PUT …/items/<id>/checked`,
      tutti con `checked: true`; «Uova» compare una volta sola in «Spuntate» e non è più in «Da
      prendere».
- [ ] V1 Screenshot Playwright di `/list?family=<Mamma>&task=<NONNA_ID>` (Anna): viewport
      390×844 e 1280×800 × `fs` 1 e 2 → 4 file
      `app/e2e-screenshots/t15-list-<larghezza>-fs<n>.png`, non vuoti; titolo `heading` 1 alto
      24 × `fs` px di carattere (atteso con `expect.poll` prima di misurare); nessun
      traboccamento orizzontale e nessun testo tagliato.
- [ ] K1 `cd app && npm test -- src/ui src/shopping` → verdi i test Jest nuovi di `ListRow`
      (compreso il vincolo `maxWidth: '100%'` + `flexShrink: 1` sulle azioni) e di `Text struck` e quelli vecchi di `src/shopping` (compreso `ShoppingListAndroid.test.tsx`).
- [ ] R1 `cd app && npx expo export --platform web && npx playwright test` → tutte le suite
      vecchie verdi, in particolare `giro-019-shopping`, `giro-020-reorder`, `giro-021-focus` e
      `e2e/giro-020-reorder-retry.spec.ts`, e `giro-046-list-kit` (B10), **senza toccarle**.
- [ ] Q1 `cd app && npx tsc --noEmit && npx eslint . && npm test` → verdi.

## Fuori perimetro
- Qualsiasi modifica al server, alle migrazioni, ai permessi P17–P18, alla logica di
  `src/shopping/logic.ts`, `offline.ts`, `queued.ts`, `useOfflineList.ts`.
- Trascinare per ordinare (resta «Sposta su/giù»); undo della spunta; `LoadingState` del kit
  (V8 completo: «Idee per dopo»).
- `AppHeader` e `FamilySwitch` nella lista della spesa.
- La voce di galleria `/gallery?set=list` con `ListRow` (rinviata: nessun controllo la prova e
  rischia B10 del giro 046).
- Nascondere «Sposta su/giù» sulla prima/ultima voce; `aria-labelledby` sulle liste.
- Modificare i test di accettazione vecchi (019, 020, 021) o la fake API 019: se una suite
  vecchia diventa rossa, è un difetto del costruttore, non del test.
- Cambiare la lingua dal profilo (endpoint nuovo), dubbio 052 sul 401 (lingua su `/login`).
- Prove sul telefono (APK, TalkBack, fontScale di sistema): le fa il giro di verifica o l'umano.
- Il giro `verifica-produzione` di T15: è il prossimo giro.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni» a griglia;
  set di icone come dipendenza; accesso con Google o Apple, iPhone, Play Store; verifica email e
  recupero password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-053-shopping-kit.spec.ts` | S1 statico; D1–D7 con Anna (e Giulia per D1) sulla fake API 019, per ruolo ed etichetta; V1 screenshot 2 viewport × 2 `fs` |

Niente test server: il server non cambia.

## Porte
- Doppio senso previste: componente nuovo del kit `ListRow`; prop `struck` di `Text`; titoli di
  sezione visibili (prima solo nome accessibile); `TextField` con etichetta visibile al posto del
  campo senza etichetta; bottoni in variante `text`; `?fs=` su `/list`.
- Senso unico: nessuna (nessuna dipendenza nuova, nessuno schema, server invariato, test vecchi
  invariati).

## Rischi di concorrenza
- La logica di scrittura (un solo riordino in volo, `mutation_id` per ogni scrittura, voce
  cambiata nel frattempo → ricarica e avviso) **non cambia**: le suite 019–021 e
  `giro-020-reorder-retry` la provano già (R1).
- **Focus dopo «Sposta»**: il ref del bottone passa da `Pressable` a `Button.innerRef`; se il
  ref arriva al wrapper sbagliato il focus si perde quando React sposta i nodi (021 lo prova).
- **Doppio tocco sulla riga intera** (`CheckRow`): la riga più grande rende più facile un doppio
  invio; ogni tocco è una mutazione con il suo `mutation_id` e lo stato `checked` voluto
  (idempotente lato server). D6 prova un clic; D7 prova il doppio clic: al massimo 2 `PUT`,
  tutti `checked: true`, «Uova» una sola volta in «Spuntate».
- **Invio nel `TextField`**: su react-native-web `blurOnSubmit={false}` deve arrivare al
  `TextInput` interno; D5 e 019 L2 lo provano.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 250 aggiunte; file di produzione ≤ 4
(`ui/Text.tsx`, `ui/ListRow.tsx`, `shopping/ShoppingList.tsx`, `app/list.tsx`) più i test Jest.
Nessuna chiave i18n nuova: i testi ci sono già (`list.*`). Deve stare in una
sessione.

## Domande per il ricercatore (al massimo 3)
1. react-native-web 0.21: `textDecorationLine: 'line-through'` arriva come
   `text-decoration-line` calcolato sullo span del testo? E su Android TalkBack legge il testo
   rigato in modo diverso (o serve dirlo nel testo, come «tolta da…»)?
2. Liste della spesa nelle app concorrenti (Bring!, Google Keep, Todoist, OurGroceries): come
   distinguono spuntate e tolte senza colore (sezione separata, rigatura, spunta, opacità)?
3. WAI-ARIA: un titolo visibile `h2` subito prima di una `role="list"` con `aria-label` uguale
   al titolo è ridondante per i lettori di schermo? Meglio `aria-labelledby` verso il titolo?

## Idee per dopo
- `LoadingState` del kit e stato di caricamento della lista (V8).
- Undo della spunta nell'`InlineNotice` (come «fatto» nella `TaskCard`, DESIGN §6.1).
- Voce di galleria `/gallery?set=list` con `ListRow` (spuntata e tolta), con un controllo suo.
- `aria-labelledby` dalla `list` al titolo di sezione (ricerca, domanda 3).

## Critica ricevuta e cosa cambia
| Punto | Esito | Motivo |
|---|---|---|
| DA CORREGGERE 1: `Button` non si restringe, V1 rosso a `fs` 2 su 390 px | Accolto | `ListRow` avvolge ogni azione con `maxWidth: '100%'` + `flexShrink: 1`; test Jest in K1 |
| DA CORREGGERE 2: bottone disabilitato rigato, D3 ambiguo | Accolto, opzione (a) | D3 misura il testo dentro la `checkbox` «Uova»; nascondere i bottoni toccherebbe il focus del 021 |
| PIÙ SEMPLICE: voce di galleria | Accolto: rinviata | Nessun controllo la prova, rischia B10 del 046; «Idee per dopo». Budget a 4 file |
| CONCORRENZA: doppio clic su «Uova» | Accolto | Nuova riga D7 |
| TEST: D1 con Giulia su `LISTA_ID` | Accolto in parte | `LISTA_ID` ha quattro voci da prendere, quindi «Nessuna voce.» lì non compare: su `LISTA_ID` si prova l'assenza di «Spuntate»/«Voci tolte»; «Nessuna voce.» sotto «Da prendere» si prova su `SABATO_ID` (solo «Pane» spuntata), dove Giulia è membro |
| TEST: D4 distanza su almeno un asse, nessuna sovrapposizione | Accolto | |
| TEST: D5 parola nuova, etichetta con `getByText` esatto | Accolto | «Burro» |
| TEST: `expect.poll` sul carattere del titolo a `fs` 2 | Accolto | V1 e D4 |
| TEST: «Sale» con `exact` | Accolto | Anche «Uova» |
| Aggiunta mia: D3 «tolta da Luca» più piccola di «Sale» | — | Con lo schermo di oggi D3 sarebbe già verde; il `meta` del kit lo distingue |
| D6: percorso `…/check` | Corretto | La fake API 019 usa `…/checked` |
| FACOLTATIVI: `aria-label`, `shownProblem` con `Screen` + `InlineNotice` nel provider `fs` | Accolti | Chiavi `gallery.list.*`: non servono più (galleria rinviata) |
