---
giro: 044
traguardo: T12
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-25T06:45:20Z
ricerca: sì
accettazione:
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
  strutture statiche in `StyleSheet` (DESIGN §3, «Tema»). Solo il tema chiaro.
- Kit in `app/src/ui/`: `Text` (varianti `title`, `section`, `body`, `bodyStrong`, `meta`,
  `caption`; tono `default`/`secondary`/`danger`/`success`), `Button` (varianti `primary`,
  `secondary`, `destructive`, `text`; stati normale, `disabled`, pressed), `Screen` (safe area,
  margine 16, scroll), `InlineNotice` (toni `notice`, `danger`, `success`; `role="alert"`),
  `TextField` (etichetta visibile sopra, errore sotto, `aria-invalid` con errore). `TextField`
  non è nell'elenco di T12 ma serve perché `login.tsx` sia «composta solo dal kit» (è in DESIGN §5).
- Accessibilità con `role` + `aria-*` piatte (DESIGN §3): `Button` → `<button>` con
  `aria-label` e `aria-disabled`; `Text` titolo → `role="heading"` con `aria-level`.
- Moltiplicatore di prova del font: `FontScaleContext` (valore 1 di default); solo
  `app/app/gallery.tsx` lo imposta dal parametro `?fs=` (valori ammessi 1, 1.5, 2; altro → 1).
  `Text` e `TextField` moltiplicano `fontSize` e `lineHeight`; layout con `minHeight`, mai altezze
  fisse sul testo, niente `numberOfLines` sui testi necessari.
- Galleria `app/app/gallery.tsx` (dati finti sotto): una sezione per componente, ogni componente
  in ogni stato. Raggiungibile solo in sviluppo: `isGalleryEnabled()` in `app/src/ui/gallery.ts`
  è vero se `__DEV__` oppure, sul web, se l'host è `localhost` o `127.0.0.1` (la CI fa Playwright
  sul bundle di produzione servito in locale); altrimenti la rotta fa `Redirect` a `/`.
- `app/app/login.tsx` riscritta solo con il kit: nessun import da `react-native`, nessuno
  `StyleSheet`; l'errore di accesso è un `InlineNotice` `danger`; «Accedi» è `Button primary`
  disabilitato mentre è occupato (niente doppio login).
- Colori letterali rimossi da tutto `app/app` e `app/src`: nei file non ancora migrati
  (`tasks.tsx`, `me.tsx`, `TasksSection.tsx`, `NewTaskForm.tsx`, `ForwardDialog.tsx`,
  `ShoppingList.tsx`) si sostituisce solo il valore con il token più vicino
  (`#888`→`borderStrong`, `#ccc`→`border`, `#1f5fbf`/`#0b3a80`→`accent`, `#fff`→`onAccent`,
  `#b00020`→`danger`, `#cfe0ff`→`accentTonal`), senza ridisegnare le schermate (lo fa T13+).
- Test Jest del costruttore: `app/src/ui/__tests__/no-literal-colors.test.ts` (scansione di
  `app/app` e `app/src`, solo `tokens.ts` escluso), `gallery.test.ts` (gate),
  `tokens.test.ts` (valori di §3.1–§3.3).

### Dati finti della galleria (inventati, da SPEC Appendice A; testi con chiavi i18n `gallery.*` it/en)
| Elemento | Italiano | Inglese |
|---|---|---|
| Titolo della schermata (`Text title`, heading 1) | «Galleria del kit» | «Kit gallery» |
| Intestazioni di sezione (heading 2) | «Testo», «Bottoni», «Campi», «Avvisi» | «Text», «Buttons», «Fields», «Notices» |
| Testi d'esempio (una riga per variante) | «Prenotare il pranzo di Natale» (title… caption, stesso testo) | «Book the Christmas lunch» |
| Testo lungo (per il taglio a 2.0) | «Rinnovare la carta d'identità di Franco prima della scadenza fra dieci giorni» | «Renew Franco's identity card before it expires in ten days» |
| Bottoni (attivi) | «Aggiungi» (primary), «Prendi» (secondary), «Elimina» (destructive), «Annulla» (text) | «Add», «Take», «Delete», «Cancel» |
| Bottoni (disabilitati, stessa variante) | «Aggiungi (disattivato)», «Prendi (disattivato)», «Elimina (disattivato)», «Annulla (disattivato)» | «Add (disabled)», «Take (disabled)», «Delete (disabled)», «Cancel (disabled)» |
| Bottone di prova funzione | «Prova il bottone» → mostra il testo «Premuto 1 volta», «Premuto 2 volte» | «Try the button» → «Pressed 1 time», «Pressed 2 times» |
| Campo vuoto | etichetta «Titolo del task» | «Task title» |
| Campo con errore | etichetta «Email», valore `nonna.rosa@example`, errore «Indirizzo email non valido.» | «Email», «Invalid email address.» |
| Avvisi | notice «Già preso da Giulia.»; danger «Accesso non riuscito. Riprova.»; success «Fatto: Mettere fuori la carta.» | «Already taken by Giulia.»; «Sign-in failed. Try again.»; «Done: Put the paper out.» |

