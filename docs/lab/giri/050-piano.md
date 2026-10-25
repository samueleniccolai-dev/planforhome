---
giro: 050
traguardo: T14
traguardi_extra: []
tipo: costruzione
fase: revisione
inizio: 2026-10-25T20:54:19Z
ricerca: sì
accettazione: 71ab172
ripreso: no
---
# Piano del giro 050 — T14 parte 2: `ConfirmDialog` e inoltro con la conseguenza scritta

## Fetta e traguardo
T14 (UI-3: form e sheet), parte 2 di 2, giro `costruzione`: la parte 1 (giro 049, PR #73) ha
portato `TextField.hint`, `CheckRow`, `RadioGroup`, `Sheet`, `DateField` e il «Nuovo task» nello
`Sheet`. Questa fetta chiude il traguardo: `ConfirmDialog` nel kit, `ForwardDialog` rifatto sul
kit con la **conseguenza scritta prima della conferma** (SPEC §2.2.6), e le conferme di «Annulla
task» e «Termina la serie» spostate nel `ConfirmDialog` (DESIGN §6.4: «conferma esplicita nel
`Sheet`, con la conseguenza scritta»). Dopo questo giro: `verifica-produzione` di T14.
Fonti: SPEC §2.2.5, §2.2.6, §12; DESIGN §5, §6.4; rapporto 049; decisioni 129, 138, 140, 143–147.

Cosa si costruisce:
- **`ConfirmDialog` (`app/src/ui/ConfirmDialog.tsx`)**, composto sullo `Sheet` del kit (niente
  `Modal` nuovo, niente `Alert`):
  - prop: `title` (nome del dialogo = titolo visibile), `consequence` (testo della conseguenza,
    sempre visibile sopra i bottoni), `confirmLabel`, `cancelLabel`, `tone`
    (`'destructive' | 'primary'`), `busy`, `confirmDisabled?` con `disabledReason?`, `onConfirm`,
    `onCancel`, `children?` (contenuto sopra la conseguenza, per esempio la scelta della
    famiglia);
  - il bottone di conferma (`Button` del kit, variante dal `tone`) ha come descrizione accessibile
    (`aria-describedby`) la conseguenza o, se disattivato, il motivo; disattivato durante `busy`;
  - «Chiudi» dello `Sheet`, Esc (web) e Indietro (Android, `onRequestClose`) = `onCancel`;
  - il fuoco iniziale va sul bottone **di annullamento** (il meno distruttivo), con un `useEffect`
    nel contenuto del `Modal` (non `useLayoutEffect` né `autoFocus`, per non rompere il
    salvataggio di `activeElement` fatto dal focus trap); alla chiusura il fuoco torna al
    controllo che ha aperto il dialogo, se c'è ancora;
  - `onCancel` stabile (`useCallback` in chi lo passa): `ModalContent` di react-native-web
    ri-registra il listener di Esc a ogni funzione nuova (ricerca 050, punto 3);
  - su Android `aria-describedby` non esiste: il bottone di conferma riceve la conseguenza (o il
    motivo) anche come `accessibilityHint`; da provare con TalkBack nel giro `verifica-produzione`;
  - test Jest in `app/src/ui/__tests__/`; voce nella galleria `/gallery?set=form`.
- **`ForwardDialog` rifatto** (`app/src/task/ForwardDialog.tsx`) su `ConfirmDialog` +
  `RadioGroup`:
  - nome del dialogo invariato «Inoltra il task»; sotto il titolo, il titolo del task;
  - `radiogroup` «Famiglia di arrivo» con le altre famiglie (righe `RadioRow`, nessuna scelta
    all'apertura);
  - «Conferma inoltro» disattivato finché non si sceglie una famiglia, con il motivo «Scegli la
    famiglia di arrivo.» (chiave nuova);
  - scelta la famiglia, **la conseguenza è sempre scritta** prima della conferma (chiavi nuove,
    testi italiani esatti):
    - assegnatario membro dell'arrivo: «Il task passa in {family} e resta assegnato a {name}.»
    - task in coda: «Il task passa in {family} e resta in coda.»
    - assegnatario non membro: resta l'avviso attuale `role="alert"` «Avviso inoltro» con
      «{name} non fa parte di {family}: il task andrà in coda.» (test 016 F1/F2 invariati); la
      conseguenza è quel testo;
    - membri dell'arrivo non leggibili (rete, offline): «Il task passa in {family}. Se {name} non
      ne fa parte, andrà in coda.»;
    - durante la lettura dei membri: «Controllo chi fa parte di {family}…» e conferma disattivata
      (come oggi `checking`);
    - task ciclico: si aggiunge «La ricorrenza resta uguale.» (SPEC §2.2.6, ultimo punto);
  - esito come oggi (decisione 140): il dialogo si chiude, l'avviso («Inoltrato in {family}»,
    403, rete) va nella sezione; la riprova dopo errore di rete resta idempotente;
  - in `ForwardDialog.tsx` nessun `StyleSheet`, `Pressable`, `Text` di `react-native`, nessun
    import da `@/ui/tokens`, nessun colore `#…`.
- **«Annulla task», «Annulla questa volta», «Termina la serie»** in `TasksSection`: il tocco apre
  un `ConfirmDialog` invece dei due bottoni in riga. Etichette dei bottoni **invariate**
  («Conferma annullamento» / «Non annullare», «Conferma: termina la serie» / «Non terminare»),
  così i test vecchi cambiano solo il contenitore (riga → dialogo). Testi (chiavi nuove):
  - «Annulla task» → dialogo «Annullare «{title}»?», conseguenza «Il task passa tra i Chiusi come
    annullato e nessuno lo vedrà più da fare.»;
  - «Annulla questa volta» → dialogo «Annullare questa volta?», conseguenza «Si annulla solo
    questa occorrenza di «{title}»; le prossime restano.»;
  - «Termina la serie» → dialogo «Terminare la serie «{title}»?», conseguenza «Si annulla questa
    occorrenza e non ne arriveranno altre.» (SPEC §2.2.5).
  Lo stato `confirming` resta in `TasksSection`; nessuna logica nuova nel dialogo.
  **Esito (scelta (a) dopo la critica)**: come l'inoltro (decisione 140), dopo `run` il dialogo
  si chiude **sempre**, riuscito o no (abort, 403, `changed`, `notFound`): `setConfirming(undefined)`
  non dipende più da `saved`. L'avviso va nella sezione (`role="alert"`, mai nascosto da un dialogo
  `aria-modal` rimasto aperto). Il fuoco torna al bottone che ha aperto il dialogo («Annulla task»,
  «Annulla questa volta», «Termina la serie») se c'è ancora; dopo un errore c'è sempre. La riprova
  riusa lo stesso `mutationId` (chiave `cancel:{id}` / `endSeries:{id}` di `attemptFor`, invariata).
  I bottoni che aprono il dialogo restano montati mentre il dialogo è aperto (servono per il fuoco).
