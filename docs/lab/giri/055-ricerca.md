# Ricerca del giro 055 — tema scuro (consultata il 26/10/2026)

Fonti: 4 (2 sorgenti react-native-web, 1 sorgente doc Expo `unversioned`, 1 sintesi M2). `docs.expo.dev` e `m3.material.io` non raggiungibili (DNS).

## Casi reali e documentazione
1. **D1, `expo-system-ui` (parziale):** il pacchetto agisce fuori dall'albero React. Imposta il colore di sfondo della root view e, su Android, lo stile globale dell'interfaccia (light e dark). Con CNG va aggiunto a `plugins`; il plugin legge `userInterfaceStyle` e `backgroundColor` dalla config. Valori validi solo a build nuova. Non confermato: comportamento di `"automatic"` su Android; non verificato su SDK 58.
2. **D2, `useColorScheme` su web (confermato):** si iscrive con `Appearance.addChangeListener` in un `useEffect`; valore iniziale da `Appearance.getColorScheme()`.
3. **D2, `Appearance` su web (confermato):** usa `matchMedia('(prefers-color-scheme: dark)')` con listener `change`, quindi segue il sistema dal vivo. Senza DOM (SSR) restituisce `'light'`: il prerender statico esce chiaro, poi passa a scuro dopo l'idratazione (lampo). Letto il ramo `master`, non la 0.21.4.
4. **D3, Material (parziale):** M2 raccomanda `#121212` e non il nero puro, accenti desaturati, 4.5:1 AA su ogni superficie. Valore di superficie M3 non confermato (`#1C1B1F` vs `#121212`).
5. **D3, WCAG 1.4.3:** 4.5:1 testo normale, 3:1 testo grande e componenti UI (conoscenza generale, non pagina letta).

## Cosa prendiamo
- Tavolozza del piano coerente: `bg #111418`, `surface #1B2027`, `text #E8ECF1`, accenti pastello, corpo ≥ 7:1.
- Lampo al prerender accettato e documentato; mitigazione `<meta name="color-scheme" content="light dark">` (A4).
- Test web: attendere l'idratazione; `emulateMedia` basta per A2.
- `expo-system-ui` con `npx expo install`; aggiungerlo anche a `plugins` di `app.json` (richiesto con CNG).

## Cosa evitiamo
- Dare per certo che `"automatic"` basti su Android senza prova (prova: APK sul telefono, a carico dell'umano).
- Nero e bianco puri, accenti saturi, colori fissi negli stili a livello di modulo.

## Idee per dopo
Preferenza del tema nell'app; elevazione tonale; sfondo della finestra di avvio sull'APK.

## Da verificare [DA VERIFICARE]
`docs.expo.dev/versions/v58.0.0/sdk/system-ui` per `"automatic"` su Android; superficie dark M3; react-native-web 0.21.4 esatta.

Concorrenti analizzati: nessuno (la ricerca non li copre per questa fetta).
