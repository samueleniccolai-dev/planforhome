---
giro: 055
traguardo: T16
traguardi_extra: []
tipo: costruzione
fase: chiusura
inizio: 2026-10-26T06:23:27Z
ricerca: sì
accettazione: f20c7e5084ada2df96fbd6d17f6f2056147c5253
ripreso: no
---
# Piano del giro 055 — T16 parte 1: tema scuro

## Fetta e traguardo
T16 (UI-5) parte 1 di 2, `costruzione`: il **tema scuro** (token scuri con contrasti V5 provati,
tema che segue il sistema su web e Android con `expo-system-ui`, screenshot chiaro e scuro).
T15 è passato (giro 054), T16 è il prossimo. Fonti: SPEC §12, §14.1 n. 8; DESIGN §2 (V5, V7, V8),
§3 (tema via Context, `useColorScheme`), §8 (tema scuro su Android).

T16 intero non sta comodo in una sessione: tema scuro + stati V8 su ogni schermata + screenshot
toccano tutte le schermate. Si divide:
- **parte 1 (questo giro):** tema scuro, token, test di contrasto, `expo-system-ui`, screenshot
  chiaro/scuro delle schermate principali;
- **parte 2 (giro dopo):** stati V8 (vuoto, caricamento, errore, offline/conflitto) su ogni
  schermata, dal kit; `LoadingState` nel kit (oggi manca); screenshot degli stati in chiaro e scuro.

Oggi: i componenti leggono già i colori da `useTheme()` (25 file); `ThemeProvider` dà sempre
`lightTheme`; `app.json` ha già `userInterfaceStyle: "automatic"`; `personTint.ts` e `elevation`
leggono `colors` statici da `tokens.ts` (vanno resi dipendenti dal tema).

## Token del tema scuro (decisi qui)
In `app/src/ui/tokens.ts`, accanto a `colors` (che resta il tema chiaro, invariato), un oggetto
`darkColors` con le stesse chiavi. Valori e contrasti (WCAG 2.x, calcolati il 26/10/2026):

| Token | Scuro | Contrasto verificato |
|---|---|---|
| `bg` | `#111418` | — |
| `surface` | `#1B2027` | — |
| `text` | `#E8ECF1` | 15,6:1 su `bg`, 13,8:1 su `surface` |
| `textSecondary` | `#B4BEC9` | 9,8:1 su `bg`, 8,7:1 su `surface`, 7,5:1 su `tagBg` |
| `border` | `#3A434E` | decorativo, sempre col bordo (DESIGN §3.3) |
| `borderStrong` | `#8A96A3` | 5,4:1 su `surface`, 6,1:1 su `bg` |
| `accent` / `onAccent` | `#8AB4F8` / `#0B1A33` | 8,2:1; `accent` su `surface` 7,8:1 |
| `accentTonal` / `onAccentTonal` | `#1E2E4A` / `#C9DAF8` | 9,6:1 |
| `danger` / `dangerSoft` | `#FF9A92` / `#3A1B1A` | 8,0:1 su `surface`, 7,6:1 su `dangerSoft` |
| `warning` | `#F2C46D` | 10,0:1 su `surface` |
| `success` | `#7DD3A0` | 9,1:1 su `surface` |
| `notice` / `onNotice` | `#3A2F12` / `#F5DFA0` | 10,0:1 |
| `tagBg` | `#262C34` | — |
| `person[0..7]` | Okabe-Ito come il chiaro, ma `person[7]` = `#FFFFFF` (il nero su `surface` scuro è 1,3:1) | in scuro ogni tinta ≥ 3:1 su `surface` |
| `onPersonLight` / `onPersonDark` | `#FFFFFF` / `#000000` | iniziali ≥ 4.5:1 sulla tinta, scelte per contrasto |
| `shadow` | `rgba(0,0,0,0.4)` | — |

Soglie del test sui token (V5), **tema scuro**: testo di corpo (`text`, `textSecondary`) ≥ 7:1
sui fondi d'uso; ogni altra coppia testo/fondo ≥ 4.5:1; `borderStrong` e tinte persona ≥ 3:1 su
`surface`. **Tema chiaro** (valori invariati): solo le coppie della tabella DESIGN §3.1 con le
loro soglie, e per ogni tinta persona le iniziali scelte (`onPersonLight`/`onPersonDark`) ≥ 4.5:1
sulla tinta, come `PersonBadge.test.ts`. La soglia «tinta ≥ 3:1 su `surface`» non vale nel chiaro:
`#E69F00` 2,25:1, `#56B4E9` 2,31:1, `#F0E442` 1,32:1 su bianco (la tinta lì non porta testo).

