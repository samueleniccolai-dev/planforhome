# Runbook — <integrazione>

<!-- Modello per docs/runbook/<nome>.md, scritto da un giro di tipo runbook. Una sola
     integrazione. L'umano lo esegue in una sessione Claude assistita e dichiarata. -->

**Giro:** NNN · **Traguardo:** Tn · **Integrazione:** <nome> · **Ultima verifica:** GG/MM/AAAA

## A cosa serve
Due righe: cosa collega, cosa cambia per chi usa l'app.

## Prerequisiti
- [ ] account e permessi necessari (nessuna spesa senza una porta a senso unico già decisa)
- [ ] segreti da creare: **solo il nome** e l'environment GitHub dove vanno, mai il valore
- [ ] giri di costruzione già mergiati che il runbook presuppone

## Passi
Ogni passo: dove si clicca o quale comando si lancia, cosa si deve vedere. Segna i minuti quando
lo finisci.

| # | Passo | Cosa si deve vedere | Minuti |
|---|---|---|---|
| 1 | … | … | ☐ __ |
| 2 | … | … | ☐ __ |

## Prova di riuscita
Un comando o un controllo falsificabile, che il giro `verifica-produzione` ripeterà:
`comando` → risultato atteso.

## Rollback
Come si torna allo stato di prima, passo per passo (segreti revocati, configurazione tolta).

## Dopo l'esecuzione
- Minuti totali in `metrics/tempo-umano.csv`, `riferimento = integrazione <nome>`, `da_gerio`
  compilato.
- Un passo andato diversamente da qui si annota sotto, con la data: lo corregge un giro successivo.

## Note di esecuzione
