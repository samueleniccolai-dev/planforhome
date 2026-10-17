# Contratto comune della fase C

Le interfacce che più agenti devono rispettare allo stesso modo. Fonte delle decisioni:
`docs/lab/DELTA-V4.md`. Le voci A1 e A2 sono tolte: le costanti di stack restano nel codice, come in
gerio-lab. Fa eccezione il blocco `modelli_attesi` di `progetto.yml`.

## Fatti verificati il 17/10/2026

- Il hook `SubagentStop` riceve `agent_id`, `agent_type`, `agent_transcript_path` e
  `last_assistant_message`, più i campi comuni (`session_id`, `transcript_path`, `cwd`, …). Nessun
  campo `model`. Fonte: https://code.claude.com/docs/en/hooks.md
- Il hook `SessionStart` riceve un campo `model` e `transcript_path`.
- Nei transcript JSONL dei subagenti (`<sessione>/subagents/agent-<id>.jsonl`), le righe con
  `message.role == "assistant"` hanno:
  - `message.model`, per esempio `"claude-opus-5-5"`;
  - `message.usage`, con `input_tokens`, `output_tokens`, `cache_read_input_tokens` e
    `cache_creation_input_tokens`.

  Verificato su un file reale. La documentazione dice però che il formato è **interno e può cambiare**:
  ogni lettore deve fallire chiuso, cioè dato assente → `fonte: "assente"`.

## V1 + V3: registro degli agenti per giro

- **`.claude/hooks/registra-agente.py`** (hook `SubagentStop`):
  - legge da stdin il JSON del hook;
  - ricava il giro `NNN` dal branch corrente `claude/giro-NNN-…`; se non è un branch di giro, esce 0
    senza fare niente;
  - legge `agent_transcript_path` e raccoglie: l'insieme dei `message.model` degli assistant e la
    somma di `usage`;
  - aggiunge una voce a `docs/lab/giri/NNN-agenti.json`;
  - non fa mai fallire la sessione (exit 0 sempre); se c'è un errore, scrive la voce con
    `fonte: "assente"` e il motivo.
- **`.claude/hooks/registra-sessione.py`** (hook `SessionStart`): scrive `.claude/state/sessione.json`
  con `transcript_path`, `model` e `session_id`. Il file è ignorato da git.
- **`scripts/metrics/agenti.py chiudi NNN`** (lo chiama l'orchestratore in chiusura): legge
  `.claude/state/sessione.json`, ricava modello e token dell'orchestratore dal transcript principale,
  li aggiunge come voce `"agent_type": "orchestratore"` e calcola i totali.
- **Formato di `docs/lab/giri/NNN-agenti.json`:**

```json
{
  "giro": "007",
  "agenti": [
    {"agent_type": "pianificatore", "agent_id": "agent-…", "modelli": ["claude-opus-5-5"],
     "token": {"input": 0, "output": 0, "cache_lettura": 0, "cache_scrittura": 0},
     "fonte": "transcript", "motivo": ""}
  ],
  "totale_token": {"input": 0, "output": 0, "cache_lettura": 0, "cache_scrittura": 0},
  "token_fonte": "transcript"
}
```

  `token_fonte` vale `transcript` se tutte le voci hanno `fonte: transcript`; `parziale` se almeno una
  è `assente`; `assente` se non ce n'è nessuna.
- **Protezione:** gli agenti non scrivono `docs/lab/giri/*-agenti.json` con Edit o Write (guard). Lo
  scrivono solo gli script dei hook e `agenti.py`.

## V1 in `pr_guard.py`

- Modelli attesi: il blocco `modelli_attesi:` di `progetto.yml` (semplici righe `chiave: valore`; un
  parser minimo, senza PyYAML).
- Per il giro della PR (dal branch), legge `docs/lab/giri/NNN-agenti.json`. Motivo
  `modello-inatteso` → `revisione-umana` se:
  - il file manca;
  - una voce ha `fonte != "transcript"`;
  - un modello di una voce non è quello atteso per il suo `agent_type`. Il confronto è per prefisso:
    `claude-opus-5-5` accetta anche `claude-opus-5-5[1m]`;
  - in un giro di tipo `costruzione` manca uno di questi agenti: pianificatore, critico,
    costruttore-tdd, revisore, orchestratore.
- Un `agent_type` non in `modelli_attesi` (per esempio un agente interno con `agent_type` vuoto) si
  ignora, ma resta nel file.

## V4 + V6: tipo di giro

- Il frontmatter del piano `docs/lab/giri/NNN-piano.md` ha `tipo:` con uno di questi valori:
  `costruzione`, `verifica-produzione`, `runbook`, `caccia`.
- In `pr_guard.py`:
  - `verifica-produzione` e `caccia`: 0 righe aggiunte in `server/src/main`, `app/src` e `app/app`;
  - `runbook`: cambiano solo `docs/runbook/`, `docs/lab/` e `metrics/`;
  - tipo mancante o sconosciuto → `revisione-umana`.
- In `scripts/lab/traguardo.py`: lo stato `passato` richiede `--verifica NNN`. Il rapporto
  `docs/lab/giri/NNN-rapporto.md` deve avere `tipo: verifica-produzione`, lo stesso `traguardo` ed
  `esito: passato`. Senza → errore (ESPERIMENTO E2).

## V2: modulo di merge

Si riconosce in un commento umano quando contiene:
- un tempo, in una di queste forme: `⏱ N`, `⏱ N'`, `N'`, `N min`, `N minuti`;
- la stringa `ratifiche lette`.

Il parser sta in `scripts/metrics/raccogli.py` (minuti) e nel job `controllo` di `consegna.yml`
(presenza del modulo). Formato consigliato: `⏱ N' · ratifiche lette: NNN a/b · note`.

## V5: conclusioni

`docs/lab/CONCLUSIONI.md` è protetto: guard (Edit/Write vietati) e `pr_guard` (percorso protetto).

## Frontmatter del rapporto (`_modello-rapporto.md`)

Campi di gerio-lab **senza** `modello_orchestratore`, `modello_costruttore` e `modello_revisore` (i
modelli vengono da `NNN-agenti.json`), più questi:

```
tipo:
proposte_metodo:      # testo breve oppure «nessuna»; obbligatorio
```

I token non stanno nel frontmatter: `raccogli.py` li legge da `NNN-agenti.json`.

## Percorsi di planforhome

- Codice: `server/src/main`, `app/src`, `app/app`.
- Accettazione: `server/src/test/java/com/planforhome/acceptance/` e `app/e2e/acceptance/`.
- Migrazioni: `server/src/main/resources/db/migration/V<n>__*.sql`.
- Percorsi protetti: quelli di `progetto.yml` (`percorsi_protetti`), più `docs/lab/CONCLUSIONI.md`,
  `docs/lab/giri/*-agenti.json` e `docs/ESPERIMENTO.md`.
- `LAB_AUTORE` obbligatoria, senza un login predefinito.
- Branch di giro: `claude/giro-NNN-<slug>`.

## Registro degli adattamenti

Ogni agente scrive le sue righe in `docs/lab/_adattamenti-<lettera>.md`, con questo formato:

`| | 17/10/2026 | <file planforhome> | <file gerio-lab> | <voce DELTA-V4> | <cosa è cambiato> | <motivo> |`

Poi le unisco io in `ADATTAMENTI.md`.
