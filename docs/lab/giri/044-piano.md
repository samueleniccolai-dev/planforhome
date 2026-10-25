---
giro: 044
traguardo: T12
traguardi_extra: []
tipo: costruzione
fase: chiusura
inizio: 2026-10-25T06:45:20Z
ricerca: sì
accettazione: f93edf2
ripreso: no
---
# Piano del giro 044 — fondamenta del kit UI (token, Text, Button, Screen, InlineNotice, TextField, galleria, login)

## Fetta e traguardo
T12 intero (UI-1), tipo `costruzione`: T11 è passato, T12 è il primo traguardo della fase UI e
non ha integrazioni; ci sta in una sessione. Fonti: SPEC §12; DESIGN §2 (V1–V10), §3 (token,
regole di implementazione), §5 (kit e galleria), §7; PIANO-UI §4 (UI-1) e §5.

Cosa si costruisce:
- `app/src/ui/tokens.ts`: tutti i valori di DESIGN §3.1 (colori, tema chiaro), §3.2 (tipografia),
  §3.3 (space, radius, size, elevazione). È l'unico file dell'app con colori letterali.
- Tema: oggetto `lightTheme` passato con un Context (`ThemeProvider` in `app/_layout.tsx`),
  strutture statiche in `StyleSheet` (DESIGN §3, «Tema»). Solo il tema chiaro. Tema e
  `FontScaleContext` stanno nello stesso file `app/src/ui/theme.tsx`.
- Kit in `app/src/ui/`: `Text` (varianti `title`, `section`, `body`, `bodyStrong`, `meta`,
  `caption`; tono `default`/`secondary`/`danger`/`success`; prop `heading?: 1 | 2` che dà
  `role="heading"` e `aria-level`: la variante da sola non fa un heading), `Button` (varianti `primary`,
  `secondary`, `destructive`, `text`; stati normale, `disabled`, pressed), `Screen` (safe area,
  margine 16, scroll), `InlineNotice` (toni `notice`, `danger`, `success`; `role="alert"`),
  `TextField` (etichetta visibile sopra, errore sotto, `aria-invalid` con errore). L'etichetta è
  un `Text` con `id`, il campo la usa con `aria-labelledby` (niente `aria-label` insieme: ricerca);
  l'errore **non** ha `role="alert"` (è un testo statico sotto il campo; gli `alert` sono solo gli
  `InlineNotice`); `aria-describedby` verso l'errore è facoltativo. `TextField`
  non è nell'elenco di T12 ma serve perché `login.tsx` sia «composta solo dal kit» (è in DESIGN §5).
- Accessibilità con `role` + `aria-*` piatte (DESIGN §3): `Button` → `<button>` con
  `aria-label` e `disabled` (RNW mette `aria-disabled` e `disabled` nativo). `Button` non chiama
  `onPress` se `disabled`: la regola sta in una funzione pura `guardPress` del kit, provata in
  Jest (`Button.test.ts`), perché Playwright non può cliccare un `<button disabled>`.
- Moltiplicatore di prova del font: `FontScaleContext` (valore 1 di default); solo
  `app/app/gallery.tsx` lo imposta dal parametro `?fs=` (valori ammessi 1, 1.5, 2; altro → 1).
  **Rendering statico** (`app.json` → `web.output: "static"`): `/gallery` è prerenderizzata da
  `expo export`, dove `__DEV__` è falso, `window` non c'è e la query manca. Quindi `fs` e il gate
  si leggono con `useSyncExternalStore` come `useT` in `app/src/i18n/index.ts`: valore lato server
  `fs = 1` e gate «sconosciuto» (`null`); sul client `fs` da `window.location.search` e il gate da
  `isGalleryEnabled`. Con gate `null` la rotta non rende nulla (né galleria né `Redirect`), con
  `false` fa `Redirect` a `/`, con `true` la galleria. Così l'HTML statico non contiene la
  galleria e dopo l'idratazione React applica davvero i 36px.
  `Text` e `TextField` moltiplicano `fontSize` e `lineHeight`; layout con `minHeight`, mai altezze
  fisse sul testo, niente `numberOfLines` sui testi necessari.
