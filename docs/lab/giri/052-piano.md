---
giro: 052
traguardo: T15
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-25T23:37:40Z
ricerca: sì
accettazione:
ripreso: no
---
# Piano del giro 052 — T15 parte 1: lingua dell'account sul web; famiglia, famiglie e profilo dal kit

## Fetta e traguardo
T15 (UI-4: famiglia, profilo, spesa e lingua del web), parte 1 di 2, giro `costruzione`: T14 è
`passato` (giro 051) e T15 è il primo traguardo non passato. Il traguardo intero non sta in una
sessione: `ShoppingList.tsx` (445 righe, righe con spunta, sposta, togli, ripristina, aggiunta
rapida) da sola vale un giro, e il cambio di lingua tocca il comportamento di quasi tutte le
suite Playwright vecchie (vedi «Rischi»). Questa fetta fa la lingua del web e le tre schermate
piccole; la parte 2 fa la lista della spesa.
Fonti: SPEC §2.2.1 (lingua fissata alla registrazione, «tutte le schermate» cambiano famiglia),
§2.2.7 (solo per la parte 2), §2.2.9 (sul web vince `person.locale` dopo il login; il browser
vale solo prima), §12; DESIGN §1, §2 (V1, V3, V4, V7, V8, V10), §3, §5, §7; giro 047 (F12, il
controllo statico «fatto dal kit»).

Cosa si costruisce:
- **Lingua dell'account (`app/src/i18n/index.ts`)**:
  - uno stato di modulo `accountLocale: Locale | undefined` con `setAccountLocale(tag | undefined)`
    (usa `resolveLocale`) e `currentLocale()` = lingua dell'account, se c'è, altrimenti
    `deviceLocale()`;
  - `useT()` si iscrive a quello stato (`useSyncExternalStore` con una `subscribe` vera); lo
    snapshot del server resta `'en'` (pagina prerenderizzata);
  - `t()` senza lingua esplicita e `DateField` usano `currentLocale()`, non più `deviceLocale()`;
  - ogni `me()` riuscito (`GET /api/me`, che già restituisce `locale`, `MeController` →
    `Profile`) fissa la lingua dell'account; nessuna modifica al server;
  - all'avvio (`_layout.tsx`) un `me()` solo, così dopo un ricaricamento con sessione valida la
    lingua torna quella dell'account anche su schermate che non chiamano `me()` (`/family`);
    `login.tsx`, dopo un login riuscito, attende `me()` prima di navigare;
  - «Esci» e l'arrivo su `/login` tolgono la lingua dell'account (si torna a «prima del login»):
    vale di nuovo quella del browser;
  - una risposta di `me()` arrivata **dopo** l'uscita non rimette la lingua (contatore di
    generazione o equivalente);
  - sul web `document.documentElement.lang` segue la lingua corrente (`it` / `en`): i lettori di
    schermo pronunciano nella lingua giusta;
  - su Android la stessa logica vale senza danni (la lingua dell'account nasce da quella del
    dispositivo); nessuna prova sul telefono in questo giro.
