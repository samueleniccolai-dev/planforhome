#!/usr/bin/env python3
"""SubagentStop hook: adds the subagent's models and tokens to docs/lab/giri/NNN-agenti.json.

DELTA-V4 V1 and V3; format in scripts/metrics/agenti.py. Reads the hook JSON on stdin (agent_id,
agent_type, agent_transcript_path, last_assistant_message, cwd). Outside a round branch
(claude/giro-NNN-…) it does nothing. For the reviewer it also stores the last `VERDETTO {json}` line
of its final message (field `verdetto`, null when absent): pr_guard compares it with the verdict
written in the PR body.
It never stops the session: it always exits 0, and when something cannot be read the entry says
fonte "assente" with the reason. Standard library only.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "..", "scripts", "metrics")))


def run(raw):
    import agenti  # noqa: E402 (path set above)

    try:
        payload = json.loads(raw) if raw.strip() else {}
        if not isinstance(payload, dict):
            raise ValueError("non è un oggetto")
        problem = ""
    except ValueError as exc:
        payload, problem = {}, f"input del hook illeggibile: {exc.__class__.__name__}"
    cwd = payload.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    giro = agenti.round_of(agenti.git_branch(cwd))
    root = agenti.git_root(cwd)
    if not giro or not root:
        return
    new = agenti.entry(str(payload.get("agent_type") or ""), str(payload.get("agent_id") or ""),
                       payload.get("agent_transcript_path"))
    if problem:
        new["fonte"], new["motivo"] = "assente", problem
    if new["agent_type"] == "revisore":
        new["verdetto"] = agenti.verdict_of(payload.get("last_assistant_message"))
    agenti.add_entry(root, giro, new)


def main():
    try:
        run(sys.stdin.read())
    except Exception as exc:  # noqa: BLE001 - a metrics hook must never break the session
        print(f"registra-agente: {exc.__class__.__name__}: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
