# Revisione indipendente del meccanismo (fase C)

17/10/2026 · due subagenti che non hanno scritto il codice e non hanno visto le conversazioni:
- uno sulla **sicurezza**: diff `76f5438..715fe75` su hook, guard e workflow;
- uno sulla **coerenza del metodo**: METODO, skill, agenti, modelli, script, SETUP.

Le correzioni sono registrate riga per riga in `ADATTAMENTI.md` (righe 67–102).

## Sicurezza

| # | Rilievo | Gravità | Esito |
|---|---|---|---|
| 1 | Lo `sha` del job `immagine` è riscrivibile dal codice del giro; `deploy` eseguiva gli script di quel commit con i segreti | bloccante | corretto: sha da un passo dedicato, `deploy` da `main` con controllo di antenato, immagini solo `@sha256` |
| 2 | Le migrazioni con `$$` ed `E''` aggirano lo spezzatore SQL | bloccante | corretto: revisione umana |
| 3 | Il `tipo` del piano decide quali agenti servono; registro vuoto accettato | bloccante | corretto: tipo al commit rivisto, revisore obbligatorio tranne runbook, registro vuoto o sconosciuto rifiutato |
| 4 | Il limite di righe vede solo tre cartelle | maggiore | corretto: tutto `server/` e `app/`, con esclusioni per test e documenti |
| 5 | `npx node -e` e `npm exec` scavalcano il guard | maggiore | corretto: comando sottostante analizzato, npx solo per strumenti noti |
| 6 | Il registro nasce nella stessa sandbox dell'agente | maggiore | in parte: agenti sconosciuti e ripetuti rifiutati; il resto è un **rischio residuo** fino a una fonte esterna (API delle sessioni) |
| 7 | Configurazione dei test fuori da `acceptance/` non protetta | maggiore | corretto: `src/test/resources/`, `__mocks__/` protetti |
| 8 | Configurazioni di build non protette (babel, metro, …) | maggiore | corretto |
| 9 | `application*.yml` non protetto | maggiore | corretto |
| 10 | `CLAUDE.md` annidati, `AGENTS.md`, `.mcp.json` non protetti | maggiore | corretto, anche nel guard e nei `deny` |
| 11 | La catena agisce con l'identità GitHub dell'umano | maggiore | **rischio residuo**, documentato: si chiude con la GitHub App (porta R1) |
| 12 | Il verdetto del revisore lo scrive l'orchestratore nella PR | maggiore | corretto: confronto con il verdetto registrato dal hook |
| 13 | Cache e token avvelenabili nei job che eseguono codice dei giri | minore | corretto in `consegna` (niente cache, push in un job separato); `ci.yml` usa ancora le cache: rischio residuo minore |
| 14 | I file binari sfuggono al conteggio e alla ricerca dei segreti | minore | corretto |
| 15 | `format.sh` esegue strumenti del repository | minore | **rischio residuo**, documentato |

## Coerenza del metodo