- **Galleria `/gallery?set=form`**: `ConfirmDialog` dimostrativo, bottone «Apri la conferma» →
  dialogo «Togliere la gita dal calendario?», conseguenza «La gita sparisce per tutta la
  famiglia.», «Togli la gita» (distruttivo) e «Tieni la gita». Chiavi i18n anche in inglese.
- **Test di accettazione vecchi adattati** (decisione 138/147, nel commit `test(acceptance)`):
  011 (conferma dell'annullamento cercata nel dialogo invece che nella riga), 014 (annulla
  occorrenza e termina serie: bottoni di conferma e «Non terminare» nel dialogo), 047 F9 (conferma
  dell'annullamento nel dialogo). 016: nessun cambio previsto (dialogo e nomi invariati); se il
  `Modal` cambia qualcosa (fuoco di F5), lo si dichiara. Nessun'altra asserzione indebolita. La PR
  va in revisione umana (previsto).

## Fatto quando — controlli eseguibili
Dati demo: quelli di `app/e2e/acceptance/giro-016-fake-api.ts` (Giulia, gestore di «Famiglia
Principale» e membro di «Famiglia Mamma»; «Ritirare le foto» assegnato a Marco, che non è in
Mamma; «Comprare il regalo per la nonna» assegnato a Giulia, che è in Mamma), orologio `MONDAY` di
quel file. Task aggiunti dal test nella fake API (inventati): «Ritirare il cappotto in tintoria»
(Principale, in coda) e «Annaffiare l'orto» (Principale, ogni sabato, assegnato a Giulia). Per
annulla e termina serie: dati di `giro-014-fake-api.ts` («Mettere fuori la carta» ciclico,
«Comprare il pane» semplice).

- [ ] K1 `cd app && npm test -- src/ui` → verdi i test nuovi di `ConfirmDialog`: conseguenza
      visibile, descrizione accessibile del bottone, fuoco iniziale su annulla, `onCancel` da
      «Chiudi», conferma disattivata con `busy` e con `confirmDisabled` (motivo come descrizione).
- [ ] K2 `cd app && npm test -- src/task` → verdi i test di `ForwardDialog`: le quattro
      conseguenze (resta assegnato, resta in coda, va in coda, membri sconosciuti) più la riga
      della ricorrenza; solo l'ultima scelta conta (risposta lenta dei membri della prima scelta).
- [ ] G1 Playwright `/gallery?set=form` (390 e 1280 px × `fs` 1 e 2): «Apri la conferma» → `dialog`
      «Togliere la gita dal calendario?» con `aria-modal`, testo «La gita sparisce per tutta la
      famiglia.» visibile, «Togli la gita» con quella descrizione accessibile, fuoco su «Tieni la
      gita»; Esc e «Tieni la gita» chiudono e il fuoco torna su «Apri la conferma»; target ≥ 48 px;
      nessun traboccamento orizzontale.
- [ ] I1 Inoltro, conseguenza scritta prima della conferma: «Inoltra «Comprare il regalo per la
      nonna»» → dialogo «Inoltra il task»; «Conferma inoltro» disattivato con descrizione «Scegli
      la famiglia di arrivo.»; scelta «Famiglia Mamma» → testo «Il task passa in Famiglia Mamma e
      resta assegnato a Giulia.» visibile, ed è la descrizione accessibile di «Conferma inoltro»;
      nessuna richiesta `POST …/forward` finché non si conferma.
- [ ] I2 Task in coda: «Ritirare il cappotto in tintoria» → «Il task passa in Famiglia Mamma e
      resta in coda.»; conferma → 1 POST, «Inoltrato in Famiglia Mamma».
- [ ] I3 Assegnatario perso: «Ritirare le foto» → `alert` «Avviso inoltro» con «Marco non fa
      parte di Famiglia Mamma: il task andrà in coda.», descrizione di «Conferma inoltro» uguale.
- [ ] I4 Membri non leggibili (`GET …/members` di Mamma risponde 500): «Il task passa in Famiglia
      Mamma. Se Marco non ne fa parte, andrà in coda.»; la conferma è possibile.
- [ ] I5 Ciclico: «Annaffiare l'orto» → la conseguenza contiene «La ricorrenza resta uguale.».
- [ ] I6 Chiusura: «Annulla», «Chiudi» ed Esc → nessun POST, dialogo chiuso, fuoco su «Inoltra
      «…»».
- [ ] C1 «Annulla task» su «Comprare il pane» → `dialog` «Annullare «Comprare il pane»?» con
      `aria-modal`, la conseguenza scritta (descrizione accessibile di «Conferma annullamento») e
      fuoco su «Non annullare»; nella riga 0 bottoni di conferma, «Annulla task» ancora nel DOM
      (`toHaveCount(1)`); «Non annullare» ed Esc → nessuna richiesta, dialogo chiuso, fuoco su
      «Annulla task» della riga; «Conferma annullamento» → 1 `POST …/cancel`, dialogo chiuso, il
      task risulta «Annullato».
- [ ] C2 «Annulla questa volta» su «Mettere fuori la carta» → dialogo «Annullare questa volta?»
      con «Si annulla solo questa occorrenza di «Mettere fuori la carta»; le prossime restano.».
- [ ] C3 «Termina la serie» su «Mettere fuori la carta» → dialogo «Terminare la serie «Mettere
      fuori la carta»?» con «Si annulla questa occorrenza e non ne arriveranno altre.»;
      «Non terminare» → nessuna richiesta, fuoco su «Termina la serie» della riga;
      «Conferma: termina la serie» → 1 richiesta di fine serie; doppio clic → al massimo una.
- [ ] C4 Errore dentro la conferma (scelta (a)): primo `POST …/cancel` di «Comprare il pane»
      interrotto (abort di rete) → dialogo chiuso, `alert` «Qualcosa non ha funzionato. Riprova.»
      visibile, task ancora aperto, fuoco su «Annulla task»; «Annulla task» → «Conferma
      annullamento» → secondo `POST` con lo stesso corpo (stesso `mutationId`), task «Annullato».
- [ ] E1 `en-US`: «Forward the task», «Choose the family of arrival.», la conseguenza «The task
      moves to Famiglia Mamma and stays assigned to Giulia.», il dialogo `Cancel “Comprare il
      pane”?` (virgolette inglesi, come `task.forward.action`); il test delle chiavi mancanti passa.
- [ ] S1 Screenshot Playwright del dialogo d'inoltro con la conseguenza, 390×844 e 1280×800:
      nessun traboccamento orizzontale, «Conferma inoltro» raggiungibile. Il moltiplicatore
      `?fs=` esiste solo nella galleria (`theme.tsx`): il carattere doppio del `ConfirmDialog` lo
      prova G1, senza estendere `?fs=` alla schermata della famiglia.
- [ ] S2 Kit soltanto (test che legge i sorgenti, come N12 del 049): `ForwardDialog.tsx` senza
      `StyleSheet`, colori `#…`, import da `@/ui/tokens`; da `react-native` al massimo `View`.
      `app/src/ui/ConfirmDialog.tsx` esiste e non ha colori `#…`. Che i bottoni di conferma non
      stiano più nella riga lo prova C1 (`toHaveCount(0)` nella riga, `1` nel dialogo).
- [ ] R1 Regressione: `cd app && npm test && npx tsc --noEmit && npx eslint . && npx playwright test`
      verdi, compresi 011, 014, 016, 047 adattati; `cd server && ./mvnw -B -ntp verify` verde
      (server non toccato).

## Fuori perimetro
- Server: nessun endpoint, nessuna migrazione, nessun cambio dell'API d'inoltro.
- Errori dell'inoltro e dell'annullamento dentro il dialogo: restano nella sezione (decisione 140).
- Dove va il fuoco dopo un annullamento riuscito (la riga sparisce): com'è oggi; si annota.
- Undo dell'annullamento; dettaglio del task; modifica di un task nello `Sheet`.
- Assegnatario nel form di creazione; selettore dell'ora; lingua del web (UI-4).
- Bottone disattivato con motivo contro bottone attivo con errore: da valutare in T15.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni»; set di
  icone come dipendenza; accesso Google/Apple, iPhone, Play Store; verifica email e recupero
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-050-confirm.spec.ts` | I1–I6, C1–C4, E1, S1, S2 sopra, sulle fake API di 016 e 014 |
| `app/e2e/acceptance/giro-050-confirm-kit.spec.ts` | G1: `/gallery?set=form`, `ConfirmDialog` |
| test vecchi 011, 014, 047 (e 016 se serve) | adattati: conferma nel dialogo invece che nella riga |

K1, K2 e R1 restano comandi del piano (Jest e regressione).

## Porte
- Doppio senso previste: `ConfirmDialog` sullo `Sheet`; fuoco iniziale sul bottone di
  annullamento; testi e chiavi nuove delle conseguenze; conferme di annulla e termina serie
  spostate nel dialogo; test vecchi adattati (revisione umana).
- Senso unico: nessuna. Nessuna dipendenza, nessun cambio di schema o di API.

## Rischi di concorrenza
- Doppio clic su «Conferma inoltro» o «Conferma: termina la serie»: il blocco `exclusive` di
  `TasksSection` resta l'unico, il bottone è disattivato con `busy`. 016 F4 e C3 contano al
  massimo una richiesta.
- Risposta lenta dei membri dopo un cambio di famiglia: conta solo l'ultima scelta (`latest`),
  la conseguenza non deve mostrare il testo della scelta precedente. K2.
- Dialogo chiuso mentre la richiesta è in volo: l'esito va nella sezione, il dialogo non si
  riapre. Riprova idempotente (decisione 51) invariata.
- Esc o «Non annullare»/«Non terminare» mentre `POST …/cancel` o `…/end-series` è in volo: vale
  come per l'inoltro. Il dialogo si chiude, la richiesta continua, l'esito va nella sezione;
  «Annulla task» e «Termina la serie» restano disattivati con `locked(task)` finché la scrittura
  non finisce, quindi il dialogo non si riapre su una scrittura in volo. La fine di `run` chiude
  un dialogo già chiuso (nessun effetto).
- Scrittura fallita (abort, 403, `changed`, `notFound`): il dialogo si chiude comunque, l'avviso
  è visibile (C4). Prima della critica restava aperto con `aria-modal` e nascondeva l'avviso.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 450; file di produzione ≤ 8; server 0. Deve stare in
una sessione.

## Domande per il ricercatore (al massimo 3)
1. Dialogo di conferma accessibile: `dialog` o `alertdialog` (WAI-ARIA APG), fuoco iniziale sul
   bottone meno distruttivo, descrizione con `aria-describedby`; cosa fa `Modal` di
   react-native-web 0.21 e cosa va fatto a mano.
2. Testi delle conferme distruttive (Material 3, GOV.UK, Apple HIG): titolo come domanda col
   verbo, bottoni con verbo invece di «Sì/No», conseguenza in una frase.
3. Dove va il fuoco quando il controllo che ha aperto il dialogo sparisce dopo la conferma
   (WAI-ARIA APG, buone pratiche).

## Critica ricevuta e cosa cambia
| Punto | Esito | Motivo |
|---|---|---|
| 1 DA CORREGGERE: `change()` azzera `confirming` solo se riesce, il dialogo resta aperto e nasconde l'avviso | accolto, scelta (a) | coerente con l'inoltro e con la decisione 140; (b) è fuori perimetro. Nuovo controllo C4 (abort → dialogo chiuso, avviso visibile, riprova con lo stesso `mutationId`) |
| 2 Esc/«Non annullare» con il POST in volo | accolto | riga nei rischi di concorrenza: come l'inoltro, `locked(task)` impedisce di riaprire |
| 3 Fuoco di ritorno su «Annulla task» (C1, dopo «Non annullare» ed Esc) e su «Termina la serie» (C3); bottone che apre nel DOM | accolto | asserzioni in C1 e C3, `toHaveCount(1)` sul bottone che apre |
| 4a Fuoco iniziale con `useEffect` nel contenuto del `Modal` | accolto | indicazione per il costruttore nel `ConfirmDialog` |
| 4b Android: `accessibilityHint` al posto di `aria-describedby` | accolto | `accessibilityHint` sul bottone di conferma; prova con TalkBack nel giro `verifica-produzione` |
| 4c `onCancel` stabile con `useCallback` | accolto | evita di ri-registrare il listener di Esc |

Scartato: nulla. Precisazioni mie in FINALE: E1 usa le virgolette inglesi di
`task.forward.action`; S1 senza `?fs=` (vale solo nella galleria), il carattere doppio è in G1.

## Idee per dopo
- Errori dell'inoltro dentro il dialogo, come nel «Nuovo task».
- Fuoco dopo un annullamento riuscito (riga sparita): sull'avviso o sull'heading della sezione.
- Tasto Indietro di Android su `ConfirmDialog`: da provare nel giro `verifica-produzione`.
- `accessibilityHint` della conferma su Android letto da TalkBack: da provare nel giro
  `verifica-produzione`.
