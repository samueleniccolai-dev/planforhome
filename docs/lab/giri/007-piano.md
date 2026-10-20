---
giro: 007
traguardo: T4
traguardi_extra: []
tipo: costruzione
fase: critica
inizio: 2026-10-20T06:44:03Z
ricerca: sì
accettazione:
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
| `app/src/family/` (logica, con test Jest) | `landing(families)` puro: 1 famiglia → `/family?id=<id>`; 2 o più → `/families`; lista vuota o errore → `/me`. Client API: `families()` e `members(familyId)` in `app/src/api/client.ts`, con esito tipato (`ok` / `unauthorized` / `notFound` / `error`), come `login`. |
| Login (`app/app/login.tsx`) | Dopo un login riuscito chiama `GET /api/families` e va con `router.replace` alla destinazione di `landing`. Se la chiamata fallisce (qualunque stato non 200, rete) → `/me`, come nel giro 004: così `giro-004-login.spec.ts` (che risponde 404 a ogni API non sua) resta verde senza toccarlo. |
| `/families` (`app/app/families.tsx`) | Senza sessione (401) → `/login`. Con 1 famiglia → `replace` a `/family?id=<id>`. Con 2 o più: titolo h1 «Scegli una famiglia», un **link** per famiglia con nome accessibile = nome della famiglia, nell'ordine del server. Errore → `role="alert"` «Impossibile caricare le famiglie. Riprova.» |
| `/family?id=<uuid>` (`app/app/family.tsx`) | Senza sessione → `/login`. Titolo h1 = nome della famiglia (preso da `GET /api/families`). Sotto, h2 «Persone» e un elenco (`role="list"`, ogni persona `role="listitem"`) dei membri da `GET /api/families/{id}/members`: nome e, accanto, «Gestore», «Membro» oppure «Senza account» (risorsa). `id` assente, malformato, o di una famiglia non tra le proprie (anche se il server rispondesse) → `role="alert"` «Famiglia non trovata.», nessun nome di famiglia o persona mostrato, e nessuna chiamata ai membri di quell'`id`. |
| Selettore di famiglia | Su **ogni schermata con sessione** (`/family`, `/me`; non su `/`, `/login`, `/families`), in alto: link «Cambia famiglia» che porta a `/families`. Visibile solo se l'utente ha 2 o più famiglie; con 1 famiglia, o se `GET /api/families` fallisce, non c'è. Un solo componente, montato da un layout comune o da ciascuna schermata (scelta del costruttore, porta a doppio senso). |
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
| `family.role.manager` | Gestore | Manager |
| `family.role.member` | Membro | Member |
| `family.role.resource` | Senza account | No account |

