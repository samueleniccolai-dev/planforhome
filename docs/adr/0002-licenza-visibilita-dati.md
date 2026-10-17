# ADR-0002 — Licenza, visibilità e dati

- **Data:** 17/10/2026
- **Stato:** approvato dall'umano al CANCELLO 2 (17/10/2026)
- Questo non è un parere legale.

## Contesto

planforhome è il secondo caso misurato del metodo. Il repository sta su GitHub e la catena lo
costruisce in pubblico. I ruleset di GitHub sono gratuiti solo sui repository pubblici
([GitHub Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)):
senza ruleset resta solo il guard.

## Decisione

1. **Repository pubblico** fin dal primo commit.
2. **Licenza MIT** sul codice e sui documenti del repository
   ([testo](https://opensource.org/license/mit)).
   - Alternative scartate: Apache-2.0, che ha una concessione esplicita sui brevetti ma più testo, e
     AGPL-3.0, che impedisce il riuso chiuso come servizio ma pesa su chi vuole riusarlo.
   - Il nome «planforhome» e il dominio non sono concessi dalla licenza: restano dell'umano.
3. **Solo dati inventati** fino alla porta R1 (SPEC §3). Nel repository, nei test, negli screenshot e
   negli artefatti di CI non entra mai un dato reale.
4. **Nessun segreto nel repository.** I segreti stanno negli environment di GitHub e sul server.
   Gli agenti non li leggono e non li chiedono.
5. **Il nome del metodo non compare** in nulla di pubblico (README, commit, PR, pagine).
6. **Commit senza trailer degli strumenti** e senza menzioni di strumenti AI, come da regole personali
   dell'umano.

## Conseguenze

- Tutto quello che si committa è pubblico per sempre: un dato o un segreto pubblicato per errore va
  considerato compromesso. Si ruota il segreto; la cronologia non basta riscriverla.
- Rendere privato il repository più avanti è possibile, ma toglie i ruleset gratuiti.
- Lo stato del diritto d'autore sul codice scritto dall'IA non è chiaro in molti paesi: il README lo
  dice.
- Per R1 serve un'identità separata per la catena (GitHub App). Con i dati reali, il codice resta
  pubblico e i dati stanno solo sul server.
