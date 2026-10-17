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

## Ancora aperti

- Proteggere `docs/lab/prove/`: altrimenti un agente può scrivere da sé l'esito della prova V1.
  Serve una patch a `pr_guard.py` e a `progetto.yml`, file protetti.
- `raccogli.py` conta le righe descrittive solo su tre cartelle: va allineato al nuovo limite.
- I test del guard non sono ancora stati eseguiti su Linux: Docker spento, se ne occupa la prima
  run della CI.
