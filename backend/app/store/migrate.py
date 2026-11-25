"""Migration runner with a human approval gate for destructive steps (AGENTS.md §5, SECURITY.md §5).

  python -m app.store.migrate status
  python -m app.store.migrate plan                 # lists pending migrations; if any is destructive, prints a one-time code
  python -m app.store.migrate upgrade              # applies pending migrations (refuses destructive ones)
  python -m app.store.migrate upgrade --approve 482913   # a human types the code from `plan`

Rules enforced here:
  * A backup is taken before every upgrade (pg_dump for PostgreSQL, the online backup API for SQLite).
  * Destructive SQL (DROP, TRUNCATE, DELETE without WHERE, op.drop_*) needs a code from `plan`.
    The code is bound to the exact migration files (sha256), valid 15 minutes, and works once.
    After it is used, the next destructive call needs a new plan and a new code: approval is never reused.
  * In production (ET_ENV=production) the code must also be confirmed interactively on a TTY,
    so an agent running non-interactively can't approve its own call.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import secrets
import shutil
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

from app.config import get_settings
from app.db import engine

ROOT = Path(__file__).resolve().parents[2]
VERSIONS = Path(__file__).resolve().parent / "migrations" / "versions"
BACKUPS = Path(os.environ.get("ET_BACKUP_DIR", ROOT / "backups"))
PLAN_FILE = Path(os.environ.get("ET_PLAN_FILE", ROOT / ".migration-plan.json"))
PLAN_TTL_S = 15 * 60

DESTRUCTIVE = [
    re.compile(r"\bDROP\s+(TABLE|COLUMN|INDEX|VIEW|TRIGGER|SCHEMA|DATABASE)\b", re.I),
    re.compile(r"\bTRUNCATE\b", re.I),
    re.compile(r"\bDELETE\s+FROM\s+\w+\s*(;|\"|'|\)|$)", re.I),
    re.compile(r"\bALTER\s+TABLE\s+\w+\s+DROP\b", re.I),
    re.compile(r"\bop\.drop_(table|column|index|constraint)\("),
]


def _cfg() -> Config:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).resolve().parent / "migrations"))
    return cfg


def pending() -> list[tuple[str, Path]]:
    script = ScriptDirectory.from_config(_cfg())
    with engine.connect() as conn:
        current = MigrationContext.configure(conn).get_current_revision()
    revs = list(script.walk_revisions("base", "heads"))
    revs.reverse()
    out: list[tuple[str, Path]] = []
    seen_current = current is None
    for r in revs:
        if seen_current:
            out.append((r.revision, Path(r.path)))
        elif r.revision == current:
            seen_current = True
    return out


def upgrade_body(path: Path) -> str:
    """Only the upgrade() function counts; downgrade() never runs automatically."""
    src = path.read_text(encoding="utf-8")
    m = re.search(r"def upgrade\(\)[^:]*:(.*?)(?=\ndef |\Z)", src, re.S)
    return m.group(1) if m else src


def destructive_lines(path: Path) -> list[str]:
    hits = []
    for line in upgrade_body(path).splitlines():
        if line.strip().startswith("#"):
            continue
        if any(rx.search(line) for rx in DESTRUCTIVE):
            hits.append(f"{path.name}: {line.strip()[:140]}")
    return hits


def _digest(items: list[tuple[str, Path]]) -> str:
    h = hashlib.sha256()
    for rev, p in items:
        h.update(rev.encode())
        h.update(p.read_bytes())
    return h.hexdigest()


def backup() -> Path:
    BACKUPS.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    url = get_settings().database_url
    if url.startswith("sqlite"):
        src_path = url.split("///", 1)[1]
        dest = BACKUPS / f"et-{stamp}.db"
        with sqlite3.connect(src_path) as src, sqlite3.connect(dest) as dst:
            src.backup(dst)
    else:
        dest = BACKUPS / f"et-{stamp}.dump"
        pg_dump = shutil.which("pg_dump")
        if not pg_dump:
            raise SystemExit("pg_dump not found: install the PostgreSQL client tools, or take a provider snapshot and rerun.")
        clean = url.replace("postgresql+psycopg://", "postgresql://").replace("postgres://", "postgresql://")
        subprocess.run([pg_dump, "--format=custom", "--file", str(dest), clean], check=True)  # noqa: S603
    kept = sorted(BACKUPS.glob("et-*"))
    for old in kept[:-5]:
        old.unlink()
    print(f"backup written: {dest}")
    return dest


def cmd_status() -> int:
    items = pending()
    print(f"database: {urlparse(get_settings().database_url).scheme}  pending migrations: {len(items)}")
    for rev, p in items:
        flag = " (DESTRUCTIVE)" if destructive_lines(p) else ""
        print(f"  {rev}  {p.name}{flag}")
    return 0


def cmd_plan() -> int:
    items = pending()
    hits = [h for _, p in items for h in destructive_lines(p)]
    if not items:
        print("nothing to migrate")
        return 0
    cmd_status()
    if not hits:
        print("no destructive steps: run `upgrade` (a backup is taken first)")
        PLAN_FILE.unlink(missing_ok=True)
        return 0
    code = f"{secrets.randbelow(1_000_000):06d}"
    PLAN_FILE.write_text(json.dumps({"digest": _digest(items), "code_sha256": hashlib.sha256(code.encode()).hexdigest(), "created": time.time()}))
    print("\nDestructive steps found:")
    for h in hits:
        print("  " + h)
    print(f"\nA human must review these, then run:\n  python -m app.store.migrate upgrade --approve {code}\nThe code works once, for exactly these files, for 15 minutes.")
    return 0


def cmd_upgrade(approve: str | None) -> int:
    items = pending()
    if not items:
        print("nothing to migrate")
        return 0
    hits = [h for _, p in items for h in destructive_lines(p)]
    if hits:
        if not approve:
            print("Refusing: pending migrations contain destructive SQL. Run `plan`, have a human review, then pass --approve <code>.")
            for h in hits:
                print("  " + h)
            return 3
        if not PLAN_FILE.exists():
            print("Refusing: no approval plan. Run `plan` first.")
            return 3
        plan = json.loads(PLAN_FILE.read_text())
        PLAN_FILE.unlink()  # one use, whatever happens next
        if time.time() - plan["created"] > PLAN_TTL_S:
            print("Refusing: the approval code expired. Run `plan` again.")
            return 3
        if plan["digest"] != _digest(items):
            print("Refusing: migration files changed after the plan was made. Run `plan` again.")
            return 3
        if not secrets.compare_digest(plan["code_sha256"], hashlib.sha256(approve.encode()).hexdigest()):
            print("Refusing: wrong approval code.")
            return 3
        if get_settings().is_prod:
            if not sys.stdin.isatty():
                print("Refusing: production destructive migrations must be confirmed by a person at a terminal.")
                return 3
            typed = input(f"Type the database host to confirm dropping data on {urlparse(get_settings().database_url).hostname}: ")
            if typed.strip() != (urlparse(get_settings().database_url).hostname or ""):
                print("Refusing: confirmation did not match.")
                return 3
    backup()
    command.upgrade(_cfg(), "head")
    print("migrated to head")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.store.migrate")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    sub.add_parser("plan")
    up = sub.add_parser("upgrade")
    up.add_argument("--approve", default=None)
    a = ap.parse_args(argv)
    if a.cmd == "status":
        return cmd_status()
    if a.cmd == "plan":
        return cmd_plan()
    return cmd_upgrade(a.approve)


if __name__ == "__main__":
    sys.exit(main())
