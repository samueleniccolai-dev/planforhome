---
giro: 050
traguardo: T14
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-25T20:54:19Z
fine: 2026-10-25T21:47:19Z
pr: 74
ricerca_fonti: 6
critico_da_correggere: 1
critico_accolti: 1
revisore_bloccanti: 0
revisore_dubbi: 3
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 4
mutazioni_prese: 4
verify_rossi_locali: 0
test_totali: 1040
test_delta: 0
decisioni_registro: 5
decisioni_ratifica: 0
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 050 — T14 parte 2: `ConfirmDialog` e inoltro con la conseguenza scritta

> **PR:** #74 · **Branch:** `claude/giro-050-t14` · **Traguardo:** T14 — «Fatto quando verde, da
> verificare in produzione». Il prossimo giro è `verifica-produzione` di T14.
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Nuovo `ConfirmDialog` nel kit: titolo, conseguenza scritta, bottone di conferma con la conseguenza come descrizione, fuoco iniziale su «annulla».
- L'inoltro dice sempre cosa succede prima della conferma (resta assegnato, resta in coda, va in coda, membri non leggibili; riga sulla ricorrenza).
- «Annulla task», «Annulla questa volta» e «Termina la serie» passano nel dialogo con la conseguenza scritta.
- Anche su errore il dialogo si chiude e l'avviso compare nella sezione (critica 1).
- **Revisione umana richiesta:** test di accettazione vecchi 011, 014, 047 adattati (solo il contenitore: dialogo invece della riga; decisione 152).
- Da provare sul telefono: `accessibilityHint` con TalkBack e tasto Indietro sul dialogo (Android).
- Nessuna ratifica. Server non toccato, nessuna dipendenza.

## Cosa funziona ora — con la prova
- Revisore (SHA 13ee716): server 445, Jest 198, Playwright 394/394, `tsc` ed `eslint` 0 errori; K1, K2, G1, I1–I6, C1–C4, E1, S1, S2 verdi.
- 4 mutazioni su 4 prese; 3 sonde di concorrenza su 3 verdi (doppio clic, Esc con POST in volo).

## Cosa non funziona ancora
- `accessibilityHint` e tasto Indietro del dialogo provati solo con Jest, non su Android.
- Dopo un annullamento riuscito il fuoco non ha una destinazione definita (la riga cambia stato).
- Il ruolo resta `dialog`: la pagina APG non è stata letta (rete), fonti di seconda mano.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 3, nessuno corretto: K1 non ha un test Jest del fuoco iniziale su annulla (coperto da Playwright G1/C1–C3); `050-agenti.json` cambiato dal hook (atteso); `pr_guard.py` bloccato dall'hook come falso positivo, lanciato dall'orchestratore.
- **PERIMETRO:** nessuna aggiunta fuori piano.
- **CONCORRENZA:** 3 sonde su 3 verdi.
- **MUTAZIONI:** provate 4, prese 4.

## Ricerca e critica
Concorrenti analizzati: nessuno (Microsoft To Do, da `ricerca-concorrenti.md`: perde l'assegnazione nello spostamento, caso evitato dalla conseguenza scritta). Fonti: sorgenti di `Modal` di react-native-web (letti, ramo master, non la 0.21); w3.org e m3.material.io non raggiungibili. Critica: 1 punto su 1 accolto, più 3 facoltativi.

## Proposte al metodo
nessuna

## Prossima fetta
`verifica-produzione` di T14; poi T15.
