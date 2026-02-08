# Onboarding Pipeline (Proof of Concept)

This folder contains a decoupled, minimal pipeline to ingest a Kaggle email dataset (JSON/JSONL) and populate a SQLite database with the **same schema** as `backend/data/org.db`.

## What It Does
- Reads a JSON or JSONL email dataset
- Infers employees from email addresses
- Builds `comm_events` and aggregates `comm_edges`
- Writes a SQLite DB at `onboarding/data/onboarding.db`

## Usage
```bash
python -m onboarding.pipeline --input path\to\emails.json
```

Optional flags:
```bash
python -m onboarding.pipeline --input path\to\emails.json --output onboarding\data\onboarding.db --overwrite
```

## Expected Input (Flexible)
The loader tries common fields:
- sender: `from`, `sender`, `from_email`
- recipients: `to`, `recipients`, `to_emails`, `cc`, `bcc`
- subject: `subject`, `title`
- body: `body`, `content`, `text`
- timestamp: `date`, `sent_at`, `timestamp`

JSON can be an array or JSON Lines (one JSON object per line).
The pipeline also supports a dict-of-threads format (like `threaded_emails.json`).

## Notes
- This is a proof of concept; topics/capacity are inferred by simple keyword rules.
- If your dataset has different keys, update `FIELD_MAP` in `onboarding/pipeline.py`.
- The loader supports large JSON arrays by streaming records (no full-file load).
- To limit ingestion size, set `MAX_RECORDS` in `onboarding/pipeline.py` (set to `None` for all).
- Only emails **from** `enron.com` senders are ingested.
- Optional LLM enrichment can be enabled in `onboarding/pipeline.py` (`LLM_MODE`, `LLM_ENDPOINT`, `LLM_MODEL`). When disabled, role/team/task are set to `Unknown`.

## Enron Dataset Example
If you used KaggleHub, the files are typically here:
`C:\Users\hannes\.cache\kagglehub\datasets\jivfur\enron-emails\versions\2`

Example:
```bash
python -m onboarding.pipeline --input "C:\Users\hannes\.cache\kagglehub\datasets\jivfur\enron-emails\versions\2\cleaned_enron_emails.json" --overwrite
```
