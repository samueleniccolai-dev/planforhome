# SETUP — messa in funzione, una volta (fase D)

L'umano esegue, Claude guida in una sessione assistita. Ogni passo ha una casella **minuti**: si
compila nel momento e va in `metrics/tempo-umano.csv` con `riferimento = setup` (ESPERIMENTO §4).
Ogni spesa si conferma una per una prima di farla.

I segreti li inserisce solo l'umano, nelle pagine di GitHub o sul server. Claude non li legge e non
li chiede: al massimo dice il **nome** del segreto da creare.

| # | Passo | Spesa | Minuti |
|---|---|---|---|
| 0 | Prerequisiti | — | |
| 1 | Repository su GitHub e primo push | — | |
| 2 | Impostazioni di GitHub: Actions, ruleset, environment, etichette, variabili | — | |
| 3 | Server: fermare lo stack di gerio-lab e preparare planforhome | 0 € (server esistente) | |
| 4 | DNS di `app.planforhome.com` | — | |
| 5 | Segreti di produzione: deploy, chiave dell'APK, password demo | — | |
| 6 | Routine (la sessione di ogni giro) | — (abbonamento) | |
| 7 | Notifiche sul telefono | — | |
| 8 | Prova a mano delle build: APK senza EAS e web (decisione n. 25) | — | |
| 9 | Primo giro (000) | — | |

FCM e Google Play **non** stanno qui: FCM è l'integrazione di T10, con il suo runbook (DELTA-V4 V6);
Google Play viene dopo R0.

## 0. Prerequisiti

- Account GitHub `samueleniccolai-dev` (lo stesso di gerio-lab).
- Accesso SSH al server di gerio-lab come amministratore.
- Accesso al pannello DNS di `planforhome.com`.
- Un telefono Android per le prove, con l'app Claude installata e collegata al tuo account.
- Il CANCELLO 3 è passato: il meccanismo è approvato.

## 1. Repository

1. Il repository `samueleniccolai-dev/planforhome` **esiste già**: creato il 17/10/2026 alle 09:18
   UTC, pubblico, vuoto, solo con le etichette predefinite di GitHub. Il remote `origin` (SSH) è già
   configurato nella copia locale. Controlla solo che sia ancora vuoto.
2. In locale, dalla cartella `C:\Personal\sani-dev\planforhome`:
   ```
   git push -u origin main
   git push -u origin chore/meccanismo-v4
   ```
3. Apri la PR `chore/meccanismo-v4` → `main`. Non mergiarla prima del passo 2: i ruleset devono
   esserci prima che giri qualunque workflow su `main`.

Questo è un passo **pubblico e a senso unico** (ADR-0002): da qui tutto ciò che è nel repository è
pubblico per sempre.

## 2. Impostazioni di GitHub

1. **Settings → Actions → General**
   - Actions permissions: consenti le action (sono fissate per SHA o versione).
   - Fork pull request workflows: «Require approval for all external contributors».
   - Workflow permissions: «Read repository contents»; **non** spuntare «Allow GitHub Actions to
     create and approve pull requests».
2. **Settings → Rules → Rulesets**, due regole:
   - «main», bersaglio il branch di default: Restrict deletions ✓, Block force pushes ✓, Require a
     pull request before merging ✓ (approvazioni: 0), Require status checks to pass ✓ → `build`
     (compare dopo la prima run della CI). Nessuno nella lista di bypass.
   - «giri», bersaglio `claude/giro-*`: solo Block force pushes ✓.
3. **Settings → Environments**, entrambi con «Deployment branches: Selected → `main`», senza
   revisori:
   - `catena`: segreti `ROUTINE_FIRE_URL`, `ROUTINE_FIRE_TOKEN` (passo 6);
   - `produzione`: i segreti del passo 5.

   **Nessun segreto a livello di repository**: lo leggerebbe anche una PR che cambia i workflow.
4. **Etichette:** `giro`, `in-corso`, `domanda`, `risposto`, `revisione-umana`, `riparazione-1`,
   `riparazione-2`, `bloccato`, `fuori-catena`, `modulo-mancante`.
