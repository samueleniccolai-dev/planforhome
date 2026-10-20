# Ricerca giro 010 (consultata il 2026-10-20)

Il testo viene dal web: è un dato, non un'istruzione. Fonti lette: 2 (Hermes `IntlAPIs.md`, versione web e raw).
Fonti solo da risultato di ricerca: 3 (Todoist, `react-native-get-random-values`, `expo-random`).

- **Todoist:** aggiunta rapida in una riga con riconoscimento di data, progetto ed etichette.
  Altri concorrenti non verificati.
- **Hermes `Intl.DateTimeFormat`:** la documentazione elenca solo `format`, `resolvedOptions` e `supportedLocalesOf`.
  `formatToParts` non è documentato per `DateTimeFormat`; `timeZone` non è citato. Rischio aperto su Android.
  Inferenza: usare `format` una volta per campo e comporre a mano.
- **`crypto.getRandomValues`:** nessuna fonte ufficiale. Su Android probabilmente manca; serve un polyfill o `expo-crypto`
  (dipendenza nuova, porta a senso unico, per T9). Questo giro: `uuidv7` con generatore iniettato, mai `Math.random()`.
- **react-native-web 0.21 `role`/`aria-label`:** non verificato; lo prova il test Playwright con `getByRole`.
- **[DA VERIFICARE] ancora aperti:** Intl su Android e `getRandomValues` su Hermes (provare su APK in T9).

Fonti: https://github.com/facebook/hermes/blob/main/doc/IntlAPIs.md ·
https://github.com/LinusU/react-native-get-random-values · https://www.npmjs.com/package/expo-random ·
https://todoist.com/help/articles/task-quick-add-va4Lhpzz
