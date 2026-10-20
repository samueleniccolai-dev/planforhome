---
giro: 006
traguardo: T4
traguardi_extra: []
tipo: costruzione
fase: finale
inizio: 2026-10-20T05:35:20Z
ricerca: no
accettazione:
ripreso: no
---
# Piano del giro 006 — famiglie, persone e ruoli sull'API

## Fetta e traguardo
T4, parte 1 di 2: **il lato server** delle righe P13, P14 e P15 di SPEC §5 e della regola
«nessuna persona resta senza famiglia» (SPEC §2.2.1). T3 è passato e ogni traguardo dopo (T5–T10)
ha bisogno di famiglie, ruoli e referenti veri. T4 intero non sta in una sessione (API + scelta e
cambio famiglia nell'app web): si taglia di nuovo sul confine API / app, come in T3.

Nota: PROGRESS indicava come prossimo il login su Android (T3 parte 3, porta `expo-secure-store`).
L'orchestratore ha scelto T4: il login su Android resta in coda, non fa parte del «Fatto quando»
di T3 (DECISIONI n. 23) e non blocca T4.

**Resta per la parte 2 (giro successivo, T4):** test Playwright — Luca entra diretto nella
Famiglia Mamma; Giulia sceglie tra Famiglia Principale e Famiglia Mamma e cambia famiglia da
qualunque schermata (selettore nel layout radice).
**Resta per T5:** «i suoi task tornano in coda» quando si disattiva un account o si cancella una
risorsa. In questo giro la tabella `task` non esiste: il costruttore lascia nel servizio un solo
punto (`MembershipService.onMembershipRemoved` o simile) dove T5 aggiungerà il ritorno in coda, e
il giro di T5 ne scrive il test. T4 non può passare prima che quel test esista e sia verde.

Fonti: SPEC §2.1, §2.2.1, §5 (P13–P15), §6, App. A; codice in `server/.../family/`,
`server/.../account/`; `Giro003IsolationAcceptanceTest` (percorre già tutti gli endpoint).

## Cosa si costruisce

Package `com.planforhome.family` (logica nei servizi, controller sottili). Nessuna migrazione
prevista: `disabled_at`, `membership.referent_person_id` e la FK composta esistono già (`V1`). Se
serve un indice o un vincolo in più, solo `V2__…sql` in aggiunta.

| Endpoint | Corpo | Esito |
|---|---|---|
| `POST /api/families` (P14) | `{id?, name, timeZone?}` | 201 `{id, name, timeZone, role:"MANAGER"}`; chi chiama ne diventa gestore, qualunque sia il suo ruolo altrove. `name` vuoto dopo trim, con NUL o oltre 80 caratteri → 400 `family_name_invalid` (stessa validazione della registrazione, riusata). `timeZone` fuori da `ZoneId.getAvailableZoneIds()` → 400 `time_zone_invalid` (predefinito `Europe/Rome`). `id` facoltativo, UUID dal client, confrontato **solo con `family.id`**: già usato da chi chiama, con lo stesso nome → 200 con la stessa famiglia (idempotente); altrimenti (famiglia di altri, o stesso utente con altro nome) → 409 `{"error":"id_conflict"}`, nessuna appartenenza creata. Insert senza controllo preventivo: il duplicato di chiave (`DuplicateKeyException`) si cattura, la transazione si annulla e si rilegge; così due invii paralleli con lo stesso `id` danno una 201 e una 200, una famiglia, una appartenenza. |
| `POST /api/families/join` (codice da utente già registrato) | `{code}` | 200 `{id, name, timeZone, role:"MEMBER"}`. Codice sconosciuto, scaduto o usato → 400 `invite_invalid`. Utente già nella famiglia del codice → 409 `already_member` e il codice **non** si consuma: in una sola transazione si blocca la riga `person` di chi chiama (e si ricontrolla `disabled_at is null`, altrimenti 401), si legge la famiglia del codice valido, si controlla l'appartenenza **prima** di consumare, poi `consumeInvite` e insert; un duplicato di chiave sull'insert (corsa) annulla tutta la transazione, consumo compreso, → 409 `already_member`. Stesso limite per IP dei codici in registrazione (`AttemptLimits.inviteCodes`, 5 rifiuti/ora, DECISIONI n. 12): contano solo i codici sbagliati; 200 e `already_member` restituiscono lo slot (il codice era buono). |
| `POST /api/families/{familyId}/invites` (P13) | — | esiste già: gestore 201, membro 403. |
| `POST /api/families/{familyId}/resources` (P13) | `{id?, displayName, referentPersonId}` | 201 `{personId, displayName, role:"MEMBER", hasAccount:false, referentPersonId}`. Solo gestore (membro → 403 `forbidden`). `referentPersonId` che non è un **utente** della stessa famiglia (risorsa, utente di un'altra famiglia, inesistente) → 400 `referent_invalid`, nessuna persona creata. `displayName` come in registrazione (validazione riusata) → 400 `display_name_invalid`. `id` facoltativo, confrontato con `person.id`: già una risorsa di questa famiglia → 200 con la stessa risorsa (idempotente); qualunque altra persona → 409 `{"error":"id_conflict"}`, nulla creato. Blocca la riga `family` come ogni altra scrittura (vedi «Rischi di concorrenza»). |
| `PUT /api/families/{familyId}/members/{personId}/role` (P13) | `{role}` | 200 membro aggiornato. Solo gestore. `role` non `MANAGER`/`MEMBER`, o `MANAGER` a una risorsa senza account → 400 `role_invalid`. Togliere il ruolo all'unico gestore → 409 `last_manager`. |
| `PUT /api/families/{familyId}/members/{personId}/referent` (P13) | `{referentPersonId}` | 200. Solo gestore. Destinatario non risorsa senza account → 400 `not_a_resource`; referente non utente della famiglia → 400 `referent_invalid`. Blocca la riga `family` (un referente tolto in parallelo dà 400, mai 500 per la FK composta). |
| `DELETE /api/families/{familyId}/members/{personId}` (P13 se `personId` è un altro; P15 se è chi chiama) | — | 204. **Altri:** solo gestore (membro → 403). **Sé stessi (lasciare):** gestore e membro; ultima famiglia di chi chiama → 409 `last_family`; unico gestore → 409 `last_manager`. **Ultima appartenenza di un utente tolta da un gestore:** basta un `update user_account set disabled_at = Clock.instant()`: le sessioni (token e cookie web) cadono da sole, perché `liveSession` filtra già `disabled_at is null`; il login risponde con lo stesso errore di una password sbagliata. **Ultima appartenenza di una risorsa:** la persona è cancellata. Persona referente di una risorsa in quella famiglia → 409 `referent_in_use` (prima si nomina un altro referente). |

**Ordine dei controlli (fisso, per ogni endpoint con `{familyId}`):** 1) appartenenza di chi chiama
→ 404 `not_found`; 2) ruolo → 403 `forbidden`; 3) corpo → 400; 4) `{personId}` nella famiglia →
404; 5) regole di stato → 409. Così il test parametrico del giro 003 (corpo `{}`) vede 404 da fuori
e mai un 400 che riveli la famiglia. Tra le regole di stato del `DELETE`: prima `last_manager`, poi
`referent_in_use`, poi `last_family`.

