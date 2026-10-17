# Fase 0 — registro delle proposte

Una riga per ogni proposta di Claude nella fase 0 (B1–B8). Esito: **accettata**, **cambiata** o
**respinta**, con il perché. Serve alla soglia P6 di `docs/ESPERIMENTO.md`: almeno il 25% delle
proposte cambiate o respinte.

| # | Data | Fase | Proposta | Esito | Perché |
|---|---|---|---|---|---|
| 1 | 17/10/2026 | B1 | Intervista in blocchi da ≤ 5 domande, condotta da Claude, invece del flusso `/specify` di Spec Kit (poi: via di mezzo, Spec Kit solo come lista di controllo) | cambiata | Spec Kit diventa uno strumento del repository, iterato a ogni funzione nuova; Claude verifica risultato e integrazione |
| 2 | 17/10/2026 | B1 | Prima demo: login multi-famiglia con scelta, task con assegnatario o coda, scadenza e criticità, task ciclici, promemoria automatico e sollecito manuale; dopo: template, inoltro, calendario, ALL | accettata | |
| 3 | 17/10/2026 | B1 | Niente profilo ALL: vista «tutte le mie famiglie» limitata alle proprie | accettata | |
| 4 | 17/10/2026 | B1 | Template 730 (scan e PDF) fuori da R0: dati fiscali e archivio di file | accettata | |
| 5 | 17/10/2026 | B1 | Il promemoria per una risorsa senza app va al suo referente: chi ha assegnato il task, o un responsabile indicato sulla risorsa | accettata | |
| 6 | 17/10/2026 | B1 | Due ruoli per famiglia: gestore (assegna a tutte le risorse, gestisce membri e risorse, sollecita) e membro (crea task, prende dalla coda, assegna a sé) | accettata | |
| 7 | 17/10/2026 | B1 | Spec Kit: in fase 0 solo studio della versione attuale (documentazione, senza installare); installazione in fase C con approvazione, come dipendenza e riga in ADATTAMENTI | accettata | sinergia Spec Kit + `/giro` come parte della prova di questo esperimento |
| 8 | 17/10/2026 | B1 | Login di R0 con email e password gestite dal backend; accesso con Google o Apple dopo, perché ognuno è un'integrazione esterna | accettata | |
| 9 | 17/10/2026 | B1 | R0 solo Android con APK installato a mano; iPhone dopo, quando c'è l'account sviluppatore Apple | accettata | Apple quando il progetto si dimostra valido; i 25 $ una tantum di Google Play sono accettabili |
| 10 | 17/10/2026 | B2 | Spec Kit: usare solo `specify`, `clarify` (e `checklist`); non `plan`, `tasks`, `implement`, `converge`, `analyze` né l'estensione git; init a mano su un branch; template di specifica sovrascritto per chiedere il «fatto quando» | accettata | l'umano non conosce Spec Kit e si fida della raccomandazione (nota per P6: accettazione per fiducia) |
| 11 | 17/10/2026 | B3 | Stack: client Flutter (Android, web, poi iOS) con SQLite; server Quarkus + PostgreSQL; sincronizzazione nostra e stretta; uscita verso PowerSync se il traguardo del sync fallisce due volte | cambiata | server Spring Boot al posto di Quarkus; valutare anche React Native per il client |
| 12 | 17/10/2026 | B3 | Server di R0: fascia ~0 € (riuso del server di gerio-lab) o VPS nuovo ~5–10 €/mese | accettata | riuso del server del laboratorio |
| 13 | 17/10/2026 | B6 | Licenza MIT (alternative: Apache-2.0, AGPL-3.0) | accettata | |
| 14 | 17/10/2026 | B3 | Offline richiesto solo sul telefono; il web resta online | accettata | |
| 15 | 17/10/2026 | B3 | Client React Native + Expo (TypeScript) invece di Flutter, se passa la n. 14 | accettata | |
| 16 | 17/10/2026 | B3 | Server condiviso: fermare lo stack di gerio-lab (esperimento concluso) o proxy condiviso sull'host | accettata | fermare lo stack di gerio-lab |
| 17 | 17/10/2026 | B4 | Inoltro = spostamento del task; l'assegnatario resta solo se appartiene alla famiglia di arrivo, altrimenti coda con avviso prima di confermare (SPEC §2.2.6) | accettata | |
| 18 | 17/10/2026 | B4 | Promemoria: anticipo predefinito 1 ora + alla scadenza; scadenza solo di data → 9:00; task in coda scaduto → avviso ai gestori; silenzio notturno 22–7 per i soli automatici (SPEC §8) | accettata | |
| 19 | 17/10/2026 | B4 | Sollecito: al massimo 1 per task ogni 2 ore (SPEC §8) | cambiata | limite di 1 sollecito per task ogni 5 minuti |
| 20 | 17/10/2026 | B4 | Permessi: il membro segna fatto solo i task suoi o delle risorse di cui è referente; modifica solo i propri (SPEC §5) | accettata | |
| 21 | 17/10/2026 | B4 | Niente email in R0: password reimpostata dal gestore o dallo script demo (SPEC §2.3) | accettata | |
| 22 | 17/10/2026 | B4 | R1: un minore di 14 anni non ha account, resta risorsa con referente (SPEC §11) | accettata | |
| 23 | 17/10/2026 | B5 | 9 traguardi nell'ordine T1 deploy, T2 verifica visiva e APK, T3 account, T4 task e permessi, T5 ciclici, T6 inoltro, T7 spesa, T8 offline, T9 push; unica integrazione esterna FCM (T9) | accettata | |
| 24 | 17/10/2026 | B4 | Dominio di R0: app.planforhome.com | accettata | |
| 25 | 17/10/2026 | B7 | Provare a mano in C1 la build dell'APK senza EAS e del web, prima del giro 000; se non regge, decisione su EAS | accettata | |
| 26 | 17/10/2026 | B7 | Notifica sul telefono all'umano per ogni `domanda` e `revisione-umana` (canale da decidere in SETUP) | accettata | canale deciso dall'umano: la PR su GitHub e la notifica dell'app Claude sul telefono |
| 27 | 17/10/2026 | B8 | R0 esposto: registrazione solo con codice d'invito monouso (7 giorni); qualunque utente crea una famiglia; password demo da segreto in produzione; reimpostazione password solo con lo script di amministrazione | cambiata | registrazione pubblica (nessun timore di accessi non invitati); in più nessuna persona, utente o risorsa, esiste senza famiglia |
| 28 | 17/10/2026 | B8 | Ricorrenze: ancorate alla scadenza, periodi persi saltati, scadenza obbligatoria, «annulla questa volta» e «termina la serie»; nessuna cancellazione dura dei task in R0 | accettata | |
| 29 | 17/10/2026 | B8 | Promemoria: due_kind DATE/DATETIME (DATE: 9:00 e 18:00), anticipo per task, ricalcolo a ogni cambio, silenzio che non supera la scadenza (21:45), sollecito solo su task assegnati, segno «sollecitato» sul web, payload FCM senza dati personali, lingua del destinatario effettivo | accettata | |
| 30 | 17/10/2026 | B8 | Permessi completati: 15 righe in SPEC §5, ognuna con il suo traguardo | accettata | |
| 31 | 17/10/2026 | B8 | Traguardi da 9 a 10: T3 diviso in account (T3) e famiglie/persone/ruoli (T4); API pronte al sync da T5; Android chiama l'API fino all'offline; spesa online; offline con fotografia iniziale e pulizia della famiglia persa; build APK obbligatoria su ogni PR; smoke che cresce; 500 task solo descrittivo | accettata | |
| 32 | 17/10/2026 | B8 | ESPERIMENTO: modifiche E1–E6 (fine con caccia, passato dopo la verifica, P5 modello rifatto, P4 anche sui giri di costruzione, tabella di attribuzione, nuove minacce) | accettata | |
| 33 | 17/10/2026 | B8 | progetto.yml: proteggere le configurazioni dei test e del lint, i test di accettazione, il Dockerfile, le migrazioni esistenti; app/app nel limite di righe | accettata | |