- Galleria `app/app/gallery.tsx` (dati finti sotto): una sezione per componente, ogni componente
  in ogni stato; i bottoni uno sotto l'altro (colonna, spazio ≥ 8). Raggiungibile solo in
  sviluppo: `isGalleryEnabled({ dev, os, host })` in `app/src/ui/gallery.ts`, funzione pura, è
  vera se `dev` oppure se `os === 'web'` e `host` è `localhost` o `127.0.0.1` (la CI fa
  Playwright sul bundle di produzione servito in locale); falsa su Android senza `__DEV__` e su
  ogni altro host.
- `app/app/login.tsx` riscritta solo con il kit: nessun import da `react-native`, nessuno
  `StyleSheet`; l'errore di accesso è un `InlineNotice` `danger`; «Accedi» è `Button primary`
  disabilitato mentre è occupato (niente doppio login).
- Colori letterali rimossi da tutto `app/app` e `app/src`: nei file non ancora migrati
  (`tasks.tsx`, `me.tsx`, `TasksSection.tsx`, `NewTaskForm.tsx`, `ForwardDialog.tsx`,
  `ShoppingList.tsx`) si sostituisce solo il valore con il token più vicino
  (`#888`→`borderStrong`, `#ccc`→`border`, `#1f5fbf`→`accent`, `#fff`→`onAccent`,
  `#b00020`→`danger`, `#cfe0ff`→`accentTonal`), senza ridisegnare le schermate (lo fa T13+).
  Eccezione: in `ForwardDialog.tsx` lo stato `chosen` (`#0b3a80`) diventa `accentTonal` con il
  testo in `onAccentTonal`, perché altrimenti la famiglia scelta si distinguerebbe dal bottone
  normale (`accent`) per nulla; resta comunque `aria-checked`.
- Test Jest del costruttore in `app/src/ui/__tests__/`: `no-literal-colors.test.ts` (scansione
  di `app/app` e `app/src`, esclusi `tokens.ts`, le cartelle `__tests__` e i file `*.test.ts(x)`:
  la stessa regola di A2), `gallery.test.ts` (gate), `tokens.test.ts` (valori di §3.1–§3.3, può
  contenere hex), `Button.test.ts` (`guardPress`: con `disabled` `onPress` non parte).

### Dati finti della galleria (inventati, da SPEC Appendice A; testi con chiavi i18n `gallery.*` it/en)
| Elemento | Italiano | Inglese |
|---|---|---|
| Titolo della schermata (`Text title`, heading 1) | «Galleria del kit» | «Kit gallery» |
| Intestazioni di sezione (heading 2) | «Testo», «Bottoni», «Campi», «Avvisi» | «Text», «Buttons», «Fields», «Notices» |
| Testi d'esempio (una riga per variante, nessuna è heading) | «title · Prenotare il pranzo di Natale», «section · …», «body · …», «bodyStrong · …», «meta · …», «caption · …» | «title · Book the Christmas lunch», … |
| Testo lungo (per il taglio a 2.0) | «Rinnovare la carta d'identità di Franco prima della scadenza fra dieci giorni» | «Renew Franco's identity card before it expires in ten days» |
| Bottoni (attivi) | «Aggiungi» (primary), «Prendi» (secondary), «Elimina» (destructive), «Annulla» (text) | «Add», «Take», «Delete», «Cancel» |
| Bottoni (disabilitati, stessa variante) | «Aggiungi (disattivato)», «Prendi (disattivato)», «Elimina (disattivato)», «Annulla (disattivato)» | «Add (disabled)», «Take (disabled)», «Delete (disabled)», «Cancel (disabled)» |
| Bottone di prova funzione | «Prova il bottone» → mostra il testo «Premuto 1 volta», «Premuto 2 volte» | «Try the button» → «Pressed 1 time», «Pressed 2 times» |
| Campo vuoto | etichetta «Titolo del task» | «Task title» |
| Campo con errore | etichetta «Email», valore `nonna.rosa@example`, errore «Indirizzo email non valido.» | «Email», «Invalid email address.» |
| Avvisi | notice «Già preso da Giulia.»; danger «Accesso non riuscito. Riprova.»; success «Fatto: Mettere fuori la carta.» | «Already taken by Giulia.»; «Sign-in failed. Try again.»; «Done: Put the paper out.» |

