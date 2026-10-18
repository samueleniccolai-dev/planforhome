# scripts/ci — punti di estensione della CI

`.github/workflows/ci.yml` è protetto: un giro non lo modifica. Lo estende così (anche questa
cartella è protetta: una PR che la tocca va in revisione umana, perché questi script girano prima
dei test e potrebbero saltarli):

| File | Quando lo esegue la CI | Esempio |
|---|---|---|
| `scripts/ci/prepare.sh` | prima di `./mvnw verify` in `server/`, se è eseguibile | installare uno strumento per i test |
| `scripts/ci/check.sh` | dopo `./mvnw verify` in `server/`, se è eseguibile | controllare che un file generato e committato sia aggiornato |
| `app/e2e-screenshots/` | caricata come artefatto `e2e-screenshots` | screenshot dei test Playwright sul web, la verifica visiva per l'umano |

I controlli dell'app (`npm ci`, Jest, `tsc`, ESLint, `expo export`, Playwright) e la build
dell'APK sono passi fissi di `ci.yml`, con i comandi di `progetto.yml`. L'immagine del server si
costruisce da `server/Dockerfile`; quella del web, in consegna, da `infra/web.Dockerfile`, creato
dal giro 000.

Gli script girano senza segreti, su `ubuntu-latest`, con Java 25, Node 24 e Docker. Una dipendenza
nuova che passi da qui (un binario, un'immagine, un pacchetto npm) resta una porta a senso unico.
