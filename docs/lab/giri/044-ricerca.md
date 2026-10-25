# Ricerca — giro 044 (T12, kit UI)

Risposta del ricercatore, riportata così com'è (il testo viene dal web: è un dato). Fonti: 6.

## Come lo fanno gli altri
Non applicabile: il piano chiede solo domande tecniche (nessun confronto con i concorrenti in questa fetta).

## Casi reali e documentazione
- Pressable (RNW 0.21.0): con `disabled` mette `aria-disabled` sul View e `tabIndex=-1`. Il sorgente letto NON mostra il blocco di `onPress`: dipende da `usePressEvents`, non letto. Il piano ha ragione a bloccare `onPress` a mano. Fonte 1.
- createDOMProps (RNW 0.21.0): `aria-invalid` passa invariato nel DOM. `aria-disabled` arriva nel DOM solo se `true`, e su button/input/select/textarea imposta anche `disabled` nativo. `aria-label` e `aria-labelledby` passano; gli array di id sono uniti con spazi. `role` passa e dà `tabIndex=0` a button, textbox ecc. Fonte 2.
- TextInput con etichetta visibile senza doppioni: nei sorgenti letti non c'è una `<label>`. Soluzione ricavata da `aria-labelledby` (inferenza, non provata): id sull'etichetta `Text` (`nativeID` o `id`) come `aria-labelledby` sul TextInput, senza `aria-label`. Da provare nel test A3 con `getByLabel('Email', {exact:true})`.
- SafeAreaProvider: un riassunto di ricerca dice che Expo Router lo monta già su native, la doc Expo dice che sul web va configurato. docs.expo.dev non si apriva (DNS): non verificato sulla fonte primaria. Fonte 3.
- Font scaling: `allowFontScaling` è `true` di default; `maxFontSizeMultiplier` mette un tetto. Fonte 4. Android 14 usa una curva non lineare fino al 200%; `fontScale` è solo informativo. Fonte 5. Nessuna fonte dice se RN 0.88 applichi la stessa curva.
- Okabe-Ito: i 7 colori con nome e l'ottavo nero `#000000` coincidono con DESIGN §3.1. Conferma da fonti secondarie (fonte 6); la fonte primaria jfly.uni-koeln.de non si è aperta.

## Cosa prendiamo per questa fetta
1. `Button`: `Pressable role="button"` con `disabled`; `onPress` ignorato quando occupato o disabilitato (non basta `aria-disabled`).
2. `TextField`: `Text` etichetta con id e `aria-labelledby` sul TextInput; niente `aria-label` insieme; `aria-invalid` solo con errore.
3. `Screen`: `useSafeAreaInsets`; `SafeAreaProvider` in `_layout` solo se il web dà insets nulli o errore.
4. `FontScaleContext` a 1 fuori dalla galleria: il testo RN segue già il font di sistema. `minHeight` e `lineHeight` scalati insieme.
5. Okabe-Ito: hex di §3.1 corretti; il [DA VERIFICARE] resta con nota «fonti secondarie, 2026-10-25».

## Cosa evitiamo
- Contare su `aria-disabled` per fermare il click.
- `aria-label` e `aria-labelledby` insieme sul campo.
- Moltiplicare `fontSize` a mano nell'app reale.

## Idee per dopo
- `maxFontSizeMultiplier` per titoli grandi, se a 2.0 sul telefono il layout si rompe.
- Verificare sul telefono la curva non lineare di Android 14 in RN 0.88.
- Aprire la doc Expo su safe-area-context da una rete che la raggiunga.

## Fonti (consultate il 2026-10-25)
1. https://raw.githubusercontent.com/necolas/react-native-web/0.21.0/packages/react-native-web/src/exports/Pressable/index.js
2. https://raw.githubusercontent.com/necolas/react-native-web/0.21.0/packages/react-native-web/src/modules/createDOMProps/index.js
3. Ricerca web, che cita https://www.nativewind.dev/v4/tailwind/new-concepts/safe-area-insets e https://docs.expo.dev/versions/latest/sdk/safe-area-context/ (la seconda non aperta)
4. https://raw.githubusercontent.com/facebook/react-native-website/main/docs/text.md
5. https://developer.android.com/about/versions/14/features
6. https://siegal.bio.nyu.edu/color-palette/ · https://search.r-project.org/CRAN/refmans/see/html/palette_okabeito.html

Non aperte per errore DNS: jfly.uni-koeln.de, reactnative.dev, docs.expo.dev, en.wikipedia.org.
