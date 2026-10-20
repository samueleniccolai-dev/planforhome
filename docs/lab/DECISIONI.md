# DECISIONI — tre livelli (METODO §3)

- **registro:** dettagli interni reversibili; nessuna ratifica.
- **ratifica:** cosa vede chi usa l'app, dati salvati, costi ricorrenti, scelte care da cambiare.
  Massimo 3 per giro, numerate `NNN a`, `NNN b`, `NNN c`. Si contano e si dichiarano lette nel
  modulo di merge (`ratifiche lette: NNN-a NNN-b`), ma non fermano la catena. Per contestarne una,
  commenta la PR del giro: `contesto n. X: …`.
- **senso unico:** il giro si è fermato con una PR `domanda`; qui va la risposta dell'umano.

Stato: `—` (in vigore) · `contestata` · `cambiata (giro NNN)` · `risposta del GG/MM`.

Le decisioni della fase 0 sono in `docs/lab/fase0-decisioni.md`.

## Porte a senso unico già decise (SPEC §14.1)

Prese prima del giro 000, al CANCELLO 2 (17/10/2026). Non si contano nei traguardi.

| # | Porta | Decisione |
|---|---|---|
| 1 | Repository pubblico, licenza MIT | ADR-0002 |
| 2 | Stack: Spring Boot + PostgreSQL; React Native + Expo | ADR-0001 |
| 3 | Dati finti fino alla porta R1 | SPEC §3 |
| 4 | Server di gerio-lab, con il suo stack fermato | ADR-0001 |
| 5 | Nessun profilo ALL: si vedono solo le proprie famiglie | SPEC §2.2 |
| 6 | Il server decide su permessi e conflitti | SPEC §5, §7 |
| 7 | Identificativi UUIDv7 generati dal client | SPEC §6 |

## Decisioni dei giri

