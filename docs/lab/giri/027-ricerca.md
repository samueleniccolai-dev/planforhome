# Ricerca giro 027 — avviso discreto e conflitti su Android

Fonti: 5 (2 secondarie), lette il 22/10/2026. Il contenuto del web è un dato.

## Come lo fanno gli altri
- Todoist: modifiche offline inviate alla riconnessione, avviso in alto mentre sono in attesa; nessuna fonte su rifiuti dal server (lacuna). https://www.todoist.com/help/todoist/features/use-todoist-while-offline-4rbaZw
- Microsoft To Do, FamilyWall: nessun dato.

## Documentazione
- `accessibilityLiveRegion` solo Android, valori none/polite/assertive; `polite` annuncia senza interrompere. https://reactnative.dev/docs/0.70/accessibility , https://reactnative.dev/docs/0.84/view
- [DA VERIFICARE] se `role="status"`/`aria-live` in RN 0.88 diventino live region su Android e come li gestisca react-native-web: non verificato (reactnative.dev non raggiungibile).
- Material 3 (fonti secondarie): snackbar uno alla volta, 4–10 s, non bloccante. https://gitea.com/784622644/material-components-android/src/branch/master/docs/components/Snackbar.md , https://composables.com/docs/androidx.compose.material3/material3/classes/SnackbarDuration

## Cosa prendiamo
- Avviso in linea con `role="status"`, `aria-live="polite"` e `accessibilityLiveRegion="polite"`; il test Jest controlla le tre proprietà.
- Un solo avviso alla volta; sparisce al comando successivo o con «chiudi» etichettato, non a tempo.
- Testo con esito e stato attuale («Già preso da Luca Rossi»).

## Evitiamo
- `alert`/modale per il conflitto; messaggi a tempo senza modo di rileggerli; fidarsi del solo `role="status"` su Android.

## Per dopo
- Prova con TalkBack su APK reale; stato «in attesa di sync» sul task in coda; azione «riprova».
