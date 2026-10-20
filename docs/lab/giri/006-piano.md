---
giro: 006
traguardo: T4
traguardi_extra: []
tipo: costruzione
fase: critica
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
| `POST /api/families` (P14) | `{id?, name, timeZone?}` | 201 `{id, name, timeZone, role:"MANAGER"}`; chi chiama ne diventa gestore, qualunque sia il suo ruolo altrove. `name` vuoto dopo trim o oltre 80 caratteri → 400 `family_name_invalid`. `timeZone` non IANA → 400 `time_zone_invalid` (predefinito `Europe/Rome`). `id` facoltativo, UUID dal client: ripetuto dallo stesso utente con lo stesso nome → 200 con la stessa famiglia (idempotente); `id` già usato da un'altra famiglia non sua o da un'altra entità → 409 `id_conflict`. |
| `POST /api/families/join` (codice da utente già registrato) | `{code}` | 200 `{id, name, timeZone, role:"MEMBER"}`. Codice sconosciuto, scaduto o usato → 400 `invite_invalid`, il codice non si consuma. Utente già nella famiglia del codice → 409 `already_member`, il codice **non** si consuma. Stesso limite per IP dei codici in registrazione (DECISIONI n. 12). |
| `POST /api/families/{familyId}/invites` (P13) | — | esiste già: gestore 201, membro 403. |
| `POST /api/families/{familyId}/resources` (P13) | `{id?, displayName, referentPersonId}` | 201 `{personId, displayName, role:"MEMBER", hasAccount:false, referentPersonId}`. Solo gestore (membro → 403 `forbidden`). `referentPersonId` che non è un **utente** della stessa famiglia (risorsa, utente di un'altra famiglia, inesistente) → 400 `referent_invalid`, nessuna persona creata. `displayName` come in registrazione → 400 `display_name_invalid`. |
| `PUT /api/families/{familyId}/members/{personId}/role` (P13) | `{role}` | 200 membro aggiornato. Solo gestore. `role` non `MANAGER`/`MEMBER`, o `MANAGER` a una risorsa senza account → 400 `role_invalid`. Togliere il ruolo all'unico gestore → 409 `last_manager`. |
| `PUT /api/families/{familyId}/members/{personId}/referent` (P13) | `{referentPersonId}` | 200. Solo gestore. Destinatario non risorsa senza account → 400 `not_a_resource`; referente non utente della famiglia → 400 `referent_invalid`. |
| `DELETE /api/families/{familyId}/members/{personId}` (P13 se `personId` è un altro; P15 se è chi chiama) | — | 204. **Altri:** solo gestore (membro → 403). **Sé stessi (lasciare):** gestore e membro; ultima famiglia di chi chiama → 409 `last_family`; unico gestore → 409 `last_manager`. **Ultima appartenenza di un utente tolta da un gestore:** `user_account.disabled_at` = `Clock.instant()`, le sue sessioni non valgono più, il login risponde con lo stesso errore di una password sbagliata. **Ultima appartenenza di una risorsa:** la persona è cancellata. Persona referente di una risorsa in quella famiglia → 409 `referent_in_use` (prima si nomina un altro referente). |

Isolamento: `{familyId}` altrui o inesistente → 404 `not_found` (corpo identico); `{personId}` che
non appartiene a quella famiglia → 404 `not_found`; `referentPersonId` di un'altra famiglia nel
corpo → 400 `referent_invalid` (non rivela se la persona esiste). Il «lasciare» sta su un percorso
con `{personId}` e non su `/{familyId}/leave`: il controllo positivo del test di isolamento del
giro 003 chiama con Rosa ogni endpoint che ha **solo** `{familyId}`, e con `/leave` farebbe uscire
Rosa dalla Famiglia Babbo dei dati demo condivisi.

## Fatto quando — controlli eseguibili
- [ ] `cd server && ./mvnw -q -Dtest='Giro006*AcceptanceTest' test` → tutti verdi:
  - P14: Luca (membro nella Famiglia Mamma) crea «Famiglia Faggio» → 201, ne è gestore, `GET /api/families` gliene mostra 2; vietato: senza login → 401, nome vuoto → 400 `family_name_invalid` e nessuna famiglia creata; stesso `id` ripetuto → 200 con la stessa famiglia, nessun doppione;
  - codice da utente già registrato: Irene genera un codice della Famiglia Faggio, Bruno (già registrato altrove) lo usa → 200 `MEMBER`; vietato: lo stesso codice di nuovo (da Carla) → 400 `invite_invalid`; un codice scaduto (orologio + 7 giorni + 1 minuto) → 400; Bruno con un secondo codice della stessa famiglia → 409 `already_member` e quel codice vale poi per Carla;
  - P13 codici: gestore 201, membro 403 (nuova famiglia del giro, non i dati demo);
  - P13 risorse: Irene aggiunge «Nina» con referente Irene → 201, `hasAccount:false`; vietato: Bruno (membro) → 403; referente = una risorsa → 400 `referent_invalid`; referente = un utente di un'altra famiglia (Luca) → 400 `referent_invalid`; in entrambi i casi l'elenco membri non cambia;
  - P13 ruoli: Irene nomina Bruno gestore → 200; vietato: Bruno, quando è membro, nomina sé stesso gestore → 403; Irene, unica gestore, si toglie il ruolo → 409 `last_manager`; `MANAGER` a Nina → 400 `role_invalid`;
  - P13 referente: Irene sposta il referente di Nina a Bruno → 200; vietato: membro → 403; referente risorsa → 400;
  - P13 togliere un'appartenenza: Irene toglie Carla (che sta anche in un'altra famiglia) → 204, Carla entra ancora; vietato: Bruno (membro) toglie Carla → 403;
  - P15 lasciare: un membro con 2 famiglie lascia la Famiglia Faggio → 204; un gestore lascia se resta un altro gestore → 204; vietato: l'unico gestore → 409 `last_manager`; un utente con 1 sola famiglia → 409 `last_family`, e resta membro;
  - ultima appartenenza di un utente: Irene toglie Ettore (1 sola famiglia) → 204; il suo token dà 401 su `GET /api/me`; il login con la password giusta risponde come per una password sbagliata;
  - ultima appartenenza di una risorsa: Irene toglie Nina → 204; Nina non compare più in nessun elenco e un secondo `DELETE` → 404;
  - referente in uso: Irene toglie Bruno mentre è referente di Nina → 409 `referent_in_use`;
  - isolamento: Luca su ogni endpoint nuovo della Famiglia Babbo → 404 con corpo identico a quello di una famiglia inesistente; Irene con `{personId}` di Rosa sulla Famiglia Faggio → 404; `referentPersonId` di Marco (Famiglia Principale) su Famiglia Faggio → 400 `referent_invalid`;
  - concorrenza: vedi «Rischi di concorrenza».