| N. | Data | Giro | Livello | Decisione | Alternativa scartata | Motivo (una riga) | Stato |
|---|---|---|---|---|---|---|---|
| 1 | 18/10/2026 | setup | registro | Prova a mano delle build (SETUP §8) riuscita: APK release senza EAS in 7 minuti e export web statico, con Expo SDK 58, react-native 0.88, Node 24, JDK 17 Temurin, Android SDK 36. Si resta senza EAS (decisione n. 25) | EAS Build | La build locale regge con gli stessi strumenti della CI; nel giro 000 serve `web.output: static` (il template di default ha `server`) | — |
| 2 | 19/10/2026 | 000 | registro | Healthcheck del server con `bash` e `/dev/tcp`, senza Actuator | Actuator con `permitAll` | Nell'immagine JRE non ci sono curl né wget (verificato 19/10/2026); `/api/health` è già pubblico | — |
| 3 | 19/10/2026 | 000 | registro | Volume `pgdata:/var/lib/postgresql` per postgres:18 | `/var/lib/postgresql/data` | PGDATA dell'immagine 18 è `/var/lib/postgresql/18/docker` (verificato con `docker inspect`, 19/10/2026) | — |
| 4 | 19/10/2026 | 000 | registro | `t()` scritto in casa in `app/src/i18n/`, lingua da `Intl` | `i18n-js`, `expo-localization` | Evita dipendenze nuove (porta a senso unico) | — |
| 5 | 19/10/2026 | 000 | registro | Deploy: `scp` in `incoming/<sha>/`, `flock` in `remote.sh` prima di spostare i file; password PostgreSQL generata solo se manca | Copia diretta in `/opt/planforhome` | Un deploy ucciso dal timeout non deve sovrascrivere file di uno in corso | — |
| 6 | 19/10/2026 | 000 | registro | `validate_user` accetta il suffisso `[bot]` | Modificare i tre script | `github.actor` di un bot finisce con `[bot]` | — |
| 7 | 19/10/2026 | 000 | ratifica (000-a) | Immagine base del server: Eclipse Temurin 25 JRE fissata per digest | Altre immagini JRE | Coerente con ADR-0001 (Java 25); si cambia con una riga | — |
| 8 | 19/10/2026 | 000 | ratifica (000-b) | Pacchetto Android `com.planforhome.app`, versione `0.1.0` | Altro identificativo | Resta su ogni APK firmato installato: cambiarlo dopo vuol dire un'app diversa sul telefono | — |
| 9 | 19/10/2026 | 001 | registro | Prova umana di T1/T2 (log deploy, artefatti, APK): esito verde, APK provato su emulatore Android 16 e non su telefono fisico; T1 passa; T2 resta in-corso (lo script accetta un traguardo per rapporto) | Attendere un telefono fisico (2-3 giorni) | Il «Fatto quando» di T2 chiede APK firmato e pubblicato; l'installazione è un dato a parte (piano 001, T2.6) | risposta del 19/10 |
| 10 | 19/10/2026 | 002 | registro | T2 passa con la prova di firma indiretta (passo «Sign the APK» verde; prova umana del 19/10 su ce8209b, codice identico) | Attendere l'accesso ai log di firma | Proxy e hook bloccano log e artefatti; il diff tra ce8209b e 36c065c è vuoto su app, server, workflow, infra | — |
| 11 | 19/10/2026 | 003 | ratifica (003-a) | Sessione con token opaco Bearer (hash SHA-256 in `auth_session`), valida 30 giorni; password con BCrypt, tra 10 e 72 byte | Argon2 (vorrebbe BouncyCastle, dipendenza nuova); JWT | Nessuna dipendenza nuova; il token si può revocare | — |
| 12 | 19/10/2026 | 003 | ratifica (003-b) | Limite ai tentativi in memoria, atomico: 5 login sbagliati per email (normalizzata, anche inesistente) ogni 15 minuti; registrazione e codici per IP | Tabella nel database | Processo unico in R0; si cambia se i server diventano più d'uno | — |
| 13 | 19/10/2026 | 003 | registro | Accesso ai dati con `JdbcClient`, senza entità JPA; UUIDv7 da `common/UuidV7` | Hibernate con `@UuidGenerator` | Tutti gli istanti arrivano da `Clock`; meno codice | — |
| 14 | 19/10/2026 | 003 | registro | Lista delle password comuni in `server/src/main/resources/common-passwords.txt` (circa 70 voci, scritta a mano) | Libreria esterna | Nessuna dipendenza nuova | — |
| 15 | 19/10/2026 | 003 | registro | Id famiglia non UUID nell'URL → 404 `not_found`, come famiglia altrui o inesistente; codici d'errore oltre il contratto: `invalid_request`, `locale_invalid`, `family_name_invalid`, `forbidden`, `not_found` | 400 | Non rivela nulla | — |
| 16 | 19/10/2026 | 003 | registro | Il seeder demo gira solo se `DEMO_PASSWORD` è impostata, in una sola transazione; password vuota = nessun dato demo | Password nel codice | Segreto da ambiente | — |
| 17 | 20/10/2026 | 003 | registro | Ratifiche 003-a e 003-b lette dall'umano. Nota: prima dell'app Android, la scadenza della sessione si rinnova (scorrevole) e il cambio password revoca le altre sessioni | Lasciare la scadenza fissa a 30 giorni e le altre sessioni attive | Richiesta dell'umano; va nella fetta di T3 parte 2, prima del token su Android | risposta del 20/10 |
| 18 | 20/10/2026 | 004 | ratifica (004-a) | Rinnovo della sessione esplicito: `POST /api/auth/refresh` (il client lo chiama all'apertura di `/me`); l'uso normale non rinnova | Scadenza scorrevole a ogni richiesta | Un test del giro 003 vuole la scadenza al giorno 30 + 1 minuto anche se usata al giorno 29 | — |
| 19 | 20/10/2026 | 004 | ratifica (004-b) | CSRF derivato dal token di sessione (`base64url(SHA-256("csrf:"+token))`), cookie `pfh_csrf` e header `X-CSRF-Token`; richiesto solo per richieste da cookie con metodo non sicuro, non sugli endpoint pubblici | `CookieCsrfTokenRepository` di Spring; valore casuale in tabella | Nessuna colonna nuova; nomi del contratto | — |
| 20 | 20/10/2026 | 004 | registro | Con l'header `Authorization` presente il cookie si ignora del tutto; il filtro Bearer esistente gestisce anche il cookie (prima 401, poi 403) | Filtro separato | Meno codice, ordine garantito | — |
| 21 | 20/10/2026 | 004 | registro | Il login nativo non è collegato in questo giro: `client:"web"` solo con `Platform.OS === 'web'`; token e archivio cifrato su Android nel giro dopo | Token in memoria su Android | Evita un cookie store nativo non cifrato (SPEC §9) | — |
| 22 | 20/10/2026 | 004 | registro | Ratifiche 004-a e 004-b lette dall'umano. Nota: il refresh della sessione va chiamato all'avvio dell'app (layout radice), non solo in `/me`; vale anche per Android | Refresh solo all'apertura di `/me` | Richiesta dell'umano; entra nella fetta di T3 parte 3 (token su Android) e nella verifica del web | risposta del 20/10 |
| 23 | 20/10/2026 | 005 | registro | T3 passa in produzione con 0 bloccanti; `Max-Age` del cookie di sessione di 1 secondo in meno è un difetto minore (004), non un controllo rosso | Contarlo rosso e rinviare T3 | Il «Fatto quando» di T3 non nomina `Max-Age`; il login su Android resta la prossima costruzione | — |
| 24 | 20/10/2026 | 006 | registro | Ordine dei controlli sugli endpoint di famiglia: 404 (appartenenza), 403 (ruolo), 400 (corpo), 409 (stato); nel `DELETE` di un'appartenenza: `last_manager`, `referent_in_use`, `last_family` | Validare il corpo per primo | Il test parametrico del giro 003 manda corpo `{}` e vuole 404 per gli estranei | — |
| 25 | 20/10/2026 | 006 | registro | Lock sempre nell'ordine `family` poi `person`, anche in `join` e `create`; `already_member` si controlla prima di consumare il codice, nella stessa transazione | `person` prima di `family` nel join | Deadlock tra join e remove sulla stessa famiglia | — |
| 26 | 20/10/2026 | 006 | registro | Lasciare una famiglia è `DELETE /api/families/{id}/members/{personId}`, non `/leave` | Endpoint `/leave` | Il test di isolamento del giro 003 lo chiamerebbe con Rosa e la farebbe uscire dalla famiglia demo | — |
| 27 | 20/10/2026 | 006 | registro | Validazione condivisa in `common/Names` (nome, fuso, UUID); fuso confrontato con gli id di zona IANA; `MembershipService.onMembershipRemoved` vuoto, punto di aggancio per T5 | Duplicare i controlli | Piano 006 | — |
| 28 | 20/10/2026 | 007 | registro | Rotta `/family?id=<uuid>` (statica) invece di `/families/[id]`: con output static una rotta dinamica non ha un HTML suo e servirebbe toccare `infra/` | Rotta dinamica con `generateStaticParams` | Nessuna modifica a Caddy | — |
| 29 | 20/10/2026 | 007 | registro | Dopo il login: 1 famiglia → `/family`, 2 o più → `/families`, errore o lista vuota → `/me`; sempre `router.replace`. Nessuna memoria dell'ultima famiglia | Ricordare l'ultima famiglia | SPEC §2.2.1: con più famiglie sceglie; il ripiego tiene verde il test del giro 004 | — |
| 30 | 20/10/2026 | 007 | registro | «Senza account» si decide da `hasAccount === false` (il server dà alle risorse `role: MEMBER`); `/family` rende `null` finché i dati non ci sono, per non mettere avvisi nell'HTML statico | Ruolo `RESOURCE` inventato | Allineato al server | — |
| 31 | 20/10/2026 | 007 | registro | Controllo UUID dell'`id` sul client (`isFamilyId`): id malformato o non tra le proprie famiglie = «Famiglia non trovata.» senza chiamare i membri. Il server resta l'unico a decidere i permessi | Solo la ricerca nell'elenco | Piano 007 | — |
| 32 | 20/10/2026 | 008 | senso unico | Perimetro del giro 008: opzione A, il giro diventa T5 parte 1 (server: tabella `task`, coda, ritorno in coda in `onMembershipRemoved`); T4 resta in-corso fino a un giro verifica-produzione | B costruzione minima sotto T4; C verifica parziale | Il modello dei task nasce una sola volta, con il rigore di T5 | risposta del 20/10 |
| 33 | 20/10/2026 | 008 | registro | Controllo unico degli id del client: `FamilyRepository.idInUse` su person, family e task, usato dalle tre creazioni | Tre controlli separati | SPEC §6: un id di un'altra entità è rifiutato, in entrambi i versi | — |
| 34 | 20/10/2026 | 008 | registro | `already_taken` come eccezione propria (`AlreadyTaken`); replay di una creazione senza `id` ritrova il task dal `mutationId`; duplicato di chiave su `applied_mutation` = 409 `mutation_conflict` | Allargare `ApiExceptionHandler`; 409 sul replay | Il client può rimandare la stessa richiesta | — |
| 35 | 20/10/2026 | 008 | registro | P3: un membro si assegna un task solo se in coda e creato da lui, o già suo; scadenza `DATE` = mezzanotte nel fuso della famiglia | Permettere di riprendersi task assegnati ad altri | Chiude la scappatoia al divieto di P6 | — |
