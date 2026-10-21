---
giro: 019
traguardo: T8
tipo: costruzione
esito: pr-aperta
inizio: 2026-10-21T10:13:09Z
fine: 2026-10-21T11:08:16Z
pr: 27
ricerca_fonti: 5
critico_da_correggere: 4
critico_accolti: 4
revisore_bloccanti: 0
revisore_dubbi: 5
dubbi_corretti: 0
fuori_perimetro: 0
mutazioni_provate: 4
mutazioni_prese: 4
verify_rossi_locali: 0
test_totali: 572
test_delta: 27
decisioni_registro: 4
decisioni_ratifica: 3
porte_senso_unico: 0
riparazioni: 0
difetti:
proposte_metodo: nessuna
---
# Rapporto del giro 019 — lista della spesa: chi toglie le voci e schermata dell'app

<!-- Modelli e token non stanno qui: li registra docs/lab/giri/019-agenti.json. -->

> **PR:** #27 · **Branch:** `claude/giro-019-t8` · **Traguardo:** T8 — Fatto quando verde, da
> verificare in produzione (il riordino «Sposta su/giù» nell'app passa al giro 020)
> **Domande che bloccano:** nessuna

## Per te, in 10 righe
- Contestazione 018-a applicata: creatore e gestori tolgono una voce, gli altri membri la rigano e la voce resta in «Voci tolte», ripristinabile. La decisione 61 è «cambiata (giro 019)».
- «Togli le spuntate» solo per creatore, gestori e assegnatario (gli altri 403). Migrazione V5 (solo colonne aggiunte). Replay sul task dell'URL corretto.
- Nell'app c'è la schermata della lista: tre elenchi, «aggiunta da X», aggiunta rapida, avvisi per lista cambiata. Interruttore «Lista della spesa» nel modulo dei task.
- **Revisione umana:** un test di accettazione del giro 018 è stato corretto (`clear-checked` fatto da Anna gestore, non da Giulia membro), come previsto dal piano; la PR tocca anche la migrazione.
- Budget sforato: circa 680 righe di produzione contro 580 previste (server ~200, app ~480). Il riordino nell'app è rinviato al giro 020.
- SPEC §5 non ha una riga per le voci: aggiungerla è una PR umana.
- Ratifiche da dichiarare lette: **019-a** (il creatore conta solo se è nella famiglia della lista), **019-b** (regole delle voci rigate), **019-c** (tre elenchi, riordino al giro 020).
- Modulo di merge: `⏱ N' · ratifiche lette: 019-a 019-b 019-c · note`.

## Cosa funziona ora — con la prova
- Server: `remove`, `restore`, permessi di `clear-checked`, replay corretto, lista inoltrata, serie, concorrenza (20 ripetizioni con barriera). Prova: `./mvnw -B -ntp verify`, 312 test verdi.
- App: schermata della lista in it/en. Prova: Jest 78, Playwright 160 (17 del giro 019), `tsc` ed `eslint` puliti.
- Revisore: 4 sonde di concorrenza verdi, 4 mutazioni su 4 prese.

## Cosa non funziona ancora
- Riordino con «Sposta su/giù» nell'app (giro 020). Il server del riordino c'è.
- Fuoco del campo «Nuova voce» su Android non provato. Su web `react-native-web` 0.21 ignora `submitBehavior`: serve anche `blurOnSubmit={false}` (contraddice la ricerca; decisione 70).
- Un doppio tocco su «Togli» di un membro dà al secondo tocco un avviso «La lista è cambiata» (dati corretti, pulsante non disattivato in corsa): dubbio minore.
- `pr_guard.py` non eseguibile dal revisore (hook); `createdBy`/`removedBy` di liste inoltrate mostrano UUID di persone fuori famiglia (solo id).
- Non verificati nella ricerca: Bring!, Keep, To Do, WAI-ARIA APG; `submitBehavior` [DA VERIFICARE] sulla doc di RN 0.88.

## Verdetto del revisore
- **BLOCCANTI:** nessuno.
- **DUBBI:** 5 (nessuno corretto, tutti nel rapporto).
- **PERIMETRO:** nessuna aggiunta fuori piano.
- **CONCORRENZA:** 4 sonde verdi (stessa `mutationId` in parallelo, URL diversi, restore contro clear-checked, isolamento).
- **MUTAZIONI:** provate 4, prese 4.

## Ricerca e critica
Presi: voce spuntata visibile e annullabile (AnyList), `submitBehavior` più `focus()`, etichette con il nome della voce. Critica: 4 punti su 4 accolti, più 6 aggiunte su 8; rinviate le prove sul riordino.

## Proposte al metodo
nessuna

## Prossima fetta
Giro 020: riordino «Sposta su/giù» nell'app, poi verifica-produzione di T8.
