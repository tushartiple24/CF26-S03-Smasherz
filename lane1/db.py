"""
Postgres connection helper. Reads config from environment variables so
each teammate can point at their own local Postgres without editing code.

Env vars (with defaults for local dev):
    S03_DB_HOST     default "localhost"
    S03_DB_PORT     default "5432"
    S03_DB_NAME     default "s03_cascade"
    S03_DB_USER     default "postgres"
    S03_DB_PASSWORD default "postgres"
"""

import os
import contextlib
import psycopg2
import psycopg2.extras


def get_connection():
    return psycopg2.connect(
        host=os.environ.get("S03_DB_HOST", "localhost"),
        port=os.environ.get("S03_DB_PORT", "5432"),
        dbname=os.environ.get("S03_DB_NAME", "s03_cascade"),
        user=os.environ.get("S03_DB_USER", "postgres"),
        password=os.environ.get("S03_DB_PASSWORD", "postgres"),
    )


@contextlib.contextmanager
def get_cursor(commit: bool = False):
    """Yields a RealDictCursor (rows come back as dicts). Commits on
    success if commit=True, always closes the connection."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()