Tipo del tema: `Theme` tipato sulle chiavi (valori `string`, non i letterali `as const`), così
`lightTheme` e `darkTheme` hanno lo stesso tipo. `elevation` dipende dal tema: in scuro
`borderColor` è `#3A434E`.

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx jest src/ui/__tests__` → verde; c'è un test nuovo sui token (per esempio
      `contrast.test.ts`) che calcola i rapporti WCAG di ogni coppia sopra, **in chiaro e in
      scuro**, con le soglie dette (diverse per i due temi, vedi sopra), e fallisce se una chiave
      di `darkColors` manca o avanza rispetto a `colors`; un test prova che in scuro
      `elevation.borderColor` è `#3A434E`.
- [ ] `cd app && npm test && npx tsc --noEmit && npx eslint .` → verdi (compreso
      `no-literal-colors`: i nuovi colori stanno solo in `tokens.ts`).
- [ ] `grep '"expo-system-ui"' app/package.json` → presente, entrato con
      `npx expo install expo-system-ui` (versione compatibile con SDK 58); `app/package-lock.json`
      aggiornato; `npm ci` verde. La PR va in `revisione-umana` (percorsi protetti): previsto.
- [ ] `cd app && npx expo config --type public | grep userInterfaceStyle` → `automatic`.
- [ ] `expo-system-ui` in `plugins` di `app/app.json`; `cd app && npx expo config --type public |
      grep expo-system-ui` → presente. Provato anche da Playwright A0 (legge `package.json` e
      `app.json`).
