#!/usr/bin/env python3
"""Validate PostgreSQL URLs before handing them to libpq tools.

libpq treats the first unescaped "@" as the end of userinfo. A URI containing
multiple unescaped "@" characters is ambiguous in practice: it may mean the
password contains "@" and needs percent-encoding, or it may mean the connection
string was copied in the wrong shape. Refuse to guess.
"""

from __future__ import annotations

import sys
from urllib.parse import urlsplit


POSTGRES_SCHEMES = {"postgres", "postgresql"}


def count_unescaped_at(value: str) -> int:
    count = 0
    i = 0
    while i < len(value):
        char = value[i]
        if char == "%":
            i += 3
            continue
        if char == "@":
            count += 1
        i += 1
    return count


def normalize_database_url(raw_url: str) -> str:
    url = raw_url.strip()
    if not url:
        return url

    if count_unescaped_at(url) > 1:
        print(
            "DATABASE_URL contains multiple unescaped @ characters.\n"
            "Use %40 if @ is part of the password, or remove the extra segment if it is not.\n"
            "Examples:\n"
            "  postgresql://postgres:pass%40word@db.example.com:5432/postgres\n"
            "  postgresql://postgres:password@db.example.com:5432/postgres",
            file=sys.stderr,
        )
        raise SystemExit(2)

    parsed = urlsplit(url)
    if parsed.scheme not in POSTGRES_SCHEMES or not parsed.netloc or "@" not in parsed.netloc:
        return url

    try:
        host = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise SystemExit(f"Invalid PostgreSQL DATABASE_URL: {exc}") from exc

    return url


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: normalize-database-url.py DATABASE_URL", file=sys.stderr)
        return 2

    print(normalize_database_url(sys.argv[1]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