## Fatto quando — controlli eseguibili
- [ ] `app/e2e/acceptance/giro-044-kit.spec.ts` → verde (righe A1–A9 sotto).
- [ ] A1 `app/src/ui/tokens.ts` esiste e contiene tutti i 24 hex di DESIGN §3.1 (letti dal
      documento, compresi gli 8 Okabe-Ito) → nessuno mancante.
- [ ] A2 nessun `#[0-9a-fA-F]{3,8}` in `app/app/**` e `app/src/**` (`.ts`, `.tsx`) fuori da
      `app/src/ui/tokens.ts`, dalle cartelle `__tests__` e dai `*.test.ts(x)` → zero occorrenze;
      lo stesso controlla il Jest `cd app && npm test -- src/ui` → verde.
- [ ] A3 `/gallery` (it e en) → un solo heading 1 «Galleria del kit»/«Kit gallery», i 4 heading 2
      delle sezioni, i 6 testi d'esempio e il testo lungo; 9 `button` in tutto, trovati per nome;
      i 4 attivi abilitati, i 4 disattivati `toBeDisabled()` con `aria-disabled="true"` (nessun
      click sui disattivati: il blocco di `onPress` è in Jest); «Prova il bottone» → «Premuto 1
      volta»; esattamente 3 `alert` (i 3 avvisi; l'errore del campo non è un alert); 2 `textbox`
      trovati per etichetta, etichette visibili, quello con errore ha `aria-invalid="true"`, il
      valore `nonna.rosa@example` e l'errore visibile.
- [ ] A4 token applicati in galleria: dimensione/interlinea/peso delle 6 varianti come §3.2
      (title 24/30/700, section 14/18/700, body 18/25/400, bodyStrong 18/25/600, meta 16/21/400,
      caption 14/19/400); colore del corpo `#14181D`; primario «Aggiungi» su `#1849A9`, etichetta
      bianca ≥ 18px, alto ≥ 56px; gli altri bottoni ≥ 48px; bottoni in colonna con spazio ≥ 8px.
- [ ] A5 `?fs=2` in galleria a viewport 390 → dopo l'idratazione `body` 36px/50px, `title` 48px;
      nessun overflow orizzontale della pagina; nessun nodo di testo fuori dalla viewport o
      tagliato da un antenato con overflow nascosto, nessuno scroll orizzontale interno; testo
      lungo visibile; «Aggiungi» ≥ 56px; «Prova il bottone» due volte → «Premuto 2 volte».
      `?fs=1.5` → 27px; `?fs=3` (non ammesso) → 18px.
- [ ] A6 `?fs=2` fuori dalla galleria (`/login?fs=2`) → titolo 24px e campo Email 18px, cioè i
      token a fs=1 (controllo negativo: la prova che il moltiplicatore funziona è A5).
- [ ] A7 screenshot `e2e-screenshots/gallery-{390,1280}-fs{1,2}.png` (4 file, pagina intera).
- [ ] A8 `app/app/login.tsx` non importa da `react-native` né usa `StyleSheet` (scansione del
      file); `/login`: etichette «Email» e «Password» visibili e campi trovati con
      `getByLabel(…, { exact: true })` (`aria-labelledby`), «Accedi» alto ≥ 56px con etichetta
      ≥ 18px, disabilitato mentre il login è in attesa, poi errore 401 come `alert` con il testo
      di giro 004 e una sola richiesta di login.
- [ ] A9 gate (Playwright): l'HTML statico di `/gallery` non contiene i testi della galleria;
      `http://127.0.0.1:8081/gallery` apre la galleria; `http://127.0.0.2:8081/gallery` (stesso
      server, host non locale) finisce su `/`.
- [ ] A9 gate (Jest): `cd app && npm test -- gallery` → verde (`isGalleryEnabled` falso con
      `dev=false` e host `app.planforhome.com`, falso con `dev=false` e `os='android'`, vero con
      host `localhost` e `127.0.0.1`, vero con `dev=true`).
- [ ] `cd app && npm test -- Button` → verde (`guardPress` con `disabled` non chiama `onPress`).
- [ ] Regressione: `cd app && npx playwright test` tutto verde (giro 004 login compreso);
      `npm test` (compreso il test i18n delle chiavi it/en), `npx tsc --noEmit`, `npx eslint .` verdi.
- [ ] Il server non cambia: `git diff --stat origin/main -- server/` → vuoto.
- [ ] Prova sul telefono a fontScale di sistema 2.0 (galleria in build di sviluppo, login
      sull'APK): rimandata al giro `verifica-produzione` di T12 (PIANO-UI §5: la verità è Android).

## Fuori perimetro
- Gli altri componenti di DESIGN §5 (`AppHeader`, `FamilySwitcher`, `FilterTabs`,
  `SectionHeader`, `TaskCard`, `PersonBadge`, `FamilyTag`, `CriticalityBadge`, `DueLabel`,
  `RecurrenceLabel`, `CheckRow`/`RadioRow`, `Sheet`, `ConfirmDialog`, `EmptyState`,
  `LoadingState`): T13 e seguenti. `InlineNotice` con azione (undo): T13.
- Ridisegnare `index.tsx`, `tasks.tsx`, `me.tsx`, `families.tsx`, `family.tsx`, `list.tsx` e i
  componenti di `src/task`, `src/shopping`: qui solo la sostituzione dei letterali con i token.
- Tema scuro, `expo-system-ui` (T16/UI-5); set di icone (porta, DESIGN §8).
- Screenshot di confronto visivo (`toHaveScreenshot`): solo screenshot d'anteprima.
- Qualsiasi modifica al server, a `.github/`, a `app/package.json`.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni»; set di
  icone come dipendenza; accesso Google/Apple, iPhone, Play Store; verifica email e recupero
  password; sync in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-044-kit.spec.ts` | dato il sorgente, quando si scansiona `tokens.ts`, allora contiene gli hex di §3.1 (A1) |
| idem | dato il sorgente di `app/app` e `app/src`, quando si cercano `#…`, allora solo `tokens.ts` li ha (A2) |
| idem | dato `/gallery` in it-IT e en-US, quando si cercano ruoli ed etichette, allora nomi e `aria-disabled`/`aria-invalid` sono quelli dei dati finti (A3) |
| idem | dato `/gallery`, quando si leggono gli stili calcolati, allora tipografia e altezze rispettano i token (A4) |
| idem | dato `/gallery?fs=2` a 390px, quando si misura, allora corpo 36px, niente overflow né tagli, il bottone di prova funziona (A5) |
| idem | dato `/login?fs=2`, quando si misura, allora titolo 24px e campo 18px (A6) |
| idem | dati 390/1280 × fs 1/2, quando si apre la galleria, allora si salvano 4 screenshot (A7) |
| idem | dato `login.tsx`, quando si scansiona e si apre `/login` con API finta (401 ritardato), allora niente `react-native`, etichette visibili, bottone ≥ 56px e disabilitato in attesa, `alert` col testo, un solo login (A8) |
| idem | dato l'HTML statico e due host (127.0.0.1, 127.0.0.2), quando si apre `/gallery`, allora niente galleria nell'HTML, galleria sul primo, `/` sul secondo (A9) |

## Porte
- Doppio senso previste: gate della galleria con `__DEV__` o host locale (si cambia in una riga);
  gate e `fs` letti con `useSyncExternalStore` (resa server: niente galleria, fs=1);
  `chosen` di `ForwardDialog` su `accentTonal`;
  `TextField` aggiunto al kit già in T12; mappatura dei vecchi letterali sui token più vicini;
  `FontScaleContext` con valori ammessi 1/1.5/2; tema via Context con solo `lightTheme`.
- Senso unico: nessuna. Nessuna dipendenza nuova (V9): RN puro, `react-native-safe-area-context`
  è già in `package.json`. Nessuno schema, nessun segreto, nessuna integrazione.

## Rischi di concorrenza
Nessuno stato condiviso sul server: il giro è solo UI. Unico rischio: doppio tocco su «Accedi»
che manda due login; `Button` con `disabled` durante l'attesa deve bloccare `onPress` anche sul
web (`aria-disabled` da solo non basta). Si prova in A8 (bottone disabilitato durante l'attesa,
una sola richiesta), col test di giro 004 (che conta le richieste) e in Jest con `guardPress`.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 700; file toccati ≤ 24 (8 del kit in `app/src/ui`
con tema e `FontScaleContext` in un solo `theme.tsx`, 5 in `app/app`, 4 in `app/src/task` e
`app/src/shopping`, 2 dizionari, 4 test Jest, più il rapporto); una sessione.

## Domande per il ricercatore (al massimo 3)
1. react-native-web 0.21.4 e RN 0.88: con `Pressable role="button"` e `disabled`, esce
   `aria-disabled` nel DOM e il click è bloccato? Come dare a `TextInput` un'etichetta visibile
   restando trovabile con `getByLabel('Email', { exact: true })` senza doppioni (aria-label,
   `aria-labelledby`, `<label>`)? `aria-invalid` passa nel DOM?
2. `react-native-safe-area-context` 5.10 con expo-router 58: `SafeAreaProvider` è già montato da
   expo-router? Meglio `SafeAreaView` o `useSafeAreaInsets` dentro `Screen` (web e Android)?
3. Font scaling: in RN 0.88 un `fontSize` moltiplicato a mano si somma al fontScale di sistema
   su Android (il moltiplicatore va lasciato a 1 fuori dalla galleria)? E gli hex Okabe-Ito di
   DESIGN §3.1 sulla fonte primaria (punto [DA VERIFICARE] di DESIGN §8).

## Idee per dopo
- `InlineNotice` con azione e scadenza (undo di «fatto», T13).
- Test di contrasto automatico sui token (V5) quando arriva il tema scuro (T16).

## Critica ricevuta e cosa cambia
Accolti tutti i 5 «DA CORREGGERE» e le note minori:
1. Rendering statico: gate e `fs` con `useSyncExternalStore` (server: gate `null` → niente,
   fs 1); A5 aspetta i 36px dopo l'idratazione; A9 controlla che l'HTML statico non abbia la
   galleria.
2. Scansione: escluse da entrambe (A2 e `no-literal-colors.test.ts`) le cartelle `__tests__` e i
   `*.test.ts(x)`; A1 legge gli hex da `docs/DESIGN.md`, non da una lista copiata.
3. `ForwardDialog`: `chosen` su `accentTonal` con testo `onAccentTonal`.
4. Budget: tetto a 24 file, tema e `FontScaleContext` accorpati in `theme.tsx`.
5. Disattivati: solo `toBeDisabled()` e `aria-disabled`; il blocco di `onPress` in Jest
   (`guardPress`), il doppio login in A8 col bottone disabilitato durante l'attesa.
Note minori: l'errore di `TextField` non è un `alert` (A3 resta a 3); A6 ora confronta con i
valori dei token (24px, 18px) e il piano dice che la prova positiva è A5; `getByLabel` con
`aria-labelledby` è provato in A8 e nella regressione di giro 004; `aria-describedby` facoltativo,
non provato; caso Android (`os='android'`, `dev=false` → falso) aggiunto al Jest del gate.
Aggiunto da me: A9 Playwright con l'host `127.0.0.2` (stesso server, non locale), più forte del
solo Jest. Scartato: nulla.