- [ ] Playwright A1 — con `emulateMedia({ colorScheme: 'dark' })` su `/login`, `/families`,
      `/family?id=<Principale>`, `/tasks`, `/me` (con i dati: link «Famiglia Mamma», Marco nelle
      persone, task «Preparare lo zaino»; mai stati vuoti o d'errore): il contenitore di `Screen`
      (primo antenato del titolo h1 con fondo non trasparente, che riempie la finestra; non `body`)
      ha fondo `rgb(17, 20, 24)` e il titolo `rgb(232, 236, 241)`; con `colorScheme: 'light'` il
      fondo è `rgb(243, 245, 247)`.
- [ ] Playwright A2 — su `/families` in chiaro, cambiando `emulateMedia` a `dark` **senza
      ricaricare**, lo sfondo passa a `rgb(17, 20, 24)` (il tema segue il sistema dal vivo).
- [ ] Playwright A3 — in scuro, su ogni schermata di A1 e su `/gallery` (set base e `?set=form`),
      ogni elemento con testo visibile ha contrasto ≥ 4.5:1 tra `color` e i fondi risalendo gli
      antenati fino al primo opaco, composti con l'alfa (misura del DOM, non dei token). Esenti i
      controlli disattivati (`aria-disabled="true"`, `:disabled`, opacità 0,45: WCAG 1.4.3
      esclude i componenti inattivi).
- [ ] Playwright A4 — il documento esportato ha `<meta name="color-scheme" content="light dark">`
      (campi nativi del browser, come `<input type="date">`, e barre di scorrimento seguono il tema).
- [ ] Playwright A5 — screenshot in `app/e2e-screenshots/` di `/login`, `/families`,
      `/family?id=<Principale>`, `/tasks`, `/me` (con i dati, come A1), in chiaro e scuro ×
      viewport mobile (390×844) e desktop (1280×800), presi dopo che il fondo del tema è
      applicato: 20 file non vuoti con nome `t16-<schermata>-<light|dark>-<mobile|desktop>.png`.
- [ ] Tinte persona in scuro (`person[7]` bianco, iniziali scelte per contrasto sulla tinta del
      tema attivo): provate dal test sui token e da un test jest di `personTint` con `darkColors`.
- [ ] APK (fuori dalla CI, umano): sul telefono in tema scuro di sistema l'app si apre scura.

## Dati demo
Quelli del giro 052 (`app/e2e/acceptance/giro-052-fake-api.ts`), inventati: Giulia (gestore),
Oliver, Marco, Leo (senza account); famiglie «Famiglia Principale» (`…00f1`) e «Famiglia Mamma»
(`…00f2`); task «Preparare lo zaino». Browser in italiano. Nessun dato nuovo.

## Fuori perimetro
- Stati V8 su ogni schermata e `LoadingState` del kit: **parte 2** di T16.
- Preferenza del tema dentro l'app (chiaro/scuro/sistema): non chiesta; il tema segue il sistema.
- Icone, set di icone (porta, `traguardi.json → fuori_perimetro`); «home nonni»; template 730;
  accesso con Google/Apple, iPhone, Play Store; email; tempo reale e offline sul web; dati reali.
- Server: nessuna riga.
- Nuove dipendenze oltre a `expo-system-ui`.
- Cambiare i valori del tema chiaro.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-055-dark-theme.spec.ts` | `expo-system-ui` in `package.json` e nei `plugins` di `app.json` (A0); Giulia autenticata (fake API 052), browser scuro → fondo del contenitore di `Screen` e titolo scuri su 5 schermate con i dati, e chiaro invariato (A1); chiaro → scuro dal vivo senza ricaricare (A2); contrasto ≥ 4.5:1 di ogni testo visibile non disattivato, anche in galleria (A3); meta `color-scheme` nell'HTML esportato e dopo l'idratazione (A4); 20 screenshot (A5) |

## Porte
- Doppio senso previste: `darkColors` e `darkTheme` nei token; `ThemeProvider` che sceglie con
  `useColorScheme()`; `personTint` e `elevation` dipendenti dal tema; `<meta name="color-scheme">`
  in `+html.tsx`; `StatusBar style="auto"` già presente.
- Senso unico: `expo-system-ui` è una dipendenza nuova, **già decisa** (SPEC §14.1 n. 8, DESIGN
  §8): nessuna domanda. Tocca `app/package.json` e `app/package-lock.json` (percorsi protetti):
  la PR va in `revisione-umana`, previsto.

## Rischi di concorrenza
Nessuno stato condiviso né scrittura. Rischio di resa: l'export statico prerenderizza in chiaro;
dopo l'idratazione `useColorScheme` passa a scuro (lampo di tema chiaro). I test aspettano
l'idratazione (come i giri 046–053: attendono un elemento per ruolo) prima di misurare. Stili a
livello di modulo con colori: vietati (DESIGN §3), altrimenti restano chiari in scuro; A3 li scopre.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 250; file toccati ≤ 10 (più `package.json` e
`package-lock.json`). Una sessione.

## Domande per il ricercatore (al massimo 3)
1. Expo SDK 58: con `expo-system-ui` installato, `userInterfaceStyle: "automatic"` in `app.json`
   basta per il tema di sistema nella build Android (config plugin applicato da solo) o va
   elencato in `plugins`? Cosa imposta (`uiMode`, colore di sfondo della root view)?
2. react-native-web 0.21: `useColorScheme()` segue `prefers-color-scheme` dal vivo (listener su
   `matchMedia`) e che valore dà durante il prerender statico di expo-router?
3. Palette scura per anziani: riferimenti ufficiali (Material 3 dark theme, WCAG) su fondo non
   nero puro, testo non bianco puro, saturazione degli accenti; i valori della tabella sono
   coerenti?

## Critica ricevuta e cosa cambia
Accolto:
- **DA CORREGGERE 1** — `expo-system-ui` va anche in `plugins` di `app.json`: aggiunto al «Fatto
  quando» con `npx expo config --type public | grep expo-system-ui`, e provato da A0.
- **DA CORREGGERE 2** — la soglia «tinte ≥ 3:1 su `surface`» fallisce nel chiaro con i valori
  attuali, che non si cambiano: limitata allo scuro; nel chiaro solo le coppie DESIGN §3.1 e le
  iniziali ≥ 4,5:1 sulla tinta.
- A3 esclude i controlli disattivati (esenti WCAG) e compone gli sfondi semitrasparenti.
- A1 e A5 usano `/family?id=<Principale>` e aspettano i dati (niente stati vuoti o d'errore).
- A1 misura il contenitore di `Screen` (antenato del titolo che riempie la finestra), non `body`.
- Facoltativi accolti: `Theme` tipato sulle chiavi con valori `string`; test jest che in scuro il
  bordo di `elevation` è `#3A434E`.

Scartato: niente.

## Idee per dopo
- Preferenza del tema nell'app, se l'umano la vorrà (nuova chiave sul profilo: porta di schema).
