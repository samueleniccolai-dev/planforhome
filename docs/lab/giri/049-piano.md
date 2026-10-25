---
giro: "049"
traguardo: T14
tipo: costruzione
fase: critica
inizio: 2026-10-25T18:13:39Z
ricerca: sì
accettazione:
ripreso: no
---
# Piano del giro 049 — T14 parte 1: kit dei form e nuovo task nello `Sheet`

## Fetta e traguardo
T14 (UI-3: form e sheet), parte 1 di 2, giro `costruzione`: T13 è passato nel giro 048 e T14 è
il prossimo traguardo. Il traguardo intero non sta in una sessione: oltre al kit e ai due form va
adattata una mezza dozzina di test di accettazione vecchi che compilano il form attuale. Questa
fetta chiude le **osservazioni 1–5 del 23/10** e il requisito dei **≤ 3 tocchi** (SPEC §12).
Fonti: SPEC §2.2.6, §12; DESIGN §2, §3, §5, §6.3, §7; `docs/lab/ux/2026-10-23-osservazioni-umano.md`;
rapporto 048; decisioni 138 e 140.

Cosa si costruisce:
- **Kit (`app/src/ui/`)**, ogni pezzo con test Jest, stati `disabled`/`pressed`, chiavi i18n e una
  voce nella galleria (`app/app/gallery.tsx`):
  - `TextField` (esiste): resta com'è (etichetta sopra, errore sotto); acquista solo le prop che
    servono al form (`hint?: string` sotto il campo, legato con `aria-describedby`; `innerRef`
    per il fuoco). Il placeholder non sostituisce mai l'etichetta.
  - `CheckRow`: riga intera premibile, `role="checkbox"`, `aria-checked`, segno ✓ visibile nel
    quadrato quando è scelta (stato leggibile senza colore), etichetta testuale accanto, alta
    ≥ 48 dp.
  - `RadioRow` + `RadioGroup`: gruppo `role="radiogroup"` con etichetta visibile sopra (heading
    del gruppo, `aria-labelledby`), righe `role="radio"` con `aria-checked` e pallino pieno
    visibile sulla scelta, alte ≥ 48 dp. Disposizione in colonna (a fontScale 2.0 non si taglia).
  - `Sheet`: pannello modale su `Modal` di React Native (dal basso su Android, centrato largo su
    web desktop), `role="dialog"`, `aria-modal`, `aria-label` = titolo visibile in alto, bottone
    «Chiudi» testuale, Esc chiude sul web, il fuoco torna al controllo che l'ha aperto, contenuto
    scorrevole, `radius.lg`, solo token.
  - `DateField`: etichetta sopra e valore scelto sempre scritto («Nessuna scadenza» se vuota), con
    «Togli la scadenza» quando c'è. **Web** (`DateField.web.tsx`): un `<input type="date">` HTML
    con lo stile dei token e `aria-labelledby` sull'etichetta (selettore del browser, tastiera
    compresa). **Android** (`DateField.tsx`): una griglia del mese composta da `Button` del kit
    (ogni giorno con etichetta completa, per esempio «venerdì 30 ottobre 2026»; «Mese precedente»,
    «Mese successivo», «Oggi»), dentro lo stesso `Sheet` o sotto il campo. Valore sempre
    `yyyy-mm-dd` (data di calendario, nessun fuso in gioco). Nessuna dipendenza nuova.