Isolamento: `{familyId}` altrui o inesistente → 404 `not_found` (corpo identico); `{personId}` che
non appartiene a quella famiglia → 404 `not_found`; `referentPersonId` di un'altra famiglia nel
corpo → 400 `referent_invalid` (non rivela se la persona esiste). Il «lasciare» sta su un percorso
con `{personId}` e non su `/{familyId}/leave`: il controllo positivo del test di isolamento del
giro 003 chiama con Rosa ogni endpoint che ha **solo** `{familyId}`, e con `/leave` farebbe uscire
Rosa dalla Famiglia Babbo dei dati demo condivisi.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro006*AcceptanceTest' test` → tutti verdi:
  - P14: Ettore (membro nella Famiglia Faggio) crea «Famiglia Larice» → 201, ne è gestore, `GET /api/families` gliene mostra 2; fuso esplicito `America/New_York` → restituito; vietato: senza login → 401, nome vuoto o di 81 caratteri → 400 `family_name_invalid`, fuso `Marte/Olimpo` → 400 `time_zone_invalid`, e nessuna famiglia creata; stesso `id` ripetuto → 200 con la stessa famiglia, nessun doppione; stesso `id` in 2 invii paralleli → una 201 e una 200, una famiglia, una appartenenza; `id` della famiglia di Ettore usato da Bruno → 409 `{"error":"id_conflict"}`, nessuna appartenenza per Bruno; `id` della Famiglia Babbo → 409;
  - codice da utente già registrato: Irene genera un codice della Famiglia Faggio, Bruno (già registrato altrove) lo usa → 200 `MEMBER`; vietato: lo stesso codice di nuovo (da Carla) → 400 `invite_invalid`; un codice scaduto (orologio + 7 giorni + 1 minuto) → 400; un codice inventato → 400; in tutti e tre i casi Carla non è tra i membri e il suo `GET /api/families` non cambia; Bruno con un secondo codice della stessa famiglia → 409 `already_member` e quel codice vale poi per Carla; da uno stesso IP 5 codici sbagliati → 400, il sesto → 429 `too_many_attempts`; da un altro IP 6 `already_member` di fila → sempre 409 e poi un codice sbagliato → 400 (lo slot torna);
  - P13 codici: gestore 201, membro 403 (nuova famiglia del giro, non i dati demo);
  - P13 risorse: Irene aggiunge «Nina» (con `id`) con referente Irene → 201, `hasAccount:false`; lo stesso `id` di nuovo → 200, nessun doppione; vietato: Bruno (membro) → 403; referente = una risorsa → 400 `referent_invalid`; referente = un utente di un'altra famiglia (Luca) → 400 `referent_invalid`; nome vuoto → 400 `display_name_invalid`; `id` = la persona di Marco (Famiglia Principale) → 409 `{"error":"id_conflict"}`; in tutti i casi l'elenco membri non cambia;
  - P13 ruoli: Irene, unica gestore, si toglie il ruolo → 409 `last_manager`; Irene nomina Bruno gestore → 200; Irene toglie il ruolo a Bruno (due gestori) → 200; vietato: Carla (membro) nomina sé stessa gestore → 403; `MANAGER` a Nina o ruolo `OWNER` → 400 `role_invalid`; ordine dei controlli con corpo `{}`: Luca → 404, Carla (membro) → 403, Irene → 400;
  - P13 referente: Irene sposta il referente di Nina a Bruno → 200; vietato: membro → 403; referente risorsa → 400 `referent_invalid`; destinatario utente (Bruno) → 400 `not_a_resource`;
  - P13 togliere un'appartenenza: Irene toglie Carla (che sta anche in un'altra famiglia) → 204, Carla entra ancora; vietato: Bruno (membro) toglie Carla → 403;
  - P15 lasciare: un membro con 2 famiglie (Bruno) lascia la Famiglia Faggio → 204; un gestore con 2 famiglie (Carla, promossa) lascia se resta un altro gestore → 204; vietato: l'unica gestore **con 2 famiglie** (Irene, entrata anche in Olmo) → 409 `last_manager`; un membro con 1 sola famiglia (Ettore) → 409 `last_family`; in entrambi i casi resta membro; precedenza: un'unica gestore con 1 sola famiglia → 409 `last_manager`;
  - ultima appartenenza di un utente: Irene toglie Ettore (1 sola famiglia) → 204; il suo token **e il suo cookie web** danno 401 su `GET /api/me`; il login con la password giusta risponde come per una password sbagliata (stesso stato, stesso corpo);
  - ultima appartenenza di una risorsa: Irene toglie Nina → 204; Nina non compare più in nessun elenco e un secondo `DELETE` → 404;
  - referente in uso: Irene toglie Bruno mentre è referente di Nina → 409 `referent_in_use`, e anche Bruno che lascia → 409; Bruno resta membro;
  - isolamento: Luca su ogni endpoint nuovo della Famiglia Babbo → 404 con corpo identico a quello di una famiglia inesistente; Irene con `{personId}` di Rosa sulla Famiglia Faggio → 404 e Rosa resta in Babbo; `referentPersonId` di Marco (Famiglia Principale) su Famiglia Faggio → 400 `referent_invalid` (risorse e cambio referente);
  - concorrenza: vedi «Rischi di concorrenza».