## Fuori dal conteggio P6: esiti del CANCELLO 1 (fase A)

Esiti delle proposte di DELTA-V4, che non entrano in P6 perché precedono la fase 0. Li riporto per
completezza: su 3 punti discussi, 2 sono stati cambiati e 1 accettato.

| Voce | Esito | Perché |
|---|---|---|
| DELTA-V4 A1: costanti di stack in `progetto.yml` | respinta | non condizionare la scelta dello stack |
| DELTA-V4 A2: checklist di stack in un file di profilo | respinta | come A1 |
| DELTA-V4 §6: ratifiche non lette contate, senza fermare la catena | accettata | è una misura, non un vincolo; in Gerio resta il blocco |

## Conteggio per P6 al CANCELLO 2 (17/10/2026)

- Proposte decise: 33. Accettate: 29. Cambiate: 4 (n. 1, 11, 19, 27). Respinte: 0.
- Cambiate o respinte: **12%**, contro una soglia del 25%: la prima parte di P6 è **mancata**.
- Una proposta, la n. 10, è stata accettata per fiducia, senza conoscere lo strumento.
- La revisione indipendente di SPEC, traguardi e protocollo è stata fatta prima del giro 000 (B8,
  `revisione-fase0.md`): la seconda parte di P6 è **passata**.
- Sono numeri, non conclusioni: le conclusioni le scrive l'umano.
