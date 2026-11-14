import json, sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from .config import DB_PATH, ROOT

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    try:
        yield c
        c.commit()
    finally:
        c.close()

def init_db():
    with conn() as c:
        c.executescript((ROOT / "sql" / "schema.sql").read_text(encoding="utf-8"))
    from .data.seed import seed
    seed()

def dumps(o):
    return json.dumps(o, ensure_ascii=False)
