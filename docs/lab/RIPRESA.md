# Ripresa — prompt per la sessione del 19/10/2026 (Linux, anche con il controllo remoto)

Da incollare all'inizio della nuova sessione, dentro la copia del repository.

---

# planforhome — ripresa: passo 9 del setup e giro 000

## Chi sei e come lavori
Sei il mio partner su planforhome, il secondo caso misurato del metodo. Le regole restano:
- una fase alla volta; alla fine di ogni fase ti fermi a un cancello con una domanda chiara;
- prima di qualunque cosa irreversibile, pubblica o che costa (push, merge, impostazioni di GitHub,
  server, DNS, segreti, Routine, spese) chiedi;
- domande in blocchi da al massimo 5;
- italiano, frasi brevi, tabelle dove servono; codice, commit e nomi in inglese;
- commit senza trailer `Co-authored-by` e senza menzioni di strumenti AI;
- separa i fatti dalle ipotesi.

Misuri il mio tempo: per ogni blocco in cui ci sono annoti inizio e fine in
`metrics/tempo-umano.csv` (`riferimento` = `setup` per il passo 9, `giro 000` per la PR del giro).
Ore in ora di Roma.

## Come lavoriamo su questo PC
- Hook attivi. Se il guard o Claude Code bloccano qualcosa: ti fermi, me lo dici, non lo aggiri.
- File protetti (`percorsi_protetti.metodo` di `progetto.yml`, `deny` di `.claude/settings.json`):
  li cambi solo con una patch preparata in un clone nello scratchpad, che applico io con
  `! git apply …`.
- `gh`: senza conferme per quello che le regole permettono (`.claude/settings.local.json`, solo qui).
  Merge, segreti, variabili, ruleset: li faccio io, o tu prepari uno script che lancio con `!`.
  Mai valori segreti in chat, mai comandi `!` che li stampano.
- Server: niente `ssh` da parte tua; lancio io i comandi che mi dai (alias `gerio-lab` come root,
  `planforhome-deploy` come deploy).
- Se sono da telefono con il controllo remoto: prima prova se `! date` funziona.

## Dove siamo (leggi, non ripetermelo)
- Fasi 0 e C chiuse; cancello 3 approvato il 18/10. Meccanismo su `main` (PR #1, `e489df1`).
- Setup passi 1–8 fatti il 18/10 (`docs/lab/SETUP.md`, `docs/lab/PROGRESS.md`): ruleset, environment,
  etichette, variabili (`LAB_ATTIVO=false`), stack di gerio-lab fermo, DNS A/AAAA di
  `app.planforhome.com`, segreti di `produzione` e `catena`, Routine `planforhome — giro` con
  environment `planforhome` e solo il trigger API, notifiche, prova a mano delle build riuscita
  (`DECISIONI.md` n. 1, cartella `~/planforhome-prova-apk/` tenuta).
- Branch `chore/setup` con i documenti del setup: controlla che la sua PR sia mergiata su `main`
  prima del passo 9 (il giro 000 legge `main`).
- Aperte: PR di Dependabot #2 e #3 (action di `.github/`), da guardare.

## Passo 9 — giro 000
1. Controlla che `main` contenga i documenti del setup e che la CI sia verde.
2. `LAB_ATTIVO` = `true` (lo script `!` lo lancio io).
3. Pagina della Routine → **Run now** (lo faccio io); poi aggiungo il Trigger 2, Schedule alle 03:07.
4. Segui il giro: PR bozza `in-corso`, fasi nel piano, CI. Non intervenire nel giro: guardi e mi dici.
5. Alla PR del giro 000 (in `revisione-umana`), i controlli di SETUP §9.4: autore delle PR =
   `LAB_AUTORE`; `docs/lab/giri/000-agenti.json` con i modelli attesi e la voce del revisore; email
   d'autore dei commit = `LAB_EMAIL_CATENA`; prova del controllo V1 (`docs/lab/prove/v1.md`, che
   scrivo io); etichette e push; immagine su GHCR; APK come artefatto.
6. **CANCELLO**: mi riporti l'esito dei controlli e mi chiedi se mergiare.

## Fissi
- gerio-lab non si tocca (il suo stack è fermo, i volumi restano).
- Nel repository solo dati inventati; mai leggere o chiedere segreti.
- Fonti linkate, mai copiate; nessun codice, nome o grafica di altri prodotti.
- Il nome del metodo non compare in nulla di pubblico.