- **`NewTaskForm` rifatto sul kit e dentro lo `Sheet`** (`app/src/task/NewTaskForm.tsx`):
  - nella vista famiglia il form non è più sempre aperto: c'è il bottone primario **«Nuovo task»**
    (chiave nuova `task.new`; en «New task»); il tocco apre lo `Sheet` «Nuovo task» con il campo
    titolo **già a fuoco**; l'azione «Aggiungi» di `EmptyState` apre lo stesso `Sheet`;
  - campi, ognuno con etichetta visibile sopra: **«Titolo»** (`TextField`), **«Scadenza»**
    (`DateField`), **«Ora (hh:mm, facoltativa)»** (`TextField`, invariato nella logica),
    **«Criticità»** (`RadioGroup`: Bassa · Normale · Alta, default Normale), **«Si ripete»**
    (`RadioGroup` sulle regole attuali, con intervallo, giorni (`CheckRow`) e giorno del mese come
    oggi), **«Lista della spesa»** (`CheckRow`, stato scelto visibile: osservazione 5, opzione);
  - **«Aggiungi task»** (`Button` primario) è disattivato, e si vede, finché il titolo è vuoto o
    fatto di spazi; sotto, legato con `aria-describedby`, il motivo «Scrivi il titolo per
    aggiungere il task.» (chiave `task.titleRequired`), che sparisce quando il titolo c'è;
  - la criticità si manda nel corpo **solo se non è Normale** (il corpo del task col solo titolo
    resta `{id, mutationId, title}` come oggi); `createTask` e `offline.create` la accettano
    (oggi `offline.create` scrive `NORMAL` fisso);
  - riuscita: lo `Sheet` si chiude, il form si svuota, il fuoco torna a «Nuovo task», la sezione
    mostra l'avviso come oggi; errore (`task.invalid`, `recurrence.needsDue`, rete): lo `Sheet`
    resta aperto e l'avviso (`InlineNotice`, `role="alert"`) compare **dentro lo `Sheet`**;
  - nessun import di `Pressable`, `StyleSheet`, `TextInput`, `Text` da `react-native` in
    `NewTaskForm.tsx`; nessun `colors` statico; nessun `#` né numero di stile letterale.
- **Test di accettazione vecchi adattati** (precedente: decisione 138) nel commit
  `test(acceptance)`: 010, 013, 014, 019, 046, 047 aprono prima «Nuovo task» e scelgono la
  scadenza dal campo data (`fill('2031-01-07')` sul web); il caso 014 della data impossibile
  («31/02/2031») si trasforma in un caso che il nuovo controllo può ancora produrre (ricorrenza
  senza scadenza, o intervallo non valido). Nessuna asserzione indebolita oltre al cambio di
  interazione. La PR va in revisione umana (previsto).

Resta per la parte 2 (giro 050): `ConfirmDialog` nel kit, `ForwardDialog` rifatto su
`Sheet`/`ConfirmDialog` con la conseguenza scritta prima della conferma (SPEC §2.2.6), le conferme
di «Annulla task» e «Termina serie» sul `ConfirmDialog` se stanno nel budget, gli screenshot del
dialogo d'inoltro. Poi il giro `verifica-produzione` di T14.

## Fatto quando — controlli eseguibili
Dati demo: quelli di `app/e2e/acceptance/giro-047-fake-api.ts` (Giulia, gestore di «Famiglia
Principale» e membro di «Famiglia Mamma»; fuso Europe/Rome), orologio fisso
**2026-10-28T09:00:00Z**. Titoli nuovi inventati: «Comprare il pane», «Portare l'auto in
revisione», «Spesa del sabato», «Annaffiare il basilico».

- [ ] K1 `cd app && npm test -- src/ui` → verdi i test nuovi di `CheckRow`, `RadioRow`/`RadioGroup`,
      `Sheet`, `DateField` (Android, griglia: ottobre 2026 ha 31 giorni anche col cambio dell'ora
      del 25/10; «Oggi» con orologio finto; mese successivo/precedente; «Togli la scadenza»), e
      `TextField` con `hint`.
- [ ] K2 Playwright `/gallery` → per ogni componente nuovo il ruolo giusto (`checkbox`, `radiogroup`
      + `radio`, `dialog`) con etichetta; target ≥ 48 px di altezza; nessun traboccamento
      orizzontale a 390 px con `?fs=2`.
