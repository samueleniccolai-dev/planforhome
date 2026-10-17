#!/usr/bin/env python3
"""Rebuilds metrics/giri.csv: one row per round of the lab, from facts.

Sources: the front matter of each round's report (docs/lab/giri/NNN-rapporto.md, on main or, for
rounds whose PR is still open or was closed, on the PR's own commit), the round's agent register
(docs/lab/giri/NNN-agenti.json: models and tokens, DELTA-V4 V1 and V3), the GitHub API (PR state,
timing and size, ci runs, label history, commits, the human's comments with minutes and the merge
form, V2), plus metrics/tempo-umano.csv for time spent elsewhere.

    LAB_AUTORE=<login> python3 scripts/metrics/raccogli.py   # idempotent: rewrites the whole file

LAB_AUTORE (the human's GitHub login) is required, with no default. Without network or GitHub access it still writes the report fields; the API fields stay empty
(never zero: an unknown is not a zero) and it says so.
"""
import base64
import csv
import datetime
import glob
import json
import os
import re
import subprocess
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "metrics", "giri.csv")
HUMAN = os.environ.get("LAB_AUTORE", "").strip()  # required: checked in main(), no default
CHAIN_EMAIL = os.environ.get("LAB_EMAIL_CATENA", "noreply@anthropic.com").strip().lower()
REPORT_FIELDS = [
    "traguardo", "tipo", "esito", "inizio", "fine", "ricerca_fonti", "critico_da_correggere", "critico_accolti", "revisore_bloccanti", "revisore_dubbi",
    "dubbi_corretti", "fuori_perimetro", "mutazioni_provate", "mutazioni_prese", "verify_rossi_locali",
    "test_totali", "test_delta", "decisioni_registro", "decisioni_ratifica", "porte_senso_unico", "riparazioni",
    "difetto_di", "proposte_metodo",
]
AGENT_FIELDS = [
    "modello_orchestratore", "modello_costruttore", "modello_revisore", "token_input", "token_output",
    "token_cache_lettura", "token_cache_scrittura", "token_fonte",
]
API_FIELDS = [
    "pr_creata", "pr_mergiata", "merge_automatico", "ore_dal_t0", "commit", "righe_main_aggiunte",
    "righe_main_tolte", "righe_test_aggiunte", "file", "ci_run", "ci_rossi", "ci_minuti", "interventi_umani",
    "fuori_catena", "domande", "ore_domanda", "commit_umani", "modulo_presente", "ratifiche_lette",
]
FIELDS = (["giro", "pr"] + REPORT_FIELDS + AGENT_FIELDS + ["minuti_giro"] + API_FIELDS
          + ["ore_attesa_umana", "minuti_umani"])
# Planforhome's production code and tests (DELTA-V4, contract «Percorsi di planforhome»).
MAIN_PREFIXES = ("server/src/main/", "app/src/", "app/app/")
TEST_PREFIXES = ("server/src/test/", "app/e2e/")
# Minutes in a human comment (V2): «⏱ N», «⏱ N'», «N'», «N min», «N minuti».
TIMER = re.compile(r"⏱\s*(\d+)(?:\s*['’])?")
BARE_MINUTES = re.compile(r"(?<![\w/.,])(\d+)\s*(?:['’]|min(?:uti)?\b)")
ROBOT = "🤖"  # comments written by a round (same GitHub identity as the human): not human time
BRANCH = re.compile(r"^claude/giro-(\d{3})-")
RATIFICHE = re.compile(r"ratifiche\s+lette", re.I)
RATIFICA_ITEM = re.compile(r"\b(\d{3})\s+(\d+)\s*/\s*(\d+)")
AGENT_COLUMNS = {"orchestratore": "modello_orchestratore", "costruttore-tdd": "modello_costruttore",
                 "revisore": "modello_revisore"}


def is_test(filename):
    """Server tests, Playwright tests, and the app's Jest files (…/__tests__/…, *.test.ts[x])."""
    return filename.startswith(TEST_PREFIXES) or (
        filename.startswith("app/") and ("/__tests__/" in filename or re.search(r"\.test\.[jt]sx?$", filename) is not None)
    )


def is_main(filename):
    """Production code: the limite_righe folders of progetto.yml, without the app's Jest files."""
    return filename.startswith(MAIN_PREFIXES) and not is_test(filename)


