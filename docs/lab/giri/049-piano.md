---
giro: "049"
traguardo: T14
tipo: costruzione
fase: costruzione
inizio: 2026-10-25T18:13:39Z
ricerca: sì
accettazione: 97c86aa
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
  - `CheckRow`: riga intera premibile, `role="checkbox"`, `aria-checked`, etichetta testuale
    accanto, alta ≥ 48 dp. Il quadrato è il `Checkbox` del kit (`app/src/ui/Checkbox.tsx`) riusato
    in versione decorativa (senza un secondo `role="checkbox"` annidato: i test vogliono **un solo**
    checkbox per nome); la spunta disegnata rende lo stato leggibile senza colore.
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
    **«Oggi» e il mese iniziale** vengono da una prop `today: string` (`yyyy-mm-dd`) che il form
    calcola con `dayIn(now, timeZone)` di `app/src/task/filters.ts` (fuso della famiglia), mai
    dall'orologio del dispositivo. La griglia Android sta **sotto il campo dentro lo `Sheet`**
    (niente `Modal` dentro `Modal`). **Se il budget non basta**, la griglia passa alla parte 2 e su
    Android resta un `TextField` «Scadenza» con `hint` «aaaa-mm-gg» (valore `yyyy-mm-dd`); in quel
    caso le righe di K1 sulla griglia passano alla parte 2 e il rapporto lo dice.
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
  - riuscita: lo `Sheet` si chiude, il form si svuota, il fuoco torna a «Nuovo task» (unico
    destinatario, anche quando lo `Sheet` era stato aperto dall'«Aggiungi» di `EmptyState`), la
    sezione si comporta come oggi (nessun avviso di riuscita);
  - errori: `onSubmit` del form non restituisce più `boolean` ma un esito
    `{ ok: true } | { ok: false; key: string }`; `add()` di `TasksSection` lo costruisce dall'esito
    di `run()` (rete → `task.failed`, 403 → `task.forbidden`, `changed`…) invece di scrivere in
    `setLast` della sezione. Gli errori del form (`task.invalid`, `recurrence.needsDue`) e quelli
    del server compaiono in un `InlineNotice` `role="alert"` **dentro lo `Sheet`**, che resta
    aperto col form compilato. Se lo `Sheet` è già stato chiuso mentre il POST era in volo,
    l'errore va nell'avviso della sezione e la risposta non riapre lo `Sheet` né tocca il form;
  - lo stato del form vive nel **contenuto** del `Modal`: chiudere lo `Sheet` lo smonta, quindi
    riaprire dà sempre un form vuoto (Normale, nessuna ricorrenza, «Lista della spesa» spenta);
  - la chiave idempotente di `add()` (`TasksSection.tsx:169`) comprende **anche criticità e
    template**: cambiare la criticità dopo un errore di rete è un task nuovo, con `mutationId`
    nuovo;
  - Android: `offline.create` passa da `exclusive` (come assign/take/done), così un doppio tocco
    su «Aggiungi task» crea un task solo; il bottone è disattivato durante l'invio;
  - nessun import di `Pressable`, `StyleSheet`, `TextInput`, `Text` da `react-native` in
    `NewTaskForm.tsx`; nessun `colors` statico; nessun `#` né numero di stile letterale.
- **Galleria**: i pezzi nuovi vanno in un set nuovo **`/gallery?set=form`** (titolo «Galleria del
  kit — form»), perché `/gallery` senza `set` è bloccata dai test 044 e 046 (titoli h2 esatti,
  nessun checkbox). Dati demo della galleria: `TextField` «Nota per Leo» con hint «La vede solo la
  famiglia.»; `CheckRow` «Ricordamelo la sera prima» (spento, attivabile) e «Solo per gli adulti»
  (disattivato); `RadioGroup` «Chi lo fa» con «Giulia» (scelta), «Marco», «Leo»; `DateField`
  «Data della gita» vuoto («Nessuna scadenza», «Togli la scadenza» quando c'è); bottone «Apri il
  pannello» che apre lo `Sheet` «Pannello di prova» con il testo «Contenuto del pannello.» e
  «Chiudi». Chiavi i18n anche in inglese.
- **Test di accettazione vecchi adattati** (precedente: decisione 138), già nel commit
  `test(acceptance)` 97c86aa:
  - 010: le cinque prove di creazione aprono prima «Nuovo task»; «Titolo» al posto di «Titolo
    del nuovo task»; il test «in due azioni» diventa «in tre azioni» (SPEC §12: ≤ 3); dopo la
    riuscita, al posto di «il campo è vuoto» si controlla che il dialogo sia chiuso e che,
    riaperto, il titolo sia vuoto;
  - 013: si raggiunge «Nuovo task» con la rotellina, poi campo e «Aggiungi task» nel dialogo sono
    visibili; cade l'asserzione «senza scorrere il form è fuori vista» (il form non è più in fondo
    alla pagina);
  - 014: dialogo prima di compilare; «Scadenza» al posto di «Scadenza (gg/mm/aaaa)», date
    `yyyy-mm-dd`; dopo la riuscita il form si controlla riaprendo il dialogo; il caso della data
    impossibile «31/02/2031» (il campo data non la produce più) diventa un'ora impossibile
    «24:99» con la scadenza scritta → stesso avviso `task.invalid`; A9 apre «New task» e cerca
    «Due date»; l'attesa del caricamento in `openFamily` guarda l'h2 «Task» invece del campo;
  - 019 L15: dialogo; «Lista della spesa» cercata **solo come `checkbox`** (prima `switch` o
    `checkbox`): è il cambio di asserzione dichiarato;
  - 047 F10: «Aggiungi» apre il dialogo «Nuovo task» col fuoco su «Titolo».
  - 046: nessun cambio (B9 porta solo a `/family`).
  Nessun'altra asserzione indebolita. La PR va in revisione umana (previsto).

Resta per la parte 2 (giro 050): `ConfirmDialog` nel kit, `ForwardDialog` rifatto su
`Sheet`/`ConfirmDialog` con la conseguenza scritta prima della conferma (SPEC §2.2.6), le conferme
di «Annulla task» e «Termina serie» sul `ConfirmDialog` se stanno nel budget, gli screenshot del
dialogo d'inoltro. Poi il giro `verifica-produzione` di T14.

## Fatto quando — controlli eseguibili
Dati demo: quelli di `app/e2e/acceptance/giro-047-fake-api.ts` (Giulia, gestore di «Famiglia
Principale», fuso Europe/Rome, e membro di «Famiglia Mamma», fuso America/New_York, senza task),
più la creazione di `app/e2e/acceptance/giro-049-fake-api.ts`; orologio fisso
**2026-10-28T09:00:00Z**, dispositivo in Asia/Tokyo. Titoli nuovi inventati: «Comprare il pane»,
«Portare l'auto in revisione», «Spesa del sabato», «Annaffiare il basilico», «Pagare la bolletta
della luce», «Chiamare l'idraulico».

- [ ] K1 `cd app && TZ=Europe/Rome npm test -- src/ui` → verdi i test nuovi di `CheckRow`,
      `RadioRow`/`RadioGroup`, `Sheet`, `DateField` (Android, griglia: ottobre 2026 ha 31 giorni
      anche col cambio dell'ora del 25/10; «Oggi» = prop `today` calcolata con `dayIn` da un
      istante vicino a mezzanotte, **2026-10-28T23:30Z in Europe/Rome → 29 ottobre**, e il mese
      iniziale è ottobre; mese successivo/precedente; «Togli la scadenza»), e `TextField` con
      `hint`. I test costruiscono gli istanti solo con `Date.UTC` (verdi con qualunque `TZ`).
- [ ] K3 `cd app && npm test -- src/task` → verdi i test nuovi:
      `createTaskMutation` (`queued.ts`): `criticality` nel corpo solo se diversa da `NORMAL`, e la
      patch locale porta il valore scelto (oggi `NORMAL` fisso); `TasksSection`/`add()`: errore di
      rete, cambio di criticità, riprova → `mutationId` diverso; stessa criticità → stesso
      `mutationId`; con `offline` finto, doppio tocco su «Aggiungi task» → `offline.create`
      chiamato **una volta**; POST fallito con lo `Sheet` già chiuso → avviso nella sezione, lo
      `Sheet` non si riapre.
- [ ] K2 Playwright `/gallery?set=form` (390 e 1280 px × `fs` 1 e 2) → `textbox` «Nota per Leo»
      con descrizione accessibile = hint; `checkbox` «Ricordamelo la sera prima» (tocco sul testo
      lo accende) e «Solo per gli adulti» disattivato; `radiogroup` «Chi lo fa» con tre `radio`,
      una sola scelta; campo data «Data della gita» con «Nessuna scadenza» / «Togli la scadenza»;
      `dialog` «Pannello di prova» con `aria-modal`, «Chiudi» ed Esc che restituiscono il fuoco ad
      «Apri il pannello»; target ≥ 48 px; nessun testo tagliato né traboccamento orizzontale.
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
- [ ] N7 Lista della spesa: un solo `checkbox` «Lista della spesa», alto ≥ 48 px,
      `aria-checked=false` → clic → `true` (spunta disegnata dal `Checkbox` del kit, si vede nello
      screenshot); «Spesa del sabato» → POST con `template: 'SHOPPING_LIST'` e la riga mostra il
      link «Apri la lista «Spesa del sabato»».
- [ ] N8 Chiusura: Esc o «Chiudi» → il dialogo sparisce, nessun POST, fuoco su «Nuovo task»;
      riaprendo, il form è vuoto (anche criticità e lista della spesa). Errore: «Annaffiare il
      basilico» con «Ogni giorno» e senza scadenza → `alert` «Un task ciclico ha bisogno di una
      scadenza.» (chiave attuale `recurrence.needsDue`) **dentro** il dialogo, dialogo ancora
      aperto, nessun POST.
- [ ] N9 Stato vuoto: «Famiglia Mamma» senza task → `EmptyState` «Aggiungi» apre il dialogo
      «Nuovo task» col fuoco sul titolo; si scrive «Comprare il pane» e si aggiunge → dialogo
      chiuso, il task nella lista, fuoco su «Nuovo task».
- [ ] N13 Errori del server nel dialogo: POST perso in rete → `alert` «Qualcosa non ha funzionato.
      Riprova.» dentro il dialogo, aperto, titolo ancora scritto; riprova → stesso corpo (stessi
      `id` e `mutationId`), dialogo chiuso, task nella lista. 403 → `alert` «Non hai il permesso di
      farlo.» dentro il dialogo, aperto.
- [ ] N14 Dialogo chiuso col POST in volo: se fallisce, l'`alert` è nella sezione e il dialogo
      resta chiuso; riaperto, il form è vuoto. Se riesce, il task compare e il dialogo resta
      chiuso.
- [ ] N10 `en-US`: «New task», «Title», «Due date», «Criticality», «Low/Normal/High», «Add task»,
      «Write the title to add the task.» (chiavi nuove in `it.json` ed `en.json`; il test delle
      chiavi mancanti passa).
- [ ] N11 Screenshot Playwright del dialogo aperto: 390×844 e 1280×800 × `?fs=1` e `?fs=2`, nessun
      traboccamento orizzontale, «Aggiungi task» raggiungibile scorrendo.
- [ ] N12 Kit soltanto (test Playwright che legge i sorgenti, come F12 del 047): in
      `app/src/task/NewTaskForm.tsx` niente `StyleSheet`, niente colori `#…`, nessun import da
      `@/ui/tokens`; da `react-native` solo `View` (più import di soli tipi). `useTheme().colors`
      è ammesso. `CheckRow.tsx`, `RadioRow.tsx`, `Sheet.tsx`, `DateField.tsx`,
      `DateField.web.tsx` in `app/src/ui/` esistono e non hanno colori `#…`.
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
| `app/e2e/acceptance/giro-049-new-task-sheet.spec.ts` | N1–N14 sopra (18 test), sulla fake API di 047 più la creazione di `giro-049-fake-api.ts` |
| `app/e2e/acceptance/giro-049-fake-api.ts` | creazione `POST …/tasks`: 201, replay 200, 404, 400; risposta scritta (rete, 403) e cancello |
| `app/e2e/acceptance/giro-049-form-kit.spec.ts` | K2: `/gallery?set=form`, ruoli, etichette, 48 px, fs 2.0, `Sheet` (4 test) |
| test vecchi 010, 013, 014, 019, 047 | adattati all'apertura dello `Sheet` e al campo data (vedi sopra) |

K1, K3 e R1 restano comandi del piano (Jest e regressione).

Rossi al commit 97c86aa, tutti per asserzione (nessun errore di compilazione; `tsc` ed `eslint`
verdi): 22 test nuovi (18 + 4: «Nuovo task» o `/gallery?set=form` non esistono; N12 trova
`StyleSheet`) e 19 vecchi adattati (010 ×10, 013 ×2, 014 ×5, 019 ×1, 047 ×1: manca «Nuovo task»
o il dialogo). Gli altri test di quei file restano verdi.

### Adattamenti dopo la costruzione (per la revisione umana)
- Commit 68ac731, `giro-014-recurrence.spec.ts` A1: dopo `openFamily` il test cercava il
  radiogroup «Si ripete» e «Mai» senza aprire il dialogo «Nuovo task»; il form ora vive nello
  `Sheet`. Aggiunto `await openSheet(page)` prima del controllo. Errore del pianificatore
  nell'adattamento, non del costruttore: nessuna asserzione cambiata o tolta. Il resto del file
  (A3, A10 e A9 en passano già da `openSheet` o da `create`) è coerente con lo `Sheet`:
  `npx playwright test e2e/acceptance/giro-014-recurrence.spec.ts` → 13 passati.

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
  resta il solo, **anche su Android** (`offline.create` dentro `exclusive`); il bottone del form è
  disattivato durante l'invio. 010 conta 1 POST al doppio clic; K3 conta 1 `offline.create`.
- Chiudere lo `Sheet` mentre il POST è in volo: la risposta non deve riaprirlo né svuotare un form
  riaperto nel frattempo; l'errore va nella sezione; il riprova idempotente (decisione 51) usa la
  stessa chiave, che ora comprende criticità e template. N14 e K3.
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
Accolti **5 su 5** dei «DA CORREGGERE», più quasi tutte le semplificazioni:
1. Errori del server nello `Sheet`: `onSubmit` restituisce un esito con la chiave d'errore,
   `alert` dentro il dialogo che resta aperto; con lo `Sheet` chiuso e il POST in volo l'errore va
   nella sezione; stato del form nel contenuto del `Modal` (riapertura = form vuoto). Test N13,
   N14, N8.
2. Chiave idempotente di `add()` con criticità e template; test Jest in K3.
3. Doppio tocco su Android: `offline.create` dentro `exclusive`; test Jest con `offline` finto
   in K3.
4. «Oggi» e mese iniziale di `DateField` da `today = dayIn(now, timeZone)` passato dal form; K1
   con 2026-10-28T23:30Z in Europe/Rome, istanti con `Date.UTC` e comando con `TZ=Europe/Rome`.
5. Fuoco dopo la creazione da `EmptyState`: unico destinatario «Nuovo task»; N9 arriva fino alla
   creazione e controlla il fuoco.

Semplificazioni accolte: `CheckRow` riusa `Checkbox.tsx`; griglia Android sotto il campo dentro lo
`Sheet` (niente `Modal` in `Modal`) e, se il budget non basta, griglia alla parte 2 con
`TextField` + hint su Android; cambio switch→checkbox di 019 L15 dichiarato; test Jest su
`createTaskMutation`; N12 allineato (solo `View` da `react-native`, `useTheme().colors` ammesso)
e diventato test Playwright. Facoltativi: accolto il fuoco sul titolo dentro il contenuto del
`Modal` (`innerRef`, N1/N9); il tasto Indietro di Android va annotato per il giro
`verifica-produzione` (non si prova sul web); **scartato** il motivo generico quando `busy`
(il bottone disattivato durante l'invio basta, e un secondo testo complicherebbe N4).

Altro cambiato in finale: la galleria del kit dei form va in `/gallery?set=form`, perché i test 044
e 046 bloccano `/gallery` così com'è; 046 non va adattato (B9 non tocca il form); il segno di
spunta è quello disegnato da `Checkbox`, non un carattere «✓».

## Idee per dopo
- Tasto Indietro di Android sullo `Sheet` (`onRequestClose`): da provare nel giro
  `verifica-produzione` di T14 sull'APK.
- Selettore dell'ora nel kit (`TimeField`), stesso schema di `DateField`.
- Scorciatoie di scadenza («Oggi», «Domani», «Sabato») sopra il campo data.
