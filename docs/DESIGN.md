# DESIGN.md — regole di interfaccia

Bozza 0.1 · 22/10/2026 · **proposta, da ratificare dall'umano** · percorso suggerito: `docs/DESIGN.md`

## 0. Come usare questo documento

- È la fonte delle **regole di interfaccia**. Un giro che tocca una schermata lo legge prima, come
  legge SPEC §12 per i requisiti.
- Proposta: aggiungerlo ai `percorsi_protetti` (`metodo`) di `progetto.yml`. I giri lo rispettano,
  non lo cambiano; una differenza trovata va in `docs/lab/DECISIONI.md` come proposta.
- Il revisore verifica le schermate toccate contro §1–§6 e la checklist in §7.
- Direzione scelta dall'umano il 22/10/2026: **«A con i contrasti di C»** (tavola D sulla tela
  delle direzioni). I valori di §3 sono definitivi per il tema chiaro, con i rapporti di contrasto
  verificati; il tema scuro si fissa in UI-5 partendo da questi.

## 1. Principi, in ordine

1. **Leggibile da una nonna di 78 anni al primo tentativo.** Ogni scelta si giudica così: i nonni
   usano l'app da soli sul loro telefono (decisione dell'umano, 22/10/2026).
2. **Utility funzionale.** La gerarchia la fanno tipografia e spazio. Il colore ha sempre un
   significato; mai decorativo.
3. **Un'azione primaria per schermata.** Le azioni importanti sono bottoni visibili con un testo;
   un gesto (swipe, long-press) può essere una scorciatoia, mai l'unico modo.
