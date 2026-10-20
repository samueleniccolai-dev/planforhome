---
giro: 014
traguardo: T6
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-20T21:50:54Z
fine: 2026-10-20T22:28:44Z
pr: 21
ricerca_fonti: 5
critico_da_correggere: 4
critico_accolti: 4
revisore_bloccanti: 0
revisore_dubbi: 4
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 5
mutazioni_prese: 2
verify_rossi_locali: 0
test_totali: 435
test_delta: 44
decisioni_registro: 4
decisioni_ratifica: 1
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 014 — T6 parte 2: ricorrenze nell'app

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/014-agenti.json. -->

> **PR:** #21 · **Branch:** `claude/giro-014-t6` · **Traguardo:** T6 — Fatto quando verde, da
> verificare in produzione
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Nell'app si crea un task con scadenza, ora e «Si ripete» (ogni giorno, N giorni, settimana, mese, fine mese).
- Il task mostra «Si ripete: …» e «Prossima: …»; dopo fatto o annullato compare la successiva.
- Nuovi pulsanti con conferma: «Annulla questa volta» e «Termina la serie».
- Il server annulla ora tutte le occorrenze aperte della serie; il `PUT` riscrive l'ora della regola.
- Revisione: 0 bloccanti, 435 test. Nessuna dipendenza, migrazione o percorso protetto.
- Ratifica **014-a**: «Termina la serie» annulla tutte le occorrenze aperte (decisione 48). Dichiarala letta nel modulo di merge.
- Resta da provare a mano su Android: TalkBack sui gruppi radio/casella e Hermes con `Intl` e fuso.

## Cosa funziona ora — con la prova
- Server S1–S5 (cascata, P10, concorrenza, PUT e ora, isolamento): `./mvnw -B -ntp verify`, 225 test verdi.
- App A1–A10 in it e en: `npx playwright test`, 136 verdi; Jest 72, tsc ed eslint puliti.
- Ora legale (buco, sovrapposizione, New York e Roma) nei Jest di `recurrence.test.ts`.

## Cosa non funziona ancora
- Non si cambia la regola di una serie (né «questo e i seguenti»), né titolo e scadenza dall'app.
- Non provato su telefono: TalkBack, Hermes + `Intl` con fuso.
- «Prossima» può mostrare una data per cui il server non creerà nulla se la serie ha già un'occorrenza successiva.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 4, non corretti: (1) manca un test su `end-series` con occorrenza `DONE` che deve restare; (2) manca un test al confine di `nextDue` quando la data è oggi; (3) il filtro `family_id` nella cascata è una difesa non provabile; (4) il file `014-agenti.json` è scritto dal hook. I primi due vanno nel giro successivo.
- **PERIMETRO:** niente fuori piano.
- **CONCORRENZA:** sonde 10 giri su `end-series` doppio e incrociato con `cancel`: nessuna `OPEN` residua, `change_log` coerente, nessun 500.
- **MUTAZIONI:** provate 5, prese 2 (le altre: una equivalente, due dubbi sopra).

## Ricerca e critica
Preso: etichette come Google Calendar («questo evento») e Todoist («completa per sempre»), conferma su «Termina la serie». Critica: 4 punti accolti (chiave di riprova, ricarica dopo end-series, cascata su tutte le OPEN, fuso come prop). Scartato: nascondere «Prossima» se c'è già la successiva. Le pagine RN, Hermes e Oracle non si sono aperte (DNS).

## Proposte al metodo
nessuna

## Prossima fetta
Giro `verifica-produzione` di T6, con i due test dei dubbi 1 e 2 come eventuale piccolo giro di costruzione.
