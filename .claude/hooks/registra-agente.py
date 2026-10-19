#!/usr/bin/env python3
"""SubagentStop hook: adds the subagent's models and tokens to docs/lab/giri/NNN-agenti.json.

DELTA-V4 V1 and V3; format in scripts/metrics/agenti.py. Reads the hook JSON on stdin (agent_id,
agent_type, agent_transcript_path, last_assistant_message, cwd). Outside a round branch
(claude/giro-NNN-…) it does nothing. For the reviewer it also stores the last `VERDETTO {json}` line
of its final message (field `verdetto`, null when absent): pr_guard compares it with the verdict
written in the PR body.
A subagent that hands its report back with the SubagentHandback tool (Claude Code v2.1.271 or
later) leaves only its closing text in last_assistant_message: the same script, as a PostToolUse
hook on SubagentHandback, keeps the reviewer's report (tool_input.message) until its SubagentStop.
A subagent that stops and is resumed fires SubagentStop again with the same agent_id: its entry is
replaced, since its transcript already holds both parts (round 002).
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
    if payload.get("hook_event_name") == "PostToolUse":
        tool_input = payload.get("tool_input")
        if payload.get("tool_name") == "SubagentHandback" and payload.get("agent_type") == "revisore" \
                and isinstance(tool_input, dict):
            agenti.save_handback(cwd, payload.get("agent_id"), tool_input.get("message"))
        return
    giro = agenti.round_of(agenti.git_branch(cwd))
    root = agenti.git_root(cwd)
    if not giro or not root:
        return
    new = agenti.entry(str(payload.get("agent_type") or ""), str(payload.get("agent_id") or ""),
                       payload.get("agent_transcript_path"))
    if problem:
        new["fonte"], new["motivo"] = "assente", problem
    if new["agent_type"] == "revisore":
        # In order of time: the handed-back report, then the closing text. The last line counts.
        parts = (agenti.take_handback(cwd, payload.get("agent_id")), payload.get("last_assistant_message"))
        new["verdetto"] = agenti.verdict_of("\n".join(p for p in parts if isinstance(p, str)))
    agenti.add_entry(root, giro, new, replace_same_id=True)


def main():
    try:
        run(sys.stdin.read())
    except Exception as exc:  # noqa: BLE001 - a metrics hook must never break the session
        print(f"registra-agente: {exc.__class__.__name__}: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
