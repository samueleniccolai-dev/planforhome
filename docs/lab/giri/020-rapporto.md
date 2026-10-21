---
giro: 020
traguardo: T8
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-21T12:44:20Z
fine: 2026-10-21T13:58:00Z
pr: 29
ricerca_fonti: 3
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 2
dubbi_corretti: 2
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 572
test_delta: 4
decisioni_registro: 4
decisioni_ratifica: 1
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 020 — lista ciclica (contestazione 019-b) e riordino «Sposta su/giù»

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/020-agenti.json. -->

> **PR:** #29 · **Branch:** `claude/giro-020-t8` · **Traguardo:** T8 — Fatto quando verde, da
> verificare in produzione
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Contestazione 019-b applicata: in una lista ciclica alla nuova occorrenza passano tutte le voci non spuntate, anche le rigate, che tornano normali. Le spuntate no, anche se rigate. La decisione 66 è «cambiata (giro 020)».
- Nell'app, nell'elenco «Da prendere», ci sono i pulsanti «Sposta su/giù «voce»»: disabilitati agli estremi, lo spostamento si vede subito, il fuoco resta sul pulsante, un solo riordino in volo e poi vince il server. Se la rete fallisce l'ordine torna a quello accettato dal server.
- **Revisione umana:** il test di accettazione del giro 019 è stato corretto per la contestazione (attesa «Pasta», «Caffè», «Zucchero»), come previsto dal piano.
- Ratifica **020-a**: come funziona il riordino nell'interfaccia (decisione 73). Dichiarala letta nel modulo di merge.
- Budget superato di poco: circa 157 righe di produzione contro 140 previste, 7 file.
- Nessuna migrazione, nessuna dipendenza nuova.

## Cosa funziona ora — con la prova
- Copia delle rigate nella serie (prova: `Giro020ShoppingSeriesAcceptanceTest`, `Giro019ShoppingSeriesAcceptanceTest`; mutazione che rimette la vecchia regola: presa). La prova della regola nuova è «Farina», non «Olio».
- Riordino nell'app (prova: `giro-020-reorder.spec.ts` R1–R10, più `giro-020-reorder-retry.spec.ts`; Playwright 171/171, Jest 84, server 314, tsc ed eslint puliti).

## Cosa non funziona ancora
- Il fuoco su Android non è provato; nessun annuncio ai lettori di schermo della nuova posizione (`announceForAccessibility` non fa nulla sul web).
- La regola «un solo riordino in volo» non è protetta da un test da sola (mutazione equivalente, l'ordine finale resta giusto).
- `pr_guard.py` non lanciato dai revisori (l'hook lo blocca); CI e APK da vedere sulla PR.
- Il riordino delle voci spuntate non c'è. Offline e sync delle voci sono di T9.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 2, corretti entrambi (ripristino della sola `position`; ripristino al punto accettato dal server dopo un secondo `PUT` fallito, con test di regressione).
- **PERIMETRO:** nulla fuori piano.
- **CONCORRENZA:** sonde su doppio tocco, risposte invertite e `PUT` fallito: verdi. Server: «fatto» contro rigature, sempre 200/409, nessun doppione.
- **MUTAZIONI:** provate 3, prese 3 (nella revisione precedente 5/4, con una equivalente).

## Ricerca e critica
Ricerca: 3 fonti (sorgenti di react-native-web, ramo master, non la 0.21 esatta; le pagine APG, GOV.UK e Playwright non si sono aperte). Presi: `aria-disabled` via `Pressable disabled`, annuncio rinviato. Critica: 5 punti da correggere, tutti accolti (un solo riordino in volo, merge con riordino in attesa, ripristino su errore, test del 019, conteggio `change_log`).

## Proposte al metodo
nessuna

## Prossima fetta
Giro `verifica-produzione` di T8 (poi T9).
