# Ricerca del giro 020 — riordino accessibile e Pressable in React Native Web

Risposta del ricercatore (fonti consultate il 2026-10-21; 8 letture o ricerche usate, 5 non si sono aperte).

## Come lo fanno gli altri
Non cercato: la fetta non riguarda i concorrenti e `ricerca-concorrenti.md` non parla di riordino.

## Casi reali e documentazione
- **Web, annuncio:** in react-native-web `AccessibilityInfo.announceForAccessibility` è uno stub vuoto: non crea nessuna regione `aria-live`. Anche `setAccessibilityFocus` è vuoto.
- **`disabled`:** `Pressable` di RNW mette `aria-disabled=true` e `tabIndex=-1` quando è disabilitato. Non mette l'attributo HTML `disabled` (il nodo è un `div` con `role=button`).
- **`toBeDisabled` di Playwright:** non verificato sulla documentazione (playwright.dev non si apre). Da provare con un test reale.
- **Fuoco:** `Pressable` inoltra il `ref` al `View` e non definisce un suo `focus()`. Con `role=button` il nodo ha `tabIndex=0`, quindi si può mettere a fuoco.
- **Disabilitato o nascosto agli estremi:** WAI-ARIA APG, GOV.UK e Spectrum non si sono aperti. Nessuna fonte ufficiale.

## Cosa prendiamo per questa fetta
1. Su web `aria-disabled` basta per «visibile e disabilitato»; provare `toBeDisabled` con un controllo reale.
2. Chiavi stabili (id della voce) e un `ref` per ogni pulsante; dopo lo spostamento `focus()` sul pulsante dello stesso verso, o sull'altro se quello è ora disabilitato.
3. `announceForAccessibility` non fa nulla sul web e su Android non è confermato: annuncio rinviato a «Idee per dopo».
4. Il testo accessibile del pulsante contiene il nome della voce («Sposta su «Latte»»).
5. Nessuna dipendenza nuova.

## Cosa evitiamo
- Contare su `announceForAccessibility` sul web.
- L'attributo `disabled` HTML o `accessibilityState` deprecato: usare la prop `disabled` di `Pressable`.
- Affermare nel rapporto una convenzione APG o GOV.UK senza fonte.

## Idee per dopo
- Annuncio della nuova posizione con `aria-live` sul web e `announceForAccessibility` su Android, dopo aver letto le fonti ufficiali.
- Confronto con APG, GOV.UK e Spectrum su «disabilitato o nascosto agli estremi».
- Verifica con TalkBack reale.

## Fonti
- https://raw.githubusercontent.com/necolas/react-native-web/master/packages/react-native-web/src/exports/AccessibilityInfo/index.js (ramo master, non la 0.21 esatta)
- https://raw.githubusercontent.com/necolas/react-native-web/master/packages/react-native-web/src/exports/Pressable/index.js (stesso limite)
- https://raw.githubusercontent.com/necolas/react-native-web/master/packages/react-native-web/src/modules/createDOMProps/index.js (stesso limite)
- Ricerca web generica su reactnative.dev: conferma solo che `aria-disabled` esiste come prop.
- Non aperte (DNS): reactnative.dev/docs/accessibilityinfo, design-system.service.gov.uk, www.w3.org/WAI/ARIA/apg, playwright.dev.
