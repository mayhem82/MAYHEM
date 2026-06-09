# MAYHEM Agents

MAYHEM Agents is a memory-first evidence system.

Its first job is not to be clever. Its first job is to stop forgetting.

Core loop:

1. Find sources.
2. Read sources.
3. Store facts with provenance.
4. Retrieve prior facts.
5. Connect new facts to old patterns.

This directory is intentionally new and separate from any previous MAYHEM machinery.

## Agent set

- `source_agent.py` — loads source definitions and source material.
- `reader_agent.py` — extracts candidate factual claims from source text.
- `memory_agent.py` — stores sources, facts, tags, and links in SQLite.
- `pattern_agent.py` — connects related facts using tags and repeated terms.
- `run_agents.py` — command entry point for ingestion and recall.

## Storage

Runtime data is written to:

- `mayhem-agents/data/mayhem_agents.sqlite3`
- `mayhem-agents/memory/export/findings.jsonl`
- `mayhem-agents/memory/export/sources.jsonl`

## First principle

Every remembered fact must carry source provenance.

No source, no memory.
