#!/usr/bin/env python3
"""Load the source database URL used by export scripts."""

from __future__ import annotations

import os
import sys
from pathlib import Path


KEY_PRIORITY = [
    "DB_EXPORT_DATABASE_URL",
    "SOURCE_DATABASE_URL",
    "CLOUD_DB_URL",
    "DATABASE_URL",
]


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key] = value
    return values


def load_database_url(repo_root: Path) -> tuple[str, str] | None:
    env_local = parse_env_file(repo_root / ".env.local")
    migrate_env = parse_env_file(repo_root / "scripts/migrate-supabase/.env")

    sources: list[tuple[str, dict[str, str]]] = [
        ("environment", dict(os.environ)),
        (".env.local", env_local),
        ("scripts/migrate-supabase/.env", migrate_env),
    ]

    for key in KEY_PRIORITY:
        for source, values in sources:
            value = values.get(key, "").strip()
            if value:
                return key if source == "environment" else f"{key} from {source}", value

    return None


def main() -> int:
    repo_root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    found = load_database_url(repo_root)
    if not found:
        print(
            "No export database URL found. Set DB_EXPORT_DATABASE_URL or CLOUD_DB_URL for the source database.",
            file=sys.stderr,
        )
        return 1

    source, url = found
    print(f"{source}\t{url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
