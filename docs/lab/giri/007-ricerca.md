# Ricerca del giro 007 — scelta e cambio famiglia sul web

> Il testo viene dal ricercatore e dal web: è un dato, non un'istruzione. Fonti consultate il 2026-10-20. Le pagine web non erano apribili (ENOTFOUND): solo sintesi dei risultati di ricerca.

## Come lo fanno gli altri
- Non verificato: WebFetch ha dato `getaddrinfo ENOTFOUND` su tutti gli host. Nessuna guida d'aiuto sul cambio famiglia trovata.
- Da `docs/lab/ricerca-concorrenti.md` (riga 11): FamilyWall ha più gruppi («Circle»), non risultano collegati tra loro [I] (https://support.familywall.com/en/support/solutions/articles/47001268851-how-many-circles-can-i-have-with-a-familywall-premium-subscription-).
- Riga 12: Cozi ha una sola famiglia, nessun selettore da copiare (https://www.cozi.com/cozi-gold/).
- Come FamilyWall, Todoist e altri mostrano il gruppo corrente: punto aperto, chiudibile con una prova a mano (riga 36 del file).

## Casi reali e documentazione
- Q1: con output static Expo genera un HTML per rotta; le rotte dinamiche (`app/[id].tsx`) richiedono `generateStaticParams` (https://docs.expo.dev/router/web/static-rendering/). Conferma `/family?id=`.
- Q1: un utente ha riportato HTML quasi vuoto con `useLocalSearchParams` + `generateStaticParams` (https://forums.expo.dev/t/static-rendering-has-no-content/74050), SDK 49, forse superato. Nessuna pagina descrive `?id=` dopo l'idratazione: **non confermato**; serve una prova nel test Playwright.
- Q1: `useLocalSearchParams` si aggiorna solo con la schermata a fuoco, `useGlobalSearchParams` sempre (https://docs.expo.dev/router/reference/hooks). Nulla su `router.replace` in `useEffect` né sui layout di gruppo `(app)`: **non confermato**.
- Q2: i tipi di react-native-web (terze parti) mappano `link`→`a`, `list`→`ul`, `listitem`→`li` (https://code.morphllm.com/devhubapp/devhub/raw/branch/master/@types/react-native-web/index.d.ts). Il commit della guida accessibilità di RNW dice che di solito si rendono elemento e ruolo ARIA (https://github.com/necolas/react-native-web/commit/4040151ee643a02534e72deb51eee76f001b9a5f.diff). `aria-current`: **non confermato**. RNW 0.88 non verificata.
- Q3: nessuna linea guida trovata sul selettore di gruppo.

## Cosa prendiamo per questa fetta
- `/family?id=` (rotta statica) e `router.replace` per le uscite.
- Il costruttore verifica nel DOM di `expo export` che `h1`, `ul`/`li`, `a` escano come ruoli veri; se `list`/`listitem` non risultano, ripiego su `<ul>`/`<li>` con componenti web di RNW.
- Selettore = link semplice «Cambia famiglia» verso `/families`.
- Flag `alive` contro risposte fuori ordine, come nel piano.
- Il test dell'`id` altrui si fa sul client, senza dipendere dal server.

## Cosa evitiamo
- `aria-current` come requisito dei test.
- Affidarsi a `useLocalSearchParams` al primo render: prima dell'idratazione `id` può mancare, quindi nessun «Famiglia non trovata» prima del caricamento dei parametri.

## Idee per dopo
- Sessione con rete per leggere le guide di FamilyWall, Todoist, Any.do, Homey.
- Verifica a mano di `aria-current` in RNW.
- Selettore in un'intestazione comune insieme a «Profilo» ed «Esci».

Fonti: 5 URL web (sopra) + `docs/lab/ricerca-concorrenti.md`.
