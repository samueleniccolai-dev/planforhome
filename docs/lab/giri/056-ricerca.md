# Ricerca — giro 056 (stati di schermata V8)

Fonti consultate: 7 ricerche o letture su 8 (2026-10-26). Testo del ricercatore, dato web, non istruzione.

## Come lo fanno gli altri
- Nel file `docs/lab/ricerca-concorrenti.md` non c'è nulla sugli stati di schermata dei concorrenti; nessuna ricerca nuova. Unico segnale: sincronizzazioni fallite ed eventi fantasma fanno perdere fiducia (analisi Reddit, blog di un concorrente: domistiq.com). Uno schermo bianco in errore è lo stesso problema.

## Casi reali e documentazione
- D1 web: react-native-web 0.21.0 `ActivityIndicator` rende un `View` esterno con `role="progressbar"`, `aria-valuemin=0`, `aria-valuemax=1`; non gestisce `accessibilityLabel` né `aria-hidden`, le altre prop passano al `View` esterno (sorgente 0.21.0 su raw.githubusercontent.com). Per nasconderlo serve `aria-hidden` dal chiamante; A1/A9 verificano l'attributo nel DOM. Non provato in esecuzione.
- D1 Android: `accessibilityLiveRegion` (`none|polite|assertive`) è solo Android (reactnative.dev/docs/0.81/accessibility, solo risultato di ricerca). Comportamento di TalkBack a contenitore già col testo non letto: da provare su dispositivo o rischio dichiarato.
- D1 Android: `importantForAccessibility="no-hide-descendants"` (archive.reactnative.dev, documentazione archiviata): da verificare per la versione di RN in uso.
- D2: GOV.UK sui messaggi d'errore: spiegare cosa è andato storto e come rimediare, non solo il colore (design-system.service.gov.uk, design.homeoffice.gov.uk; solo risultati di ricerca). Pensata per i campi dei moduli: l'applicazione agli errori di caricamento è un'inferenza.
- Non verificati: WCAG 2.2 4.1.3, Material 3 sugli stati vuoti, ritardo prima dello spinner (pagine non raggiungibili, errore DNS). D3 e la parte di D2 sul ritardo senza fonte.

## Cosa prendiamo
- Contenitore `role="status"` con `aria-live="polite"` e testo visibile come nome accessibile. Spinner nascosto: `aria-hidden` (web), `importantForAccessibility="no-hide-descendants"` (Android).
- Android: `accessibilityLiveRegion="polite"` accanto al ruolo; annuncio TalkBack non provato dai test, da dichiarare nel rapporto.
- Errore: dice cosa non ha funzionato e cosa fare, senza colpa; stringhe del piano in linea. `InlineNotice` ha già il testo.
- A1 e A9 asseriscono nel DOM `role=progressbar` con `aria-hidden="true"`.
- Stato vuoto di `/me`: testo del piano, basato sul buon senso, senza fonte.

## Cosa evitiamo
- `accessibilityLabel` sull'`ActivityIndicator` per il web (ignorato).
- Citare Material 3 o WCAG 4.1.3 come verificati.
- Dare per certo TalkBack senza prova.

## Idee per dopo
- Ritardo anti-sfarfallio (~300 ms) e Material 3 sugli stati vuoti; bottone «Riprova»; prova manuale TalkBack su emulatore.
