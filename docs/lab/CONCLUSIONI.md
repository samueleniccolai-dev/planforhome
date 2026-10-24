# Conclusioni — esperimento 2 (planforhome, metodo v4)

24/10/2026 · le scrive l'umano. La bozza l'ha scritta una sessione Claude su mia richiesta; io l'ho rivista e corretta. Un'altra sessione Claude l'ha controllata il 24/10 sui file e sui commenti delle PR; ho accettato le sue correzioni. La stessa sessione ha aperto la PR su mia richiesta, perché lavoro dal telefono; il merge è mio.

Fonti: `docs/lab/STATISTICHE.md` su main (`3aab127`), `metrics/giri.csv`, `metrics/tempo-umano.csv`, i commenti delle PR su GitHub (moduli e risposte, citati con il numero della PR). Rilancio degli script il 24/10 in una copia separata: esiti identici; cambiano la riga del giro 041 e la nota «esperimento in corso» di P5 (STAT:67), perché STAT è stato generato prima di `docs/lab/STOP`.

Sigle: STAT = `docs/lab/STATISTICHE.md`; TU = `metrics/tempo-umano.csv`; ESP = `docs/ESPERIMENTO.md`; METODO = `docs/METODO.md`; SKILL = `.claude/skills/giro/SKILL.md`; DECISIONI = `docs/lab/DECISIONI.md`; rapporto NNN = `docs/lab/giri/NNN-rapporto.md`; «:N» = riga.

## 1. In breve

- **Fatto.** La catena ha portato un prodotto nuovo a 10 traguardi passati su 10 (STAT:5). Calendario: 113,9 h per lo script, fino al merge della caccia (STAT:66); 106,4 h fino al merge dell'ultimo traguardo, come dice ESP:96 (`giri.csv`, `inizio` del 000 e `pr_mergiata` del 039). L'esperimento è finito per l'evento 1 di ESP §6, non per tempo (`docs/lab/STOP`:1).
- **Fatto.** Per lo script sono mancate tutte e sei le soglie e la metrica primaria (STAT:9, :63-68). Le parti delle soglie sono 15: 6 passate, 8 mancate, 1 non misurabile, la media di P1 (STAT:63, :65, :70).
- Vale l'esito dello script (ESP §3, §5). Accanto c'è una **lettura alternativa, mia**, con scelte dichiarate: righe di TU e commenti delle PR al posto dei moduli che lo script non legge, calendario di ESP:96, attesi sbagliati non contati come difetti. Non è un nuovo esito.

## 2. Soglie