def comment_minutes(body):
    """Minutes declared in one human comment. When «⏱» is there, only «⏱» values count, so that a
    note like «⏱ 12' · … 3 min di attesa» is not counted twice; otherwise the bare forms count."""
    body = body or ""
    timed = TIMER.findall(body)
    values = timed if timed else BARE_MINUTES.findall(body)
    return sum(int(v) for v in values)


def has_form(body):
    """The merge form (V2): a time in one of the accepted forms and the words «ratifiche lette»."""
    body = body or ""
    return bool(RATIFICHE.search(body)) and bool(TIMER.search(body) or BARE_MINUTES.search(body))


def ratifiche_read(body):
    """«NNN a/b» items after «ratifiche lette», as "NNN:a/b" strings."""
    m = RATIFICHE.search(body or "")
    if not m:
        return []
    tail = body[m.end():].split("·", 1)[0]
    return [f"{g}:{a}/{b}" for g, a, b in RATIFICA_ITEM.findall(tail)]


def agent_fields(giro):
    """Models and tokens of a round from docs/lab/giri/NNN-agenti.json; token_fonte=assente without it."""
    row = {k: "" for k in AGENT_FIELDS}
    row["token_fonte"] = "assente"
    path = os.path.join(ROOT, "docs", "lab", "giri", f"{giro}-agenti.json")
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        agents = data.get("agenti") if isinstance(data, dict) else None
        if not isinstance(agents, list):
            return row
    except (OSError, ValueError):
        return row
    for agent_type, column in AGENT_COLUMNS.items():
        models = sorted({m for a in agents if isinstance(a, dict) and a.get("agent_type") == agent_type
                         for m in a.get("modelli") or [] if isinstance(m, str)})
        row[column] = ";".join(models)
    total = data.get("totale_token") or {}
    for key in ("input", "output", "cache_lettura", "cache_scrittura"):
        value = total.get(key)
        row[f"token_{key}"] = value if isinstance(value, int) else ""
    fonte = data.get("token_fonte")
    row["token_fonte"] = fonte if fonte in ("transcript", "parziale", "stima", "assente") else "assente"
    return row


def read_text(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def front_matter(text):
    m = re.match(r"^---\n(.*?)\n---\n", text or "", re.S)
    data = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                value = re.split(r"\s+#", value.strip(), maxsplit=1)[0].strip()
                data[key.strip()] = "" if value.startswith("# ") else value
    return data


def repo_slug():
    if os.environ.get("GITHUB_REPOSITORY"):
        return os.environ["GITHUB_REPOSITORY"]
    url = subprocess.run(["git", "-C", ROOT, "remote", "get-url", "origin"], capture_output=True, text=True).stdout
    m = re.search(r"github\.com[:/]([^/]+/[^/.\s]+)", url)
    return m.group(1) if m else None


def pages(text):
    """The JSON values printed by `gh api --paginate`, one per page, merged into one value."""
    decoder, values, i = json.JSONDecoder(), [], 0
    text = text.strip()
    while i < len(text):
        value, i = decoder.raw_decode(text, i)
        values.append(value)
        while i < len(text) and text[i].isspace():
            i += 1
    if not values:
        return None
    if all(isinstance(v, list) for v in values):
        return [item for v in values for item in v]
    merged = dict(values[0])
    for v in values[1:]:
        for key, item in v.items():
            if isinstance(item, list) and isinstance(merged.get(key), list):
                merged[key] = merged[key] + item
    return merged


class ApiError(Exception):
    pass


class Api:
    def __init__(self, repo):
        self.repo = repo
        self.ok = repo is not None
        self.warned = False

    def get(self, path):
        """The value at repos/<repo>/<path>, all pages. Raises ApiError when it cannot be read."""
        if not self.ok:
            raise ApiError("repository sconosciuto")
        res = subprocess.run(["gh", "api", "--paginate", f"repos/{self.repo}/{path}"], capture_output=True, text=True)
        if res.returncode != 0:
            if not self.warned:
                print(f"attenzione: GitHub API non disponibile ({res.stderr.strip()[:120]}): campi API vuoti", file=sys.stderr)
                self.warned = True
            if "HTTP 404" not in res.stderr:
                self.ok = False
            raise ApiError(res.stderr.strip()[:120])
        return pages(res.stdout)


def parse_time(value):
    try:
        return datetime.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)
    except (TypeError, ValueError):
        return None


def hours(a, b):
    return round((b - a).total_seconds() / 3600, 1) if a and b else ""


