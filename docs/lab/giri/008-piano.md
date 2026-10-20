---
giro: 008
traguardo: T4
traguardi_extra: []
tipo: costruzione
fase: piano
inizio: 2026-10-20T07:41:00Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 008 — T4: il ritorno dei task in coda (in attesa di una risposta)

## DOMANDA (blocca il giro)

**Contesto.** L'orchestratore ha chiesto un giro `verifica-produzione` di T4. Ha scritto che il
giro 007 aveva chiuso T4 con «Fatto quando verde, da verificare». I documenti dicono un'altra cosa:
- `007-rapporto.md`: «Traguardo: T4 — parziale (manca il test del ritorno dei task in coda, in
  T5, e un giro verifica-produzione)».
- `006-rapporto.md`: «`onMembershipRemoved` è vuoto, lo riempie T5. T4 non può passare prima».
- Nel codice, `MembershipService.onMembershipRemoved` è vuoto. L'unica migrazione è
  `V1__accounts.sql`. La tabella `task` non esiste.

Il «Fatto quando» di T4 (SPEC §2.1, righe 101–105) chiede questo: quando un account è disattivato,
o una risorsa senza account è cancellata, «i suoi task tornano in coda». Senza task questa frase
non si può provare, né in CI né in produzione. Le regole del pianificatore permettono il tipo
`verifica-produzione` solo se l'ultimo rapporto dice «Fatto quando verde». Qui non lo dice, quindi
il tipo è `costruzione`. Però la sola parte di T4 che manca dipende dai task, cioè da T5.

**Opzioni.**

| | Opzione | Pro | Contro |
|---|---|---|---|
| A | Il giro 008 diventa **T5 parte 1** (server): tabella `task` con `mutation_id`, `version` e `change_log`; creare, assegnare e prendere dalla coda; `onMembershipRemoved` rimette i task in coda. I test di accettazione coprono anche la frase rimasta di T4. | È il piano già scritto nei giri 006 e 007. Il modello dei task nasce una sola volta, con tutto il rigore di T5 (vincolo sull'assegnatario, idempotenza, coda contesa). | Il traguardo del giro cambia da T4 a T5: lo decide l'orchestratore. T4 resta `in-corso` fino a un giro di verifica che venga dopo questa fetta. |
| B | **Costruzione minima sotto T4**: una tabella `task` ridotta (id, famiglia, titolo, assegnatario) e un endpoint per creare un task, quanto basta per provare il ritorno in coda. | Il traguardo resta T4 e la sua frase si chiude subito. | Anticipa il modello di T5 senza `mutation_id`, `change_log` e permessi P1–P9. Poi T5 dovrebbe aggiungere colonne con nuove migrazioni, o lavorare intorno a un modello nato debole. Le migrazioni sono solo aggiunte, quindi una scelta sbagliata qui resta per sempre. |
| C | **Verifica in produzione parziale** di T4: tutto il resto del «Fatto quando» contro `https://app.planforhome.com`. | Trova presto i difetti di produzione dei giri 006 e 007 (P13–P15, Luca e Giulia sul web). | Va contro la regola sul tipo. T4 non può diventare `passato` in ogni caso, e servirà un secondo giro di verifica dopo i task: un giro usato senza far avanzare nessun traguardo. |

**Raccomandazione: A.** Poi un giro `verifica-produzione` di T4, che ripeta in produzione anche i
controlli dei giri 006 e 007.

**Cosa succede dopo ogni risposta.**
- **A**: l'orchestratore rilancia la BOZZA con `traguardo: T5`, e io riscrivo il piano come T5
  parte 1. Server soltanto, `ricerca: no`, una migrazione nuova `V2__tasks.sql`, nessuna
  dipendenza nuova. Nel «Fatto quando» entrano le due frasi di T4 sul ritorno in coda (account
  disattivato, risorsa cancellata). Le schermate dei task e il Playwright di T5 vanno in una
  parte 2.
- **B**: riscrivo questo piano come costruzione T4. Il «Fatto quando» contiene: 2 test di
  accettazione (gestore toglie l'ultima appartenenza di un utente, risorsa cancellata), il task
  torna con l'assegnatario vuoto, e il test di isolamento parametrico sul nuovo endpoint. La
  migrazione `V2__tasks.sql` ha già le colonne di SPEC §6, per non rinominarle dopo.
- **C**: riscrivo questo piano come verifica parziale, sul modello di `005-piano.md`. Alla fine T4
  resta `in-corso`, e lo dice anche il rapporto.

## Fetta e traguardo
In sospeso fino alla risposta. Fonti: SPEC §2.1, §2.2.1, §5 (P13–P15), §6; `traguardi.json` → T4;
`006-rapporto.md`, `007-rapporto.md`.

## Fatto quando — controlli eseguibili
In sospeso. Dopo la risposta lo scrivo secondo l'opzione scelta (vedi sopra).

## Fuori perimetro
- Tutto ciò che non serve al ritorno dei task in coda (opzioni A e B) o alla verifica (C).
- Login su Android con `expo-secure-store`: porta a senso unico, va in un giro a parte
  (DECISIONI n. 22).
- I difetti minori aperti (`Max-Age` 2591999, account «Famiglia Verifica 005») e le PR di
  Dependabot #2 e #3.
- Da `traguardi.json → fuori_perimetro`: template 730, scansione e PDF; calendario come vista
  dedicata; accesso con Google o Apple, iPhone, Play Store; email di verifica e recupero della
  password; sincronizzazione in tempo reale e offline sul web; dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
Nessuno finché non arriva la risposta.

## Porte
- Doppio senso previste: nessuna finché la fetta non è decisa.
- Senso unico: **DOMANDA** qui sopra. È una scelta di perimetro, non una dipendenza. Con A o B
  entra però una migrazione nuova: lo schema dei task, fissato una volta per tutte.

## Rischi di concorrenza
Da scrivere dopo la risposta. Con A o B: una rimozione dell'appartenenza in gara con un
«prendo il task» sullo stesso task. Ordine dei lock `family` → `person` → `task`, come nel giro 006.

## Budget
Da fissare dopo la risposta. Indicativo: A ≤ 500 righe in `server/src/main`; B ≤ 200; C 0.

## Domande per il ricercatore (al massimo 3)
Nessuna (ricerca: no).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Nel modello del rapporto, un campo esplicito `fatto_quando: verde | parziale`, così
  l'orchestratore non deduce il tipo del giro dalla prosa. Si propone in
  `docs/lab/proposte-metodo.md`, non qui.