- [ ] `cd server && ./mvnw -q -Dtest='Giro003*AcceptanceTest,Giro004*AcceptanceTest' test` → verdi (il test di isolamento parametrico percorre anche i nuovi endpoint senza modifiche).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (Spotless compreso).
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Dati demo del giro (inventati)
I test **non modificano** le famiglie dell'Appendice A: il contesto Spring e il database sono
condivisi tra tutte le classi di accettazione. I dati demo servono solo in lettura (Luca, Rosa,
Marco, Famiglia Babbo per l'isolamento); per questo P14 la prova Ettore e non Luca (il giro 003
verifica che Luca abbia 1 sola famiglia). Ogni test registra le sue persone con email uniche
`g006-<nome>-<uuid>@example.com`, password `Lanterna-Blu-42`, locale `it`, e ogni registrazione
arriva da un IP proprio (`X-Forwarded-For` in `198.18.0.0/15`) per non toccare il limite di 10
registrazioni/ora per IP:

| Persona | Ruolo | Note |
|---|---|---|
| Irene | gestore | registra «Famiglia Faggio» (fuso `Europe/Rome`); nei test P15 entra anche in Olmo (2 famiglie), così `last_manager` non si confonde con `last_family` |
| Bruno | membro | registrato con la sua «Famiglia Olmo» (gestore lì), poi entra in Faggio con un codice |
| Carla | membro | registrata con «Famiglia Tiglio», poi entra in Faggio con un codice |
| Ettore | membro | registrato direttamente con un codice di Faggio: 1 sola famiglia; crea «Famiglia Larice» nel test P14 |
| Nina | risorsa senza account | aggiunta da Irene, referente Irene |
| Otto | risorsa senza account | seconda risorsa, per «referente = risorsa» |
| Alba, Berto | gestori | test di concorrenza: ognuno con la propria famiglia di registrazione + la famiglia condivisa «Famiglia Pioppo» creata da Alba, in cui Berto entra e viene promosso |
| Dario | membro | test di concorrenza: in «Famiglia Salice» (di Alba) e «Famiglia Cedro» (di Berto), nessun'altra |