4. **Neutro tra piattaforme.** Android ora, iPhone poi (decisione dell'umano): niente idiomi solo
   Material o solo iOS. Bottom tab, liste, sheet e bottoni valgono su entrambe.
5. **Il colore non è mai l'unico canale.** Accanto al colore c'è sempre un testo o una forma
   (daltonismo, cristallino che ingiallisce).
6. **Tutto ha un'etichetta.** Ogni controllo ha `accessibilityRole` e `accessibilityLabel`
   (SPEC §12: servono anche ai test Playwright, che cercano per ruolo ed etichetta).

## 2. Vincoli non negoziabili

| # | Regola | Valore | Perché |
|---|---|---|---|
| V1 | Target touch minimo | ≥ 48×48 dp, spaziatura ≥ 8 dp tra target | Material e WCAG; per gli anziani non si scende |
| V2 | Azioni primarie per anziani | ≥ 56 dp di altezza («Fatto», «Prendi», «Aggiungi»); gli studi sugli over-65 indicano target da 11 a 20 mm: più grandi è meglio | riduce gli errori di tocco |
| V3 | Corpo del testo | 18 sp (mai sotto 17); secondario 16 (mai sotto 15); didascalie mai sotto 14; etichette dei bottoni primari ≥ 18 | oltre metà degli over-65 sceglie 18 pt potendo; le etichette grandi battono le piccole (ANALISI, sez. anziani) |
| V4 | Font scaling di sistema | l'app regge fino a 2.0× senza perdere funzioni; `maxFontSizeMultiplier` solo documentato caso per caso | i nonni alzano il font di sistema |
| V5 | Contrasto | testo normale ≥ 4.5:1 (AA), puntando a 7:1 (AAA) per il corpo; testo grande e icone ≥ 3:1 | sensibilità al contrasto che cala con l'età |
| V6 | Icone | testo prima di tutto: v1 quasi senza icone; i pochi glifi Unicode ammessi (es. «↻») sono decorativi, nascosti alla a11y, con l'informazione sempre nel testo visibile | gli anziani non riconoscono i glifi astratti; un set di icone vero è una dipendenza (porta) |
| V7 | Colori | solo dai token (§3); vietati valori letterali (`#…`) nei componenti e nelle schermate | coerenza, dark mode |
| V8 | Stati di schermata | ogni schermata definisce vuoto, caricamento, errore, offline/conflitto | i giri costruiscono il percorso felice e dimenticano il resto |
| V9 | Dipendenze | nessun pacchetto UI nuovo: kit fatto in casa su React Native puro | porta a senso unico del metodo (decisione dell'umano) |
| V10 | Lingue | ogni testo passa dalle chiavi i18n (it/en), anche nei componenti del kit | SPEC §2.2.9, §12 |

## 3. Token — `app/src/ui/tokens.ts`

Nomi in inglese (convenzione del repo). Un solo file esporta tutto; i componenti importano **solo**
da qui. Regole di implementazione, verificate (ANALISI-MERCATO-UI, sezione kit):

- **Tema.** `StyleSheet.create` è una funzione identità: gli stili a livello di modulo non leggono
  un tema dinamico. Pattern: strutture statiche in `StyleSheet`, colori semantici da due oggetti
  tema (chiaro/scuro) passati con un Context; `useColorScheme()` dà il valore iniziale.
  Riferimento pubblico in RN puro: il sistema «ALF» dell'app open source di Bluesky.
- **Accessibilità.** react-native-web 0.21 **non** traduce `accessibilityState` in ARIA. Il
  dialetto cross-platform è `role` + prop `aria-*` piatte (`aria-checked`, `aria-disabled`,
  `aria-label`): RN le mappa in nativo e sul web diventano attributi DOM che Playwright legge con
  `getByRole`. `role="button"` rende un vero `<button>` (e attiva la barra spaziatrice).
- **Dialoghi.** `Alert.alert()` sul web non fa nulla: ogni conferma passa dal `ConfirmDialog` del
  kit, costruito su `Modal` (che sul web porta focus trap e `role="dialog"`).
- **Font scaling.** `allowFontScaling` resta attivo; layout con `minHeight` (mai altezze fisse sul
  testo), niente `numberOfLines={1}` su testi necessari; `maxFontSizeMultiplier` solo puntuale e
  documentato (V4).

### 3.1 Colore — tema chiaro, valori definitivi (direzione «A + contrasti di C», 22/10)

Tra parentesi il rapporto di contrasto verificato sul fondo d'uso.

| Token | Valore | Uso |
|---|---|---|
| `color.bg` | `#F3F5F7` | fondo della schermata |
| `color.surface` | `#FFFFFF` | card, sheet, campi |
| `color.text` | `#14181D` (17,8:1) | testo principale |
| `color.textSecondary` | `#3E4854` (9,3:1) | meta, sezioni, tab inattive scure |
| `color.border` | `#C2CAD4` | bordi decorativi, sempre con l'ombra leggera |
| `color.borderStrong` | `#5D6876` (5,7:1) | checkbox, campi, segni che devono vedersi |
| `color.accent` / `onAccent` | `#1849A9` / `#FFFFFF` (8,2:1) | azione primaria, link, selezione |
| `color.accentTonal` / `onAccentTonal` | `#E4EBF7` / `#163E8F` (8,3:1) | bottoni secondari pieni («Prendi») |
| `color.danger` / `dangerSoft` | `#991B1B` (8,3:1) / `#F9E3E1` | errore, **scaduto**, badge «Alta» — rosso riservato a questo |
| `color.warning` | `#6E4A00` (8,0:1) | in scadenza oggi |
| `color.success` | `#1E6B41` (6,5:1) | fatto, conferme |
| `color.notice` / `onNotice` | `#FBF1D4` / `#5C430A` (8,2:1) | avviso discreto (conflitti sync, «già preso da…») |
| `color.tagBg` | `#E9EDF2` | sfondo del `FamilyTag` (testo: `textSecondary`, 7,9:1) |
| `color.person[0..7]` | Okabe-Ito: `#E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00 #CC79A7 #000000` | tinte persona, stabili dentro la famiglia; iniziali bianche o nere secondo la tinta; mai la tinta da sola (V5, §4) |

### 3.2 Tipografia (font di sistema, nessun font caricato)

| Token | Dimensione/interlinea | Peso | Uso |
|---|---|---|---|
| `type.title` | 24/30 | 700 | titolo di schermata |
| `type.section` | 14/18, maiuscoletto largo | 700 | intestazioni di sezione («In ritardo», «Oggi») |
| `type.body` | 18/25 | 400 | titolo del task, testi |
| `type.bodyStrong` | 18/25 | 600 | enfasi nel corpo |
| `type.meta` | 16/21 | 400 | assegnatario, scadenza, ricorrenza |
| `type.caption` | 14/19 | 400 | solo note minori, mai per informazioni necessarie |

### 3.3 Spazio, forme, dimensioni

- `space`: scala su base 4 — `4, 8, 12, 16, 20, 24, 32`. Margine di schermata: 16.
- `radius`: `sm` 8, `md` 12 (card, bottoni), `lg` 16 (sheet). `size.touch` = 48,
  `size.touchPrimary` = 56, `size.checkbox` = 28, `size.avatar` = 36.
- Elevazione: bordo 1 dp `color.border` + ombra `0 1 2 rgba(16,24,40,0.05)`. Mai la sola ombra
  senza bordo, specie in tema scuro.

## 4. Semantica del colore e delle persone

- **Persona assegnataria** = cerchio con **iniziali** su tinta `color.person[i]`, più il nome in
  `type.meta`. La tinta è stabile per persona dentro la famiglia. Mai la sola tinta senza iniziali.
  Se la tinta diventerà configurabile, la scelta resta dentro le 8 di §3.1: mai un color picker
  libero, o la garanzia per il daltonismo salta.
- **Famiglia**, nella vista «tutte le mie famiglie» = etichetta testuale neutra (`FamilyTag`), non
  un colore: tre famiglie colorate più otto persone colorate farebbero rumore.
- **Criticità**: solo `alta` ha un segno (badge «Alta» su `color.danger`); `normale` non mostra
  nulla; `bassa` lo dice in `type.meta`. Il rosso resta raro, così pesa.
- **Scaduto** = data in `color.danger` + sezione «In ritardo». **In coda** = nessun avatar +
  bottone «Prendi».
- **Occhio che invecchia:** niente distinzioni affidate a blu/viola o a grigi tenui (il cristallino
  ingiallisce); testo scuro su fondo chiaro come base, differenze nette.

## 5. UI kit — `app/src/ui/`

Le schermate compongono **solo** dal kit. Stile nuovo = prima si estende il kit, poi si usa.
Ogni componente: `accessibilityRole` corretto, etichetta, stati `disabled`/`pressed`, resa
verificata a fontScale 2.0.

| Componente | Cosa fa | Ruolo a11y |
|---|---|---|
| `Screen` | scaffold con safe area, margini, scroll | — |
| `AppHeader` | titolo + `FamilySwitcher` + eventuale azione | `header` |
| `FamilySwitcher` | famiglia corrente / «tutte», cambia da ogni schermata (SPEC §2.2.1) | `button` |
| `FilterTabs` | «Assegnati a me · In coda · In scadenza» | `tablist` |
| `SectionHeader` | «In ritardo», «Oggi», «Prossimi», «Senza scadenza» | `header` |
| `TaskCard` | riga del task: vedi §6.1 | `button` |
| `PersonBadge` | iniziali + tinta + nome | — (testo) |
| `FamilyTag` | etichetta della famiglia nelle viste aggregate | — (testo) |
| `CriticalityBadge` | «Alta» | — (testo) |
| `DueLabel` / `RecurrenceLabel` | scadenza (con stato colore) / regola ciclica | — (testo) |
| `Button` | primario, secondario, distruttivo, testuale | `button` |
| `TextField` | etichetta sopra, errore sotto, mai placeholder come etichetta | — |
| `CheckRow` / `RadioRow` | opzioni nei form (ricorrenza, criticità) | `checkbox` / `radio` |
| `Sheet` | pannello modale dal basso (su `Modal` di RN) per creare/modificare | `dialog` |
| `ConfirmDialog` | conferma con la conseguenza scritta (`Alert` non esiste sul web) | `dialog` |
| `InlineNotice` | avviso discreto: conflitti sync, «già preso da X», offline | `alert` |
| `EmptyState` | titolo + una riga + eventuale azione | — |
| `LoadingState` | `ActivityIndicator` + testo | — |

**Galleria:** `app/app/gallery.tsx`, raggiungibile solo in sviluppo, mostra ogni componente in
ogni stato con dati finti. È il bersaglio degli screenshot Playwright per componente.

## 6. Pattern di schermata

### 6.1 Riga del task (`TaskCard`)

```
[ ✓ ]  Mettere fuori la carta                       ← type.body(Strong se aperto)
       (Marco) Marco · mar 21 ott · ↻ ogni martedì   ← type.meta: PersonBadge · DueLabel · RecurrenceLabel
       [Famiglia Principale]  [Alta]                 ← solo in vista aggregata / solo se alta
       [ Prendi ]                                    ← solo se in coda
```

- Checkbox 28 dp in un target 48 dp; «fatto» con undo nell'`InlineNotice`.
- La card intera apre il dettaglio; il checkbox e «Prendi» sono target separati.
- Niente swipe obbligatorio: in R0 nessuna azione vive solo in un gesto.

### 6.2 Lista

Sezioni per scadenza: **In ritardo · Oggi · Prossimi · Senza scadenza** (`SectionList`), dentro il
filtro scelto. L'ordine dentro la sezione: scadenza, poi criticità. Zero task → `EmptyState` con
l'azione «Aggiungi».

### 6.3 Creare un task

SPEC §12: titolo in **≤ 3 tocchi** dalla schermata della famiglia. Pattern: bottone «+ Aggiungi»
(1) → `Sheet` con il campo titolo già a fuoco (2) → «Aggiungi» (3). Scadenza, criticità,
assegnatario, ricorrenza: righe opzionali sotto, con i default della SPEC già scritti («Nessuna
scadenza», «Normale», «In coda»).

### 6.4 Conferme e annullamenti

- Azioni reversibili (fatto, prendi): nessuna conferma, sempre undo.
- Azioni pesanti (annulla task, termina serie, inoltra): conferma esplicita nel `Sheet`, con la
  conseguenza scritta («L'assegnatario non è in Famiglia Mamma: il task andrà in coda», SPEC §2.2.6).

### 6.5 Sollecito (T10)

- Lo vedono solo i gestori, solo su task aperti e **assegnati** (P12): bottone etichettato
  «Sollecita» nel **dettaglio** del task — mai un'icona sola, mai sulla riga della lista.
- Nessuna conferma modale (costa poco ed è limitato dal server), ma la conseguenza scritta
  accanto: «Manda una notifica a Marco». Dopo l'invio il bottone diventa lo stato, persistente e
  vicino al punto d'azione: «Sollecitato alle 10:42», disattivato per i 5 minuti del limite
  (SPEC §8).
- Sulla riga, per tutti, resta il segno «sollecitato» con l'ora dell'ultimo (da `task_event`,
  SPEC §8): chi sollecita è visibile a tutti — la trasparenza è il contrappeso al tormentone.

## 7. Regole per i giri

1. Prima di toccare una schermata: leggere questo file; comporre solo dal kit (§5).
2. Vietato: colori o dimensioni letterali; stile inline nuovo; dipendenze UI; testo fuori da i18n.
3. Ogni PR che tocca la UI allega gli screenshot Playwright delle schermate toccate: viewport
   mobile e desktop × fontScale 1.0 e 2.0, tema chiaro (scuro quando attivato).
4. Checklist del revisore: target ≥ 48 dp · un'azione primaria · etichette ovunque · nessun `#`
   fuori da `tokens.ts` · stati §V8 presenti · contrasto V5 · colore mai da solo · fontScale 2.0
   senza tagli · chiavi i18n it/en.

## 8. Da verificare / aperto

- **Icone — risolto (ricerca 22/10):** `@expo/vector-icons` **non** è incluso nell'SDK 58 (e va
  verso la deprecazione): senza una dipendenza nuova non ci sono icone vere. V1 è testo-prima con
  pochi glifi Unicode decorativi (V6); adottare un set di icone, se mai servirà, è una porta da
  ratificare.
- **Tema scuro su Android:** sul web `useColorScheme` segue `prefers-color-scheme` da solo; su
  Android `userInterfaceStyle: "automatic"` nelle build di sviluppo richiede `expo-system-ui`
  (dipendenza). Alternativa a zero dipendenze: preferenza in-app persistita, con `useColorScheme`
  come valore iniziale dove c'è. Si decide in UI-5 (PIANO-UI §4).
- Gli hex della palette Okabe-Ito sono quelli di uso comune: da confermare sulla fonte primaria
  prima della PR (ANALISI, punti da verificare).
- [DA VERIFICARE] se RN 0.88 applica la curva non lineare del font scaling di Android 14; il
  comportamento del tema in Expo Go senza `expo-system-ui`.