- [ ] N1 `/family?id=<Principale>`: bottone «Nuovo task» → `dialog` «Nuovo task» visibile e il
      campo «Titolo» ha il fuoco (`toBeFocused`).
- [ ] N2 **≤ 3 interazioni**: clic su «Nuovo task», `keyboard.type('Comprare il pane')` (senza
      clic sul campo), clic su «Aggiungi task» → esattamente 1 POST
      `/api/families/<Principale>/tasks` con corpo di chiavi `{id, mutationId, title}` e titolo
      «Comprare il pane»; il dialogo si chiude; «Comprare il pane» è nella lista; il fuoco torna su
      «Nuovo task». Il test conta le interazioni e asserisce `≤ 3`.
- [ ] N3 Etichette visibili: nel dialogo, `getByText` di «Titolo», «Scadenza», «Ora (hh:mm,
      facoltativa)», «Criticità», «Si ripete», «Lista della spesa» visibili; ogni campo si trova
      con `getByLabel`/`getByRole(…, { name })` con lo **stesso** testo; nessun campo ha un
      `placeholder` uguale alla sua etichetta né un `placeholder` senza etichetta.
- [ ] N4 «Aggiungi task» a titolo vuoto e a titolo «   » → `toBeDisabled()`, motivo «Scrivi il
      titolo per aggiungere il task.» visibile e collegato (`toHaveAccessibleDescription`); un
      clic forzato non fa POST. Scritto il titolo → abilitato e il motivo sparisce.
- [ ] N5 Criticità: `radiogroup` «Criticità» con «Bassa», «Normale», «Alta»; «Normale»
      `aria-checked=true` all'apertura; scelta «Alta» per «Portare l'auto in revisione» → POST con
      `criticality: 'HIGH'`, e la riga del task mostra il badge «Alta».
- [ ] N6 Scadenza (web): «Scadenza» mostra «Nessuna scadenza» all'apertura; `fill('2026-10-30')`
      sul campo data → POST con `dueKind: 'DATE'`, `due: '2026-10-30'`; con «Ora» «18:30» →
      `dueKind: 'DATETIME'`, `due: '2026-10-30T17:30:00.000Z'` (fuso della famiglia); «Togli la
      scadenza» torna a «Nessuna scadenza».
- [ ] N7 Lista della spesa: `checkbox` «Lista della spesa» `aria-checked=false` → clic → `true` con
      il segno ✓ visibile; «Spesa del sabato» → POST con `template: 'SHOPPING_LIST'`.
- [ ] N8 Chiusura: Esc o «Chiudi» → il dialogo sparisce, nessun POST, fuoco su «Nuovo task»;
      riaprendo, il form è vuoto. Errore: «Annaffiare il basilico» con «Ogni giorno» e senza
      scadenza → `alert` «Un task ciclico ha bisogno di una scadenza.» (chiave attuale
      `recurrence.needsDue`) **dentro** il dialogo, dialogo ancora aperto, nessun POST.
- [ ] N9 Stato vuoto: famiglia senza task → `EmptyState` «Aggiungi» apre il dialogo «Nuovo task»
      col fuoco sul titolo.
- [ ] N10 `en-US`: «New task», «Title», «Due date», «Criticality», «Low/Normal/High», «Add task»,
      «Write the title to add the task.» (chiavi nuove in `it.json` ed `en.json`; il test delle
      chiavi mancanti passa).
- [ ] N11 Screenshot Playwright del dialogo aperto: 390×844 e 1280×800 × `?fs=1` e `?fs=2`, nessun
      traboccamento orizzontale, «Aggiungi task» raggiungibile scorrendo.
- [ ] N12 Kit soltanto: `grep -nE "from 'react-native'|StyleSheet|colors\b|#[0-9a-fA-F]{3,6}"
      app/src/task/NewTaskForm.tsx` → nessuna riga (salvo import di soli tipi);
      stesso controllo sui file nuovi di `app/src/ui/` per `#` (solo `tokens.ts` ha colori).
