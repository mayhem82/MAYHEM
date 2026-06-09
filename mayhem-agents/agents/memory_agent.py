import sqlite3
from pathlib import Path

DB_PATH = Path('mayhem-agents/data/mayhem_agents.sqlite3')

SCHEMA = '''
CREATE TABLE IF NOT EXISTS sources (
 id INTEGER PRIMARY KEY,
 source_name TEXT,
 source_url TEXT,
 retrieved_at TEXT,
 checksum TEXT
);

CREATE TABLE IF NOT EXISTS findings (
 id INTEGER PRIMARY KEY,
 title TEXT,
 fact_text TEXT,
 source_id INTEGER,
 tags TEXT,
 confidence REAL,
 created_at TEXT,
 FOREIGN KEY(source_id) REFERENCES sources(id)
);
'''


def initialize():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()

if __name__ == '__main__':
    initialize()
