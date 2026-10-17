---
giro: NNN
traguardo: Tn
tipo:                # costruzione | runbook (verifica e caccia: _modello-rapporto-verifica.md)
esito: pr-aperta
inizio: AAAA-MM-GGTHH:MM:SSZ
fine: AAAA-MM-GGTHH:MM:SSZ
pr:
ricerca_fonti: 0
critico_da_correggere: 0
critico_accolti: 0
revisore_bloccanti: 0
revisore_dubbi: 0
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 0
mutazioni_prese: 0
verify_rossi_locali: 0
test_totali: 0
test_delta: 0
decisioni_registro: 0
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetto_di:
proposte_metodo:     # testo breve oppure «nessuna»; obbligatorio
---
# Rapporto del giro NNN — <fetta>

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/NNN-agenti.json. -->

> **PR:** #… · **Branch:** `claude/giro-NNN-…` · **Traguardo:** Tn — Fatto quando verde, da
> verificare in produzione / parziale (un traguardo passa solo con un giro verifica-produzione)
> **Domande che bloccano:** nessuna / 1) …

## Per te, in 10 righe
Cosa cambia per chi usa l'app, se serve qualcosa da te (runbook da eseguire, motivi di revisione
umana) e le ratifiche, al massimo 3, numerate `NNN a`, `NNN b`, `NNN c`: dichiarale lette nel
modulo di merge (`⏱ N' · ratifiche lette: NNN a/b · note`). Non fermano la catena.

## Cosa funziona ora — con la prova
- … (prova: test, comando, URL o screenshot)

## Cosa non funziona ancora
Sezione obbligatoria.

## Verdetto del revisore
- **BLOCCANTI:** … (risolti: sì/no, dove)
- **DUBBI:** … (corretti al massimo 2)
- **PERIMETRO:** …
- **CONCORRENZA:** …
- **MUTAZIONI:** provate N, prese M

## Ricerca e critica
Cosa abbiamo preso dai concorrenti e dalla critica, cosa abbiamo scartato.

## Proposte al metodo
Una riga, oppure «nessuna» (la stessa del frontmatter; se c'è, va anche in
`docs/lab/proposte-metodo.md`).

## Prossima fetta
Una riga (dopo un «Fatto quando» verde: giro `verifica-produzione`).