## Fuori perimetro
- Schermate dell'app: scelta e cambio famiglia, gestione membri (parte 2 di T4).
- Task e ritorno in coda (T5); `change_log`, `mutation_id` e sincronizzazione delle appartenenze
  (T5/T9: la tabella `change_log` nasce con i task). Qui solo id dal client idempotente.
- Rinominare o cancellare una famiglia; riattivare un account disattivato; aggiungere a un'altra
  famiglia una risorsa già esistente.
- Login su Android e `expo-secure-store` (T3 parte 3).
- `traguardi.json → fuori_perimetro`: template 730, calendario, Google/Apple, iPhone, Play Store,
  email di verifica e recupero, tempo reale, offline sul web, dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `server/src/test/java/com/planforhome/acceptance/Giro006FamilyAcceptanceTest.java` | P14 e codice da utente registrato: righe 1–2 del «Fatto quando» |
| `server/src/test/java/com/planforhome/acceptance/Giro006MembersAcceptanceTest.java` | P13: codici, risorse, ruoli, referente, togliere un'appartenenza |
| `server/src/test/java/com/planforhome/acceptance/Giro006LastMembershipAcceptanceTest.java` | P15, ultima appartenenza di utente e risorsa, referente in uso |
| `server/src/test/java/com/planforhome/acceptance/Giro006IsolationAcceptanceTest.java` | id altrui nell'URL e nel corpo; concorrenza |

Le classi estendono `Giro006AcceptanceSupport` (stesso file di cartella), che estende
`Giro003AcceptanceSupport` senza configurazione in più: stesso contesto, stessi dati demo.
Contratto per il costruttore: risposte di errore `{"error": codice}` come oggi; `POST
/api/families/join` legge l'IP come la registrazione (`X-Forwarded-For` fidato da loopback).

## Porte
- Doppio senso previste: forma degli endpoint e codici d'errore (`already_member`, `last_family`,
  `last_manager`, `referent_invalid`, `referent_in_use`, `role_invalid`, `not_a_resource`,
  `time_zone_invalid`, `id_conflict`); 409 per i conflitti di stato e 400 per i dati sbagliati;
  `referent_in_use` invece di spostare da soli il referente; «lasciare» = `DELETE` su sé stessi;
  eventuale migrazione `V2` solo additiva (indice).
- Senso unico: nessuna. Nessuna dipendenza nuova; la cancellazione di una risorsa è prevista da
  SPEC §2.2.1; nessun dato reale.

