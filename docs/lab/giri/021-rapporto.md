---
giro: 021
traguardo: T8
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-21T15:15:26Z
fine: 2026-10-21T15:41:00Z
pr: 31
ricerca_fonti: 7
critico_da_correggere: 4
critico_accolti: 4
revisore_bloccanti: 0
revisore_dubbi: 4
dubbi_corretti: 1
fuori_perimetro: 0
mutazioni_provate: 3
mutazioni_prese: 3
verify_rossi_locali: 0
test_totali: 577
test_delta: 8
decisioni_registro: 1
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 021 — il fuoco dopo «Sposta» solo subito dopo il tocco

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/021-agenti.json. -->

> **PR:** #31 · **Branch:** `claude/giro-021-t8` · **Traguardo:** T8 — Fatto quando verde, da
> verificare in produzione
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Contestazione 020-a risolta: dopo «Sposta su/giù» il fuoco va sul pulsante solo subito dopo il tocco.
- Risposte del server, voci sopra spuntate o rigate, voci che tornano da «Spuntate» non spostano più il fuoco: «Nuova voce» non perde i tasti.
- Cambia solo `app/src/shopping/ShoppingList.tsx` (20 righe aggiunte, 21 tolte). Server, dipendenze, migrazioni: nessuna modifica.
- Nessuna ratifica da dichiarare. Decisione 74 «cambiata», nuova decisione 77 (registro).
- Da provare a mano: APK su telefono fisico (`focus()` su Android non verificato), TalkBack; StrictMode non verificato (Playwright gira sul bundle di produzione).
- Punto [DA VERIFICARE] (regola 6): le fonti primarie (APG, react.dev, react-native-web) non si sono aperte; il comportamento del fuoco su un nodo spostato è provato solo dai test F1–F8 (7 fonti da estratti di ricerca, 21/10/2026).
- La PR va in revisione umana per `modello-inatteso`: in `021-agenti.json` mancano le voci di critico, costruttore-tdd, revisore e orchestratore (le scrive l'hook; file protetto, non toccato a mano).
- Il giro dopo (022) sarà `verifica-produzione` di T8.

## Cosa funziona ora — con la prova
- Test di accettazione F1–F8 (`app/e2e/acceptance/giro-021-focus.spec.ts`) verdi; rossi (F1–F5) prima della correzione.
- Playwright 179, Jest 84, server 314 (`verify`), tsc ed eslint puliti.

## Cosa non funziona ancora
- Prova su telefono fisico e StrictMode in sviluppo mancano. T8 non è `passato`: serve il giro di verifica.
- Annuncio della nuova posizione (`aria-live`) non fatto.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 4. Corretto: numero 75 doppio in DECISIONI (ora 77). Gli altri: `pr_guard` non lanciabile dal revisore (lanciato da me in chiusura), `021-agenti.json` modificato (atteso), StrictMode/Android non verificati (nel rapporto).
- **PERIMETRO:** nulla fuori dal piano.
- **CONCORRENZA:** 3 sonde (più Invii con PUT trattenuto, risposta concorrente, spunta in volo) verdi.
- **MUTAZIONI:** provate 3, prese 3.

## Ricerca e critica
Preso: fuoco come effetto del tocco, richiesta fissata in `move()`, un solo effetto su `[focusAt]`, azzerata solo nell'effetto. Critica: 4 su 4 accolti, più F7 (due tocchi) e F8 (tastiera). Scartato: flag in `ref` che maschera StrictMode.

## Proposte al metodo
nessuna

## Prossima fetta
Giro 022: `verifica-produzione` di T8.
