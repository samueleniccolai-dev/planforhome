# Ricerca giro 026 — sessione Android (consultata il 2026-10-21, solo via WebSearch; WebFetch fallito per DNS)

Da ricontrollare sulle pagine ufficiali (regola 6: [DA VERIFICARE]).

1. **expo-secure-store (SDK 58), Android.** `getItemAsync` dà il valore o `null` e rifiuta in caso di errore di lettura. Nessun config plugin necessario; `configureAndroidBackup` è `true` di default e esclude i dati dal backup. Alla disinstallazione le chiavi del Keystore spariscono: serve un nuovo login. SDK 58: nessun limite imposto da Expo (SDK 53 diceva 2048 byte); un token opaco è piccolo. Il forum Expo (non ufficiale) descrive «Could not decrypt the item»: catturare l'errore, cancellare la voce, tornare al login.
2. **Cookie e `fetch` su Android.** La documentazione RN non dice se `Set-Cookie` venga salvato da solo (la dichiara «instabile»). Il login Android usa solo il Bearer dal corpo e non dipende dai cookie (`credentials: "omit"` se possibile).
3. **AppState.** Stati utili `active` e `background` (`inactive` solo iOS). `currentState` all'avvio può essere `null`: usare `?? "active"`. Nessuna fonte ufficiale sui timer JS in background: la correttezza non si appoggia ai timer, c'è il ciclo al ritorno in `active`.

Fonti (7): docs.expo.dev/versions/v58.0.0/sdk/securestore.md · docs.expo.dev/versions/latest/sdk/securestore.md · forums.expo.io/t/could-not-decrypt-the-item-in-securestore-and-rewriting-the-encryption-keys/48644 · reactnative.dev/docs/0.86/network · reactnative.dev/docs/next/network · reactnative.dev/docs/appstate · reactnative.dev/docs/0.86/appstate

Si prende: `TokenVault` con try/catch su `get()` (errore = nessun token, voce cancellata, test con vault che lancia); `AppState.currentState ?? "active"`; ciclo al ritorno in `active`; nessuna lettura di `Set-Cookie`.