## Rischi di concorrenza
Regola: ogni scrittura su appartenenze, ruoli, referenti e risorse di una famiglia prende prima
`select … from family where id = ? for update`; chi tocca le appartenenze di un utente in più
famiglie prende anche `select … from person where id = ? for update`. Ogni conteggio (gestori,
appartenenze) è una **query nuova eseguita dopo** il lock, mai un valore letto prima.
- **Due gestori lasciano insieme** (o si tolgono il ruolo a vicenda): entrambi vedono «c'è un altro
  gestore». Prova: Alba e Berto, ultimi due gestori di «Famiglia Pioppo», **ciascuno con una
  seconda famiglia**, lasciano in parallelo, 10 ripetizioni → sempre una 204 e una 409
  `last_manager`; resta esattamente un gestore. Rimedio: lock su `family`.
- **Un utente tolto in parallelo dalle sue ultime due famiglie**: Alba e Berto tolgono Dario
  insieme da Salice e Cedro, 10 ripetizioni → due 204 e il login di Dario rifiutato (account
  disattivato). Rimedio: lock su `person` prima di contare.
- **Un utente entra mentre gli tolgono l'ultima famiglia**: Ettore usa un codice di Olmo mentre
  Irene lo toglie da Faggio, 10 ripetizioni → mai «disattivato con famiglie», mai «attivo senza
  famiglie» (login riuscito ⇔ almeno un'appartenenza visibile ai gestori). Rimedio: `join` blocca
  `person` e ricontrolla `disabled_at`.
- **Risorsa con referente tolto in parallelo**: Irene aggiunge una risorsa con referente Bruno
  mentre Carla (gestore) toglie Bruno, 10 ripetizioni → mai 5xx: o (201, 409 `referent_in_use`) o
  (400 `referent_invalid`, 204). Rimedio: lock su `family` anche in `resources` e `referent`.
- **Stesso codice usato in parallelo da due utenti registrati**: `consumeInvite` è già un solo
  `update … returning`; coperto dal test di unità esistente `InviteConcurrencyTest`.
- **Doppio invio di `POST /api/families` con lo stesso `id`**: insert, cattura del duplicato,
  rilettura; prova in «Fatto quando» (una 201 e una 200).

## Budget
Righe di produzione (`server/src/main`) ≤ 450; file ≤ 10; nessuna riga in `app/`. Una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`: API senza schermate).

## Critica ricevuta e cosa cambia
| Punto | Esito | Cosa cambia |
|---|---|---|
| 1. precedenza `last_family`/`last_manager` | accolto | ordine fisso (`last_manager`, `referent_in_use`, `last_family`) **e** seconda famiglia ai gestori che lasciano nei test P15 e di concorrenza; test di precedenza a parte |
| 2. doppio invio `POST /api/families` | accolto | insert + cattura del duplicato + rilettura; test con 2 invii paralleli |
| 3. `id?` delle risorse | accolto | stessa regola (200 se già risorsa della famiglia, altrimenti 409 neutro); test con la persona di Marco |
| 4. `already_member` e consumo | accolto | appartenenza controllata prima del consumo, nella stessa transazione che si annulla; lo slot del limite torna; test del 429 su `join` e dello slot restituito |
| 5. lock su `family` in `referent` e `resources` | accolto | scritto nella tabella e nella regola dei lock; test di concorrenza risorsa/referente |
| Più semplice: disattivazione | accolto | solo `update user_account`; nessun lavoro sulle sessioni |
| Più semplice: `id_conflict` solo su `family.id` | accolto | per `POST /api/families` |
| Concorrenza: conteggio dopo il lock; join contro rimozione | accolto | regola scritta; test in parallelo 10 volte. Come test di accettazione HTTP, non riusando `InviteConcurrencyTest` (che chiama i servizi): il join si prova da fuori |
| Test mancanti (6) | accolti tutti | `not_a_resource`, `time_zone_invalid`, `id_conflict`, codice scaduto/usato senza effetti, cookie web di Ettore, ordine 404/403/400 |
| Facoltativi | accolti tutti e tre | `ZoneId.getAvailableZoneIds()`, validazione riusata, gestore che toglie il ruolo all'altro → 200 |
| (mio) Luca in P14 | corretto | creare una famiglia per Luca romperebbe `Giro003IsolationAcceptanceTest` (Luca con 1 sola famiglia): P14 lo prova Ettore |
| (mio) limite registrazioni | aggiunto | ogni registrazione dei test da un IP proprio |

Scartato: nulla.

## Idee per dopo
- Rinomina della famiglia e cambio del fuso dal gestore.
- Riattivazione di un account disattivato con un nuovo codice d'invito.