def human_minutes_from_csv():
    path = os.path.join(ROOT, "metrics", "tempo-umano.csv")
    out = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                ref = (row.get("riferimento") or "").strip()
                try:
                    out[ref] = out.get(ref, 0) + int(row.get("minuti") or 0)
                except ValueError:
                    pass
    return out


def round_prs(api):
    """{giro: PR} for the lab's round PRs in any state (open, merged, closed). Empty without API."""
    try:
        prs = api.get("pulls?state=all&per_page=100") or []
    except ApiError:
        return {}
    out = {}
    for pr in prs:
        m = BRANCH.match((pr.get("head") or {}).get("ref") or "")
        labels = {label.get("name") for label in pr.get("labels") or []}
        if m and "giro" in labels and (pr.get("user") or {}).get("login") == HUMAN:
            out.setdefault(m.group(1), []).append(pr)
    # A double lock leaves two PRs for one round: the merged one, else the open one, else the latest.
    rank = lambda pr: (bool(pr.get("merged_at")), pr.get("state") == "open", pr["number"])  # noqa: E731
    return {giro: max(candidates, key=rank) for giro, candidates in out.items()}


def report_from_pr(api, giro, pr):
    """The front matter of a round's report as it is on its PR (rounds not merged into main)."""
    try:
        content = api.get(f"contents/docs/lab/giri/{giro}-rapporto.md?ref={pr['head']['sha']}")
    except ApiError:
        return {}
    if not isinstance(content, dict) or "content" not in content:
        return {}
    return front_matter(base64.b64decode(content["content"]).decode("utf-8", "replace"))


def api_fields(api, pr, t0):
    """The API columns of one round, or None when any call fails (they stay empty, not zero)."""
    try:
        detail = api.get(f"pulls/{pr['number']}")
        files = api.get(f"pulls/{pr['number']}/files?per_page=100") or []
        comments = api.get(f"issues/{pr['number']}/comments?per_page=100") or []
        runs = (api.get(f"actions/runs?branch={pr['head']['ref']}&event=pull_request&per_page=100") or {}).get(
            "workflow_runs", []
        )
        ci_ms = 0
        for run in runs:
            ci_ms += (api.get(f"actions/runs/{run['id']}/timing") or {}).get("run_duration_ms") or 0
        events = api.get(f"issues/{pr['number']}/events?per_page=100") or []
        commits = api.get(f"pulls/{pr['number']}/commits?per_page=100") or []
    except ApiError:
        return None, 0, ""
    merged_by = (detail.get("merged_by") or {}).get("login", "")
    human_comments = [
        c for c in comments
        if (c.get("user") or {}).get("login") == HUMAN and not (c.get("body") or "").lstrip().startswith(ROBOT)
    ]
    minutes = sum(comment_minutes(c.get("body")) for c in human_comments)
    labels = {label.get("name") for label in detail.get("labels") or []}
    merged_at = detail.get("merged_at")
    manual = bool(merged_at) and merged_by == HUMAN
    # A question (porta a senso unico) is the label «domanda»: count each time it was put, and how long it stayed.
    asked, open_since, question_hours = 0, None, 0.0
    for event in events:
        if (event.get("label") or {}).get("name") != "domanda":
            continue
        when = parse_time(event.get("created_at"))
        if event.get("event") == "labeled":
            asked += 1
            open_since = open_since or when
        elif event.get("event") == "unlabeled" and open_since and when:
            question_hours += (when - open_since).total_seconds() / 3600
            open_since = None
    if open_since:
        end = parse_time(merged_at) or datetime.datetime.now(datetime.timezone.utc)
        question_hours += (end - open_since).total_seconds() / 3600
    # A human commit: authored by someone other than the chain's identity (LAB_EMAIL_CATENA), or made on github.com.
    human_commits = sum(
        1 for c in commits
        if ((c.get("commit") or {}).get("author") or {}).get("email", "").strip().lower() != CHAIN_EMAIL
        or (c.get("committer") or {}).get("login") == "web-flow"
    )
    forms = [c for c in human_comments if has_form(c.get("body"))]
    fields = {
        "pr_creata": detail["created_at"],
        "pr_mergiata": merged_at or "",
        "merge_automatico": ("no" if merged_by == HUMAN else "sì") if merged_at else "",
        "ore_dal_t0": hours(t0, parse_time(merged_at)),
        "commit": detail.get("commits", ""),
        "righe_main_aggiunte": sum(f["additions"] for f in files if is_main(f["filename"])),
        "righe_main_tolte": sum(f["deletions"] for f in files if is_main(f["filename"])),
        "righe_test_aggiunte": sum(f["additions"] for f in files if is_test(f["filename"])),
        "file": detail.get("changed_files", ""),
        "ci_run": len(runs),
        "ci_rossi": sum(1 for r in runs if r.get("conclusion") in ("failure", "timed_out")),
        "ci_minuti": round(ci_ms / 60000, 1),
        "interventi_umani": len(human_comments) + (1 if merged_by == HUMAN else 0),
        "fuori_catena": "sì" if "fuori-catena" in labels else "no",
        "domande": asked,
        "ore_domanda": round(question_hours, 1),
        "commit_umani": human_commits,
        # Only a manual merge needs the form; «modulo-mancante» (job controllo) wins over the comments.
        "modulo_presente": ("no" if "modulo-mancante" in labels or not forms else "sì") if manual else "",
        "ratifiche_lette": ";".join(item for c in human_comments for item in ratifiche_read(c.get("body"))),
    }
    state = "mergiata" if merged_at else ("chiusa" if detail.get("state") == "closed" else "aperta")
    return fields, minutes, state


