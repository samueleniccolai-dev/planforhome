#!/usr/bin/env python3
"""Per-round agent register: docs/lab/giri/NNN-agenti.json (DELTA-V4 V1 and V3).

    python3 scripts/metrics/agenti.py chiudi NNN     # adds the orchestrator's entry and the totals

The SubagentStop hook (.claude/hooks/registra-agente.py) adds one entry per subagent through the
functions below; `chiudi` adds the orchestrator, read from the main transcript named in
.claude/state/sessione.json (written by the SessionStart hook).

Transcripts are an internal format that can change: every reader fails closed. When a value cannot
be read, the entry says `fonte: "assente"` and why, never a guessed number. Standard library only.
"""
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
BRANCH = re.compile(r"^claude/giro-(\d{3})-")
USAGE_KEYS = {
    "input": "input_tokens",
    "output": "output_tokens",
    "cache_lettura": "cache_read_input_tokens",
    "cache_scrittura": "cache_creation_input_tokens",
}
REQUIRED_USAGE = ("input_tokens", "output_tokens")  # the cache fields may be absent: they mean 0
LOCK_WAIT_S = 15
LOCK_STALE_S = 60
# The reviewer's verdict line (.claude/agents/revisore.md): `VERDETTO {json}` on one line.
VERDICT_LINE = re.compile(r"^[ \t]*`?VERDETTO[ \t]+(\{.*\})`?[ \t]*$", re.M)


def zero_tokens():
    return {key: 0 for key in USAGE_KEYS}


def verdict_of(message):
    """The last `VERDETTO {json}` line of the reviewer's final message, as a dict.

    None when there is none or the last one is not a JSON object: pr_guard then cannot match the
    verdict in the PR body, and the PR goes to a human."""
    if not isinstance(message, str):
        return None
    found = VERDICT_LINE.findall(message)
    if not found:
        return None
    try:
        verdict = json.loads(found[-1])
    except ValueError:
        return None
    return verdict if isinstance(verdict, dict) else None


def read_transcript(path, skip_sidechain=False):
    """(models, tokens, fonte, motivo) from a transcript JSONL. Fails closed: fonte "assente".

    Only lines with message.role == "assistant" count, and only once per message id: a message with
    several content blocks is written as several lines carrying the same usage. In the main
    transcript, skip_sidechain drops subagent lines (older versions wrote them there too; they are
    already counted by the SubagentStop hook).
    """
    tokens = zero_tokens()
    if not path:
        return [], tokens, "assente", "percorso del transcript mancante"
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except OSError as exc:
        return [], tokens, "assente", f"transcript illeggibile: {exc.__class__.__name__}"
    messages, problems = {}, []
    for number, line in enumerate(lines, 1):
        line = line.strip()
        if not line:
            continue
        try:
            record = json.loads(line)
        except ValueError:
            continue  # a truncated last line, or a format change: the other lines still count
        if not isinstance(record, dict) or (skip_sidechain and record.get("isSidechain") is True):
            continue
        message = record.get("message")
        if not isinstance(message, dict) or message.get("role") != "assistant":
            continue
        key = message.get("id") or record.get("uuid") or f"riga-{number}"
        messages[key] = message
    models = set()
    for message in messages.values():
        model = message.get("model")
        if isinstance(model, str) and model.startswith("<"):
            continue  # synthetic messages ("<synthetic>": no model call) carry no real usage
        if isinstance(model, str) and model:
            models.add(model)
        else:
            problems.append("model mancante")
        usage = message.get("usage")
        if not isinstance(usage, dict) or any(not isinstance(usage.get(k), int) for k in REQUIRED_USAGE):
            problems.append("usage mancante o incompleto")
            continue
        for key, field in USAGE_KEYS.items():
            value = usage.get(field)
            tokens[key] += value if isinstance(value, int) and value > 0 else 0
    if not messages:
        return [], tokens, "assente", "nessun messaggio assistant nel transcript"
    if problems:
        return sorted(models), tokens, "assente", "; ".join(sorted(set(problems)))
    return sorted(models), tokens, "transcript", ""


def entry(agent_type, agent_id, transcript_path, skip_sidechain=False):
    models, tokens, fonte, motivo = read_transcript(transcript_path, skip_sidechain)
    return {
        "agent_type": agent_type or "",
        "agent_id": agent_id or "",
        "modelli": models,
        "token": tokens,
        "fonte": fonte,
        "motivo": motivo,
    }


