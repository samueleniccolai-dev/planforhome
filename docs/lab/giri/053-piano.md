---
giro: 053
traguardo: T15
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-26T04:38:29Z
ricerca: sì
accettazione:
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
  (`flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: space.sm` ≥ 8 dp, V1). Nessun colore
  letterale. Test Jest: ruolo `listitem`, azioni presenti solo se passate.
  Una voce di galleria in `app/src/task/TaskListGallery.tsx` (`/gallery?set=list`): una
  `ListRow` con una `CheckRow` spuntata «Latte» e una con testo `struck` «Sale» e «tolta da
  Luca» (chiavi `gallery.list.*` nuove, it/en).
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
    focus passa da `innerRef`; `disabled` come oggi);
  - ogni voce tolta è una `ListRow`: testo con `Text struck`, «tolta da {name}» in `meta`, nelle
    `actions` «Ripristina «{item}»» e, se `canRemoveStruck`, «Togli «{item}»»;
  - «Nuova voce» = `TextField` del kit (etichetta visibile sopra, nome accessibile invariato),
    con `onSubmitEditing`, `submitBehavior="submit"`, `blurOnSubmit={false}` e `innerRef`;
  - «Togli le spuntate» = `Button` variante `secondary`;
  - avvisi: `notice` con `InlineNotice` (`role="alert"`, `tone="notice"`; `list.forbidden` e
    `list.failed` con `tone="danger"`); errore di caricamento (`problem`) con `InlineNotice
    tone="danger"`; «In attesa della rete…» con `InlineNotice role="status"`; «Nessuna voce.»
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
- [ ] D2 Voce spuntata distinta non solo dal colore: in «Spuntate», `checkbox` «Zucchero» con
      `aria-checked="true"`; in «Da prendere» `checkbox` «Uova» e «Farina» non spuntati; la
      riga di «Zucchero» contiene un elemento disegnato in più rispetto a «Uova» dentro la
      casella (il segno di spunta), misurato nel DOM della `checkbox` (numero di discendenti
      visibili con area > 0).
- [ ] D3 Voce tolta distinta non solo dal colore: in «Voci tolte», il testo «Sale» ha
      `text-decoration-line` calcolato `line-through`, la riga mostra «tolta da Luca» e i
      `button` «Ripristina «Sale»» e «Togli «Sale»»; «Uova» in «Da prendere» **non** ha
      `line-through`.
- [ ] D4 Bersagli: ogni `checkbox` e ogni `button` della schermata è alto ≥ 48 px, a `fs` 1 e
      2; tra due bottoni della stessa riga ci sono ≥ 8 px (V1).
- [ ] D5 «Nuova voce» ha un'etichetta visibile «Nuova voce» (testo sopra il campo) e il
      `textbox` con lo stesso nome; Invio con «Pane» → un solo `POST …/items` e il campo resta
      vuoto e con il focus (come 019 L2).
- [ ] D6 Spunta da kit: un clic sul **testo** «Uova» (la riga intera è la `checkbox`) manda un
      `PUT …/items/<id>/check` con `checked: true` e «Uova» passa in «Spuntate».
- [ ] V1 Screenshot Playwright di `/list?family=<Mamma>&task=<NONNA_ID>` (Anna): viewport
      390×844 e 1280×800 × `fs` 1 e 2 → 4 file
      `app/e2e-screenshots/t15-list-<larghezza>-fs<n>.png`, non vuoti; titolo `heading` 1 alto
      24 × `fs` px di carattere; nessun traboccamento orizzontale e nessun testo tagliato.
- [ ] K1 `cd app && npm test -- src/ui src/shopping` → verdi i test Jest nuovi di `ListRow` e di
      `Text struck` e quelli vecchi di `src/shopping` (compreso `ShoppingListAndroid.test.tsx`).
- [ ] R1 `cd app && npx expo export --platform web && npx playwright test` → tutte le suite
      vecchie verdi, in particolare `giro-019-shopping`, `giro-020-reorder`, `giro-021-focus` e
      `e2e/giro-020-reorder-retry.spec.ts`, **senza toccarle**.
- [ ] Q1 `cd app && npx tsc --noEmit && npx eslint . && npm test` → verdi.

## Fuori perimetro
- Qualsiasi modifica al server, alle migrazioni, ai permessi P17–P18, alla logica di
  `src/shopping/logic.ts`, `offline.ts`, `queued.ts`, `useOfflineList.ts`.
- Trascinare per ordinare (resta «Sposta su/giù»); undo della spunta; `LoadingState` del kit
  (V8 completo: «Idee per dopo»).
- `AppHeader` e `FamilySwitch` nella lista della spesa.
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
| `app/e2e/acceptance/giro-053-shopping-kit.spec.ts` | S1 statico; D1–D6 con Anna (e Giulia per D5) sulla fake API 019, per ruolo ed etichetta; V1 screenshot 2 viewport × 2 `fs` |

Niente test server: il server non cambia.

## Porte
- Doppio senso previste: componente nuovo del kit `ListRow`; prop `struck` di `Text`; titoli di
  sezione visibili (prima solo nome accessibile); `TextField` con etichetta visibile al posto del
  campo senza etichetta; bottoni in variante `text`; `?fs=` su `/list`; voce di galleria.
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
  (idempotente lato server). D6 prova un solo `PUT` per un clic.
- **Invio nel `TextField`**: su react-native-web `blurOnSubmit={false}` deve arrivare al
  `TextInput` interno; D5 e 019 L2 lo provano.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 300 aggiunte; file di produzione ≤ 7
(`ui/Text.tsx`, `ui/ListRow.tsx`, `shopping/ShoppingList.tsx`, `app/list.tsx`,
`task/TaskListGallery.tsx`, `i18n/it.json`, `i18n/en.json`) più i test Jest. Deve stare in una
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

## Critica ricevuta e cosa cambia
(dopo il critico)
