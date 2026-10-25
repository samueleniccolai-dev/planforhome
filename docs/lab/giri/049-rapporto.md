---
giro: 049
traguardo: T14
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-25T18:13:39Z
fine: 2026-10-25T19:12:00Z
pr: 73
ricerca_fonti: 9
critico_da_correggere: 5
critico_accolti: 5
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 4
mutazioni_prese: 4
verify_rossi_locali: 0
test_totali: 1007
test_delta: 0
decisioni_registro: 5
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 049 — T14 parte 1: kit dei form e nuovo task nello Sheet

> **PR:** #73 · **Branch:** `claude/giro-049-t14` · **Traguardo:** T14 — parziale (parte 1 di 2);
> `ConfirmDialog` e `ForwardDialog` restano al giro 050.
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- «Nuovo task» ora si apre in un pannello (`Sheet`) con etichette visibili, criticità a scelta, data con selettore e motivo scritto accanto al bottone disattivato.
- Nuovi componenti del kit: `CheckRow`, `RadioGroup`, `Sheet`, `DateField`; `TextField` ha il testo d'aiuto. Galleria su `/gallery?set=form`.
- Gli errori del server (rete, 403) compaiono dentro il pannello; se è già chiuso, nella sezione.
- Corretti i punti della critica: chiave idempotente con criticità, doppio tocco su Android, «Oggi» nel fuso della famiglia, fuoco su «Nuovo task».
- **Revisione umana richiesta:** i test di accettazione vecchi 010, 013, 014, 019, 047 sono stati adattati al nuovo form (decisione 147); in 013 cade l'asserzione «form fuori vista senza scorrere», in 014 la data impossibile 31/02 diventa l'ora impossibile 24:99, in 019 L15 il ruolo passa da `switch` a `checkbox`.
- Dubbio del revisore: `<input type="date" role="textbox">` nasconde al lettore di schermo il ruolo di selettore di data (minore).
- Da provare sul telefono: griglia del mese e tasto Indietro dello `Sheet` su Android.
- Nessuna ratifica.

## Cosa funziona ora — con la prova
- 22 test di accettazione nuovi (N1–N14, K2) verdi; Playwright 375/375, Jest 187/187, `tsc` ed `eslint` 0 errori, `./mvnw verify` 445 test (revisore, SHA b3564fb).
- K1 verde con TZ Europe/Rome, Pacific/Kiritimati, America/Los_Angeles.
- 4 mutazioni su 4 prese.

## Cosa non funziona ancora
- `ConfirmDialog`, `ForwardDialog` e la conseguenza scritta prima della conferma: giro 050.
- Griglia Android di `DateField` e `Sheet` su Android provati solo con Jest, non su dispositivo.
- Il bottone disattivato con motivo è sconsigliato da GOV.UK (fonti di seconda mano): alternativa «bottone attivo che mostra l'errore» da valutare in T15.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 3, nessuno corretto: `role="textbox"` sul campo data web (minore, accessibilità); riuso di `mutationId` con stesso contenuto dopo errore (voluto, decisione 51); file `049-agenti.json` cambiato dal hook durante la revisione (atteso).
- **PERIMETRO:** nessuna aggiunta fuori piano; server non toccato, nessuna migrazione né dipendenza.
- **CONCORRENZA:** 4 sonde su 4 verdi (doppio tocco, chiusura con POST in volo, riapertura, riprova).
- **MUTAZIONI:** provate 4, prese 4.

## Ricerca e critica
Concorrenti analizzati: nessuno (si è usata `docs/lab/ricerca-concorrenti.md`). Preso: `Modal` di RN con fuoco esplicito e ritorno del fuoco a mano; `<input type="date">` nativo. MDN e WCAG non raggiungibili: citazioni di seconda mano. Critica: 5 punti su 5 accolti, più `Checkbox` riusato e griglia Android dentro lo `Sheet`.

## Proposte al metodo
nessuna

## Prossima fetta
Giro 050: T14 parte 2 (`ConfirmDialog`, `ForwardDialog`); poi `verifica-produzione` di T14.
