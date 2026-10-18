# Ripresa — prompt per la sessione del 18/10/2026 (Linux)

Da incollare all'inizio della nuova sessione, dentro la copia del repository.

---

# planforhome — ripresa dopo la fase C: verifica su Linux e setup assistito

## Chi sei e come lavori
Sei il mio partner su planforhome, il secondo caso misurato del metodo. Le regole sono quelle di ieri:
- si lavora una fase alla volta; alla fine di ogni fase ti fermi a un cancello con una domanda chiara;
- prima di qualunque cosa irreversibile, pubblica o che costa (push, merge, impostazioni di GitHub,
  server, DNS, segreti, Routine, spese) chiedi;
- domande in blocchi da al massimo 5;
- italiano, frasi brevi, tabelle dove servono; codice, commit e nomi in inglese;
- commit senza trailer `Co-authored-by` e senza menzioni di strumenti AI;
- separa i fatti dalle ipotesi.

Misuri il mio tempo: per ogni blocco in cui ci sono annoti inizio e fine in
`metrics/tempo-umano.csv` (colonne `data,minuti,attivita,riferimento,da_gerio,note`; riferimento
`setup` per la fase D). Scrivi le ore in ora di Roma.

## Dove siamo (leggi, non ripetermelo)
- Fasi A e B (fase 0) chiuse: cancelli 1 e 2 approvati. Su `main` ci sono protocollo, SPEC, traguardi,
  ADR e profilo (`docs/ESPERIMENTO.md`, `docs/SPEC.md`, `docs/lab/traguardi.json`, `docs/adr/`,
  `progetto.yml`).
- Fase C (meccanismo) sul branch `chore/meccanismo-v4`, da rivedere come una PR:
  - `76f5438`: copia di gerio-lab così com'è;
  - `7505bdb`: adattamento;
  - `715fe75`: hook attivi;
  - `3f1688b`: correzioni della revisione indipendente (`docs/lab/revisione-fase-c.md`);
  - ogni differenza da gerio-lab è in `docs/lab/ADATTAMENTI.md`.
- Tempo umano finora: fase A 125', fase B 77', cancello 2 60', fase C 35' (15' + 20').
- La revisione di ieri è stata fatta su Windows. Lì 2 test del guard fallivano solo per motivi di
  Windows (symlink, `/etc/hosts`) e 4 test di `test_pr_helper.py` si saltavano da soli. **Su Linux
  devono passare tutti.**

## Regole nuove decise ieri
- **File protetti:** su quelli elencati in `progetto.yml` (`percorsi_protetti.metodo`) e nei `deny` di
  `.claude/settings.json` non scrivi né con Edit e Write né con la shell. Prepari una patch e la
  applico io con `! git apply …`. Ieri un subagente ha aggirato il divieto con uno script: non deve
  ripetersi, né da te né da un tuo subagente. Scrivilo nel prompt di ogni subagente.
- **Hook attivi:** su Linux `python3` esiste, quindi i hook di `.claude/settings.json` sono attivi
  anche in questa sessione interattiva, ed è voluto. Se il guard blocca qualcosa, fermati e dimmelo;
  non aggirarlo. Su Windows c'era un `.claude/settings.local.json` (ignorato da git) che li spegneva:
  qui non c'è.
- **`test_pr_helper.py`:** su Windows aveva chiamato il `gh` vero. Ora si salta se il `gh` finto non è
  quello del PATH. Prima di lanciarlo, controlla che non possa raggiungere GitHub.

## Fase C2 — verifica su Linux (prima cosa da fare)
1. `git status`, `git log --oneline --all -8`: controlla di essere su `chore/meccanismo-v4` a
   `3f1688b` (o dopo).
2. Esegui:
   ```
   python3 -I -m unittest discover -s scripts/guard/tests
   python3 -I -m unittest discover -s scripts/metrics/tests
   python3 -I -m unittest discover -s scripts/lab/tests
   bash -n .claude/hooks/*.sh
   ```
   Poi valida i YAML dei workflow. Riporta i numeri esatti. Un fallimento si corregge (con una patch,
   se il file è protetto) e non si nasconde.
3. Prepara la patch rimasta da ieri: proteggere `docs/lab/prove/` (le prove registrate di P5, che un
   agente non deve poter scrivere). Una riga ciascuno:
   - `scripts/guard/pr_guard.py`, in `PROTECTED_PREFIXES`: `"docs/lab/prove/"`;
   - `.claude/hooks/guard.py`, in `RULE_PREFIXES`: `"docs/lab/prove/"`;
   - `progetto.yml`, in `percorsi_protetti.metodo`: `- docs/lab/prove/`;
   - `.claude/settings.json`: `Edit(/docs/lab/prove/**)` e `Write(/docs/lab/prove/**)` nei `deny`;
   - più un test in `test_pr_guard.py` e uno in `test_guard_hook.py`.

   Me la fai applicare, rilanci i test, poi fai il commit.
4. Un'ultima lettura indipendente, breve: un subagente che non ha visto niente controlla solo che il
   giro 000 possa partire seguendo `docs/lab/SETUP.md` e `.claude/skills/giro/SKILL.md` alla
   lettera, su Linux.
5. **CANCELLO 3:** mi riporti i test su Linux e cosa è cambiato, poi mi chiedi di approvare il
   meccanismo.

## Fase D — setup assistito (dopo il cancello 3)
Seguiamo `docs/lab/SETUP.md` passo per passo: io eseguo, tu guidi. I minuti di ogni passo vanno in
`metrics/tempo-umano.csv` con `riferimento = setup`. Le spese le confermo una per una. Non leggi e non
chiedi segreti: mi dici solo il nome del segreto da creare e dove.
- Il repository `samueleniccolai-dev/planforhome` esiste ed è pubblico. Contiene i branch che ho
  pushato ieri sera.
- La PR `chore/meccanismo-v4` → `main` si mergia solo dopo ruleset, environment e variabili (SETUP
  §2).
- Il server è quello di gerio-lab: prima di fermare il suo stack, guarda cosa c'è.
- La prova a mano della build dell'APK senza EAS (SETUP §8) si fa prima del giro 000. Se non regge,
  mi fermo e decido su EAS.

## Fase E — giro 000
Il primo giro della catena posa i binari (T1 deploy automatico, T2 verifica visiva e APK). Alla fine
della sessione:
- `docs/lab/PROGRESS.md` aggiornato;
- il totale del mio tempo per fase;
- il prossimo passo in una riga.

## Fissi
- gerio-lab non si tocca. Nel repository solo dati inventati; mai leggere o chiedere segreti.
- Fonti linkate, mai copiate; nessun codice, nome o grafica di altri prodotti.
- Il nome del metodo non compare in nulla di pubblico.
- Se una cosa non la puoi fare da lì, dillo subito e proponi come la faccio io.