def totals(agents):
    """(totale_token, token_fonte) as the contract defines them."""
    total = zero_tokens()
    for agent in agents:
        for key in total:
            value = (agent.get("token") or {}).get(key)
            total[key] += value if isinstance(value, int) else 0
    if not agents:
        return total, "assente"
    fonti = {agent.get("fonte") for agent in agents}
    return total, "transcript" if fonti == {"transcript"} else "parziale"


def register_path(root, giro):
    return os.path.join(root, "docs", "lab", "giri", f"{giro}-agenti.json")


def git_branch(cwd):
    try:
        res = subprocess.run(["git", "-C", cwd, "symbolic-ref", "--short", "-q", "HEAD"],
                             capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        return ""
    return res.stdout.strip() if res.returncode == 0 else ""


def git_root(cwd):
    try:
        res = subprocess.run(["git", "-C", cwd, "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        return ""
    return os.path.normpath(res.stdout.strip()) if res.returncode == 0 and res.stdout.strip() else ""


def round_of(branch):
    m = BRANCH.match(branch or "")
    return m.group(1) if m else None


def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
        f.flush()
        os.fsync(f.fileno())
    for attempt in range(20):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:  # Windows: a reader holds the file for a moment
            time.sleep(0.05 * (attempt + 1))
    os.replace(tmp, path)


class Lock:
    """An exclusive lock file next to the register (O_EXCL), with retry and stale-lock recovery."""

    def __init__(self, path):
        self.path = path + ".lock"
        self.held = False

    def __enter__(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        deadline = time.monotonic() + LOCK_WAIT_S
        while True:
            try:
                fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(fd, str(os.getpid()).encode())
                os.close(fd)
                self.held = True
                return self
            except FileExistsError:
                try:
                    if time.time() - os.path.getmtime(self.path) > LOCK_STALE_S:
                        os.remove(self.path)
                        continue
                except OSError:
                    continue
                if time.monotonic() > deadline:
                    raise TimeoutError(f"lucchetto occupato: {self.path}")
                time.sleep(0.02)

    def __exit__(self, *exc):
        if self.held:
            try:
                os.remove(self.path)
            except OSError:
                pass
        return False


def load_register(path, giro):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get("agenti"), list):
            return data
    except (OSError, ValueError):
        pass
    return {"giro": giro, "agenti": []}


def add_entry(root, giro, new, replace_same_id=False):
    """Appends (or, with replace_same_id, replaces) one entry and rewrites the totals, under the lock."""
    path = register_path(root, giro)
    with Lock(path):
        data = load_register(path, giro)
        agents = data["agenti"]
        if replace_same_id and new.get("agent_id"):
            agents = [a for a in agents if not (a.get("agent_id") == new["agent_id"]
                                                and a.get("agent_type") == new.get("agent_type"))]
        agents.append(new)
        total, fonte = totals(agents)
        data = {"giro": giro, "agenti": agents, "totale_token": total, "token_fonte": fonte}
        atomic_write_json(path, data)
    return data


def close_round(root, giro):
    """The orchestrator's entry, from .claude/state/sessione.json and the main transcript."""
    state = os.path.join(root, ".claude", "state", "sessione.json")
    try:
        with open(state, encoding="utf-8") as f:
            session = json.load(f)
        if not isinstance(session, dict):
            raise ValueError("non è un oggetto")
    except (OSError, ValueError) as exc:
        new = entry("orchestratore", "", None)
        new["motivo"] = f".claude/state/sessione.json illeggibile: {exc.__class__.__name__}"
        return add_entry(root, giro, new)
    new = entry("orchestratore", str(session.get("session_id") or ""), session.get("transcript_path"),
                skip_sidechain=True)
    return add_entry(root, giro, new, replace_same_id=True)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) < 2 or argv[0] != "chiudi" or not re.fullmatch(r"\d{3}", argv[1]):
        print("uso: agenti.py chiudi NNN [--root CARTELLA]", file=sys.stderr)
        return 2
    root = argv[argv.index("--root") + 1] if "--root" in argv[2:] else ROOT
    data = close_round(root, argv[1])
    print(f"docs/lab/giri/{argv[1]}-agenti.json: {len(data['agenti'])} voci, token_fonte={data['token_fonte']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