- **Kit: `LinkRow` (`app/src/ui/LinkRow.tsx`)**, il collegamento di navigazione del kit (DESIGN
  §5: «stile nuovo = prima si estende il kit»): `Link` di expo-router con ruolo `link`, nome
  accessibile = testo visibile, altezza minima `size.touch` (48), `type.body`, colore
  `color.accent`, sottolineato (il colore non è l'unico segno); voce nella galleria
  (`/gallery?set=form` o un set esistente) con un testo lungo. Test Jest in `app/src/ui/__tests__/`.
- **`app/app/families.tsx` dal kit**: `Screen`, `Text variant="title" heading={1}` «Scegli una
  famiglia», una `LinkRow` per famiglia (nome invariato, ruolo `link`, test 007 invariati) e la
  `LinkRow` «Tutte le mie famiglie»; errore con `InlineNotice tone="danger"` (`role="alert"`,
  testo invariato); caricamento: oggi `return null`; `LoadingState` non c'è ancora
  nel kit, quindi resta com'è (V8 completo va in «Idee per dopo»). Accetta `?fs=` come `family.tsx` (`parseFontScale`).
- **`app/app/me.tsx` dal kit**: `Screen`, `FamilySwitch` come oggi, titolo «Ciao, {name}»
  (heading 1, invariato), una riga `type.meta` «Lingua dell'account: Italiano» / «Account
  language: English» (chiavi nuove, il nome della lingua scritto nella lingua corrente), bottone
  «Esci» = `Button` del kit, variante `secondary` (≥ 56 dp non richiesto: non è un'azione
  primaria da anziani, ma ≥ 48). Accetta `?fs=`.
- **`app/app/family.tsx` dal kit**: `Screen` al posto di `ScrollView` + `StyleSheet`, titolo con
  `Text variant="title" heading={1}`, «Persone» con `SectionHeader` (o `Text variant="section"
  heading={2}`), ogni persona come `listitem` con `PersonBadge` (iniziali + tinta + nome) e il
  ruolo («Gestore», «Membro», «Senza account») in `type.meta` testuale (il colore non è mai
  l'unico segno); errori con `InlineNotice tone="danger"`. `TasksSection` e tutta la logica di
  caricamento restano come sono.
- **Statico, per i tre file** `app/app/family.tsx`, `families.tsx`, `me.tsx`: nessun
  `StyleSheet`, nessun `style=`, nessun `Text`/`Pressable`/`ScrollView` importato da
  `react-native`, nessun import da `@/ui/tokens`, nessun colore `#…`.
- **Test di accettazione vecchi adattati** (precedente: decisioni 138 e 152), nel commit
  `test(acceptance)`: nelle suite che girano con browser `en-US` dopo il login, la fake API
  restituisce in `GET /api/me` un account con `locale: 'en'` (oggi è sempre `'it'`), così ogni
  caso continua a provare la stessa cosa (account inglese su browser inglese). Nessuna asserzione
  indebolita; i file toccati si elencano nel piano finale. La PR va in revisione umana.

## Fatto quando — controlli eseguibili
Dati demo (inventati), nella fake API di `app/e2e/acceptance/giro-052-fake-api.ts` (costruita su
quella del giro 047, con l'opzione `locale` dell'account):
- **Giulia** (`giulia@example.com`, `locale: 'it'`), gestore di «Famiglia Principale» e membro di
  «Famiglia Mamma» (come in 047); in Principale anche Marco (membro) e Leo (senza account);
- **Oliver** (`oliver@example.com`, `locale: 'en'`), membro della sola «Famiglia Principale».

- [ ] L1 Playwright, browser `en-US`, account Giulia (`it`): `/login` mostra «Sign in to
      planforhome» e il bottone «Sign in» (prima del login vince il browser), `html[lang="en"]`;
      dopo il login `/families` mostra «Scegli una famiglia», `/me` «Ciao, Giulia», «Esci» e
      «Lingua dell'account: Italiano», `/family?id=<Principale>` «Persone»; `html[lang="it"]`.
- [ ] L2 Come L1, poi ricaricamento di `/family?id=<Principale>` con la sessione valida → ancora
      «Persone» e «Gestore» (italiano), senza passare da `/me`.
- [ ] L3 Come L1, poi «Esci» → `/login` di nuovo in inglese («Sign in»), `html[lang="en"]`.
- [ ] L4 Il contrario: browser `it-IT`, account Oliver (`en`): `/login` in italiano («Accedi a
      planforhome»); dopo il login `/me` «Hi, Oliver», «Sign out», «Account language: English».
- [ ] L5 Risposta tardiva: `GET /api/me` rallentata dalla fake API, «Esci» premuto prima della
      risposta → `/login` resta in inglese (browser `en-US`, account `it`).
- [ ] K1 `cd app && npm test -- src/ui src/i18n` → verdi i test nuovi: `LinkRow` (ruolo `link`,
      nome = testo, `minHeight` ≥ 48), `setAccountLocale`/`currentLocale` (account vince sul
      dispositivo, `undefined` torna al dispositivo, `useT` si aggiorna senza rimontare).
- [ ] S1 Statico (Playwright, lettura dei sorgenti come 047 F12): `app/app/family.tsx`,
      `families.tsx`, `me.tsx` senza `StyleSheet`, `style=`, `Text`/`Pressable`/`ScrollView` da
      `react-native`, import da `@/ui/tokens`, `#[0-9a-fA-F]{3,8}`; `app/src/ui/LinkRow.tsx`
      senza `#…`.
- [ ] P1 `/family?id=<Principale>` (Giulia): lista «Persone» con un `listitem` per Giulia, Marco
      e Leo, ognuno con le iniziali visibili, il nome e il ruolo scritto («Gestore», «Membro»,
      «Senza account»).
- [ ] P2 `/families` (Giulia): `link` «Famiglia Principale», «Famiglia Mamma» e «Tutte le mie
      famiglie», ognuno alto ≥ 48 px a `fs` 1 e 2; un clic su «Famiglia Mamma» apre
      `/family?id=<Mamma>`.
- [ ] P3 `/me` (Giulia): `button` «Esci» alto ≥ 48 px a `fs` 1 e 2.
- [ ] V1 Screenshot Playwright di `/families`, `/me`, `/family?id=<Principale>`: viewport 390×844
      e 1280×800 × `fs` 1 e 2 → 12 file in `app/e2e-screenshots/`, non vuoti; nessun traboccamento
      orizzontale (`scrollWidth` ≤ `clientWidth`) e nessun testo tagliato (titolo e righe intere
      visibili) a `fs` 2.
- [ ] R1 `cd app && npx playwright test` → tutte le suite vecchie verdi dopo l'adattamento della
      fake API (account `en` nei casi con browser `en-US`).
- [ ] Q1 `cd app && npx tsc --noEmit && npx eslint . && npm test` → verdi.

## Fuori perimetro
- **Parte 2 di T15**: `ShoppingList` dal kit, voci spuntate e rigate distinte non solo dal colore,
  screenshot della lista; poi il giro `verifica-produzione` di T15.
- Cambiare la lingua dal profilo (SPEC §2.2.1): serve un endpoint nuovo (`PUT /api/me/locale` o
  simile) e non è nel «Fatto quando» di T15. Va in «Idee per dopo».
- Cambiare la password dal profilo nell'app (l'endpoint esiste, la schermata no): non è in T15.
- `FamilySwitch` e un `AppHeader` del kit: restano come sono (un solo `StyleSheet` di
  posizionamento in `src/family/FamilySwitch.tsx`, non è una schermata di T15).
- Qualsiasi modifica al server, alle migrazioni o ai testi delle notifiche.
- Prove sul telefono (APK, TalkBack, fontScale di sistema): le fa il giro di verifica o l'umano.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni» a griglia;
  set di icone come dipendenza; accesso con Google o Apple, iPhone, Play Store; verifica email e
  recupero password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-052-fake-api.ts` | fake API di 047 con `locale` dell'account e ritardo opzionale di `GET /api/me` (supporto, non test) |
| `app/e2e/acceptance/giro-052-account-locale.spec.ts` | L1–L5: browser in una lingua, account nell'altra; prima del login, dopo, dopo il ricaricamento, dopo l'uscita, risposta tardiva |
| `app/e2e/acceptance/giro-052-screens-kit.spec.ts` | S1 statico; P1–P3 per ruolo ed etichetta; V1 screenshot 2 viewport × 2 `fs` |
| suite vecchie (elenco nel piano finale) | solo la fake API: account `en` nei casi `en-US`; nessuna asserzione cambiata |

Niente test server: il server non cambia (`GET /api/me` restituisce già `locale`).

## Porte
- Doppio senso previste: stato di modulo della lingua in `src/i18n`; `me()` che fissa la lingua
  come effetto; un `me()` in più all'avvio; componente nuovo del kit `LinkRow`; `lang`
  dell'`<html>` scritto dal client; adattamento delle fake API delle suite vecchie.
- Senso unico: nessuna (nessuna dipendenza nuova, nessuno schema, server invariato).

## Rischi di concorrenza
- **`me()` dopo l'uscita**: una risposta in volo può rimettere l'italiano dopo «Esci». Si prova
  con L5 (ritardo nella fake API); difesa con un contatore di generazione azzerato da
  `setAccountLocale(undefined)`.
- **Due `me()` insieme** (avvio + schermata): rispondono lo stesso account; l'ultimo vince, senza
  effetti diversi. Nessuna scrittura, nessun `mutation_id` coinvolto.
- **Idratazione**: la pagina prerenderizzata è in inglese; il primo render del client usa
  `currentLocale()`. Il cambio dopo `me()` deve passare da `useSyncExternalStore` senza errori di
  idratazione nella console (L1 controlla che non ce ne siano).
- **Suite vecchie**: oggi molte girano con browser `en-US` e fake API con account `it`; senza
  l'adattamento diventerebbero rosse per la regola nuova, non per un difetto (R1).

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 450 aggiunte; file di produzione ≤ 10
(`i18n/index.ts`, `api/client.ts`, `ui/LinkRow.tsx`, `ui/DateField.tsx`, galleria, `_layout.tsx`,
`login.tsx`, `families.tsx`, `me.tsx`, `family.tsx`) più `it.json`/`en.json`. Deve stare in una
sessione.

## Domande per il ricercatore (al massimo 3)
1. `useSyncExternalStore` con export statico di Expo Router (SDK 58, React 19): uno snapshot del
   client diverso da quello del server dopo l'idratazione dà avvisi? Qual è il modo indicato per
   uno stato globale di lingua che cambia dopo una richiesta?
2. `Link` di expo-router con `asChild` su un `Pressable` (react-native-web 0.21): resta un `<a>`
   con `href` e nome accessibile dal testo? Serve `role="link"` esplicito? Il `minHeight` si
   applica all'`<a>`?
3. Scrivere `document.documentElement.lang` dal client in una pagina statica di Expo: è il modo
   giusto (WCAG 3.1.1), o `+html.tsx` ha un meccanismo migliore? Fonti ufficiali.

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Cambio della lingua dal profilo (endpoint nuovo + `RadioGroup` in `/me`).
- `LoadingState` nel kit (DESIGN §5) e stato di caricamento nelle tre schermate.
- `AppHeader` del kit con `FamilySwitch` dentro, al posto del posizionamento assoluto.
- Ricordare la lingua dell'account in `localStorage` per evitare il primo render nella lingua del
  browser dopo un ricaricamento.
