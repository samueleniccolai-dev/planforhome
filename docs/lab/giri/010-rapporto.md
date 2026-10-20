---
giro: 010
traguardo: T5
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-20T13:37:31Z
fine: 2026-10-20T14:27:00Z
pr: 17
ricerca_fonti: 5
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 4
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 4
mutazioni_prese: 4
verify_rossi_locali: 0
test_totali: 277
test_delta: 130
decisioni_registro: 2
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 1
difetti: 010:minore
proposte_metodo: nessuna
---
# Rapporto del giro 010 — T5 parte 2: i task nell'app web e i task demo

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/010-agenti.json. -->

> **PR:** #17 · **Branch:** `claude/giro-010-t5` · **Traguardo:** T5 — parziale (parte 3 e verifica in produzione da fare)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Nella schermata della famiglia c'è l'elenco dei task: creazione col solo titolo, assegnazione, ritorno in coda, «Prendo io».
- Nuova rotta `/tasks` «Tutte le mie famiglie», con le date nel fuso della famiglia.
- Il server semina due task demo: «Prenotare il pranzo di Natale» (Mamma) e «Rinnovare la carta d'identità di Franco» (Babbo), senza duplicati e senza bloccare l'avvio.
- Nessuna ratifica da dichiarare. Nessuna porta a senso unico.
- Revisione umana probabile: `pr_guard` segnala `modello-inatteso` (il revisore non ha potuto eseguirlo per l'hook) e il giro supera il budget (882 righe di produzione contro 650).
- Test totali (nuova conta del revisore): 277.

## Cosa funziona ora — con la prova
- Test di accettazione 42/42 (Playwright 35, server 7); `./mvnw verify` verde (148 test); Jest 36/36; tsc ed eslint puliti; Playwright completo 93/93. Riprovato dal revisore sullo SHA 569ead5.

## Cosa non funziona ancora
- T5 parte 3: P7–P9 server e app, filtri della vista.
- Non provato su Android: `Intl` con `timeZone` e `crypto.getRandomValues` su Hermes ([DA VERIFICARE], nessuna fonte ufficiale: va provato su APK in T9).
- Nessuna verifica in produzione di questo giro.
- Elenco task lungo nella schermata della famiglia: manca lo scroll.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 4, non corretti: (1) due seeder in parallelo duplicano i task (escluso in R0); (2) budget superato; (3) dopo un cambio famiglia, id e mutationId del tentativo restano e il server risponde 409 (minore, difetto 010); (4) `pr_guard` non eseguito dal revisore.
- **PERIMETRO:** nessuna aggiunta fuori piano.
- **CONCORRENZA:** doppio clic, riprova, replay 200 e risposte fuori ordine coperti dai test; seeder in parallelo vedi dubbio 1.
- **MUTAZIONI:** provate 4, prese 4.

## Ricerca e critica
Ricerca: 5 fonti (2 lette). Critica: 5 punti accolti su 5 (data del test demo, seeder che non blocca l'avvio, errori dei task locali, 200 = 201 nel replay, firma del seeder).

## Proposte al metodo
nessuna

## Prossima fetta
T5 parte 3 (costruzione); poi verifica-produzione di T5.
