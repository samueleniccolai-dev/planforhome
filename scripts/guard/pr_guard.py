#!/usr/bin/env python3
"""Decides whether a round's PR may be merged without a human (docs/METODO.md §4).

The consegna workflow runs the copy on main against the PR's commits, read as data only:
nothing from the PR is executed. The orchestrator runs it locally before opening the PR.

    python3 scripts/guard/pr_guard.py --base origin/main --head HEAD
    python3 scripts/guard/pr_guard.py --base <sha> --head <sha> --pr-json pr.json --out verdetto.json --markdown verdetto.md

Exit code 0 in both cases: the answer is in `auto_merge` (JSON) or on the first printed line.
"""
import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys

# Protected paths: `percorsi_protetti` of progetto.yml, groups `metodo`, `stack` and `agenti`, plus
# docs/lab/CONCLUSIONI.md, docs/ESPERIMENTO.md and the agents' registers (contract of phase C).
# The other groups have their own checks: test_accettazione → check_acceptance,
# migrazioni_esistenti → check_migrations, stato_solo → check_goals.
PROTECTED_PREFIXES = (
    ".github/",
    ".claude/",
    ".specify/",
    "scripts/",
    "docs/adr/",
    "docs/lab/prove/",  # proofs the human records (ESPERIMENTO P5): a round never writes them
    "server/.mvn/",
    "server/src/test/resources/",  # test configuration: it can change what the tests prove
    "app/__mocks__/",
    "app/plugins/",  # Expo config plugins: they run at build time
    "infra/",
)
PROTECTED_FILES = {
    "CLAUDE.md",
    "progetto.yml",
    "docs/METODO.md",
    "docs/ESPERIMENTO.md",
    "docs/SPEC.md",
    "docs/lab/SETUP.md",
    "docs/lab/CONCLUSIONI.md",
    "docs/lab/revisione-fase0.md",  # phase-0 records behind P6 (ESPERIMENTO §3)
    "docs/lab/fase0-decisioni.md",
    "server/pom.xml",
    "server/mvnw",
    "server/mvnw.cmd",
    "server/Dockerfile",
    "app/package.json",
    "app/package-lock.json",
    "app/app.json",
    "app/app.config.ts",
    "app/eas.json",
    "app/tsconfig.json",
    "app/.npmrc",
    ".dockerignore",  # kept from gerio-lab: they change what the image and the diff contain
    ".gitignore",
}
PROTECTED_GLOBS = (
    "docs/lab/giri/_modello-*.md",
    "server/src/main/resources/application*.properties",
    "server/src/main/resources/application*.yml",
    "server/src/main/resources/application*.yaml",
    "server/src/main/resources/config/application*",
    "app/jest.config.*",
    "app/playwright.config.*",
    "app/eslint.config.*",
    "app/.prettierrc*",
    "app/prettier.config.*",
    "app/babel.config.*",
    "app/metro.config.*",
)
# Instructions and configuration of coding agents, wherever they are: they steer the next session.
AGENT_FILE_NAMES = ("CLAUDE*.md", "AGENTS.md", ".mcp.json")
AGENT_DIR = ".claude"
# The agents' register: a round's PR carries its own, written by the hooks; any other is protected.
AGENTS_LOG = re.compile(r"^docs/lab/giri/(\d+)-agenti\.json$")
MIGRATIONS_DIR = "server/src/main/resources/db/migration/"
ACCEPTANCE_DIRS = ("server/src/test/java/com/planforhome/acceptance/", "app/e2e/acceptance/")
CODE_DIRS = ("server/src/main/", "app/src/", "app/app/")
# Lines that count for the size of a slice (and must be 0 in verifica-produzione and caccia): every
# added line under server/ and app/, except tests, docs and protected files (they have their own rules).
SIZE_ROOTS = ("server/", "app/")
SIZE_EXCLUDED = re.compile(
    r"^(server/src/test/|app/e2e/)|(^|/)__tests__/|\.(test|spec)\.tsx?$|(^|/)docs?/|\.md$"
)
# Binary files: their lines are not counted and no check can read them. Only these assets pass.
BINARY_ALLOWED = re.compile(r"^app/assets/.+\.(png|jpe?g|webp|ttf|otf)$", re.I)
TEST_PATHS = re.compile(r"^(server/src/test/|app/e2e/)|(^|/)__tests__/|\.(test|spec)\.[jt]sx?$")
APP_PROPERTIES = re.compile(r"^server/src/main/resources/(config/)?application(-[\w.-]+)?\.(properties|ya?ml)$")
# Files of keys: binary, so the secret patterns below never see them.
KEY_FILES = re.compile(r"\.(jks|keystore|p12|pfx)$", re.I)
# Files that change how git shows the diff (or what it contains) to the checks below.
GIT_META_FILES = {".gitattributes", ".gitmodules"}
# The empty tree: with it as the attribute source, a .gitattributes in the PR cannot mark files as
# binary (-diff) and hide their lines from the checks.
EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
# Spring Boot keys that can drop, regenerate or bypass the schema managed by Flyway. Keys are
# compared after Spring's relaxed binding (lower case, no '-' or '_'); each test gets the value.
SAFE_DDL = {"validate", "none"}
DANGEROUS_CONFIG = {
    "spring.jpa.hibernate.ddlauto": lambda v: v not in SAFE_DDL,
    "spring.jpa.properties.hibernate.hbm2ddl.auto": lambda v: v not in SAFE_DDL,
    "spring.flyway.cleandisabled": lambda v: v == "false",
    "spring.flyway.baselineonmigrate": lambda v: True,
    "spring.flyway.outoforder": lambda v: True,
    "spring.flyway.validateonmigrate": lambda v: v == "false",
    "spring.sql.init.mode": lambda v: v == "always",
}
GOALS_FILE = "docs/lab/traguardi.json"
GOAL_STATE_FIELDS = {"stato", "giri", "pr", "passato_il"}
GOAL_STATES = {"da-fare", "in-corso", "passato"}
STOP_FILE = "docs/lab/STOP"
BRANCH_PREFIX = "claude/giro-"
ROUND_BRANCH = re.compile(r"^claude/giro-(\d{3,})-")
MAX_MAIN_LINES = 1500
# PostgreSQL dollar quoting ($$ … $$, $tag$ … $tag$) and escape strings (E'…'): the statement
# splitter below does not follow them, so a ';' inside could hide a second statement.
DOLLAR_QUOTE = re.compile(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$")
ESCAPE_STRING = re.compile(r"(?<![\w'])[eE]'")
# DELTA-V4 V1: the expected model of each agent comes from progetto.yml (block modelli_attesi).
PROJECT_FILE = "progetto.yml"
BUILD_AGENTS = ("pianificatore", "critico", "costruttore-tdd", "revisore", "orchestratore")
# DELTA-V4 V4, V6: the kind of round, from the plan's frontmatter.
ROUND_KINDS = {"costruzione", "verifica-produzione", "runbook", "caccia"}
RUNBOOK_ALLOWED = ("docs/runbook/", "docs/lab/", "metrics/")
AFTER_REVIEW_ALLOWED = ("docs/lab/", "metrics/")
MIGRATION_NAME = re.compile(r"^V(\d+)__[a-z0-9_]+\.sql$")
ALLOWED_SQL = [
    re.compile(p, re.I | re.S)
    for p in (
        r"^create\s+table\s",
        r"^create\s+(unique\s+)?index\s",
        r"^create\s+sequence\s",
        r"^alter\s+table\s+(if\s+exists\s+)?[\w.\"]+\s+add\s+(column\s+|constraint\s+)?(?!.*\b(drop|rename|type)\b)",
        r"^insert\s+into\s",
        r"^comment\s+on\s",
    )
]
SECRETS = [
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\b(sk|rk)_(live|test)_[0-9A-Za-z]{20,}"),
    re.compile(r"\bwhsec_[0-9A-Za-z]{24,}"),
    re.compile(r"\bghp_[0-9A-Za-z]{30,}"),
    re.compile(r"\bgithub_pat_[0-9A-Za-z_]{30,}"),
    re.compile(r"\bsk-ant-[0-9A-Za-z_-]{20,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bxox[abprs]-[0-9A-Za-z-]{10,}"),
    re.compile(r"[\"']type[\"']\s*:\s*[\"']service_account[\"']"),  # Google service-account JSON
]
VERDICT = re.compile(r"<!--\s*verdetto-revisore:\s*(\{.*?\})\s*-->", re.S)


def git(repo, *args, check=True):
    res = subprocess.run(
        ["git", "-C", repo, "-c", "core.quotePath=false", f"--attr-source={EMPTY_TREE}", *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if check and res.returncode != 0:
        raise SystemExit(f"git {' '.join(args)}: {res.stderr.strip()}")
    return res.stdout


def show(repo, ref, path):
    res = subprocess.run(["git", "-C", repo, "show", f"{ref}:{path}"], capture_output=True, text=True, encoding="utf-8")
    return res.stdout if res.returncode == 0 else None


def protected(path, round_no=None):
    log = AGENTS_LOG.match(path)
    name = os.path.basename(path)
    return (
        path in PROTECTED_FILES
        or path.startswith(PROTECTED_PREFIXES)
        or any(fnmatch.fnmatchcase(path, g) for g in PROTECTED_GLOBS)
        or name in GIT_META_FILES
        or any(fnmatch.fnmatchcase(name, g) for g in AGENT_FILE_NAMES)
        or AGENT_DIR in path.split("/")[:-1]
        or bool(log and log.group(1) != round_no)
    )


def counts_as_code(path, round_no=None):
    """True when the added lines of `path` count for the size of the slice."""
    return path.startswith(SIZE_ROOTS) and not SIZE_EXCLUDED.search(path) and not protected(path, round_no)


def is_acceptance(path):
    return path.startswith(ACCEPTANCE_DIRS) or path.endswith("AcceptanceTest.java")


def changes(repo, base, head):
    """[(status, path, old_path)] between the merge base and head; NUL-separated, so any file name works."""
    out = []
    fields = git(repo, "diff", "-z", "--name-status", "-M", f"{base}...{head}").split("\0")
    i = 0
    while i < len(fields) and fields[i]:
        status = fields[i][0]
        if status in ("R", "C"):
            out.append((status, fields[i + 2], fields[i + 1]))
            i += 3
        else:
            out.append((status, fields[i + 1], None))
            i += 2
    return out


def numstat(repo, base, head, binaries=None):
    """[(added, removed, path)]; the paths git sees as binary go in `binaries` (a list), if given."""
    stats = []
    for record in git(repo, "diff", "-z", "--numstat", "--no-renames", f"{base}...{head}").split("\0"):
        if not record:
            continue
        added, removed, path = record.split("\t", 2)
        if added == "-":  # binary
            added = removed = "0"
            if binaries is not None:
                binaries.append(path)
        stats.append((int(added), int(removed), path))
    return stats


def check_binaries(binaries, changed, reasons):
    """No binary file under server/ or app/, except a few kinds of assets under app/assets/."""
    present = {path for status, path, _ in changed if status != "D"}
    for path in binaries:
        if path in present and path.startswith(SIZE_ROOTS) and not BINARY_ALLOWED.match(path):
            reasons.append(f"file binario {path}: nessun controllo lo può leggere (ammessi solo png, jpg, webp, ttf e otf in app/assets/)")


def sql_statements(body):
    """Statements of a migration, without comments, splitting on ';' outside quotes."""
    out, current, i, quote = [], [], 0, None
    while i < len(body):
        ch = body[i]
        if quote:
            current.append(ch)
            if ch == quote:
                quote = None
        elif ch in ("'", '"'):
            quote = ch
            current.append(ch)
        elif body.startswith("--", i):
            while i < len(body) and body[i] != "\n":
                i += 1
            current.append(" ")
            continue
        elif body.startswith("/*", i):
            end = body.find("*/", i + 2)
            i = len(body) if end < 0 else end + 2
            current.append(" ")
            continue
        elif ch == ";":
            out.append("".join(current))
            current = []
        else:
            current.append(ch)
        i += 1
    out.append("".join(current))
    return [re.sub(r"\s+", " ", s).strip() for s in out if s.strip()]


def check_migrations(repo, base, head, changed, reasons):
    existing = [
        int(m.group(1))
        for name in git(repo, "ls-tree", "--name-only", f"{base}:{MIGRATIONS_DIR}", check=False).splitlines()
        if (m := MIGRATION_NAME.match(os.path.basename(name)))
    ]
    expected = (max(existing) if existing else 0) + 1
    added = []
    for status, path, old in changed:
        for p in (path, old):
            if p and "/db/migration/" in p and not p.startswith(MIGRATIONS_DIR):
                reasons.append(f"migrazione fuori da {MIGRATIONS_DIR}: {p}")
        touched = [p for p in (path, old) if p and p.startswith(MIGRATIONS_DIR)]
        if not touched:
            continue
        if status != "A":
            reasons.append(f"migrazione {touched[0]}: solo aggiunte, mai modifiche, cancellazioni o rinomine")
            continue
        m = MIGRATION_NAME.match(os.path.basename(path))
        if not m:
            reasons.append(f"migrazione {os.path.basename(path)}: il nome deve essere V<n>__descrizione.sql")
            continue
        added.append((int(m.group(1)), path))
    for version, path in sorted(added):
        name = os.path.basename(path)
        if version != expected:
            reasons.append(f"migrazione {name}: attesa la versione V{expected}, in sequenza con main")
        expected = version + 1
        body = show(repo, head, path) or ""
        if DOLLAR_QUOTE.search(body):
            reasons.append(f"migrazione {name}: dollar quoting di PostgreSQL ($$ o $tag$) non controllabile, serve una persona")
            continue
        if ESCAPE_STRING.search(body):
            reasons.append(f"migrazione {name}: stringhe E'…' di PostgreSQL non controllabili, serve una persona")
            continue
        for statement in sql_statements(body):
            if not any(p.match(statement) for p in ALLOWED_SQL):
                reasons.append(f"migrazione {name}: istruzione non tra quelle sempre sicure → «{statement[:60]}»")
    return len(added)


def relaxed(key):
    """A Spring key after relaxed binding: spring.jpa.hibernate.ddl-auto == spring.jpa.hibernate.ddlAuto."""
    key = key.strip().strip("\"'").replace("[", ".").replace("]", "")  # map form: properties[hibernate.x]
    return ".".join(part.replace("-", "").replace("_", "").lower() for part in key.split(".") if part)


def config_settings(text, path):
    """{(key, value)} of a .properties or .yml file; raises ValueError on YAML it cannot follow."""
    pairs = set()
    if path.endswith(".properties"):
        text = re.sub(r"\\\r?\n\s*", "", text)  # continuation lines
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith(("#", "!")):
                continue
            m = re.match(r"^((?:[^=:\s\\]|\\.)+)\s*[=:\s]\s*(.*)$", line)
            if m:
                pairs.add((relaxed(m.group(1)), m.group(2).strip().strip("\"'").lower()))
        return pairs
    stack = []  # [(indent, key)]
    for raw in text.splitlines():
        line = re.sub(r"(^|\s)#.*$", "", raw).rstrip()
        if not line.strip():
            continue
        if line.startswith(("---", "...")):
            stack = []
            continue
        indent = len(line) - len(line.lstrip(" "))
        body = line.strip()
        if body.startswith("- "):
            continue  # list items: no schema key is a list
        m = re.match(r"""^("[^"]*"|'[^']*'|[^:{}\[\]"'][^:{}]*?)\s*:(?:\s+(.*))?$""", body)
        if not m:
            raise ValueError(f"riga YAML non controllabile: «{body[:40]}»")
        while stack and stack[-1][0] >= indent:
            stack.pop()
        key, value = m.group(1).strip().strip("\"'"), (m.group(2) or "").strip()
        if not value:
            stack.append((indent, key))
            continue
        if value[0] in "{[|>&*!":
            raise ValueError(f"forma YAML non controllabile: «{body[:40]}»")
        full = ".".join([k for _, k in stack] + [key])
        pairs.add((relaxed(full), value.strip("\"'").lower()))
    return pairs


def check_config(repo, base, head, changed, reasons):
    merge_base = git(repo, "merge-base", base, head).strip()
    for status, path, old in changed:
        if not APP_PROPERTIES.match(path or "") or show(repo, head, path) is None:
            continue
        try:
            before = config_settings(show(repo, merge_base, old or path) or "", path)
            after = config_settings(show(repo, head, path), path)
        except ValueError as exc:
            reasons.append(f"{path}: {exc}")
            continue
        for key, value in sorted(after - before):
            if key in DANGEROUS_CONFIG and DANGEROUS_CONFIG[key](value):
                reasons.append(f"{path}: chiave che può cancellare o rigenerare lo schema → «{key}={value[:40]}»")


def check_acceptance(repo, base, head, changed, reasons):
    merge_base = git(repo, "merge-base", base, head).strip()
    for status, path, old in changed:
        paths = [p for p in (path, old) if p and is_acceptance(p)]
        if paths and status != "A":
            reasons.append(f"test di accettazione {paths[0]}: quelli già su main non si toccano")
    # Every acceptance test added during the PR must still be there, unchanged since the commit
    # that created it, and that commit must be a test(acceptance) one.
    first = {}
    for commit in git(repo, "log", "--reverse", "--format=%H", f"{merge_base}..{head}").split():
        subject = git(repo, "log", "-1", "--format=%s", commit).strip()
        fields = git(repo, "diff-tree", "--no-commit-id", "-z", "-r", "--name-status", "--diff-filter=A", commit).split("\0")
        for status, path in zip(fields[0::2], fields[1::2]):
            if status == "A" and is_acceptance(path) and path not in first:
                first[path] = (commit, subject)
    for path, (commit, subject) in first.items():
        if not subject.lower().startswith("test(acceptance)"):
            reasons.append(f"test di accettazione {path}: nato in un commit che non è test(acceptance)")
            continue
        original = show(repo, commit, path)
        now = show(repo, head, path)
        if now is None:
            reasons.append(f"test di accettazione {path}: tolto o spostato dopo il commit che lo ha creato")
        elif now != original:
            reasons.append(f"test di accettazione {path}: cambiato dopo il commit test(acceptance) che lo ha creato")


def check_goals(repo, base, head, changed, reasons):
    if not any(GOALS_FILE in (path, old) for _, path, old in changed):
        return
    try:
        before = json.loads(show(repo, git(repo, "merge-base", base, head).strip(), GOALS_FILE) or "{}")
        after = json.loads(show(repo, head, GOALS_FILE) or "null")
    except ValueError:
        reasons.append(f"{GOALS_FILE}: JSON non valido")
        return
    if not isinstance(after, dict):
        reasons.append(f"{GOALS_FILE}: cancellato o vuoto")
        return
    if {k: v for k, v in before.items() if k != "traguardi"} != {k: v for k, v in after.items() if k != "traguardi"}:
        reasons.append(f"{GOALS_FILE}: cambiati campi che non sono di stato")
    old_goals, new_goals = before.get("traguardi", []), after.get("traguardi", [])
    if [g.get("id") for g in old_goals] != [g.get("id") for g in new_goals]:
        reasons.append(f"{GOALS_FILE}: traguardi aggiunti, tolti o riordinati")
        return
    changed_goals = 0
    for old, new in zip(old_goals, new_goals):
        if {k: v for k, v in old.items() if k not in GOAL_STATE_FIELDS} != {k: v for k, v in new.items() if k not in GOAL_STATE_FIELDS}:
            reasons.append(f"{GOALS_FILE}: {new.get('id')} cambiato oltre lo stato")
        if new.get("stato") not in GOAL_STATES:
            reasons.append(f"{GOALS_FILE}: {new.get('id')} ha uno stato sconosciuto")
        for key in ("giri", "pr"):
            if new.get(key, [])[: len(old.get(key, []))] != old.get(key, []):
                reasons.append(f"{GOALS_FILE}: {new.get('id')}.{key} riscritto (si può solo aggiungere)")
        if old != new:
            changed_goals += 1
    if changed_goals > 1:
        reasons.append(f"{GOALS_FILE}: un giro cambia lo stato di un traguardo solo, qui {changed_goals}")


def round_number(repo, head, meta):
    """The round of the PR, from its branch (claude/giro-NNN-…); None when it is not a round's."""
    branch = (meta or {}).get("headRefName") or git(repo, "rev-parse", "--abbrev-ref", head, check=False).strip()
    m = ROUND_BRANCH.match(branch)
    return m.group(1) if m else None


def expected_models(text):
    """The `modelli_attesi:` block of progetto.yml, as {agent_type: model}: plain `key: value` lines."""
    out, inside = {}, False
    for line in (text or "").splitlines():
        body = line.split("#", 1)[0].rstrip()
        if not body.strip():
            continue
        if not line[:1].isspace():
            inside = body.strip() == "modelli_attesi:"
        elif inside and (m := re.fullmatch(r"\s+([\w-]+)\s*:\s*[\"']?([\w.\[\]-]+)[\"']?", body)):
            out[m.group(1)] = m.group(2)
    return out


def model_matches(model, expected):
    """By prefix: claude-opus-5-5 accepts claude-opus-5-5[1m], not claude-opus-5-50."""
    return isinstance(model, str) and re.match(re.escape(expected) + r"(?![0-9.])", model) is not None


def pr_verdict(meta):
    """The last verdetto-revisore marker of the PR body, as a dict; None when missing or unreadable."""
    found = VERDICT.findall((meta or {}).get("body") or "")
    try:
        verdict = json.loads(found[-1]) if found else None
    except ValueError:
        return None
    return verdict if isinstance(verdict, dict) else None


def reviewed_ref(repo, head, verdict):
    """The commit the reviewer saw (the verdict's sha, when it is in the PR's history), else head."""
    sha = str((verdict or {}).get("sha") or "")
    if re.fullmatch(r"[0-9a-f]{7,40}", sha):
        res = subprocess.run(["git", "-C", repo, "merge-base", "--is-ancestor", sha, head], capture_output=True)
        if res.returncode == 0:
            return sha
    return head


def round_kind(repo, ref, round_no, reasons):
    """`tipo:` of the plan's frontmatter at `ref` (the reviewed commit); None (and a reason) when
    missing or unknown. Read at the reviewed commit, so a change of kind after the review is ignored."""
    plan = f"docs/lab/giri/{round_no}-piano.md"
    text = show(repo, ref, plan) or ""
    front = re.match(r"^---\r?\n(.*?)\r?\n---", text, re.S)
    m = re.search(r"^tipo:[ \t]*[\"']?([\w-]*)[\"']?[ \t]*(#.*)?$", front.group(1) if front else "", re.M)
    kind = m.group(1) if m else ""
    if kind not in ROUND_KINDS:
        reasons.append(f"tipo di giro mancante o sconosciuto in {plan} ({kind or 'assente'}): uno tra {', '.join(sorted(ROUND_KINDS))}")
        return None
    return kind


def read_register(repo, ref, path):
    """The `agenti` list of a register at `ref`; None when the file is missing. ValueError when unreadable."""
    text = show(repo, ref, path)
    if text is None:
        return None
    try:
        data = json.loads(text)
    except ValueError as exc:
        raise ValueError(f"JSON non valido: {exc}") from None
    agents = data.get("agenti") if isinstance(data, dict) else None
    if not isinstance(agents, list):
        raise ValueError("agenti non è una lista")
    return agents


def required_agents(kind):
    """DELTA-V4 V1: the agents a round of this kind must have run (the orchestrator always)."""
    if kind == "costruzione":
        return BUILD_AGENTS
    if kind == "runbook":
        return ("orchestratore",)
    return ("revisore", "orchestratore")


def check_models(repo, base, head, reviewed, round_no, kind, reasons):
    """DELTA-V4 V1: every agent ran on the expected model, read from the hooks' register.

    The register is read at head: the reviewer's and the orchestrator's entries are added after the
    reviewed commit. What it already said at the reviewed commit can only grow (the orchestrator's
    entry may be rewritten by `agenti.py chiudi`). Returns the entries, or None."""
    expected = expected_models(show(repo, base, PROJECT_FILE))
    if not expected:
        reasons.append(f"modello-inatteso: nessun modello atteso leggibile da {PROJECT_FILE} (modelli_attesi)")
        return None
    path = f"docs/lab/giri/{round_no}-agenti.json"
    try:
        agents = read_register(repo, head, path)
    except ValueError as exc:
        reasons.append(f"modello-inatteso: {path} non leggibile ({exc})")
        return None
    if agents is None:
        reasons.append(f"modello-inatteso: manca {path}")
        return None
    if not agents:
        reasons.append(f"modello-inatteso: {path} non ha agenti")
    if reviewed != head:
        try:
            before = read_register(repo, reviewed, path) or []
        except ValueError as exc:
            reasons.append(f"modello-inatteso: {path} non leggibile al commit rivisto {reviewed[:9]} ({exc})")
            before = []
        lost = [e for e in before if not (isinstance(e, dict) and e.get("agent_type") == "orchestratore") and e not in agents]
        if lost:
            reasons.append(f"modello-inatteso: {path} riscritto dopo la revisione di {reviewed[:9]}: le voci si possono solo aggiungere")
    seen, ids = set(), set()
    for entry in agents:
        if not isinstance(entry, dict):
            reasons.append(f"modello-inatteso: voce non valida in {path}")
            continue
        agent, agent_id = entry.get("agent_type"), entry.get("agent_id")
        if agent_id and agent_id in ids:
            reasons.append(f"modello-inatteso: agent_id ripetuto in {path} ({str(agent_id)[:40]})")
        ids.add(agent_id)
        if agent == "":
            continue  # an internal agent (empty agent_type): stays in the file, never counts as a role
        if agent not in expected:
            reasons.append(f"modello-inatteso: agent_type sconosciuto in {path} ({str(agent)[:40]!r}), attesi {', '.join(sorted(expected))}")
            continue
        if not agent_id:
            reasons.append(f"modello-inatteso: {agent} senza agent_id in {path}")
        seen.add(agent)
        if entry.get("fonte") != "transcript":
            reasons.append(f"modello-inatteso: {agent} senza modello dal transcript (fonte {entry.get('fonte')!r}: {str(entry.get('motivo') or '')[:80]})")
            continue
        models = entry.get("modelli")
        if not isinstance(models, list) or not models:
            reasons.append(f"modello-inatteso: {agent} senza modelli registrati")
            continue
        wrong = [m for m in models if not model_matches(m, expected[agent])]
        if wrong:
            reasons.append(f"modello-inatteso: {agent} su {', '.join(map(str, wrong))}, atteso {expected[agent]}")
    missing = [a for a in required_agents(kind) if a not in seen]
    if missing:
        reasons.append(f"modello-inatteso: in un giro {kind or 'senza tipo'} mancano {', '.join(missing)} in {path}")
    return agents


def check_recorded_verdict(agents, verdict, reasons):
    """The verdict in the PR body must be the one the reviewer gave: the hook stores the last
    `VERDETTO` line of the reviewer's final message in its register entry (field `verdetto`)."""
    reviews = [e for e in agents or [] if isinstance(e, dict) and e.get("agent_type") == "revisore"]
    recorded = reviews[-1].get("verdetto") if reviews else None
    if not isinstance(recorded, dict):
        reasons.append("il verdetto nel corpo della PR non è verificabile: nel registro degli agenti manca il VERDETTO del revisore")
        return
    body_sha, rec_sha = str(verdict.get("sha") or "").lower(), str(recorded.get("sha") or "").lower()
    body_blockers, rec_blockers = verdict.get("bloccanti"), recorded.get("bloccanti")
    same_blockers = type(body_blockers) is int and type(rec_blockers) is int and body_blockers == rec_blockers
    if not body_sha or body_sha != rec_sha or not same_blockers:
        reasons.append(
            f"il verdetto nel corpo della PR (sha {body_sha[:9] or '—'}, bloccanti {body_blockers!r}) non è quello "
            f"registrato dal revisore (sha {rec_sha[:9] or '—'}, bloccanti {rec_blockers!r})"
        )


def check_kind(kind, changed, code_added, reasons):
    """DELTA-V4 V4, V6: what each kind of round may change."""
    if kind in ("verifica-produzione", "caccia") and code_added:
        reasons.append(f"giro {kind}: {code_added} righe aggiunte nel codice ({', '.join(SIZE_ROOTS)}, test e documenti esclusi), attese 0")
    if kind == "runbook":
        outside = [p for _, path, old in changed for p in (path, old) if p and not p.startswith(RUNBOOK_ALLOWED)]
        if outside:
            reasons.append(f"giro runbook: cambia solo {', '.join(RUNBOOK_ALLOWED)}, qui anche {', '.join(outside[:5])}")


def check_secrets(repo, base, head, reasons):
    diff = git(repo, "diff", "--text", "--unified=0", "--no-color", f"{base}...{head}")
    current, previous = None, ""
    for line in diff.splitlines():
        if previous.startswith("--- ") and line.startswith("+++ "):
            current = line[6:] if line.startswith("+++ b/") else line[4:]
        elif line.startswith("+") and any(p.search(line) for p in SECRETS):
            reasons.append(f"possibile segreto in {current}: niente segreti nel repository")
        previous = line


def check_pr(repo, head, meta, reasons):
    branch = meta.get("headRefName", "")
    labels = {l.get("name") if isinstance(l, dict) else l for l in meta.get("labels", [])}
    if not branch.startswith(BRANCH_PREFIX):
        reasons.append(f"branch {branch!r}: le PR automatiche vengono solo da {BRANCH_PREFIX}…")
    if "giro" not in labels:
        reasons.append("manca l'etichetta 'giro'")
    for label in ("domanda", "in-corso", "bloccato", "revisione-umana"):
        if label in labels:
            reasons.append(f"etichetta '{label}': non è il momento del merge")
    if meta.get("isDraft"):
        reasons.append("la PR è ancora in bozza")
    found = VERDICT.findall(meta.get("body") or "")
    if not found:
        reasons.append("nel corpo della PR manca il verdetto del revisore (<!-- verdetto-revisore: {...} -->)")
        return None
    try:
        verdict = json.loads(found[-1])  # the last one: the most recent review
    except ValueError:
        reasons.append("il verdetto del revisore non è JSON valido")
        return None
    blockers = verdict.get("bloccanti")
    if type(blockers) is not int or blockers != 0:
        reasons.append(f"il revisore riporta bloccanti: {blockers!r}")
    sha = str(verdict.get("sha") or "")
    if not re.fullmatch(r"[0-9a-f]{7,40}", sha):
        reasons.append("il verdetto non dice quale commit ha rivisto (campo sha)")
    else:
        res = subprocess.run(["git", "-C", repo, "merge-base", "--is-ancestor", sha, head], capture_output=True)
        if res.returncode != 0:
            reasons.append(f"il commit rivisto {sha[:9]} non è nella storia della PR")
        else:
            after = [p for _, p, _ in changes(repo, sha, head) if not p.startswith(AFTER_REVIEW_ALLOWED)]
            if after:
                reasons.append(f"codice cambiato dopo la revisione di {sha[:9]}: {', '.join(after[:5])}")
    return verdict


def check_links(repo, base, head, reasons):
    """Symbolic links: a link can make a protected or checked file say something else."""
    fields = git(repo, "diff", "-z", "--raw", "--no-renames", f"{base}...{head}").split("\0")
    for meta, path in zip(fields[0::2], fields[1::2]):
        parts = meta.split()
        if len(parts) >= 2 and parts[1] == "120000":
            reasons.append(f"collegamento simbolico: {path}")


def guarded(name, reasons, check, *args):
    """Runs one check; if it fails, the PR goes to a human instead of the check being skipped."""
    try:
        return check(*args)
    except (Exception, SystemExit) as exc:  # noqa: BLE001 - any failure means "a human looks"
        reasons.append(f"controllo «{name}» non riuscito ({type(exc).__name__}: {str(exc)[:120]})")
        return None


def evaluate(repo, base, head, meta=None):
    reasons = []
    changed = changes(repo, base, head)
    round_no = round_number(repo, head, meta)
    for status, path, old in changed:
        for p in (path, old):
            if p and protected(p, round_no):
                reasons.append(f"percorso protetto: {p}")
            if p and KEY_FILES.search(p) and status != "D" and p == path:
                reasons.append(f"file di chiavi nel repository: {p}")
    if show(repo, head, STOP_FILE) is not None or show(repo, base, STOP_FILE) is not None:
        reasons.append("interruttore: esiste docs/lab/STOP")
    new_migrations = guarded("migrazioni", reasons, check_migrations, repo, base, head, changed, reasons)
    guarded("configurazione", reasons, check_config, repo, base, head, changed, reasons)
    guarded("test di accettazione", reasons, check_acceptance, repo, base, head, changed, reasons)
    guarded("traguardi", reasons, check_goals, repo, base, head, changed, reasons)
    guarded("segreti", reasons, check_secrets, repo, base, head, reasons)
    guarded("collegamenti", reasons, check_links, repo, base, head, reasons)
    binaries = []
    stats = numstat(repo, base, head, binaries)
    guarded("file binari", reasons, check_binaries, binaries, changed, reasons)
    main_added = sum(a for a, _, p in stats if counts_as_code(p, round_no))
    if main_added > MAX_MAIN_LINES:
        reasons.append(f"fetta troppo grande: {main_added} righe aggiunte nel codice ({', '.join(SIZE_ROOTS)}, test e documenti esclusi; massimo {MAX_MAIN_LINES})")
    agents = None
    if round_no is None:
        reasons.append("giro non ricavabile dal branch (claude/giro-NNN-…): tipo e modelli non verificabili")
    else:
        reviewed = guarded("commit rivisto", reasons, reviewed_ref, repo, head, pr_verdict(meta)) or head
        kind = guarded("tipo di giro", reasons, round_kind, repo, reviewed, round_no, reasons)
        guarded("tipo di giro", reasons, check_kind, kind, changed, main_added, reasons)
        agents = guarded("modelli", reasons, check_models, repo, base, head, reviewed, round_no, kind, reasons)
    verdict = guarded("PR", reasons, check_pr, repo, head, meta, reasons) if meta is not None else None
    if isinstance(verdict, dict):
        guarded("verdetto registrato", reasons, check_recorded_verdict, agents, verdict, reasons)
    reasons = list(dict.fromkeys(reasons))
    return {
        "auto_merge": not reasons,
        "motivi": reasons,
        "metriche": {
            "file": len(changed),
            "righe_main_aggiunte": main_added,
            "righe_main_tolte": sum(r for _, r, p in stats if counts_as_code(p, round_no)),
            "righe_test_aggiunte": sum(a for a, _, p in stats if TEST_PATHS.search(p)),
            "righe_docs_aggiunte": sum(a for a, _, p in stats if p.startswith("docs/")),
            "migrazioni_nuove": new_migrations or 0,
            "verdetto": verdict,
        },
    }


def markdown(result):
    if result["auto_merge"]:
        head = "✅ **Controlli di consegna superati**: merge automatico."
    else:
        head = "⏸️ **Revisione umana**: il merge automatico non si fa perché:\n\n" + "\n".join(
            f"- {r}" for r in result["motivi"]
        )
    m = result["metriche"]
    return (
        f"{head}\n\n"
        f"File: {m['file']} · righe di codice: +{m['righe_main_aggiunte']} −{m['righe_main_tolte']} · "
        f"righe di test: +{m['righe_test_aggiunte']} · migrazioni nuove: {m['migrazioni_nuove']}\n\n"
        "_Regole: `docs/METODO.md` §4, controllo `scripts/guard/pr_guard.py` (versione su main)._\n"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--repo", default=".")
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--pr-json", help="JSON della PR: headRefName, labels, isDraft, body")
    parser.add_argument("--out", help="scrive il risultato JSON in questo file")
    parser.add_argument("--markdown", help="scrive il commento per la PR in questo file")
    args = parser.parse_args()
    meta = None
    if args.pr_json:
        with open(args.pr_json, encoding="utf-8") as f:
            meta = json.load(f)
    result = evaluate(args.repo, args.base, args.head, meta)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
    if args.markdown:
        with open(args.markdown, "w", encoding="utf-8") as f:
            f.write(markdown(result))
    print("auto-merge" if result["auto_merge"] else "revisione-umana")
    for reason in result["motivi"]:
        print(f"- {reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