- [ ] R1 Regressione: `cd app && npm test && npx tsc --noEmit && npx eslint . && npx playwright test`
      → verdi, compresi i test vecchi adattati; `cd server && ./mvnw -B -ntp verify` verde (server
      non toccato).

## Fuori perimetro
- `ConfirmDialog`, `ForwardDialog`, conferme di annulla/termina serie: parte 2.
- Assegnatario nel form di creazione (DESIGN §6.3 lo cita come riga opzionale; T14 non lo chiede).
- Selettore dell'ora: l'ora resta un `TextField` con etichetta.
- Modifica di un task esistente nello `Sheet`; dettaglio del task.
- Lingua del web (osservazione 6): UI-4.
- Server: nessun endpoint né migrazione nuova.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni»; set di
  icone come dipendenza; accesso Google/Apple, iPhone, Play Store; verifica email e recupero
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-049-new-task-sheet.spec.ts` | N1–N11 sopra, sulla fake API di 047 (o una copia `giro-049-fake-api.ts`) |
| `app/e2e/acceptance/giro-049-form-kit.spec.ts` | K2: galleria, ruoli, etichette, 48 px, fs 2.0 |
| test vecchi 010, 013, 014, 019, 046, 047 | adattati all'apertura dello `Sheet` e al campo data |

K1, N12 e R1 restano comandi del piano.

## Porte
- Doppio senso previste: `Sheet` su `Modal` di RN; `DateField` con `<input type="date">` sul web
  e griglia del kit su Android; chiavi i18n nuove (`task.new`, `task.titleRequired`,
  `task.title`, `task.criticality.*`, `date.*`); etichette cambiate («Scadenza» al posto di
  «Scadenza (gg/mm/aaaa)», «Titolo» al posto di «Titolo del nuovo task»); criticità nel corpo
  solo se ≠ Normale; test di accettazione vecchi adattati (decisione 138, revisione umana).
- Senso unico: nessuna. Nessuna dipendenza nuova (niente `@react-native-community/datetimepicker`:
  sarebbe una porta; la griglia del kit la evita).

## Rischi di concorrenza
- Doppio clic su «Aggiungi task»: il blocco `busy`/`exclusive` di `TasksSection` (decisione 140)
  resta il solo; il bottone del form è disattivato durante l'invio. N2 conta 1 POST.
- Chiudere lo `Sheet` mentre il POST è in volo: la risposta non deve riaprirlo né svuotare un form
  riaperto nel frattempo; il riprova idempotente (decisione 51) usa la stessa chiave. Test Jest.
- Stato del form tra aperture: si svuota alla chiusura (N8); nessun riuso del `mutationId` per un
  task diverso.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 650; file di produzione ≤ 14; server 0. Deve stare in
una sessione.

## Domande per il ricercatore (al massimo 3)
1. `Modal` di React Native 0.88 su react-native-web 0.21: espone `role="dialog"`/`aria-modal`,
   intrappola il fuoco, chiude con Esc (`onRequestClose`) e restituisce il fuoco? Cosa va fatto a
   mano?
2. `<input type="date">` reso via react-dom dentro react-native-web (file `.web.tsx`): etichetta
   con `aria-labelledby`, valore `yyyy-mm-dd`, `fill()` di Playwright, comportamento su Chrome
   Android e desktop; buone pratiche (WCAG, GOV.UK, Material) per i selettori di data accessibili.
3. Bottone disattivato con motivo: `disabled` + `aria-describedby` o bottone attivo che mostra
   l'errore? Cosa dicono le linee guida (GOV.UK, Material 3, WCAG 3.3.1/3.3.2)?

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Selettore dell'ora nel kit (`TimeField`), stesso schema di `DateField`.
- Scorciatoie di scadenza («Oggi», «Domani», «Sabato») sopra il campo data.
