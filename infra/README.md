# infra — contratto del deploy

Questa cartella oggi contiene solo il contratto. Gli script li crea la catena al **giro 000** e da lì
in poi crescono con i traguardi (SPEC §10, `progetto.yml` → `consegna`). Tutto ciò che sta in
`infra/` è un percorso protetto: le PR che lo toccano vanno sempre in revisione umana.

## Cosa fa `consegna` dopo ogni merge su `main`

1. **Job `immagine`**, senza segreti (è uno dei due job che eseguono il codice del giro):
   - `server`: `./mvnw -B -ntp package -DskipTests` in `server/`, poi
     `docker build -f server/Dockerfile --build-arg GIT_SHA=<sha> server` →
     `ghcr.io/<owner>/<repo>/server:<sha>`;
   - `web`: `npm ci && npx expo export --platform web` in `app/`, poi
     `docker build -f infra/web.Dockerfile app/dist` → `ghcr.io/<owner>/<repo>/web:<sha>`.

   Push su GHCR; all'uscita ci sono i due riferimenti per digest (`…@sha256:…`).
2. **Job `deploy`**, environment `produzione` (i segreti esistono solo per `main`): esegue gli script
   qui sotto, presi dal commit appena mergiato. Se manca `infra/deploy.sh` o manca un segreto
   obbligatorio, il deploy si salta con un avviso.
3. **Job `apk` e `apk-firma`**: non toccano questa cartella.

## File che il giro 000 crea

| File | Deve |
|---|---|
| `infra/deploy.sh <immagine-server> <immagine-web>` | Gira sul runner. Valida gli argomenti (solo `ghcr.io/…@sha256:<64 hex>`, altrimenti uscita 2), copia sul server `remote.sh`, `lib.sh`, `docker-compose.yml`, `Caddyfile` e `env.example`, poi esegue `remote.sh` via ssh. **Non costruisce niente.** Idempotente. Uscita ≠ 0 se qualcosa va storto. |
| `infra/remote.sh` | Gira sul server. Prende il lucchetto (`flock` su un file fisso, attesa massima limitata: due deploy non si sovrappongono mai), legge i segreti da stdin, scrive il `.env` (permessi 600), salva i digest in esecuzione come `precedente`, fa `docker login` + `pull` + `docker compose up -d` e **verifica il digest**: i container `server` e `caddy` devono girare esattamente le immagini passate, altrimenti uscita ≠ 0. |
| `infra/rollback.sh` | Gira sul runner (via ssh, stesso lucchetto). Rimette in esecuzione i digest salvati in `precedente` e verifica il digest come sopra. Lo chiama `consegna` se deploy o smoke falliscono. |
| `infra/smoke.sh` | Gira sul runner. Prova dall'esterno `https://$LAB_BASE_DOMAIN`. Uscita ≠ 0 al primo controllo fallito. I controlli **crescono con i traguardi**: quando un traguardo passa, il giro aggiunge i suoi (vedi sotto). |
| `infra/lib.sh` | Funzioni comuni: opzioni ssh con `DEPLOY_KNOWN_HOSTS` fissato (`StrictHostKeyChecking=yes`, niente fiducia al primo contatto), validazioni, log senza segreti. |
| `infra/docker-compose.yml` | Tre servizi: `caddy` (l'immagine `web`: Caddy con il bundle in `/srv`, porte 80 e 443, volume per i certificati), `server` (Spring Boot, non esposto fuori dalla rete di Compose), `postgres` (volume per i dati, non esposto). Immagini per digest, prese dal `.env`. Healthcheck su `server` e `postgres`. |
| `infra/Caddyfile` | Sito `{$LAB_BASE_DOMAIN}` con TLS automatico. `/api/*` → `server:8080`; tutto il resto → file statici di `/srv` con ripiego su `index.html` (le rotte di expo-router). Header HSTS. Gli endpoint di gestione (per esempio `/actuator`) non si raggiungono da fuori. |
| `infra/web.Dockerfile` | `FROM caddy` fissato per digest, `COPY . /srv`. Contesto: `app/dist`. |
| `infra/env.example` | I nomi delle variabili del `.env` sul server, senza valori. |

## Variabili e segreti

`consegna` li passa a `deploy.sh` come variabili d'ambiente. Mai stamparli, mai metterli nella riga
di comando di ssh.

| Variabile | Tipo | Contenuto |
|---|---|---|
| `DEPLOY_HOST`, `DEPLOY_USER` | segreti, obbligatori | IPv4 del server e utente di deploy |
| `DEPLOY_SSH_KEY` | segreto, obbligatorio | chiave privata dedicata alla CI |
| `DEPLOY_KNOWN_HOSTS` | segreto, obbligatorio | host key del server, fissata |
| `DEMO_PASSWORD` | segreto, obbligatorio | password degli account demo in produzione (SPEC §9) |
| `FCM_SERVICE_ACCOUNT_JSON` | segreto, facoltativo fino a T10 | account di servizio di Firebase; vuoto = notifiche push spente |
| `LAB_BASE_DOMAIN` | variabile | `app.planforhome.com`, impostata nel setup |
| `IMAGE_SERVER`, `IMAGE_WEB` | dal job `immagine` | gli stessi riferimenti passati come argomenti |
| `GIT_SHA` | dal job `immagine` | il commit; `smoke.sh` lo confronta con `/api/health` |
| `GHCR_USER`, `GHCR_TOKEN` | credenziali del run | sola lettura dei pacchetti, scadono a fine job: servono al server per `docker login ghcr.io` |

**I segreti viaggiano su stdin**, una riga ciascuno, in quest'ordine: `GHCR_TOKEN`, `DEMO_PASSWORD`,
`FCM_SERVICE_ACCOUNT_JSON` in base64 su una riga (riga vuota = assente). `remote.sh` li scrive solo nel
`.env` (600). La password di PostgreSQL la genera `remote.sh` al primo deploy e resta sul server.

## Smoke per traguardo

Copia di `progetto.yml` → `consegna.smoke`, che resta la fonte:

- **da T1:** `GET /api/health` → 200 con `GIT_SHA`; `GET /` → 200 con la pagina iniziale; `http` →
  `https` con redirect permanente; header HSTS presente.
- **da T3:** pagina di login in italiano e in inglese; `GET /api/families` senza login → 401.

Un controllo nuovo entra in `smoke.sh` con il giro che fa passare il suo traguardo.

## Regole

- **Gli script leggono solo file dentro `infra/`**: un file letto fuori da lì potrebbe arrivare su
  `main` con un merge automatico e girare con i segreti.
- Il job `deploy` ha solo gli strumenti standard di `ubuntu-latest`: niente Java, niente Node, niente
  build.
- Sul server: Docker e l'utente di deploy (`docs/lab/SETUP.md` §3). Le porte 80 e 443 devono essere
  libere: lo stack di gerio-lab si ferma a mano nel setup, gli script non lo toccano.
- Nessun segreto nel repository: sul server stanno nel `.env`.
- Nessun backup in R0: i dati sono rigenerabili (SPEC §10).
- Un giro non esegue mai questi script: il guard blocca `ssh` e simili.
