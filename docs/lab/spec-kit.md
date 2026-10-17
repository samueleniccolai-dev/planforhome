# Spec Kit: studio per la proposta n. 7

17/10/2026 · ho letto solo la documentazione, senza installare niente. **[F]** = fatto con fonte;
**[I]** = inferenza.

## Fatti

- **[F] Versione e installazione.** Ultima release v1.2.1 del 16/10. Si installa con
  `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z`. Serve
  Python 3.11+. Licenza MIT. Fonti: [release](https://github.com/github/spec-kit/releases),
  [installazione](https://github.github.io/spec-kit/installation.html).
- **[F] Comandi.** Con Claude Code sono skill in `.claude/skills/speckit-*`: `constitution`, `specify`,
  `clarify`, `checklist`, `plan`, `tasks`, `analyze`, `implement`, `converge`. Le funzioni vanno in
  `specs/NNN-nome/`; la configurazione sta in `.specify/`. Fonti:
  [quickstart](https://github.github.io/spec-kit/quickstart.html),
  [changelog](https://raw.githubusercontent.com/github/spec-kit/main/CHANGELOG.md).
- **[F] Branch automatici.** Non sono più il comportamento predefinito: l'estensione git va attivata
  apposta. Su Windows gli script sono in PowerShell.
- **[F] Rete.** Nessuna telemetria documentata. Chiamate di rete solo per l'installazione e per il
  controllo delle versioni.
- **[F] Repository esistente.** `specify init --here --integration claude --script ps`. `--force` può
  sostituire file nei percorsi che Spec Kit gestisce. Fonte:
  [progetti esistenti](https://github.github.io/spec-kit/guides/existing-projects.html).
- **[F] Personalizzazione.** I template si sovrascrivono in `.specify/templates/overrides/`. Fonte:
  [personalizzazione](https://github.github.io/spec-kit/guides/customization.html).

## Proposta di integrazione con `/giro` (inferenza)

1. Per ogni funzione nuova, l'umano lancia `/speckit-specify` e poi `/speckit-clarify` in una sessione
   interattiva. Il risultato è `specs/NNN-x/spec.md`.
2. Da quella specifica nasce un traguardo in `traguardi.json`, con `spec: specs/NNN-x/spec.md` e un
   «fatto quando» verificabile, preso dagli scenari della specifica.
3. Il pianificatore della catena legge la specifica; costruttore e revisore lavorano come sempre.

**Da usare:** `specify`, `clarify`, e `checklist` se serve.
**Da non usare:** `plan`, `tasks`, `implement`, `converge`, `analyze` (doppioni del pianificatore e
del costruttore: due fonti di verità per il piano) e l'estensione git (i branch li gestisce la catena).
**Da decidere:** `constitution`, perché rischia di duplicare CLAUDE.md e METODO.

**Attriti noti:**
- l'init scrive in `.claude/`, che il guard protegge: va fatto a mano, fuori dalla catena, su un
  branch con revisione del diff;
- il template di specifica va sovrascritto, perché chieda un «fatto quando» e rimandi a SPEC.md.
