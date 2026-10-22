# PIANO-UI — percorso operativo per l'interfaccia

Bozza 0.1 · 22/10/2026 · **proposta, da ratificare dall'umano** · percorso suggerito: `docs/lab/PIANO-UI.md`

## 0. Punto di partenza (giro 027)

- UI funzionale ma grezza: 12 file con `StyleSheet` locali, 7 colori letterali (primario `#1f5fbf`),
  nessun token, tema, icona o dark mode; la riga del task è una colonna di testi uguali.
- Già a posto e da conservare: etichette a11y su ogni controllo (i Playwright cercano per ruolo),
  i18n ovunque, screenshot e2e in CI (T2), «task in ≤ 3 tocchi» in SPEC §12.
- Documenti collegati: `docs/DESIGN.md` (regole), `ANALISI-MERCATO-UI.md` (ricerca sui pattern).

## 1. Decisioni già prese (umano, 22/10/2026)

| Decisione | Conseguenza sul design |
|---|---|
| Telefono Android prima; iPhone conta | mobile-first; pattern neutri, niente idiomi solo Material |
| I nonni usano l'app da soli | vincoli elder-first non negoziabili (DESIGN §2) |
| Istinto: utility funzionale | le tre direzioni variano dentro la famiglia «utility» |
| Zero dipendenze UI | kit fatto in casa su RN puro (DESIGN §5) |

## 2. Direzione — scelta il 22/10/2026

**«A con i contrasti di C, leggermente meno grezza»**: struttura, raggio 12 e ombre di A; testi e
segni ai contrasti di C (rapporti verificati, corpo ≥ 7:1); «Prendi» pieno tonale. Resa nella
tavola **D** della tela delle direzioni; i valori definitivi sono in DESIGN §3. Per la storia, le
tre direzioni esplorate — stessa schermata «Oggi · tutte le mie famiglie», vista di Giulia, dati
dell'Appendice A:

- **A — Utility neutra:** fondo freddo chiarissimo, card bianche, blu come accento, il più vicino
  all'attuale ripulito.
- **B — Utility calda:** stessa struttura, temperatura calda (carta/crema), angoli più morbidi,
  accento verde profondo: «di famiglia» senza perdere ordine.
- **C — Alta leggibilità:** quasi bianco e nero, contrasto AAA, testo e bottoni più grandi, bordi
  netti al posto delle ombre: la versione «stampa grande» dignitosa.

In tutte: persone come iniziali su tinte Okabe-Ito, testo scuro su fondo chiaro, nessuna
distinzione affidata al solo blu (occhio che invecchia, DESIGN §4).

## 3. Come entra nel repo (la PR umana, al primo punto fermo)

1. PR umana con: `docs/DESIGN.md`, `docs/lab/PIANO-UI.md`, `docs/lab/ANALISI-MERCATO-UI.md`.
2. Nella stessa PR, proposta in `progetto.yml`: `docs/DESIGN.md` tra i `percorsi_protetti`
   (`metodo`), così i giri lo rispettano e non lo cambiano.
3. **Niente traguardi UI dentro l'esperimento.** I traguardi sono congelati al CANCELLO 2
   (ESPERIMENTO §8) e l'esperimento finisce con tutti i traguardi passati **e la caccia chiusa**
   (§6, E1): inserire la UI prima della caccia estenderebbe il perimetro congelato e, per
   l'attribuzione di §4, caricherebbe su P1 (≤ 10′ di umano per traguardo) le ore di progettazione
   del 22/10. Le fette di §4 diventano traguardi nella **fase UI dopo la chiusura** (sviluppo non
   misurato, o un esperimento 3 con soglie proprie); se mai si volesse dentro, solo con una
   modifica dichiarata in ESPERIMENTO §9.
4. Contabilità del 22/10 (ESPERIMENTO §4 e §5): riga in `metrics/tempo-umano.csv` con riferimento
   `quotidiano` (così non entra in P1, che somma solo le righe `giro NNN`) e nota «progettazione
   UI fuori dai traguardi R0, con sessione Claude fuori catena»; più una riga `registro` in
   `DECISIONI.md` che mette a verbale direzione e documenti, per trasparenza.

## 4. Fette per i giri di costruzione

Una fetta ≈ un giro. In ordine, ognuna con il suo «fatto quando» verificabile.