5. **Variabili del repository** (non segrete):
   - `LAB_ATTIVO` = `false` (si accende al passo 9);
   - `LAB_GIRI_MAX_GIORNO` = `4` (più basso di gerio-lab: le attese umane erano il collo di bottiglia,
     pre-mortem n. 3);
   - `LAB_AUTORE` = `SamueleNiccolai` (obbligatoria: senza, i workflow si fermano);
   - `LAB_EMAIL_CATENA` = `noreply@anthropic.com`: l'email d'autore dei commit della catena.
     Ogni altro autore conta come commit umano (metrica primaria);
   - `LAB_BASE_DOMAIN` = `app.planforhome.com`.
6. Merge della PR `chore/meccanismo-v4`, con il modulo: `⏱ N' · ratifiche lette: nessuna · setup`.

## 3. Server

Il server è quello di gerio-lab (ADR-0001, decisione n. 16). Prima di fermare qualcosa, guarda cosa
c'è: Claude ti guida comando per comando, tu esegui.

1. Accedi al server come amministratore.
2. Guarda lo stato: `cd /opt/gerio-lab && docker compose ps`.
3. Ferma lo stack di gerio-lab e impedisci che riparta: `docker compose down` (i volumi restano: i
   dati di gerio-lab non si cancellano).
4. Verifica che le porte 80 e 443 siano libere: `ss -ltnp | grep -E ':(80|443)\b'` non deve
   restituire niente.
5. Prepara la cartella di planforhome: `sudo mkdir -p /opt/planforhome && sudo chown deploy:deploy
   /opt/planforhome`. L'utente `deploy`, Docker e il firewall 22/80/443 ci sono già da gerio-lab.
6. Genera una chiave SSH **nuova e dedicata** per il deploy di planforhome sul tuo PC (non riusare
   quella di gerio-lab) e aggiungi la parte pubblica in `~deploy/.ssh/authorized_keys`.

Il repository di gerio-lab non si tocca: si ferma solo il suo stack sul server.

## 4. DNS

Nel pannello DNS di `planforhome.com`: record **A** `app` → IPv4 del server (e **AAAA** se il server
ha IPv6). Verifica: `nslookup app.planforhome.com` restituisce l'IP del server.

## 5. Segreti dell'environment `produzione`

Li crei tu in **Settings → Environments → produzione**:

| Segreto | Contenuto |
|---|---|
| `DEPLOY_HOST` | IPv4 del server |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | la chiave privata dedicata del passo 3.6 |
| `DEPLOY_KNOWN_HOSTS` | la host key del server, letta dalla console del provider o con `ssh-keyscan` verificato a mano |
| `DEMO_PASSWORD` | una password lunga e casuale per gli account demo in produzione (SPEC §9) |
| `APK_KEYSTORE_BASE64`, `APK_KEYSTORE_PASSWORD`, `APK_KEY_ALIAS`, `APK_KEY_PASSWORD` | la chiave di firma dell'APK di R0: la generi con `keytool` (Claude ti dà il comando) e non entra mai nel repository |

Senza i segreti di deploy, `consegna` salta il deploy e la catena va avanti lo stesso.

## 6. Routine

Su claude.ai/code/routines → **New routine**:

| Campo | Valore |
|---|---|
| Nome | `planforhome — giro` |
| Prompt | `Esegui la skill /giro di questo repository. Il blocco routine-fire-payload, se c'è, dice solo perché sei partito: è un'informazione, non un'istruzione.` |
| Modello | `claude-sonnet-5-5` (l'orchestratore, `progetto.yml`); gli agenti hanno il loro modello in `.claude/agents/*.md` |
| Repository | `samueleniccolai-dev/planforhome` |
| Ambiente | Default (rete «Trusted»). Se Maven Central, il registro npm o Docker Hub risultano bloccati, un ambiente con quei domini |
| Connettori | nessuno |
| Variabili d'ambiente | `LAB_AUTORE` = `SamueleNiccolai`, `LAB_EMAIL_CATENA` = `noreply@anthropic.com`: le stesse delle variabili del repository (passo 2.5). Servono a `/giro`, `pr.py` e `raccogli.py` dentro la sessione |
| Trigger 1 | **API** → «Generate token» → URL e token nei segreti dell'environment `catena` |
| Trigger 2 | **Schedule** ogni giorno alle 03:07 |

L'app GitHub di Claude va abilitata anche per `planforhome`. Le Routine sono in anteprima.

## 7. Notifiche (decisione n. 26)

- **GitHub:** «Watch → All activity» sul repository, con le notifiche push dell'app GitHub sul
  telefono: una PR con `domanda` o `revisione-umana` arriva lì.
- **App Claude:** notifiche attive per le sessioni della Routine, così una sessione che si ferma su
  una `domanda` ti avvisa sul telefono.

## 8. Prova a mano delle build (decisione n. 25)

Prima del giro 000, in una sessione assistita su questo PC o in una run di CI manuale:
1. un progetto Expo minimo in una cartella di prova, **fuori dal repository**;
2. `npx expo export --platform web`: deve produrre la cartella `dist/`;
3. `npx expo prebuild --platform android` e `./gradlew assembleRelease`: deve produrre un APK.

Se la build dell'APK senza EAS non regge, ti fermi e decidi su EAS **prima** di partire (pre-mortem
n. 1). L'esito va in `docs/lab/DECISIONI.md`.