- [ ] `cd server && ./mvnw -q -Dtest='Giro003*AcceptanceTest,Giro004*AcceptanceTest' test` → verdi (il test di isolamento parametrico percorre anche i nuovi endpoint senza modifiche).
- [ ] `cd server && ./mvnw -B -ntp verify` → verde (Spotless compreso).
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Dati demo del giro (inventati)
I test **non modificano** le famiglie dell'Appendice A: il contesto Spring e il database sono
condivisi tra tutte le classi di accettazione. I dati demo servono solo in lettura (Luca, Rosa,
Marco, Famiglia Babbo per l'isolamento). Ogni test registra le sue persone con email uniche
`g006-<nome>-<uuid>@example.com`, password `Lanterna-Blu-42`, locale `it`:

| Persona | Ruolo | Note |
|---|---|---|
| Irene | gestore | registra «Famiglia Faggio» (fuso `Europe/Rome`) |
| Bruno | membro | registrato con la sua «Famiglia Olmo», poi entra in Faggio con un codice |
| Carla | membro | registrata con «Famiglia Tiglio», poi entra in Faggio con un codice |
| Ettore | membro | registrato direttamente con un codice di Faggio: 1 sola famiglia |
| Nina | risorsa senza account | aggiunta da Irene, referente Irene |

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

Le classi estendono `Giro003AcceptanceSupport` (stesso contesto, stessi dati demo).

## Porte
- Doppio senso previste: forma degli endpoint e codici d'errore (`already_member`, `last_family`,
  `last_manager`, `referent_invalid`, `referent_in_use`, `role_invalid`, `not_a_resource`,
  `time_zone_invalid`, `id_conflict`); 409 per i conflitti di stato e 400 per i dati sbagliati;
  `referent_in_use` invece di spostare da soli il referente; «lasciare» = `DELETE` su sé stessi;
  eventuale migrazione `V2` solo additiva (indice).
- Senso unico: nessuna. Nessuna dipendenza nuova; la cancellazione di una risorsa è prevista da
  SPEC §2.2.1; nessun dato reale.

## Rischi di concorrenza
- **Due gestori si tolgono il ruolo a vicenda** (o lasciano insieme): entrambi vedono «c'è un altro
  gestore» e la famiglia resta senza. Prova: le ultime due gestrici di una famiglia nuova
  lasciano in parallelo, 10 ripetizioni → sempre esattamente una 204 e una 409 `last_manager`.
  Rimedio atteso: blocco della riga `family` (`select … for update`) in ogni cambio di ruolo o
  appartenenza.
- **Un utente tolto in parallelo dalle sue ultime due famiglie** (o lascia una e viene tolto
  dall'altra): resterebbe senza famiglia e non disattivato. Prova: due gestori diversi lo tolgono
  in parallelo, 10 ripetizioni → dopo entrambe le risposte, o ha ancora una famiglia o il suo
  account è disattivato (login rifiutato); mai «nessuna famiglia e attivo». Rimedio atteso: blocco
  della riga `person` prima di contare le appartenenze.
- **Stesso codice usato in parallelo da due utenti registrati**: `consumeInvite` è già un solo
  `update … returning`; prova: una 200 e una 400.
- Il doppio invio di `POST /api/families` con lo stesso `id` è coperto dall'idempotenza sull'id.

## Budget
Righe di produzione (`server/src/main`) ≤ 450; file ≤ 10; nessuna riga in `app/`. Una sessione.

## Domande per il ricercatore (al massimo 3)
Nessuna (`ricerca: no`: API senza schermate).

## Critica ricevuta e cosa cambia
(dopo il critico)

## Idee per dopo
- Rinomina della famiglia e cambio del fuso dal gestore.
- Riattivazione di un account disattivato con un nuovo codice d'invito.