## Fatto quando — controlli eseguibili
- [ ] `cd app && npx expo export --platform web && npx playwright test e2e/acceptance/giro-007-*`
  → verdi, in `it-IT` e in `en-US`, API finta nel browser come nel giro 004:
  - **Luca entra diretto:** login di Luca → URL `/family?id=<Mamma>`, h1 «Famiglia Mamma»,
    elenco con 6 persone (Anna, Pietro, Giulia, Luca, Paolo, Davide); Anna e Pietro «Gestore»,
    gli altri «Membro»; **nessun** link «Cambia famiglia»; mai mostrato «Scegli una famiglia»;
    screenshot `family-luca-<lingua>.png`;
  - Luca che apre `/families` → finisce su `/family?id=<Mamma>`;
  - **Giulia sceglie:** login di Giulia → URL `/families`, h1 «Scegli una famiglia», esattamente 2
    link di famiglia, «Famiglia Principale» e «Famiglia Mamma», e nessun «Famiglia Babbo»;
    screenshot `families-giulia-<lingua>.png`; clic su «Famiglia Mamma» → `/family?id=<Mamma>`,
    h1 «Famiglia Mamma»;
  - **Giulia cambia famiglia:** su `/family?id=<Principale>` h1 «Famiglia Principale», 4 persone,
    Marco e Giulia «Gestore», Leo e Sofia «Senza account»; clic su «Cambia famiglia» →
    `/families` → clic su «Famiglia Mamma» → h1 «Famiglia Mamma»; lo stesso partendo da `/me`
    (il link c'è anche lì, accanto al saluto);
  - **isolamento nell'interfaccia:** Giulia apre `/family?id=<Babbo>` → alert «Famiglia non
    trovata.», nessun testo «Famiglia Babbo», «Rosa», «Franco», e nessuna richiesta a
    `/api/families/<Babbo>/members`; lo stesso con `id` malformato (`/family?id=abc`) e senza `id`;
  - **senza sessione:** `/families` e `/family?id=<Mamma>` → `/login`;
  - **errori:** `GET /api/families` → 500 dopo un login riuscito → `/me` con il saluto; `/families`
    con `GET /api/families` → 500 → alert «Impossibile caricare le famiglie. Riprova.».
- [ ] `cd app && npx playwright test` → verdi tutti, compresi `giro-000-*` e `giro-004-login`
  **senza modifiche** (test già su `main`).
- [ ] `cd app && npm test` → verde, compresi i test Jest nuovi di `landing` e il test delle chiavi
  di traduzione.
- [ ] `cd app && npx tsc --noEmit && npx eslint .` → nessun errore.
- [ ] `git diff --stat origin/main -- server infra app/package.json app/package-lock.json app/app.json`
  → vuoto.
- [ ] `python3 -I scripts/guard/pr_guard.py --base origin/main --head HEAD` → nessun errore.

## Dati demo del giro (inventati, dall'Appendice A)
Solo nell'API finta del browser; nessun account reale. Password `Lanterna-Blu-42` per tutti.

| Cosa | id | Note |
|---|---|---|
| Famiglia Principale | `0192a3b4-0000-7000-8000-0000000000f1` | `Europe/Rome`; Marco e Giulia gestori, Leo (referente Giulia) e Sofia (referente Marco) senza account |
| Famiglia Mamma | `0192a3b4-0000-7000-8000-0000000000f2` | `Europe/Rome`; Anna e Pietro gestori; Giulia, Luca, Paolo, Davide membri |
| Famiglia Babbo | `0192a3b4-0000-7000-8000-0000000000f3` | Rosa e Franco gestori, Marco membro; Giulia e Luca non ne vedono nulla (l'API finta risponde 404 `not_found` ai suoi membri) |
| Giulia | persona `0192a3b4-0000-7000-8000-000000000004` | `giulia@example.com`; `GET /api/families` → Principale (`MANAGER`), Mamma (`MEMBER`), in quest'ordine |
| Luca | persona `0192a3b4-0000-7000-8000-000000000005` | `luca@example.com`; `GET /api/families` → solo Mamma (`MEMBER`) |

Gli altri `personId` li sceglie il test (`…-0000000000a1` e seguenti).

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
| `app/e2e/acceptance/giro-007-families.spec.ts` | tutte le righe del primo controllo del «Fatto quando», in `it-IT` e `en-US`, con API finta (`page.route('**/api/**')`) che tiene la sessione e risponde a login, me, refresh, logout, families e members; elementi per ruolo ed etichetta |

Nessun test del server: il server non cambia (il giro 006 copre P13–P15).

## Porte
- Doppio senso previste: rotte `/families` e `/family?id=` (invece di una rotta dinamica);
  selettore come link a `/families` invece di un menu a tendina; ripiego su `/me` se le famiglie
  non si caricano; nessuna memoria dell'ultima famiglia; testi della tabella sopra; layout comune o
  componente per schermata.
- Senso unico: nessuna. Nessuna dipendenza nuova (expo-router c'è già), nessuna modifica a
  `infra/`, nessun dato reale.

## Rischi di concorrenza
Poco stato condiviso: solo letture. Rischi lato client:
- **Risposte fuori ordine:** cambiando famiglia in fretta, i membri della famiglia precedente
  arrivano dopo quelli della nuova. Rimedio: ignorare la risposta se l'`id` è cambiato (flag
  `alive` come in `me.tsx`). Prova: test Playwright «cambia famiglia» con la risposta dei membri
  della Principale ritardata (l'API finta la trattiene) → resta «Famiglia Mamma» con le sue 6
  persone.
- **Doppio reindirizzamento** (login che porta a `/families` e `/families` che porta a
  `/family`): sempre `replace`, mai `push`; prova: dopo il login di Luca, «indietro» non mostra la
  scelta.

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
(dopo il critico)
