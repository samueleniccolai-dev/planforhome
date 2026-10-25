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
  - `t()` senza lingua esplicita, `DateField.tsx` (Android) e `DateField.web.tsx` (web, riga 42
    oggi `longDay(value, deviceLocale())`) usano la lingua corrente, letta dallo stesso stato a
    cui si iscrive `useT()` (così il campo si ridisegna quando la lingua cambia);
  - ogni `me()` riuscito (`GET /api/me`, che già restituisce `locale`, `MeController` →
    `Profile`) fissa la lingua dell'account dentro `me()` in `api/client.ts`; nessuna modifica al
    server; ogni chiamata a `me()` è una richiesta sua (nessuna promessa in volo condivisa);
  - **contatore di generazione** in `src/i18n`: si incrementa a ogni uscita
    (`setAccountLocale(undefined)`), non si azzera mai; `me()` lo legge **alla partenza** della
    richiesta e alla risposta fissa la lingua solo se il contatore è ancora quello;
  - all'avvio, **solo sul web**, `_layout.tsx` chiama `me()` una volta, così dopo un ricaricamento
    con sessione valida la lingua torna quella dell'account anche su schermate che non chiamano
    `me()` (`/family`, `/families`); `login.tsx`, dopo un login riuscito, attende `me()` (esito
    ignorato) e poi naviga **comunque**, anche se `me()` fallisce;
  - **un solo punto di cancellazione**: `setAccountLocale(undefined)`, chiamato solo da «Esci» in
    `me.tsx` (si torna a «prima del login»: vale di nuovo quella del browser); l'arrivo su
    `/login` non cancella nulla;
  - sul web `document.documentElement.lang` segue la lingua corrente (`it` / `en`), scritto dal
    client dopo il montaggio e a ogni cambio (WCAG 3.1.1; `+html.tsx` non si tocca);
  - su Android la lingua dell'account si fissa solo quando una schermata chiama `me()` (`/me`, la
    lista della spesa); niente `me()` in `_layout` su Android; nessuna prova sul telefono.
- **Kit: `LinkRow` (`app/src/ui/LinkRow.tsx`)**, il collegamento di navigazione del kit (DESIGN
  §5: «stile nuovo = prima si estende il kit»): `Link` di expo-router con ruolo `link`, nome
  accessibile = testo visibile, altezza minima `size.touch` (48), `type.body`, colore
  `color.accent`, sottolineato (il colore non è l'unico segno); nel DOM resta **un `<a href>`**
  e il `minHeight` vale sull'`<a>` (se `asChild` su `Pressable` non lo garantisce, `Link` senza
  `asChild` con lo stile). **Una sola voce di galleria**, in `src/ui/FormGallery.tsx`
  (`/gallery?set=form`), chiave `gallery.form.link`: it «Vai a tutte le famiglie di cui fai parte,
  anche quelle condivise con i nonni», en «Go to every family you belong to, including the ones
  shared with the grandparents», `href` `/families`. Test Jest in `app/src/ui/__tests__/`.
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
  `test(acceptance)`: in `GET /api/me` la fake API rispondeva sempre `locale: 'it'`; ora il
  locale dell'account segue il caso, cioè la lingua del browser letta da `Accept-Language`
  (`it` per `it-IT`, `en` per `en-US`), così ogni caso continua a provare la stessa cosa.
  File toccati (una riga ciascuno, nessuna asserzione cambiata): `giro-004-login.spec.ts`,
  `giro-007-families.spec.ts`, `giro-010-tasks.spec.ts` (fake API dentro lo spec);
  `giro-011-fake-api.ts`, `giro-014-fake-api.ts`, `giro-016-fake-api.ts`, `giro-019-fake-api.ts`,
  `giro-031-fake-api.ts`, `giro-046-fake-api.ts`, `giro-047-fake-api.ts` (usata anche da 049 e
  050). La PR va in revisione umana.

