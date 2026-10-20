---
giro: 007
traguardo: T4
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-20T06:44:03Z
fine: 2026-10-20T07:09:59Z
pr: 14
ricerca_fonti: 5
critico_da_correggere: 4
critico_accolti: 4
revisore_bloccanti: 0
revisore_dubbi: 4
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 4
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 82
test_delta: 35
decisioni_registro: 4
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 007 — T4 parte 2: scelta e cambio famiglia (web)

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/007-agenti.json. -->

> **PR:** #14 · **Branch:** `claude/giro-007-t4` · **Traguardo:** T4 — parziale (manca il test del ritorno dei task in coda, in T5, e un giro verifica-produzione)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Dopo il login l'app legge le famiglie: Luca (1 famiglia) va diretto a «Famiglia Mamma»; Giulia (2) vede «Scegli una famiglia».
- La pagina famiglia mostra le persone con «Gestore», «Membro» o «Senza account».
- Il link «Cambia famiglia» c'è su famiglia e profilo, solo con 2 o più famiglie.
- Un `id` di famiglia altrui o malformato dà «Famiglia non trovata.» e non chiama il server per i membri.
- Solo `app/`: nessuna dipendenza, nessuna migrazione, nessun cambio a `infra/`. Nessuna porta a senso unico.
- Motivi di revisione umana: `pr_guard` non è stato eseguito dal revisore (hook); lo ha lanciato l'orchestratore, vedi sotto.
- Ratifiche: nessuna.

## Cosa funziona ora — con la prova
- 35 test di accettazione Playwright (it-IT ed en-US), 58 Playwright totali, 18 Jest: verdi (revisore, SHA db54c69).
- `dist/family.html` esiste e non contiene avvisi.
- `tsc` ed `eslint` puliti.

## Cosa non funziona ancora
- Nessuna prova in produzione (serve il giro verifica-produzione).
- Il ritorno dei task in coda (T5) e le schermate del server non toccate.
- Il refresh della sessione non parte su `/family` (rischio noto, DECISIONI n. 22).
- Nessun test del repository copre le risposte vecchie in `/family` (mutazione 3 non presa).

## Verdetto del revisore
- **BLOCCANTI:** 0.
- **DUBBI:** 4 (pr_guard non eseguibile dal revisore; risposte vecchie senza test; membri 401 senza test; `007-agenti.json` non committato: ora committato). Nessuno corretto.
- **PERIMETRO:** nulla fuori piano; 251 righe di produzione, 10 file.
- **CONCORRENZA:** 6 sonde verdi (cambio `id` nella stessa istanza, doppio clic su Accedi, membri 401).
- **MUTAZIONI:** provate 4, prese 3.

## Ricerca e critica
Ricerca: rete non raggiungibile, solo sintesi; presa la rotta statica `?id=`. Critica: accolti tutti e 4 i punti (regola «Senza account», niente avvisi nell'HTML statico, stati di errore, `busy` fino alla navigazione); tolto il test delle risposte fuori ordine che non provava nulla.

## Proposte al metodo
nessuna

## Prossima fetta
T5 (task) oppure il login su Android (porta a senso unico); T4 serve ancora un giro verifica-produzione.