| # | Rilievo | Gravità | Esito |
|---|---|---|---|
| 1 | `LAB_AUTORE` assente nella Routine: il giro 000 sarebbe uscito subito | bloccante | corretto (SETUP §6, ROUTINE) |
| 2 | Formato delle ratifiche diverso tra documenti e parser | bloccante | corretto: `NNN-a` ovunque (le parti protette con patch applicate dall'umano) |
| 3 | Giro 000 come T1+T2 solo sulla carta | maggiore | corretto: `traguardi_extra`, attribuzione dichiarata |
| 4 | Il giro 000 non poteva creare `pom.xml` e `package.json` | maggiore | corretto: dipendenze di base di ADR-0001 già decise, scheletro prima dei test |
| 5 | Finestra di lettura delle ratifiche troppo corta | maggiore | corretto: fino al primo merge a mano |
| 6 | Gravità dei difetti mai raccolta | maggiore | corretto: campo `difetti` |
| 7 | P5 (V1) e P6 (revisione) veri per costruzione | maggiore | corretto: esito da una prova registrata; da proteggere `docs/lab/prove/` (aperto) |
| 8 | Il riconoscimento dei commit umani si basa su un'ipotesi | maggiore | da verificare al giro 000 (SETUP §9.3) |
| 9 | P1 passata su un sottoinsieme di traguardi | maggiore | corretto |
| 10 | Il registro degli agenti si perde nel controllo «albero pulito» | minore | corretto |
| 11 | V2(b) e V6 senza test | minore | V6 corretto; il job `controllo` resta senza test (verifica al primo merge a mano) |
| 12 | `NNN-agenti.json` contro `NNN-modelli.json` | minore | annotato in ESPERIMENTO §9 (patch applicata dall'umano) |
| 13 | L'esito della verifica sovrascritto dallo stato della PR | minore | corretto: `esito_verifica` |
| 14 | Il giro di chiusura entra nei conteggi | minore | corretto: tipo `chiusura` escluso; `pr_guard` lo manda in revisione umana |
| 15 | Frontmatter con `\r\n` non letto | minore | corretto |

## Verifica su Linux (18/10/2026)

Python 3.14.4, git 2.53.0, PyYAML 6.0.3. Hook attivi anche nella sessione assistita.

| Controllo | Prima delle patch (`c2065f5`) | Dopo (`018e760`) |
|---|---|---|
| `scripts/guard/tests` | 101 OK, 0 saltati | 105 OK, 0 saltati |
| `scripts/metrics/tests` | 48 OK | 48 OK |
| `scripts/lab/tests` | 9 OK | 9 OK |
| di cui `test_pr_helper.py`, con il `gh` finto | 4 eseguiti, 0 saltati | uguale |
| `bash -n` sui due script dei hook | OK | OK |
| YAML: 3 workflow, `dependabot.yml`, `progetto.yml` | OK | OK |

I 2 test che su Windows fallivano (symlink, `/etc/hosts`) qui passano. Ogni test nuovo fallisce
sul codice di prima (20 casi) e passa su quello nuovo.

Trovati durante la verifica e corretti con due patch applicate dall'umano:

| # | Rilievo | Gravità | Esito |
|---|---|---|---|
| 1 | `python3 -I x.py` passava il guard senza che lo script fosse letto | maggiore | corretto (`018e760`) |
| 2 | La prova V1 valeva anche come riga di `DECISIONI.md`, che i giri scrivono | maggiore | corretto: conta solo `docs/lab/prove/v1.md` (`a27b5f3`) |
| 3 | Le fonti di P6 (`revisione-fase0.md`, `fase0-decisioni.md`) erano scrivibili dai giri; nessun `esito:` registrato | maggiore | corretto: protette; `esito: passato` deciso dall'umano (`a27b5f3`) |
| 4 | Il controllo «dopo» di revisore e critico non vedeva i file di regola nuovi sotto `docs/lab/` | minore | corretto (`a27b5f3`) |
| 5 | `_modello-runbook.md` fuori dal hook; due modelli fuori dai `deny` | minore | corretto (`a27b5f3`) |
| 6 | `bash -n .claude/hooks/*.sh` controlla solo il primo file | minore | nota: un file per volta, con il percorso per esteso (il guard rifiuta lo script in una variabile) |

## Lettura indipendente su Linux (18/10/2026)

Un subagente che non aveva visto niente ha seguito alla lettera `SETUP.md` e la skill `/giro`, in
sola lettura. Il suo verdetto: il giro 000 parte solo dopo i punti 1–3; i punti 4–5 servono per
arrivare alla PR pronta. I punti segnati «verificato» li ha ricontrollati l'orchestratore sul
repository.

| # | Rilievo | Gravità | Stato |
|---|---|---|---|
| 1 | `session-start.sh` e `format.sh` sono `100644` in git (copia fatta su Windows), ma `settings.json` li lancia come programmi: in un clone Linux danno «Permission denied» e la sessione cloud parte senza JDK 25, Node 24, Docker e Chromium | maggiore | verificato; corretto con un test (`9514289`) |
| 2 | Dove si impostano `LAB_AUTORE` e `LAB_EMAIL_CATENA` di una Routine: campo della Routine o ambiente? Se mancano, `/giro` esce al §0.5 | bloccante se mancano | [DA VERIFICARE] sulla documentazione, al passo 6 del setup |
| 3 | La Schedule nasce al passo 6 e la skill non legge `LAB_ATTIVO`: il giro 000 può partire da solo prima del passo 9, anche prima della prova dell'APK | maggiore | verificato; corretto: Schedule al passo 9 (`9514289`) |
| 4 | Lo scheletro del giro 000 è solo nelle «Regole fisse»: nel flusso numerato non c'è né un passo né una `fase:`, e dopo `ESITO: VERDE` il §6 porta alla revisione | maggiore | verificato; corretto: passo esplicito e `fase: scheletro` (`9514289`) |
| 5 | `server/mvnw` nasce solo con `mvn -N wrapper:wrapper` (Write e `chmod` bloccati): serve `mvn` nell'immagine cloud | maggiore | il comando è scritto nel costruttore (`9514289`); `mvn` nell'immagine [DA VERIFICARE] nel setup |
| 6 | SETUP §1 è superato e cita un percorso Windows | minore | verificato; corretto (`9514289`) |
| 7 | `infra/README.md` non chiede script eseguibili, e senza `-x` `consegna` salta deploy e smoke | minore | verificato; corretto (`286f063`) |
| 8 | SKILL e costruttore dicono «mai i percorsi protetti», ma il giro 000 deve scrivere `pom.xml`, `package.json` e `infra/` (il guard li ammette) | minore | verificato; corretto (`9514289`) |
| 9 | `LAB_GIRI_MAX_GIORNO` vale 4 in SETUP e 6 in ROUTINE; SETUP §8 cita una «run di CI manuale» che non costruisce niente fuori dal repository | minore | verificato; corretto (`286f063`, `9514289`) |

Dopo la patch: 106 test del guard, 48 delle metriche, 9 del laboratorio, tutti verdi.

## Ancora aperti

- Punti 2 e 5 della lettura indipendente: si verificano nel setup (fase D).
- `raccogli.py` conta le righe descrittive solo su tre cartelle: va allineato al nuovo limite.
- Il guard non legge lo script in forme rare (`perl -C x.pl`, opzioni lunghe con valore): rischio
  residuo minore.

Chiusi il 18/10: protezione di `docs/lab/prove/` (`a27b5f3`); test del guard su Linux (sopra).
