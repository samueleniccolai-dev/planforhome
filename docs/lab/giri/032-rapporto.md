---
giro: 032
traguardo: T10
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-23T06:34:26Z
fine: 2026-10-23T07:32:47Z
pr: 45
ricerca_fonti: 6
critico_da_correggere: 3
critico_accolti: 16
revisore_bloccanti: 0
revisore_dubbi: 4
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 4
mutazioni_prese: 4
verify_rossi_locali: 1
test_totali: 549
test_delta: 26
decisioni_registro: 2
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti: 032:maggiore
proposte_metodo: nessuna
---
# Rapporto del giro 032 — promemoria automatici, silenzio notturno e ricalcolo

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/032-agenti.json. -->

> **PR:** #45 · **Branch:** `claude/giro-032-t10` · **Traguardo:** T10 — parziale (fetta 2/3)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Il server ora crea i promemoria da solo: per una scadenza con ora, l'anticipo (60'); per una scadenza di giorno, alle 9:00 e alle 18:00 nel fuso della famiglia.
- Silenzio notturno: un promemoria di notte slitta alle 7:00, o alle 21:45 della sera prima se la scadenza è prima delle 7:00.
- Si ricalcola quando cambiano scadenza, assegnatario, stato, inoltro, serie, rimozione di un membro e referente.
- Un task in coda scaduto avvisa i gestori.
- Il payload FCM resta generico: SPEC §8 si contraddice sul nome della risorsa, da decidere a te.
- **Revisione umana** (pr_guard): 4 file di accettazione corretti dopo il commit `test(acceptance)` (`4f80ca5`: i token scadevano dopo il salto di un anno dell'orologio; nessuna asserzione cambiata) e `032-agenti.json` senza costruttore-tdd, revisore e orchestratore (il container si è riavviato durante la revisione, che è stata rilanciata). Nessun percorso protetto toccato (V7 è solo un indice).
- Da decidere: dubbio 1 del revisore (vedi sotto), difetto maggiore da correggere in un giro futuro.
- Ratifiche: nessuna.

## Cosa funziona ora — con la prova
- 26 test di accettazione Giro032 verdi; `./mvnw -B -ntp verify` verde (383 test); app 114/114, tsc ed eslint puliti.
- Concorrenza: due `runDue()` insieme a rimozione del membro e a cambio di referente, senza stalli né doppi invii (sonde del revisore).
- Ora legale: provata sull'ultima domenica di marzo e di ottobre.

## Cosa non funziona ancora
- Android (`expo-notifications`) e verifica in produzione: giro 033 e poi verifica-produzione.
- Anticipo modificabile (`reminder_offset_minutes` fuori dall'API), task già esistenti e recupero dei promemoria passati: fuori perimetro.
- Cambio di ruolo/lingua: coperto solo dal controllo all'invio.
- Limite di 100 righe per corsa senza test dedicato.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 1) un PUT dopo l'istante di una riga e prima della corsa del lavoro (30 s) cancella una riga già dovuta e non inviata: promemoria perso (maggiore, conforme al piano; correzione: `due_at > now` in `deletePending`, giro futuro). 2) `sendReminder` può sovrascrivere con `error:network` il risultato del primo token dopo un'eccezione (minore, improbabile). 3) Il guard segnala `032-agenti.json` (scritto dal hook, si committa in chiusura). 4) Test di accettazione corretto in `4f80ca5` (solo login dopo lo spostamento dell'orologio, nessuna asserzione cambiata). Corretti: 0.
- **PERIMETRO:** nessuna aggiunta fuori piano.
- **CONCORRENZA:** 3 sonde + quelle del piano, verdi.
- **MUTAZIONI:** provate 4, prese 4.

## Ricerca e critica
Ricerca: nessun concorrente documenta un silenzio notturno lato app (lo rimandano al telefono): la regola è nostra. Critica: 3 punti da correggere, tutti accolti (ordine dei blocchi, ricalcolo su rimozione/referente, contesto di test unico), 16/16 punti accolti dal pianificatore. Fonti ufficiali non raggiungibili (rete).

## Proposte al metodo
nessuna

## Prossima fetta
Giro 033: Android (`expo-notifications`, `google-services.json`), si aprirà con una DOMANDA; poi verifica-produzione.
