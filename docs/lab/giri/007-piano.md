---
giro: 007
traguardo: T4
traguardi_extra: []
tipo: costruzione
fase: revisione
inizio: 2026-10-20T06:44:03Z
ricerca: sì
accettazione: db7ad18
ripreso: no
---
# Piano del giro 007 — scelta e cambio famiglia sul web

## Fetta e traguardo
T4, parte 2 di 2: **il lato app** del «Fatto quando» di T4 (SPEC §2.2.1, «Dopo il login»). Luca
(1 famiglia) entra direttamente nella Famiglia Mamma; Giulia (2 famiglie) sceglie tra Famiglia
Principale e Famiglia Mamma e cambia famiglia da qualunque schermata con sessione. La parte server
(P13–P15, ultima appartenenza) è nel giro 006, mergiata (#13). Adesso perché le API ci sono e T5
(task) ha bisogno di una schermata della famiglia su cui atterrare.

Fonti: SPEC §2.1, §2.2.1, §5 (solo per i ruoli mostrati), §12 (etichette), App. A; codice in
`app/app/` (`_layout.tsx`, `login.tsx`, `me.tsx`), `app/src/api/client.ts`,
`app/e2e/acceptance/giro-004-login.spec.ts`; API `GET /api/families` →
`[{id, name, timeZone, role}]` e `GET /api/families/{id}/members` →
`[{personId, displayName, role, hasAccount, referentPersonId}]` (`FamilyRepository`).

**Resta dopo questo giro, per T4:** il ritorno dei task in coda (test in T5:
`MembershipService.onMembershipRemoved`). T4 non passa prima di quel test e di un giro
`verifica-produzione`.

## Cosa si costruisce

Solo `app/`. Nessuna modifica al server, a `infra/`, a `app/package.json`.

| Elemento | Comportamento |
|---|---|
| `app/src/family/` (logica, con test Jest) | `landing(outcome)` puro: 1 famiglia → `/family?id=<id>`; 2 o più → `/families`; lista vuota, `error` o `notFound` → `/me`; `unauthorized` → `/login` (test Jest per ognuno, compresi lista vuota e `unauthorized`). `roleLabel(member)` puro: `hasAccount === false` → `family.role.resource`, altrimenti `MANAGER` → `family.role.manager`, `MEMBER` → `family.role.member` (il server dà alle risorse `role: MEMBER` + `hasAccount: false`, `MembershipService`, `FamilyRepository.MemberView`); test Jest della mappatura. Client API: `families()` e `members(familyId)` in `app/src/api/client.ts`, con esito tipato (`ok` / `unauthorized` / `notFound` / `error`), come `login`. |
| Login (`app/app/login.tsx`) | Dopo un login riuscito chiama `GET /api/families` e va con `router.replace` alla destinazione di `landing`. Il pulsante resta occupato (`disabled`) **fino alla navigazione**, non solo fino alla risposta del login: un secondo clic non manda un secondo login. Se la chiamata fallisce (qualunque stato non 200, rete) → `/me`, come nel giro 004: così `giro-004-login.spec.ts` (che risponde 404 a ogni API non sua) resta verde senza toccarlo. |
| `/families` (`app/app/families.tsx`) | Senza sessione (401) → `/login`. Con 1 famiglia → `replace` a `/family?id=<id>`. Con 2 o più: titolo h1 «Scegli una famiglia», un **link** per famiglia con nome accessibile = nome della famiglia, nell'ordine del server. Errore → `role="alert"` «Impossibile caricare le famiglie. Riprova.» |
| `/family?id=<uuid>` (`app/app/family.tsx`) | Rende `null` finché sessione e famiglie non sono caricate: niente avviso nell'HTML statico (`dist/family.html`) né durante il caricamento. Ordine: `GET /api/families` 401 → `/login` (anche con `id` malformato o assente, senza chiamare i membri); famiglie 500 o rete → `role="alert"` «Impossibile caricare la famiglia. Riprova.»; poi il controllo dell'`id`. Titolo h1 = nome della famiglia (preso da `GET /api/families`). Sotto, h2 «Persone» e un elenco (`role="list"`, ogni persona `role="listitem"`) dei membri da `GET /api/families/{id}/members`: nome e, accanto, «Gestore», «Membro» oppure «Senza account» (risorsa). `id` assente, malformato, o di una famiglia non tra le proprie (anche se il server rispondesse) → `role="alert"` «Famiglia non trovata.», nessun nome di famiglia o persona mostrato, e nessuna chiamata ai membri di quell'`id`. Membri 404 → «Famiglia non trovata.»; membri 500 o rete → «Impossibile caricare la famiglia. Riprova.» (mai «non trovata» per un errore). |
| Selettore di famiglia | Su **ogni schermata con sessione** (`/family`, `/me`; non su `/`, `/login`, `/families`), in alto: link «Cambia famiglia» che porta a `/families`. Visibile solo se l'utente ha 2 o più famiglie; con 1 famiglia, o se `GET /api/families` fallisce, non c'è. Un solo componente **montato da ciascuna schermata** (niente layout di gruppo `(app)`); riceve l'elenco delle famiglie che la schermata ha già (prop), così `/family` non chiama `GET /api/families` due volte. Non chiama `refresh` (su `/me` resta un solo refresh, regola del giro 004). |
| Traduzioni | Chiavi nuove in `it.json` e `en.json` (il test Jest esistente fallisce se ne manca una). |

**Perché `/family?id=` e non `/families/[id]`.** Con `web.output: static` una rotta dinamica non
ha un file HTML suo: in produzione Caddy (`try_files {path} {path}.html /index.html`) servirebbe
`index.html` e servirebbe toccare `infra/` (revisione umana). `family.html` esiste come file
statico e `?id=` si legge sul client. Porta a doppio senso.

**Niente memoria dell'ultima famiglia:** a ogni login Giulia sceglie (SPEC §2.2.1: «con più famiglie
sceglie quale»). Nessun archivio locale, nessuna dipendenza.