def plan_type(giro):
    """The round type from the plan's front matter, when the report does not say it."""
    path = os.path.join(ROOT, "docs", "lab", "giri", f"{giro}-piano.md")
    try:
        return front_matter(read_text(path)).get("tipo", "")
    except OSError:
        return ""


def main():
    if not HUMAN:
        print("raccogli.py: LAB_AUTORE non impostata: esporta il login GitHub dell'umano (nessun valore predefinito)",
              file=sys.stderr)
        return 2
    api = Api(repo_slug())
    manual = human_minutes_from_csv()
    reports = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "docs", "lab", "giri", "[0-9][0-9][0-9]-rapporto.md"))):
        reports[os.path.basename(path)[:3]] = front_matter(read_text(path))
    prs = round_prs(api)
    for giro, pr in prs.items():
        if giro not in reports:
            fm = report_from_pr(api, giro, pr)
            reports[giro] = fm or {"pr": str(pr["number"]), "esito": "senza-rapporto"}
    starts = [parse_time(fm.get("inizio")) for fm in reports.values()]
    t0 = min((s for s in starts if s), default=None)  # the lab's T0: the first round's start

    rows = []
    for giro in sorted(reports):
        fm = reports[giro]
        row = {k: fm.get(k, "") for k in REPORT_FIELDS}
        row["giro"] = giro
        row["tipo"] = row["tipo"] or plan_type(giro)
        row.update(agent_fields(giro))
        row["pr"] =(fm.get("pr", "") or "").lstrip("#") or (str(prs[giro]["number"]) if giro in prs else "")
        start, end = parse_time(fm.get("inizio")), parse_time(fm.get("fine"))
        row["minuti_giro"] = round((end - start).total_seconds() / 60) if start and end else ""
        minutes = manual.get(f"giro {giro}", 0)
        pr = prs.get(giro)
        if row["pr"].isdigit() and (pr is None or pr["number"] != int(row["pr"])):
            pr = {"number": int(row["pr"]), "head": {}}  # the report names its PR: that one counts
        known = pr is None  # without a PR there is nothing to ask GitHub
        if pr and api.ok:
            if not pr.get("head", {}).get("ref"):
                try:
                    pr = api.get(f"pulls/{pr['number']}")
                except ApiError:
                    pr = None
            result = api_fields(api, pr, t0) if pr else (None, 0, "")
            if result[0] is not None:
                fields, from_comments, state = result
                row.update(fields)
                row["esito"] = state
                minutes += from_comments
                known = True
        if row["pr"]:
            minutes += manual.get(f"PR #{row['pr']}", 0)
        if row.get("modulo_presente") == "no":
            known = False  # a manual merge without the form: its minutes are unknown (ESPERIMENTO §4)
        row["minuti_umani"] = minutes if known else ""  # unknown is not zero
        if row.get("merge_automatico") == "no":
            waited = hours(end, parse_time(row.get("pr_mergiata")))
            row["ore_attesa_umana"] = "" if waited == "" else round(waited + float(row.get("ore_domanda") or 0), 1)
        elif row.get("merge_automatico") == "sì" or row.get("esito") in ("aperta", "chiusa"):
            row["ore_attesa_umana"] = row.get("ore_domanda", "")
        rows.append(row)

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"metrics/giri.csv: {len(rows)} giri" + ("" if api.ok or not rows else " (senza dati GitHub)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