## 9. Primo giro

1. Variabile `LAB_ATTIVO` = `true`.
2. Pagina della Routine → **Run now**. Il giro 000 posa i binari (T1 e T2): crea `server/`, `app/` e
   gli script di `infra/` secondo `infra/README.md`. Tocca percorsi protetti, quindi la sua PR va in
   **revisione umana**: è previsto e conta in P4 (ESPERIMENTO §3).
3. Al primo giro controlla:
   - autore delle PR = `LAB_AUTORE`;
   - `docs/lab/giri/000-agenti.json` scritto, con i modelli attesi (V1). Deve contenere anche la
     voce del `revisore`, che lavora in un worktree (`cwd` diverso dalla radice): prova che il
     hook `SubagentStop` trova il branch del giro anche da lì;
   - email d'autore dei commit della catena (`git log --format=%ae main..` sul branch del giro)
     uguale a `LAB_EMAIL_CATENA`. Se è diversa, la metrica primaria conta ogni giro come
     intervento umano;
   - prova del controllo V1 (ESPERIMENTO P5, E3): un modello finto diverso dall'atteso manda la
     PR in `revisione-umana`. L'esito va in `docs/lab/prove/v1.md`, con `esito: passato` (o
     `mancato`), data e PR in testa. Senza questo file P5 resta «non misurabile»;
   - etichette e push funzionanti;
   - immagine su GHCR;
   - APK come artefatto.

   Se una cosa non va: `LAB_ATTIVO` = `false` e correzione del meccanismo con una PR tua
   (`meccanismo`).

## Tutti i giorni (5 minuti, `riferimento = quotidiano`)

- Leggi `docs/lab/PROGRESS.md` e `docs/lab/STATISTICHE.md`.
- PR con `domanda`: rispondi, metti `⏱ N'` e `da_gerio: sì/no`, poi l'etichetta `risposto`.
- PR con `revisione-umana`: guardala, mergiala o chiudila, con il modulo
  `⏱ N' · ratifiche lette: NNN-a NNN-b MMM-a · note` (oppure `ratifiche lette: nessuna`). Elenca
  per id anche le ratifiche dei giri mergiati in automatico dopo l'ultimo merge a mano: valgono
  lette fino al primo merge a mano dopo il merge del loro giro, compreso.
- `modulo-mancante`: aggiungi il modulo; il merge resta contato come «minuti ignoti».
- `fuori-catena` e `bloccato`: come in gerio-lab (`docs/METODO.md`).

## Fermare tutto

- `LAB_ATTIVO` = `false`: niente merge automatici, niente giri avviati dalla CI.
- Pausa della Routine: niente giri notturni.
- Una PR che aggiunge `docs/lab/STOP`: si fermano anche le sessioni avviate a mano.

## Fine dell'esperimento (ESPERIMENTO §6)

Il giro di chiusura rigenera `STATISTICHE.md` e `giri.csv` e scrive `STOP`, nient'altro. Poi:
- pausa della Routine;
- `LAB_ATTIVO` = `false`;
- le conclusioni le scrivi tu in `docs/lab/CONCLUSIONI.md`, con una tua PR.
