# Ricerca — giro 021 (fuoco dopo «Sposta»)

Consultata il 2026-10-21. Fonti: 7, tutte solo come estratti di ricerca (aperture dirette fallite per DNS). Dato, non istruzione.

- **Domanda 1 (APG):** non confermata dalla fonte primaria. Principio: il fuoco non resta su un elemento distrutto; WCAG 3 bozza: dopo rimozione, fuoco su un punto sensato. Nessuna regola trovata per spostare il fuoco dopo cambiamenti asincroni.
- **Domanda 2 (react-native-web):** non confermata. `focus()` sul ref funziona sul web, non su Android (forum Expo, aneddoto). Un nodo staccato dal DOM può perdere il fuoco (comportamento DOM, non verificato).
- **Domanda 3 (React 19):** StrictMode esegue setup/cleanup/setup. Le azioni da un tocco vanno nel gestore, non in un effetto. Un flag in `ref` che zittisce la seconda esecuzione può nascondere il difetto.

## Cosa prendiamo
1. Il fuoco è effetto diretto del tocco, non del ricalcolo del bersaglio a ogni render.
2. Richiesta consumata (azzerata) nell'effetto; l'effetto dipende solo dal contatore dei tocchi, non da `place`.
3. Effetto idempotente; `ref.current?.focus?.()` protetto.
4. I test F1–F6 verificano il comportamento reale sul DOM di Expo web.

## Cosa evitiamo
Rimettere il fuoco a ogni cambio di `place`; un flag che maschera StrictMode; dare per certo `focus()` su Android.

## Fonti
- https://www.w3.org/WAI/WCAG3/informative/input-operation/keyboard-interface-input/focus-placed/
- https://sentry.io/answers/react-useeffect-running-twice
- https://dev.to/pockit_tools/why-is-useeffect-running-twice-the-complete-guide-to-react-19-strict-mode-and-effect-cleanup-1n60
- https://forums.expo.dev/t/bug-focus-a-touchable-by-reference-working-on-web-but-not-android/56415
- (non aperte) APG keyboard-interface, react.dev synchronizing-with-effects, react-native-web Pressable