## Fatto quando — controlli eseguibili
- [ ] `app/e2e/acceptance/giro-044-kit.spec.ts` → verde (righe A1–A9 sotto).
- [ ] A1 `app/src/ui/tokens.ts` contiene tutti gli hex di DESIGN §3.1 (compresi gli 8 Okabe-Ito)
      → nessuno mancante.
- [ ] A2 nessun `#[0-9a-fA-F]{3,8}` in `app/app/**` e `app/src/**` (`.ts`, `.tsx`) fuori da
      `app/src/ui/tokens.ts` → zero occorrenze; lo stesso controlla il Jest
      `cd app && npm test -- src/ui` → verde.
- [ ] A3 `/gallery` (it e en) → heading 1 «Galleria del kit»/«Kit gallery», le 4 sezioni, ogni
      bottone dei dati finti trovato per ruolo `button` e nome; i 4 disattivati hanno
      `aria-disabled="true"`, i 4 attivi no; 3 `alert` con i testi degli avvisi; 2 `textbox`
      per etichetta, quello con errore ha `aria-invalid="true"` e l'errore visibile.
- [ ] A4 token applicati in galleria: `Text body` 18px/25px, `title` 24px/30px, `meta` 16px;
      bottone primario alto ≥ 56px, gli altri ≥ 48px; spazio verticale tra bottoni ≥ 8px.
- [ ] A5 `?fs=2` in galleria → `body` 36px; a viewport 390 nessun overflow orizzontale
      (`scrollWidth ≤ 390`); nessun testo tagliato (per ogni elemento di testo
      `scrollWidth ≤ clientWidth+1` e `scrollHeight ≤ clientHeight+1`); il testo lungo è intero;
      «Prova il bottone» premuto due volte → «Premuto 2 volte» (nessuna funzione persa).
- [ ] A6 `?fs=2` fuori dalla galleria (`/login?fs=2`) → nessun effetto (corpo e campi come a fs=1).
- [ ] A7 screenshot `e2e-screenshots/gallery-{390,1280}-fs{1,2}.png` (4 file, pagina intera).
- [ ] A8 `app/app/login.tsx` non importa da `react-native` né usa `StyleSheet` (scansione del
      file); `/login`: «Accedi» alto ≥ 56px, errore 401 come `alert` con il testo di giro 004.
- [ ] A9 gate: `cd app && npm test -- gallery` → verde (`isGalleryEnabled` falso con
      `__DEV__=false` e host `app.planforhome.com`, vero con host `localhost`).
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
| idem | dato `/login?fs=2`, quando si misura, allora come a fs=1 (A6) |
| idem | dati 390/1280 × fs 1/2, quando si apre la galleria, allora si salvano 4 screenshot (A7) |
| idem | dato `login.tsx`, quando si scansiona e si apre `/login` con API finta (401), allora niente `react-native`, bottone ≥ 56px, `alert` col testo (A8) |

## Porte
- Doppio senso previste: gate della galleria con `__DEV__` o host locale (si cambia in una riga);
  `TextField` aggiunto al kit già in T12; mappatura dei vecchi letterali sui token più vicini;
  `FontScaleContext` con valori ammessi 1/1.5/2; tema via Context con solo `lightTheme`.
- Senso unico: nessuna. Nessuna dipendenza nuova (V9): RN puro, `react-native-safe-area-context`
  è già in `package.json`. Nessuno schema, nessun segreto, nessuna integrazione.

## Rischi di concorrenza
Nessuno stato condiviso sul server: il giro è solo UI. Unico rischio: doppio tocco su «Accedi»
che manda due login; `Button` con `disabled` durante l'attesa deve bloccare `onPress` anche sul
web (`aria-disabled` da solo non basta). Si prova col test di giro 004 (che conta le richieste)
e in A3 (i disattivati non reagiscono).

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 700; file toccati ≤ 18; una sessione.

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
(dopo il critico) Accolto: … · Scartato, con motivo: …