| Soglia | Script | Lettura alternativa (mia) | Fonte |
|---|---|---|---|
| Primaria | mancata: 17/41 (41%) | uguale | STAT:9 |
| P1 | mancata: T2 15', T8 30', T10 16'; con minuti ignoti T1 ≥ 10', T3 ≥ 0', T5 ≥ 5', T9 ≥ 9'; media ≥ 9,6' (stampata «10'»), non misurabile | mancata: T1 15', T2 15', T3 ≥ 20', T8 30', T9 ≥ 11', T10 16'; media ≥ 12,7'. Entro 10': T4 1', T5 9', T6 10', T7 0' | STAT:63; TU:15-17; PR #7, #15, #36 |
| P2 | mancata: 98' | mancata: 105' con i moduli delle PR #43 (2') e #48 (5') | STAT:64; TU:23-34; PR #43, #48 |
| P3 | mancata: decisioni ≤ 5 passata; ratifiche lette 12/16 | passata: ratifiche 16/16 se contano TU:15-16; decisioni ≤ 5 | STAT:65; TU:15-16 |
| P4 | mancata: merge automatici 51%, fuori catena 0, attese 53%, primaria 41% | mancata: merge automatici e primaria come lo script; attese passata, 52,9 h su 106,4 h (49,7%) col calendario di ESP:96; fuori catena passata per la definizione (METODO:77-78), ma le forzature del 033 (§5) il controllo non le vede | STAT:66; `giri.csv` (`inizio`, `pr_mergiata`, `ore_attesa_umana`) |
| P5 | mancata: 8 bloccanti; verifiche, caccia e V1 passate | passata: 1 bloccante del prodotto trovato dopo il merge | STAT:67; rapporti 003, 006, 028, 040 |
| P6 | mancata: 12%; revisione indipendente passata | uguale | STAT:68 |

## 3. Fatti per soglia

- **Primaria.**
  - 24 giri con intervento: 20 merge a mano, più 4 domande con merge automatico (009, 012, 037, 039; `giri.csv`, colonne `merge_automatico` e `domande`).
  - Una verifica con la prova sul telefono si ferma con una PR `domanda` (SKILL:169-170), e una domanda è un intervento (STAT:11). È successo al 037 e al 039.
  - gerio-lab: 40% (ESP:42).
- **P1.**
  - T1: 10' del giro 000 (STAT:63) e 5' delle mie prove del giro 001 (commento sulla PR #7 del 19/10). Il modulo del merge della PR #7 è «0 N'», senza ⏱: lo script non lo legge (STAT:93).
  - T2 conta il giro 000 per intero (STAT:74).
  - T3 viene dalla revisione delle PR #10 e #11 (TU:15-16), che toccano percorsi protetti (rapporto 003:41, rapporto 004:42). Le due PR non hanno modulo.
  - T4 1', T6 10', T7 0' (STAT:63).
  - T5: 008 4', cioè 2' di risposta alla domanda e 2' di revisione (PR #15; la revisione è anche in TU:17); 012 5' (`giri.csv`). Il modulo della PR #15 l'ha scritto una sessione assistita e comincia con «🤖»: lo script lo scarta come commento di un giro (`scripts/metrics/raccogli.py`:55).
  - T8: 10' di contestazioni delle ratifiche 018-a e 019-b e della scrittura della PR #28 sullo SPEC (TU:19-20); 10' di moduli per la revisione e il merge delle PR #25 e #27 (note di TU:19-20); 10' di revisione del giro 020 (TU:21). Il merge della PR #28 non ha modulo.
  - T9: 024 7', 028 2' (`giri.csv`); 026 almeno 2', per la risposta alla domanda (PR #36; DECISIONI:118), con il merge senza modulo; 029 senza modulo.
  - T10: giro 033 7', 031 5', 032 e 035 2' ciascuno (`giri.csv`, `minuti_umani`).
  - gerio-lab: 8,5' di media su T1–T4 (ESP:39).
- **P2.**
  - 63' di runbook: 10' di preparazione (TU:23) e 53' di esecuzione (TU:24-34).
  - 35' dei giri di verifica (`giri.csv`, `minuti_umani`): la domanda del 034, che non ha eseguito controlli (10'; rapporto 034:33-34; DECISIONI:142), e due verifiche con la prova sul telefono, 037 e 039 (25').
  - 7' dei moduli delle mie PR #43 (esecuzione del runbook, 2') e #48 (`google-services.json` nei job `apk`, 5'): lo script non legge le PR umane.
  - gerio-lab: ~100' Stripe e ~120' email, senza assistenza (ESP:40).
- **P3.**
  - 16 ratifiche e 9 porte a senso unico; al massimo 5 decisioni, su T8 (`giri.csv`).
  - Non lette per la regola: 003-a/b e 004-a/b. Le PR #10 e #11 sono state mergiate senza modulo (STAT:93); TU:15-16 le dichiarano lette.
  - Il 037 e il 039 contano come porte in `giri.csv`, ma sono prove sul telefono, e una prova non è una porta (SKILL:169-171).
  - gerio-lab: media 2,5, 6 su T5 e T6 (ESP:41).
- **P4.**
  - I 20 merge a mano, per il primo motivo del commento «Revisione umana» del guard sulla PR o del rapporto:
    - 7 per percorsi protetti o dipendenze: 000, 003, 004, 024, 026, 031, 033;
    - 7 per test di accettazione corretti: 008, 013, 018, 019, 020, 032, 035;
    - 3 per segnalazioni del guard: 001 (due traguardi cambiati da un giro solo, PR #7), 002 (voce doppia nel registro degli agenti, rapporto 002:40), 029 (codice «cambiato dopo la revisione» per un merge di main, PR #40; `docs/lab/proposte-metodo.md`:19-28);
    - 3 senza verdetto o con bloccanti: 028, 034, 040.
  - Alcuni giri hanno più motivi (008, 019, 032, 033); conto il primo. Le segnalazioni del guard, a mio giudizio, non avevano un rischio vero.
  - Le attese di 3 notti (026, 031, 040) fanno 22,8 h sulle 60 dello script (`giri.csv`, `ore_attesa_umana`). Col calendario di ESP:96 il 040 è fuori: 15,7 h su 52,9.
  - Sui soli giri di costruzione: merge automatici 46%, attese 34% (STAT:85).
  - gerio-lab: 40%; 1 fuori catena; attese 85% (ESP:42).
- **P5.**
  - I 25 «difetti dopo il merge» (STAT:67), dalla colonna `difetti` di `giri.csv`:
    - 9 sono rilievi del revisore prima del merge, che i giri di costruzione registrano su sé stessi (000, 003, 006, 010, 032, 033). Quello del 032 (`deletePending`, rapporto 032:58) è stato mergiato ed è ancora aperto (§9);
    - 5 sono attesi sbagliati del piano (rapporto 028:34);
    - 11 sono difetti del prodotto trovati dopo il merge. Di questi, 1 solo è bloccante: replay dopo un inoltro, introdotto dal giro 016 (rapporto 040:33).
  - Non sono i 9 «bloccanti presi dal revisore prima del merge» di STAT:92: quelli sommano `revisore_bloccanti` (003, 006, 024, 028 ×5, 040).
  - `difetti:` è stato usato anche per i rilievi del revisore. I giri 001, 012, 028, 029, 037 e 040 scrivono in `difetto_di` il proprio numero, non il giro d'origine (per esempio 040 invece di 016), contro SKILL:166.
  - Il controllo V1 è stato provato il 19/10 sulla PR 5, nel giro 000 (`docs/lab/prove/v1.md`:2-4); ESP:43 lo chiedeva in C1.
  - gerio-lab: difetti non cercati (ESP:43).
- **P6.** 4 proposte cambiate su 33, 0 respinte (`docs/lab/fase0-decisioni.md`:56). La n. 10 l'ho accettata per fiducia (:58). Revisione indipendente con esito «passato» (`docs/lab/revisione-fase0.md`:2). gerio-lab: 138 su 140 senza modifiche (ESP:44).
- **Descrittivi.**
  - Tempo umano per riferimento: fase 0 262', setup 165', integrazione 63', giri 42', quotidiano 60', meccanismo 15' (STAT:89).
  - Bloccanti presi dal revisore prima del merge: 9 (STAT:92; vedi P5).

## 4. Ipotesi sulle cause

- **I1.** I minuti dei traguardi interni stanno dove correggo la catena (contestazioni, SPEC, test di accettazione corretti), dove si toccano percorsi protetti o dove il guard segnala qualcosa; non nel lavoro di routine.
- **I2.** P1 e P4 penalizzano le decisioni prese davvero da me, che ESP §1 chiede.
- **I3.** Una parte dei merge a mano viene dal meccanismo (registri degli agenti, conteggi, merge di main nel branch), non dal rischio del codice.
- **I4.** Le attese misurano la mia disponibilità, soprattutto di notte (ESP:64-65).
- **I5.** La regola «controllo rosso = bloccante» (SKILL:165-166) non distingue un atteso sbagliato da un difetto.
- **I6.** Il difetto del canale trovato nel 037 può venire dalla documentazione di Expo non raggiungibile nel giro 033 (rapporto 033:66).
- **I7.** P2 pesa così perché era la prima esecuzione, dal PC di lavoro, e, se I6 è vera, con una verifica ripetuta per il difetto del 033. Senza la modifica dello SPEC e senza quella verifica farebbe circa 73' (98' − 10' del 034 − 15' del 039): comunque sopra 60'.
- **I8.** In fase 0 ho accettato anche per fiducia: la n. 10, «senza conoscere lo strumento» (`docs/lab/fase0-decisioni.md`:58), 1 caso su 29 accettate. Lo scopo era pure provare tecnologie nuove. Allora P6 non distingue un'accettazione per fiducia scelta da una distratta.

## 5. Minacce alla validità

- **Sessione assistita** dal 22/10 sera al 24/10 (PR #43–#57), per lavorare solo dal telefono. Ha fatto con il mio token, su mia indicazione:
  - i merge;
  - i moduli;
  - le risposte alle domande dei giri 033, 034, 037 e 039.

  Già il 20 e il 21/10 una sessione assistita aveva scritto alcuni moduli e contestazioni (PR #15, #34, #36). I minuti sono miei. Direzione: a favore su P1 e sulle attese di P4. Nessun effetto sulle ratifiche: dopo il giro 020 non ce ne sono (`giri.csv`, `decisioni_ratifica`). Che le decisioni siano mie dai file non si verifica.
- **Giro 033.**
  - `expo-notifications` l'ha installata la sessione assistita (`5de1a14`). È una mia dichiarazione: il commit ha l'autore della catena (`Claude <noreply@anthropic.com>`), quindi `commit_umani` vale 0.
  - La domanda sulla PR #47 era già risposta ed è stata rimessa (`giri.csv`: `domande` = 2): è una forzatura del protocollo.
  - Il controllo «fuori catena» non vede nessuna delle due: a favore su P4.
- **SPEC cambiato a metà traguardo**: PR #46 su T10 (giro 035 e il «passo prima» del 034) e PR #28 su T8. Contro su P1, P2 e P4, poco; nessun esito cambia.
- **Runbook FCM.** Prima volta, dal PC di lavoro con Cloud Shell. Il valore di `GOOGLE_SERVICES_JSON` è finito a video, senza la chiave API nella parte visibile (`docs/runbook/fcm.md`:88). Contro su P2, rispetto a un'esecuzione ripetuta.
- **Registri degli agenti incompleti al momento della PR**: il guard li segnala nei giri 000, 008, 018, 024, 032 e 033 (rapporti 000:42, 008:42, 018:40, 024:41, 032:41, 033:41); si completano in chiusura (SKILL:174-175). Il controllo V1 ha dei buchi: a favore sul dato «0 modelli inattesi» (STAT:86).
- **Minuti ignoti**: il giro 029 e i merge delle PR #28 e #36 (giro 026), senza modulo. A favore: i minuti veri possono solo essere di più. Le PR #3 (Dependabot) e #41 (guard) hanno minuti ignoti, ma vanno in `meccanismo` (ESP:94): non toccano le soglie.
- **Minuti autodichiarati, assistenza dell'IA, `da_gerio` «no» su tutte le righe di TU**: a favore su P1 e P2.
- **Errori degli script** (sezione 2): in tutte e due le direzioni.
- **Chiusura senza correggere il bloccante** (ESP §6 lo permette): a favore su P1 e P4, perché non ci sono giri di correzione.
- **Minacce già in ESP §5** (dominio, metodo e stack insieme; Spring invece di Quarkus; un caso solo; dati finti) restano. Spec Kit non è stato usato nei giri: il campo `spec` di `docs/lab/traguardi.json` cita solo sezioni dello SPEC. La fine per tempo non si è presentata.

| Esito | Quanto regge |
|---|---|
| P1, P2, P6 mancate | alto |
| P4 merge e primaria mancate | medio |
| P3 ratifiche, P4 attese, P5 bloccanti mancate | basso |

## 6. Pre-mortem (`docs/lab/pre-mortem.md`)

- **Non avverati:**
  - i binari che non partono: T1 e T2 passati il 19/10 (`giri.csv`, `pr_mergiata` di 001 e 002);
  - il sync che affonda T9: una sola verifica non passata, per attesi sbagliati (rapporto 028:34).
- **Avverato in parte:** l'umano come collo di bottiglia. Attese al 53% contro 85% di gerio-lab (STAT:66; ESP:42); la più lunga 7,9 h (giro 031; `giri.csv`, `ore_attesa_umana`).
- **Non presentato:** Spec Kit contro `/giro`.
- **Avverato, ma per cause diverse da quelle previste:** il meccanismo che si rompe da fuori. Container riavviati (rapporto 032:41), rete e DNS (rapporto 033:66, rapporto 014:63), il proxy che blocca `npx expo install` (DECISIONI:113), il 403 sul download dell'APK dalla sessione cloud (rapporto 037:38). In TU non sono annotate come `meccanismo`, come chiedeva la contromisura (pre-mortem:13).
- **Fuori dalle contromisure:** l'interesse è rimasto. Il prodotto serve alla famiglia, ma non in questo stato: lo useremo dopo aver risolto i bloccanti, la UI e la UX (§7, §9).
- **Avverati senza essere previsti:**
  - attesi sbagliati nei piani di verifica (rapporto 028:34);
  - SPEC cambiato a metà traguardo (PR #28, #46);
  - segnalazioni del guard senza un rischio vero, a mio giudizio (§3, P4);
  - un dato a video durante l'integrazione (`docs/runbook/fcm.md`:88);
  - difetti di sicurezza aperti alla chiusura (rapporto 040:33-34).

## 7. Per me: metodo v4 contro gerio-lab (percezione)

- **Meglio per i tempi**, con più merge automatici. Mi sono fidato del risultato. I dati accanto:
  - merge automatici 51% contro 40%, attese 53% contro 85% (STAT:66; ESP:42);
  - però la primaria è 41% contro 40%, e la caccia ha trovato un bloccante di isolamento (rapporto 040:33).
- Mi è piaciuto non dover usare un PC fisso; per FCM però è servito quello di lavoro (TU:23).
- Mi è piaciuto poter modificare lo SPEC e contestare le ratifiche.
- **Più problemi di UI e UX che in gerio-lab.** È una percezione: nel repository non c'è una misura della UX di gerio-lab. Ci sono 6 osservazioni (`docs/lab/ux/2026-10-23-osservazioni-umano.md`).
  - *Ipotesi:* gerio-lab copiava un prodotto esistente (ESP:12), e nei «Fatto quando» non c'è nessun criterio di usabilità (`docs/lab/traguardi.json`, campo `fatto_quando`).
- Le funzionalità ci sono. Per usarlo davvero manca la UI e la UX.

## 8. Esperimento 3

- UI e UX nel ciclo, con un criterio nei «Fatto quando».
- Il lavoro dal telefono (merge, moduli, risposte) previsto dal metodo, senza bisogno di una sessione assistita.
- In verifica, un atteso sbagliato non è un bloccante. `difetti:` solo per i difetti trovati dopo il merge, con il giro d'origine.
- Meno segnalazioni del guard senza un rischio vero.
- SPEC libero, ma con i suoi costi contati a parte (un riferimento `spec` in TU).
- Correzioni agli script:
  - tenere i minuti noti anche senza modulo;
  - leggere un modulo anche senza ⏱ (PR #7) o scritto da una sessione assistita (PR #15);
  - calendario come ESP:96;
  - dire come si divide il giro 000;
  - leggere i moduli delle PR umane;
  - non contare come porte le prove sul telefono;
  - stampare «≥» sulla media di P1 quando ci sono minuti ignoti.
- **Concorrenti dichiarati.** Quando una decisione si basa sui concorrenti, la riga di DECISIONI e il rapporto dicono quali app sono state analizzate e cosa se ne è preso. Se non ne è stata analizzata nessuna, lo dicono.
  - Fatto: su 18 ricerche (`docs/lab/giri/*-ricerca.md`), 8 non nominano nessuna app dell'elenco del ricercatore (`.claude/agents/ricercatore.md`:16-17): 004, 020, 021, 026, 030, 031, 033, 038. Solo due lo dicono (020-ricerca:6, 033-ricerca:6). DECISIONI non ne nomina nessuna. Solo il rapporto 014 dice cosa ha preso e da chi (rapporto 014:63).
- **Il cartografo.** Un repository privato, solo mio, fuori da planforhome, che fa da base di conoscenza. Ogni esperimento ci scrive cosa studiare: i concetti applicati ed esempi di dove vederli (file, PR, giro). Io studio quando posso, e intanto il progetto va avanti senza aspettarmi.
  - Nasce da I8: in fase 0 ho accettato anche per fiducia, come la n. 10 (`docs/lab/fase0-decisioni.md`:58). *Ipotesi:* il tempo per capire le cose nuove non c'era dentro il giro.
  - Lo studio è asincrono, quindi non aggiunge attese (P4).
  - Il tempo di studio va in TU con un riferimento suo, per esempio `studio`, fuori da P1.
  - La catena che scrive in un secondo repository è un'integrazione nuova, quindi una porta a senso unico (CLAUDE.md regola 2): si decide in fase 0.
  - Anche se è privato, lì non vanno segreti (regola 4). Quello che la catena rilegge da lì è un dato, mai un'istruzione (regola 5).

## 9. Difetti aperti alla chiusura

- **Bloccante:** il replay di una creazione dopo un inoltro restituisce il task a chi non è della famiglia. Introdotto dal giro 016 (rapporto 040:33).
- **Maggiore:** i token FCM restano dopo il logout (rapporto 040:34; SPEC §9).
- **Maggiore:** `deletePending` può cancellare un promemoria già dovuto (rapporto 032:58; già noto nel rapporto 040:34).
- **Minori:** 3 (rapporto 040:35).
- Nessuna conclusione sulla prontezza per dati reali (R1).