## Fatto quando — controlli eseguibili
Dati demo (inventati), nella fake API autonoma `app/e2e/acceptance/giro-052-fake-api.ts` (id del
giro 047; login, logout, `GET /api/me` con il `locale` dell'account, famiglie, membri, task):
- **Giulia** (`giulia@example.com`, password `password-finta-giulia`, `locale: 'it'`), gestore
  di «Famiglia Principale» e membro di «Famiglia Mamma» (gestore Anna); in Principale anche Marco
  (membro con account) e Leo (senza account, referente Giulia); un task aperto in coda,
  «Preparare lo zaino»;
- **Oliver** (`oliver@example.com`, password `password-finta-oliver`, `locale: 'en'`), **senza
  famiglie**: dopo il login atterra su `/me` (`landing`), senza ricaricare la pagina.

- [ ] L1 Playwright, browser `en-US`, account Giulia (`it`): `/login` mostra «Sign in to
      planforhome» e il bottone «Sign in» (prima del login vince il browser), `html[lang="en"]`;
      dopo il login `/families` mostra «Scegli una famiglia», `/me` «Ciao, Giulia», «Esci» e
      «Lingua dell'account: Italiano», `/family?id=<Principale>` «Persone»; `html[lang="it"]`;
      in «Nuovo task» il campo «Scadenza» con 2026-10-30 mostra «venerdì 30 ottobre 2026»; nessun
      messaggio di console o `pageerror` su idratazione (`hydrat…`, React #418/#423/#425).
- [ ] L2 Sessione valida, `/family?id=<Principale>` e poi ricaricamento → ancora «Persone» e
      «Gestore» (italiano), `html[lang="it"]`, senza passare da `/me`.
- [ ] L3 Da `/me` (Giulia), «Esci» → `/login` di nuovo in inglese («Sign in to planforhome»,
      «Sign in»), `html[lang="en"]`, un solo `POST /api/auth/logout`.
- [ ] L4 Il contrario: browser `it-IT`, account Oliver (`en`): `/login` in italiano («Accedi a
      planforhome», `html[lang="it"]`); dopo il login `/me` «Hi, Oliver», «Sign out», «Account
      language: English», `html[lang="en"]`.
- [ ] L5 Risposta tardiva, browser `it-IT`, account Oliver (`en`): sessione già valida, la fake
      API trattiene **la prima** `GET /api/me` (quella di `_layout` su `/login`, l'unica in volo
      all'avvio: la schermata di login non chiama `me()`); login, `/me` in inglese, «Sign out»;
      poi la fake API rilascia la risposta (200, `en`), il test la attende con
      `page.waitForResponse` e solo dopo controlla «Accedi a planforhome», «Accedi» e
      `html[lang="it"]`.
- [ ] L6 Guardia (verde già oggi, deve restarlo): login riuscito e `GET /api/me` in 500 → il
      login naviga comunque a `/families` («Choose a family»).
- [ ] K1 `cd app && npm test -- src/ui src/i18n` → verdi i test Jest nuovi:
      `LinkRow` (ruolo `link`, nome = testo, `minHeight` ≥ 48); `setAccountLocale`/`currentLocale`
      (l'account vince sul dispositivo, `undefined` torna al dispositivo); `useT` si aggiorna
      senza rimontare; `t()` senza lingua esplicita usa la lingua dell'account;
      `getServerSnapshot` resta `'en'` (render sul server con account `it`); **risposta vecchia
      scartata**: `me()` partita prima di `setAccountLocale(undefined)` e risolta dopo lascia la
      lingua del dispositivo; il contatore non torna mai indietro.
- [ ] S1 Statico (Playwright, lettura dei sorgenti come 047 F12): `app/app/family.tsx`,
      `families.tsx`, `me.tsx` senza `StyleSheet`, `style=`, `Text`/`Pressable`/`ScrollView` da
      `react-native`, import da `@/ui/tokens`, `#[0-9a-fA-F]{3,8}`; `app/src/ui/LinkRow.tsx`
      senza `#…`.
- [ ] P1 `/family?id=<Principale>` (Giulia): lista «Persone» con un `listitem` per Giulia, Marco
      e Leo, ognuno con le iniziali visibili, il nome e il ruolo scritto («Gestore», «Membro»,
      «Senza account»).
- [ ] P2 `/families` (Giulia): `link` «Famiglia Principale», «Famiglia Mamma» e «Tutte le mie
      famiglie», ognuno un `<a>` con `href` alto ≥ 48 px nel DOM a `fs` 1 e 2; un clic su
      «Famiglia Mamma» apre `/family?id=<Mamma>`.
- [ ] P3 `/me` (Giulia): `button` «Esci» alto ≥ 48 px a `fs` 1 e 2.
- [ ] G1 `/gallery?set=form`, browser `en-US`, 390 px: la voce `LinkRow` col testo lungo è un
      `<a href>` alto ≥ 48 px, nessun testo tagliato.
- [ ] V1 Screenshot Playwright di `/families`, `/me`, `/family?id=<Principale>`: viewport 390×844
      e 1280×800 × `fs` 1 e 2 → 12 file `app/e2e-screenshots/t15-<schermata>-<larghezza>-fs<n>.png`,
      non vuoti; titolo `heading` 1 a 24 × `fs` px; nessun traboccamento orizzontale e nessun
      testo tagliato, a `fs` 1 e 2.
- [ ] R1 `cd app && npx expo export --platform web && npx playwright test` → tutte le suite
      vecchie verdi dopo l'adattamento delle fake API (locale dell'account = lingua del browser).
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
| `app/e2e/acceptance/giro-052-fake-api.ts` | fake API autonoma con `locale` dell'account e `holdFirstMe()`/`releaseMe()` sulla prima `GET /api/me`, risposta decisa all'arrivo (supporto, non test) |
| `app/e2e/acceptance/giro-052-account-locale.spec.ts` | L1–L6: browser in una lingua, account nell'altra; prima del login, dopo, campo data, ricaricamento, uscita, risposta tardiva, `me()` che fallisce dopo il login |
| `app/e2e/acceptance/giro-052-screens-kit.spec.ts` | S1 statico; P1–P3 per ruolo ed etichetta; G1 galleria; V1 screenshot 3 schermate × 2 viewport × 2 `fs` |
| 10 file vecchi (elenco sopra) | solo `GET /api/me`: `locale` da `Accept-Language`; nessuna asserzione cambiata |

Niente test server: il server non cambia (`GET /api/me` restituisce già `locale`).

## Porte
- Doppio senso previste: stato di modulo della lingua in `src/i18n`; `me()` che fissa la lingua
  come effetto; un `me()` in più all'avvio; componente nuovo del kit `LinkRow`; `lang`
  dell'`<html>` scritto dal client; adattamento delle fake API delle suite vecchie.
- Senso unico: nessuna (nessuna dipendenza nuova, nessuno schema, server invariato).

## Rischi di concorrenza
- **`me()` dopo l'uscita**: una risposta in volo può rimettere l'italiano dopo «Esci». Si prova
  con L5 (la fake API trattiene la prima `GET /api/me`); difesa con un contatore di generazione
  incrementato a ogni `setAccountLocale(undefined)`, mai azzerato, letto da `me()` alla partenza
  della richiesta.
- **Due `me()` insieme** (avvio + schermata): rispondono lo stesso account; l'ultimo vince, senza
  effetti diversi. Nessuna scrittura, nessun `mutation_id` coinvolto.
- **Idratazione**: la pagina prerenderizzata è in inglese; il primo render del client usa
  `currentLocale()`. Il cambio dopo `me()` deve passare da `useSyncExternalStore` senza errori di
  idratazione nella console (L1 controlla che non ce ne siano).
- **Suite vecchie**: oggi molte girano con browser `en-US` e fake API con account `it`; senza
  l'adattamento diventerebbero rosse per la regola nuova, non per un difetto (R1).

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 450 aggiunte; file di produzione ≤ 11
(`i18n/index.ts`, `api/client.ts`, `ui/LinkRow.tsx`, `ui/DateField.tsx`, `ui/DateField.web.tsx`,
`ui/FormGallery.tsx`, `_layout.tsx`, `login.tsx`, `families.tsx`, `me.tsx`, `family.tsx`) più
`it.json`/`en.json` e i test Jest. Deve stare in una sessione.

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
Accolti tutti: i 4 «DA CORREGGERE» e gli 8 altri punti.
- **DateField.web.tsx** nel perimetro e nel budget (11 file); L1 prova il giorno in italiano.
- **Contatore di generazione**: incrementato a ogni uscita, mai azzerato, letto alla partenza
  dentro `me()` in `client.ts`.
- **L5**: la fake API trattiene solo la prima `GET /api/me` e la rilascia su comando dopo
  l'uscita; il test attende `page.waitForResponse` e solo dopo controlla la pagina di login e
  `html[lang]`. Adattato in un punto: per avere «quella di `_layout`» davvero come prima e unica
  richiesta, il caso parte da `/login` con la sessione già valida (la schermata di login non
  chiama `me()`) e arriva a «Esci» senza ricaricare, grazie a Oliver senza famiglie (`landing` →
  `/me`). Partire da `/me` non va: lì la `me()` della schermata e quella di `_layout` partono
  insieme e gli effetti di React girano prima nel figlio, quindi «la prima» sarebbe quella della
  schermata. Per questo L5 usa browser `it-IT` e account `en` (la prova è la stessa a lingue
  scambiate): controlla «Accedi» e `html[lang="it"]`.
- **Suite vecchie**: elenco dei 10 file sopra. Il locale dell'account segue il caso, letto da
  `Accept-Language` (verificato: Chromium manda `it-IT` / `en-US`); 004, 007 e 047 rieseguite,
  70 verdi.
- Una sola voce di galleria (`FormGallery`, chiave e testi decisi); un solo punto di
  cancellazione (`setAccountLocale(undefined)` da «Esci»; l'arrivo su `/login` non cancella);
  caso Jest della risposta vecchia scartata (K1); `login.tsx` naviga anche se `me()` fallisce
  (guardia L6); su Android la lingua si fissa solo quando una schermata chiama `me()`; L1 ascolta
  console e `pageerror` (anche i codici di produzione di React); `minHeight` di `LinkRow` provato
  sull'`<a>` nel DOM (P2, G1); K1 con `t()` senza lingua esplicita e `getServerSnapshot` `'en'`.
Scartato:
- Nessun punto scartato nel merito; l'unica deviazione è la scelta di lingue e persona in L5,
  spiegata sopra.
Aggiunti da me: V1 controlla anche il titolo a 24 × `fs` px e il taglio dei testi anche a `fs` 1;
nessuna promessa in volo condivisa tra chiamate a `me()` (serve a L5 e al contatore).

## Idee per dopo
- Cambio della lingua dal profilo (endpoint nuovo + `RadioGroup` in `/me`).
- `LoadingState` nel kit (DESIGN §5) e stato di caricamento nelle tre schermate.
- `AppHeader` del kit con `FamilySwitch` dentro, al posto del posizionamento assoluto.
- Ricordare la lingua dell'account in `localStorage` per evitare il primo render nella lingua del
  browser dopo un ricaricamento.