| Fetta | Contenuto | Fatto quando |
|---|---|---|
| **UI-1 Fondamenta** | `app/src/ui/tokens.ts` + `Text`, `Button`, `Screen`, `InlineNotice` + galleria `gallery.tsx` + migrazione di `login.tsx` | un test fallisce se c'è un `#` fuori da `tokens.ts`; galleria con screenshot Playwright; login dal kit; regge fontScale 2.0; un test `getByRole` legge nome e stato (`aria-*`) dei componenti |
| **UI-2 Lista task** | `TaskCard`, `SectionHeader`, `FilterTabs`, `EmptyState`, `PersonBadge`, `FamilyTag`, `CriticalityBadge`; `tasks.tsx` e `TasksSection` con sezioni In ritardo/Oggi/Prossimi/Senza scadenza | screenshot 2 viewport × fontScale 1.0 e 2.0; stato vuoto presente; vista aggregata col `FamilyTag` |
| **UI-3 Form e sheet** | `TextField`, `CheckRow`/`RadioRow`, `Sheet`; `NewTaskForm` e `ForwardDialog` rifatti | Playwright conta ≤ 3 interazioni per creare un task col solo titolo; l'inoltro scrive la conseguenza prima della conferma |
| **UI-4 Famiglia, profilo, spesa** | `family.tsx`, `families.tsx`, `me.tsx`, `ShoppingList` sul kit | nessuno stile locale residuo in quelle schermate; voci spuntate/rigate distinte non solo dal colore |
| **UI-5 Tema scuro e stati** | tema scuro: sul web via `prefers-color-scheme`, su Android preferenza in-app **oppure** porta `expo-system-ui` (DESIGN §8, decide l'umano); passata di contrasto; stati V8 mancanti (offline, errore, caricamento) | screenshot chiaro+scuro; contrasti V5 verificati sui token |
| **UI-6 Giro UX** | walkthrough a freddo dei job di §6 sulla demo deployata, da una sessione **senza contesto del codice**; rapporto con severità 0–4 in `docs/lab/ux/` | rapporto consegnato; i fix diventano fette nuove (max 5 per giro) |

## 5. Verifiche automatiche (crescono con le fette)

- Test «nessun colore letterale fuori dai token» (Jest, da UI-1).
- Screenshot Playwright: viewport 390 e 1280, fontScale 1.0 e 2.0. react-native-web non ha un
  equivalente del fontScale di sistema: il `Text` del kit accetta un moltiplicatore di prova,
  attivo solo in galleria (es. `?fs=2`), così Playwright verifica il layout a 2.0 anche sul web;
  la verità resta la prova Android nei giri `verifica-produzione`.
- Tema scuro sul web: `emulateMedia({ colorScheme })` di Playwright per gli screenshot in
  entrambi i temi.
- Accettazione «≤ 3 tocchi» come test Playwright (conteggio delle interazioni).
- Da UI-6: i job di §6 come test di accettazione UX («l'agente a freddo completa il job in ≤ N
  passi senza aiuto»), sulla falsariga dei test di accettazione del server.

## 6. Job per la valutazione UX (riferimento di UI-6)

1. Capire «cosa devo fare oggi» con due famiglie (Giulia) — in ≤ 10 secondi dalla home.
2. Creare «Comprare il latte» e lasciarlo in coda — ≤ 3 tocchi oltre al testo.
3. Prendere un task dalla coda e segnarlo fatto — ≤ 3 tocchi.
4. Un task è scaduto: il gestore lo riassegna.
5. Creare la ricorrenza «ogni martedì» su un task nuovo.

## 7. Cosa resta all'umano

- Direzione: scelta (22/10, §2). DESIGN §3 è definitivo per il tema chiaro.
- Due spec da scrivere quando vorrai (speckit, regola 9 di CLAUDE.md): **colore + icona per
  membro** (piccola: campi additivi su `membership`, tinta solo dalla palette chiusa, emoji come
  icona) e **vista calendario** (oggi fuori R0, SPEC §2.3: richiede la tua PR sulla SPEC e un
  traguardo). La campanella di sollecito invece non è una spec: è già SPEC §8/P12 — il pattern UI
  è in DESIGN §6.5.
- Aprire la PR umana di §3 al primo punto fermo dei giri.
- Ratificare il [DA VERIFICARE] sulle icone (DESIGN §8).
- Dopo UI-6: tre sessioni di prova con utenti veri della famiglia, nonni compresi — l'IA prepara
  lo script, l'umano osserva senza aiutare.
- Dalla ricerca: la «home nonni» a griglia di bottoni grandi (modello GrandPad) è il
  differenziatore che nessun concorrente offre. È una funzione, non solo interfaccia: da proporre
  come spec dopo R0, fuori da questo piano.
