---
giro: 058
traguardo: T17
traguardi_extra: []
tipo: verifica-produzione
fase: chiusura
inizio: 2026-10-26T14:44:41Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 058 — T17 walkthrough a freddo (solo web)

## Fetta e traguardo
T17 (UI-6), solo la parte web, come `verifica-produzione` con 0 righe di codice. È una decisione
dell'umano (26/10): la prova sull'APK la fa l'umano, sta in «Per l'umano» e non blocca il giro.
Fonti: SPEC §12, `docs/lab/PIANO-UI.md` §6, `traguardi.json` → T17 `fatto_quando`.

## Come lavora il revisore: «a freddo»
- Usa **solo** l'app deployata `https://app.planforhome.com`, da un browser (Playwright headless,
  `locale` `it-IT`, fuso `Europe/Rome`, viewport 390×844 come un telefono). Ogni passo lo sceglie
  da ciò che si vede: istantanea di accessibilità (ruoli ed etichette visibili) e schermate.
- **Non legge** `app/`, `server/`, `docs/SPEC.md`, `docs/DESIGN.md`, `PIANO-UI.md` oltre al §6,
  né piani o rapporti dei giri UI (027–057). Non usa URL interni, `id` o chiamate API durante i
  job. Conosce solo: l'URL, le credenziali, i 5 job e i limiti.
- Un job si fa una volta sola, alla prima prova; si annota il percorso reale (ogni tocco, ogni
  esitazione, ogni passo indietro). Un secondo tentativo si annota a parte e non vale per il limite.
- **Tocco** = un clic su un controllo, la scelta di una voce o l'invio di un modulo. Scrivere il
  testo nel campo non conta come tocco (job 2: «oltre al testo»); il login non conta.
- Un ostacolo esterno (rete, proxy, 429, deploy in corso) si dichiara e non è un difetto.

