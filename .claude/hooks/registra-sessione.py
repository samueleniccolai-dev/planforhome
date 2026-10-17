#!/usr/bin/env python3
"""SessionStart hook: writes .claude/state/sessione.json (transcript_path, model, session_id).

scripts/metrics/agenti.py `chiudi` reads it to find the orchestrator's transcript (DELTA-V4 V1, V3).
The file is local state, ignored by git. Always exits 0; standard library only.
"""
import datetime
import json
import os
import subprocess
import sys


def project_root(payload):
    if os.environ.get("CLAUDE_PROJECT_DIR"):
        return os.environ["CLAUDE_PROJECT_DIR"]
    cwd = payload.get("cwd") or os.getcwd()
    try:
        res = subprocess.run(["git", "-C", cwd, "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=10)
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    return cwd


def run(raw):
    payload = json.loads(raw) if raw.strip() else {}
    if not isinstance(payload, dict):
        payload = {}
    model = payload.get("model")
    if isinstance(model, dict):  # tolerate {"id": …} or {"display_name": …}
        model = model.get("id") or model.get("display_name")
    data = {
        "session_id": payload.get("session_id") or "",
        "transcript_path": payload.get("transcript_path") or "",
        "model": model if isinstance(model, str) else "",
        "source": payload.get("source") or "",
        "scritto_il": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    path = os.path.join(project_root(payload), ".claude", "state", "sessione.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def main():
    try:
        run(sys.stdin.read())
    except Exception as exc:  # noqa: BLE001 - a metrics hook must never break the session
        print(f"registra-sessione: {exc.__class__.__name__}: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