Testi decisi qui (i test li usano):

| Chiave | it | en |
|---|---|---|
| `families.title` | Scegli una famiglia | Choose a family |
| `families.error` | Impossibile caricare le famiglie. Riprova. | Couldn't load your families. Try again. |
| `family.switch` | Cambia famiglia | Switch family |
| `family.people` | Persone | People |
| `family.notFound` | Famiglia non trovata. | Family not found. |
| `family.error` | Impossibile caricare la famiglia. Riprova. | Couldn't load this family. Try again. |
| `family.role.manager` | Gestore | Manager |
| `family.role.member` | Membro | Member |
| `family.role.resource` | Senza account | No account |

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-007-*`
  → verdi, in `it-IT` e in `en-US`, API finta nel browser come nel giro 004:
  - **HTML statico:** `dist/family.html` esiste e non contiene «Famiglia non trovata.», «Family
    not found.» né i testi di errore;
  - **Luca entra diretto:** login di Luca → URL `/family?id=<Mamma>`, h1 «Famiglia Mamma»,
    elenco con 6 persone nell'ordine del server (Anna, Davide, Giulia, Luca, Paolo, Pietro); Anna
    e Pietro «Gestore», gli altri «Membro»; **nessun** link «Cambia famiglia» (né su `/me`);
    nessuna navigazione su `/families` (`framenavigated`); screenshot `family-luca-<lingua>.png`;
  - Luca che apre `/` e poi `/families` → finisce su `/family?id=<Mamma>`; «indietro» non porta a
    `/families`;
  - **Giulia sceglie:** login di Giulia → URL `/families`, h1 «Scegli una famiglia», esattamente 2
    link di famiglia, «Famiglia Mamma» e «Famiglia Principale» in quest'ordine, nessun «Famiglia Babbo»;
    screenshot `families-giulia-<lingua>.png`; clic su «Famiglia Mamma» → `/family?id=<Mamma>`,
    h1 «Famiglia Mamma»;
  - **Giulia cambia famiglia:** su `/family?id=<Principale>` h1 «Famiglia Principale», 4 persone
    (Giulia, Leo, Marco, Sofia), Marco e Giulia «Gestore», Leo e Sofia «Senza account»; clic su «Cambia famiglia» →
    `/families` → clic su «Famiglia Mamma» → h1 «Famiglia Mamma»; lo stesso partendo da `/me`
    (il link c'è anche lì, accanto al saluto) e su `/me` resta **un solo** refresh;
  - **doppio clic su Accedi:** con `GET /api/families` lento, dopo la risposta del login il
    pulsante è disabilitato; un secondo clic non manda nulla: esattamente 1 POST di login, URL
    finale `/families`;
  - **isolamento nell'interfaccia:** Giulia apre `/family?id=<Babbo>` → alert «Famiglia non
    trovata.», nessun testo «Famiglia Babbo», «Rosa», «Franco», e nessuna richiesta a
    `/api/families/<Babbo>/members`; lo stesso con `id` malformato (`/family?id=abc`) e senza `id` (nessuna richiesta ai membri);
    membri della Mamma → 404 → «Famiglia non trovata.»;
  - **caricamento:** con `GET /api/families` lento, `/family?id=<Mamma>` non mostra alcun alert
    finché non arriva, poi la Famiglia Mamma;
  - **senza sessione:** `/families`, `/family?id=<Mamma>` e `/family?id=abc` → `/login`, nessuna
    richiesta ai membri;
  - **errori:** `GET /api/families` → 500 dopo un login riuscito → `/me` con il saluto; `/families`
    con `GET /api/families` → 500 → alert «Impossibile caricare le famiglie. Riprova.»; `/family`
    con famiglie 500 o membri 500 → alert «Impossibile caricare la famiglia. Riprova.», mai «non
    trovata».
- [ ] `cd app && npx playwright test` → verdi tutti, compresi `giro-000-*` e `giro-004-login`
  **senza modifiche** (test già su `main`).
- [ ] `cd app && npm test` → verde, compresi i test Jest nuovi di `landing` (anche lista vuota e
  `unauthorized`), di `roleLabel` (risorsa = `hasAccount: false`) e il test delle chiavi
  di traduzione.
- [ ] `cd app && npx tsc --noEmit && npx eslint .` → nessun errore.
- [ ] `git diff --stat origin/main -- server infra app/package.json app/package-lock.json app/app.json`
  → vuoto.
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Dati demo del giro (inventati, dall'Appendice A)
Solo nell'API finta del browser; nessun account reale. Password `Lanterna-Blu-42` per tutti.

| Cosa | id | Note |
|---|---|---|
| Famiglia Principale | `0192a3b4-0000-7000-8000-0000000000f1` | `Europe/Rome`; Marco e Giulia gestori; Leo (referente Giulia) e Sofia (referente Marco) risorse: `role: MEMBER`, `hasAccount: false`, `referentPersonId` |
| Famiglia Mamma | `0192a3b4-0000-7000-8000-0000000000f2` | `Europe/Rome`; Anna e Pietro gestori; Giulia, Luca, Paolo, Davide membri |
| Famiglia Babbo | `0192a3b4-0000-7000-8000-0000000000f3` | Rosa e Franco gestori, Marco membro; Giulia e Luca non ne vedono nulla (l'API finta risponde 404 `not_found` ai suoi membri) |
| Giulia | persona `0192a3b4-0000-7000-8000-000000000004` | `giulia@example.com`; `GET /api/families` → Mamma (`MEMBER`), Principale (`MANAGER`), in quest'ordine (il server ordina per nome) |
| Luca | persona `0192a3b4-0000-7000-8000-000000000005` | `luca@example.com`; `GET /api/families` → solo Mamma (`MEMBER`) |

Gli altri `personId` li sceglie il test (`…-0000000000a1` e seguenti). L'API finta ordina come il
server: famiglie per `name`, membri per `display_name`, poi `id`.

## Fuori perimetro
- Schermate di gestione: codici d'invito, risorse, ruoli, referente, togliere o lasciare, creare
  una famiglia, usare un codice da utente registrato (le API ci sono; le schermate dopo, o in un
  traguardo che le chieda).
- Task e coda (T5). Fuso della famiglia nelle date (T5).
- Ricordare l'ultima famiglia scelta; famiglia predefinita.
- Login su Android, `expo-secure-store`, refresh nel layout radice (T3 parte 3, DECISIONI n. 22).
- Link al profilo o «Esci» nella schermata della famiglia (vedi «Idee per dopo»).
- Server, `infra/`, Caddy, dipendenze.
- `traguardi.json → fuori_perimetro`: template 730, calendario, Google/Apple, iPhone, Play Store,
  email di verifica e recupero, tempo reale, offline sul web, dati reali.

## Test di accettazione (scritti prima, intoccabili dal costruttore)
| File | Dato … quando … allora … |
|---|---|
| `app/e2e/acceptance/giro-007-families.spec.ts` | tutte le righe del primo controllo del «Fatto quando», in `it-IT` e `en-US` (35 test), con API finta (`page.route('**/api/**')`) che tiene la sessione, ordina come il server e risponde a login, me, refresh, logout, families e members, con manopole per 500, 404 e risposte lente; elementi per ruolo ed etichetta. Commit `db7ad18`: 31 rossi per asserzione; 4 già verdi e restano come guardia (famiglie 500 dopo il login → `/me`; nessun «Cambia famiglia» su `/me` per Luca). |

Nessun test del server: il server non cambia (il giro 006 copre P13–P15).

## Porte
- Doppio senso previste: rotte `/families` e `/family?id=` (invece di una rotta dinamica);
  selettore come link a `/families` invece di un menu a tendina; ripiego su `/me` se le famiglie
  non si caricano; nessuna memoria dell'ultima famiglia; testi della tabella sopra; selettore come
  componente per schermata; `/family?id=abc` senza sessione → `/login`.
- Senso unico: nessuna. Nessuna dipendenza nuova (expo-router c'è già), nessuna modifica a
  `infra/`, nessun dato reale.

## Rischi di concorrenza
Poco stato condiviso: solo letture. Rischi lato client:
- **Risposte fuori ordine:** se la stessa istanza di `/family` cambia `id`, una risposta vecchia
  non deve sovrascrivere la nuova. Rimedio: flag `alive` nell'effetto legato a `id`, come in
  `me.tsx`. Nessun test di accettazione: col flusso attuale (link → `/families` → link) ogni
  famiglia monta una schermata nuova e il test non proverebbe nulla.
- **Doppio reindirizzamento** (login che porta a `/families` e `/families` che porta a
  `/family`): sempre `replace`, mai `push`; prove: dopo il login di Luca nessuna navigazione su
  `/families`; da `/` → `/families` → `/family`, «indietro» non torna a `/families`.
- **Doppio invio del login:** pulsante occupato fino alla navigazione; prova: doppio clic con
  famiglie lente → 1 solo POST.
- **Sessione non rinnovata su `/family`:** il refresh resta solo su `/me` (DECISIONI n. 22, il
  refresh nel layout è T3 parte 3). Chi resta solo su `/family` può vedere scadere la sessione e
  finire su `/login`: rischio accettato per questo giro.

## Budget
Righe di produzione (`app/src`, `app/app`) ≤ 350, esclusi i file JSON delle traduzioni; file
toccati ≤ 10. Server 0 righe. Deve stare in una sessione.

## Domande per il ricercatore (al massimo 3)
1. expo-router (SDK 58) con `web.output: "static"`: `useLocalSearchParams` su `/family?id=` dopo
   l'idratazione, `router.replace` dentro `useEffect`, e un layout di gruppo `(app)/_layout.tsx`
   che non cambia gli URL: cosa dice la documentazione ufficiale e quali trappole note.
2. React Native Web (react-native 0.88): `role="list"`, `role="listitem"`, `role="link"` e
   `aria-current` diventano ruoli ARIA veri, trovabili da `getByRole` di Playwright?
3. Selettore di famiglia/spazio di lavoro in app con più gruppi (linee guida di accessibilità o
   piattaforma): dove metterlo e come segnare il gruppo corrente.

## Idee per dopo
- Link «Profilo» ed «Esci» nell'intestazione delle schermate con sessione.
- Schermata di gestione dei membri per i gestori (codici, risorse, ruoli, referente).
- Ricordare l'ultima famiglia scelta (su Android con l'archivio locale di T9).

## Critica ricevuta e cosa cambia
Accolti tutti e 4 i «DA CORREGGERE»:
1. **Risorse:** il server le manda come `role: MEMBER` + `hasAccount: false`; l'etichetta «Senza
   account» viene da `hasAccount === false` (`roleLabel`, con test Jest); dati demo di Leo e Sofia
   corretti.
2. **Export statico:** `/family` rende `null` finché sessione e famiglie non sono caricate; test su
   `dist/family.html` e su `/family` con famiglie lente.
3. **Stati di errore di `/family`:** 401 → `/login`; membri 404 → «non trovata»; famiglie o membri
   500 → nuova chiave `family.error`; test per ciascuno.
4. **Login:** occupato fino alla navigazione; test del doppio clic con famiglie lente.

«Più semplice» accolto: componente per schermata, che riceve le famiglie già lette; niente layout
di gruppo. «Concorrenza» accolto: tolto il test delle risposte fuori ordine (non provava nulla);
il flag `alive` resta come indicazione al costruttore. «Test» accolti tutti: ordine come il server,
«indietro» di Luca con partenza da `/families` e `framenavigated`, famiglie 500 su `/family`,
`/family?id=abc` senza sessione → `/login` senza richieste ai membri, un solo refresh su `/me` con
il selettore. Facoltativi: Jest di `landing` con lista vuota e `unauthorized` accolto; refresh in
`/family` **non** aggiunto (fuori perimetro, DECISIONI n. 22), annotato tra i rischi.
Scartato: nulla.