## Dati di prova (inventati, decisione 42)
Li prepara **un passo separato** (l'orchestratore o il costruttore, via API, prima del revisore),
che consegna al revisore solo l'email e la password di A e i titoli attesi di J1 in busta chiusa
(per il confronto alla fine, non prima). Account `verifica058.<epoch>.<x>@example.com`, password
generate al momento e mai scritte nel repository. Fuso delle famiglie `Europe/Rome`.

| Chi / cosa | Come nasce | Serve a |
|---|---|---|
| A, «Giulia Verifica», `locale: "it"` | registrazione, `familyName: "Famiglia Rossi 058"` (F1) | il protagonista di tutti i job, gestore di F1 e F2 |
| F2 «Famiglia Bianchi 058» | A, `POST /api/families` | job 1: seconda famiglia |
| B, «Marco Verifica», `locale: "it"` | registrazione con invito di F1 | membro di F1; assegnatario del task scaduto |

| Task | Famiglia | Stato | Serve a |
|---|---|---|---|
| «Portare Leo dal pediatra», scadenza oggi 17:00, criticità alta, assegnato ad A | F1 | aperto | J1 |
| «Pagare la mensa», scadenza oggi, in coda | F2 | aperto | J1 |
| «Ritirare il pacco», scadenza fra 5 giorni, assegnato ad A | F2 | aperto | J1 (non è «oggi») |
| «Svuotare la lavastoviglie», senza scadenza, in coda | F1 | aperto | J3 |
| «Cambiare la lettiera», scadenza ieri 18:00, assegnato a B | F1 | scaduto | J4 |

Risposta attesa di J1: oggi in F1 «Portare Leo dal pediatra», in F2 «Pagare la mensa»; il
pediatra è il più urgente. «Ritirare il pacco» non è di oggi.

## Fatto quando — controlli eseguibili
Tutti contro `https://app.planforhome.com`, account A, dopo il login.

- [ ] P0 Preparazione: i dati della tabella esistono (`GET /api/families` di A → 2 famiglie;
      `GET /api/tasks` → i 5 task). Se un passo fallisce, il giro si ferma e lo dichiara.
- [ ] J1 «Cosa devo fare oggi» con due famiglie: dalla prima schermata dopo il login, il revisore
      dice quali task sono di oggi e in quale famiglia, e confronta con la busta. Tempo misurato
      dal caricamento della home (`load` + primo controllo visibile) alla risposta scritta,
      contando i tocchi → **≤ 10 secondi** e risposta corretta. Se serve aprire ogni famiglia a
      turno, si annota quanti tocchi e quanti secondi.
- [ ] J2 Creare «Comprare il latte» e lasciarlo in coda (F1) → **≤ 3 tocchi** oltre al testo,
      contati dalla schermata di F1; poi il task è visibile in F1 come «in coda» (non assegnato).
- [ ] J3 Prendere «Svuotare la lavastoviglie» dalla coda e segnarlo fatto → **≤ 3 tocchi** dalla
      schermata di F1; poi il task risulta fatto (non più tra gli aperti).
- [ ] J4 «Cambiare la lettiera» è scaduto: A (gestore) lo riassegna a sé → **senza aiuto**: il
      revisore trova da solo che è scaduto e come riassegnarlo; poi il task mostra A come
      assegnatario. Si annotano tocchi e vicoli ciechi.
- [ ] J5 Creare un task nuovo «Portare fuori la carta» in F1 con ricorrenza «ogni martedì» →
      **senza aiuto**; poi il task mostra la ricorrenza settimanale il martedì e la prossima
      scadenza è un martedì.
- [ ] R1 Rapporto UX `docs/lab/ux/2026-10-26-walkthrough-giro-058.md`: per ogni job percorso
      reale, tocchi, secondi, **giudizio** (completato entro il limite / completato fuori limite /
      non completato) e per ogni difetto una **severità 0–4** (Nielsen: 0 non è un problema,
      1 cosmetico, 2 minore, 3 maggiore, 4 catastrofico), con la schermata o l'etichetta che lo
      prova. Ogni job fuori limite o non completato ha almeno un difetto di severità ≥ 2.
- [ ] R2 Rapporto di verifica `docs/lab/giri/058-rapporto.md` dal modello
      `_modello-rapporto-verifica.md`, con i difetti nel campo `difetti:`.

Esito del traguardo: T17 è `passato` (per il web) solo se nessun difetto ha severità 3–4. Se ce
ne sono, T17 resta `da-fare`: i giri successivi li correggono e un nuovo walkthrough li
ri-verifica. I difetti di severità 0–2 vanno in «Idee per dopo» del rapporto.

## Fuori perimetro
- Qualsiasi riga di codice, test di accettazione, correzione dei difetti trovati (vanno nei giri
  successivi).
- La prova sull'APK e su TalkBack: all'umano, in «Per l'umano» di PROGRESS; non blocca il giro.
- Lettura del codice o dei documenti di progetto da parte del revisore (vedi «a freddo»).
- Pulizia degli account di prova; prove di carico; altri browser.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; «home nonni»; set di
  icone; accesso con Google o Apple, iPhone, Play Store; verifica email e recupero password;
  sync in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno: giro `verifica-produzione`, i controlli sono il walkthrough sopra.

| File | Dato … quando … allora … |
|---|---|
| — | — |

## Porte
- Doppio senso previste: account e dati di prova in produzione (decisione 42); file nuovi in
  `docs/lab/ux/` e `docs/lab/giri/`.
- Senso unico: nessuna.

## Rischi di concorrenza
Nessuna scrittura concorrente: un solo revisore, un solo account attivo. Se un job fallisce a
metà (per esempio un task creato due volte), si annota e non si ripete per «pulire».

## Budget
0 righe di produzione. File: il rapporto UX e il rapporto del giro. Una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`).

## Per l'umano
- Ripetere i 5 job sull'ultimo APK, se possibile da una persona che non ha mai visto l'app, e
  aggiungere i risultati al rapporto UX.

## Idee per dopo

## Critica ricevuta e cosa cambia
(dopo il critico)
