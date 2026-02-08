import argparse
import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import os


FIELD_MAP = {
    "sender": ["from", "sender", "from_email", "from_address", "From"],
    "recipients": ["to", "recipients", "to_emails", "to_address", "to_addresses", "To"],
    "cc": ["cc", "cc_emails", "cc_address", "cc_addresses", "Cc", "CC"],
    "bcc": ["bcc", "bcc_emails", "bcc_address", "bcc_addresses", "Bcc", "BCC"],
    "subject": ["subject", "title", "Subject"],
    "body": ["body", "content", "text", "Body"],
    "timestamp": ["date", "sent_at", "timestamp", "sent", "Date"],
}

TOPIC_RULES = {
    "hiring": ["hiring", "interview", "candidate", "recruit"],
    "release": ["release", "launch", "deploy"],
    "bugfix": ["bug", "issue", "fix", "regression"],
    "pricing": ["pricing", "price", "quote"],
    "roadmap": ["roadmap", "plan", "milestone"],
    "onboarding": ["onboarding", "onboard", "orientation"],
    "security": ["security", "vuln", "incident"],
    "performance": ["latency", "performance", "slow"],
    "marketing_launch": ["campaign", "launch", "press", "webinar"],
    "enterprise_request": ["enterprise", "contract", "legal"],
}

CAPACITY_RULES = {
    "decision": ["approve", "decision", "deadline", "signoff"],
    "coordination": ["sync", "meeting", "align", "schedule"],
    "support": ["help", "issue", "blocking", "blocked"],
    "FYI": [],
}

# Set to None to process all records
MAX_RECORDS = 500

# LLM enrichment (optional)
LLM_MODE = "openai_compat"  # "off" | "openai_compat"
LLM_ENDPOINT = "https://api.openai.com/v1/chat/completions"
LLM_MODEL = "gpt-4o-mini"
LLM_API_KEY_ENV = "OPENAI_API_KEY"
LLM_TIMEOUT_SECONDS = 10
LLM_MAX_CALLS = 100
ENRON_DOMAIN = "enron.com"


@dataclass
class EmailRecord:
    sender: str
    recipients: list[str]
    subject: str
    body: str
    timestamp: datetime


def _first_key(record, keys):
    for k in keys:
        if k in record and record[k] not in (None, ""):
            return record[k]
    return None


def _as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        parts = re.split(r"[,;]", value)
        return [p.strip() for p in parts if p.strip()]
    return [str(value)]


def _extract_email(value):
    if isinstance(value, dict):
        for k in ["email", "address", "addr"]:
            if k in value:
                return str(value[k]).strip()
        return ""
    if isinstance(value, str):
        m = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", value)
        return m.group(0).strip() if m else value.strip()
    return str(value).strip()


def _parse_ts(value):
    if not value:
        return datetime.now(timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            try:
                return parsedate_to_datetime(value)
            except (TypeError, ValueError):
                return datetime.now(timezone.utc)
    return datetime.now(timezone.utc)


def _infer_topic(subject, body):
    text = f"{subject} {body}".lower()
    for topic, keywords in TOPIC_RULES.items():
        if any(k in text for k in keywords):
            return topic
    return "general"


def _infer_capacity(subject, body):
    text = f"{subject} {body}".lower()
    for cap, keywords in CAPACITY_RULES.items():
        if any(k in text for k in keywords):
            return cap
    return "FYI"


def _infer_name(email):
    local = email.split("@", 1)[0]
    parts = re.split(r"[._-]+", local)
    return " ".join(p.capitalize() for p in parts if p)


def _email_domain(email):
    return email.split("@", 1)[-1].lower() if "@" in email else ""


def _is_enron_sender(email):
    return _email_domain(email).endswith(ENRON_DOMAIN)


def _llm_enrich(record: "EmailRecord"):
    if LLM_MODE != "openai_compat":
        return {
            "role": "Unknown",
            "team": "Unknown",
            "task_title": "Unknown",
            "task_description": "Unknown",
        }

    api_key = os.getenv(LLM_API_KEY_ENV)
    if not api_key:
        print("LLM disabled: OPENAI_API_KEY not set.")
        return {
            "role": "Unknown",
            "team": "Unknown",
            "task_title": "Unknown",
            "task_description": "Unknown",
        }

    system = (
        "You extract roles, teams, and task candidates from email text. "
        "If unknown, return 'Unknown'. Return only JSON."
    )
    user = (
        f"From: {record.sender}\n"
        f"To: {', '.join(record.recipients)}\n"
        f"Subject: {record.subject}\n"
        f"Body: {record.body[:2000]}"
    )
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
    }
    req = Request(
        LLM_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        print("LLM call...")
        with urlopen(req, timeout=LLM_TIMEOUT_SECONDS) as resp:
            body = resp.read().decode("utf-8")
        data = json.loads(body)
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        return {
            "role": parsed.get("role", "Unknown") or "Unknown",
            "team": parsed.get("team", "Unknown") or "Unknown",
            "task_title": parsed.get("task_title", "Unknown") or "Unknown",
            "task_description": parsed.get("task_description", "Unknown") or "Unknown",
        }
    except HTTPError as exc:
        err_body = exc.read().decode("utf-8") if exc.fp else ""
        print(f"LLM HTTP error: {exc.code} {exc.reason} {err_body}")
    except URLError as exc:
        print(f"LLM URL error: {exc.reason}")
    except Exception as exc:
        print(f"LLM error: {exc}")
        return {
            "role": "Unknown",
            "team": "Unknown",
            "task_title": "Unknown",
            "task_description": "Unknown",
        }


def _iter_json_array(fp):
    decoder = json.JSONDecoder()
    buffer = ""
    in_array = False
    while True:
        chunk = fp.read(65536)
        if not chunk:
            break
        buffer += chunk
        while True:
            buffer = buffer.lstrip()
            if not in_array:
                if buffer.startswith("["):
                    buffer = buffer[1:]
                    in_array = True
                else:
                    break
            if buffer.startswith("]"):
                return
            try:
                obj, idx = decoder.raw_decode(buffer)
            except json.JSONDecodeError:
                break
            yield obj
            buffer = buffer[idx:].lstrip()
            if buffer.startswith(","):
                buffer = buffer[1:]


def _iter_jsonl(fp):
    for line in fp:
        line = line.strip()
        if line:
            yield json.loads(line)


def iter_records(path: Path):
    with path.open("r", encoding="utf-8") as fp:
        first = ""
        while True:
            ch = fp.read(1)
            if not ch:
                break
            if not ch.isspace():
                first = ch
                break

        fp.seek(0)
        if first == "[":
            records_iter = _iter_json_array(fp)
        elif first == "{":
            data = json.load(fp)
            if isinstance(data, dict):
                flat = []
                for v in data.values():
                    if isinstance(v, list):
                        flat.extend(v)
                    elif isinstance(v, dict):
                        flat.append(v)
                records_iter = flat
            else:
                records_iter = data
        else:
            records_iter = _iter_jsonl(fp)

        for rec in records_iter:
            sender_raw = _first_key(rec, FIELD_MAP["sender"]) or ""
            to_raw = _first_key(rec, FIELD_MAP["recipients"]) or []
            cc_raw = _first_key(rec, FIELD_MAP["cc"]) or []
            bcc_raw = _first_key(rec, FIELD_MAP["bcc"]) or []
            subject = _first_key(rec, FIELD_MAP["subject"]) or "(no subject)"
            body = _first_key(rec, FIELD_MAP["body"]) or ""
            ts_raw = _first_key(rec, FIELD_MAP["timestamp"]) or ""

            sender = _extract_email(sender_raw)
            recipients = [
                _extract_email(v)
                for v in (_as_list(to_raw) + _as_list(cc_raw) + _as_list(bcc_raw))
            ]
            recipients = [r for r in recipients if r and r != sender]
            if not sender or not recipients:
                continue
            if not _is_enron_sender(sender):
                continue

            yield EmailRecord(
                sender=sender,
                recipients=recipients,
                subject=str(subject),
                body=str(body),
                timestamp=_parse_ts(ts_raw),
            )


def ensure_schema(conn: sqlite3.Connection):
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL,
            team TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            discord_handle TEXT UNIQUE NOT NULL,
            manager_id INTEGER,
            location TEXT NOT NULL,
            start_date DATE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS comm_events (
            id INTEGER PRIMARY KEY,
            timestamp DATETIME NOT NULL,
            from_employee_id INTEGER NOT NULL,
            to_employee_id INTEGER NOT NULL,
            channel TEXT NOT NULL,
            capacity TEXT NOT NULL,
            topic TEXT NOT NULL,
            summary TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS comm_edges (
            id INTEGER PRIMARY KEY,
            from_employee_id INTEGER NOT NULL,
            to_employee_id INTEGER NOT NULL,
            channel TEXT NOT NULL,
            capacity TEXT NOT NULL,
            weight REAL NOT NULL,
            message_count_30d INTEGER NOT NULL,
            last_interaction_at DATETIME NOT NULL,
            topics TEXT NOT NULL,
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS boards (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            owner_id INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS board_columns (
            id INTEGER PRIMARY KEY,
            board_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            order_index INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL,
            priority TEXT NOT NULL,
            assignee_id INTEGER,
            reporter_id INTEGER NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            due_date DATE,
            labels TEXT NOT NULL,
            related_topic TEXT NOT NULL,
            parent_board_id INTEGER
        );

        CREATE TABLE IF NOT EXISTS board_cards (
            id INTEGER PRIMARY KEY,
            board_id INTEGER NOT NULL,
            task_id INTEGER NOT NULL,
            column_id INTEGER NOT NULL,
            order_index INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS inferred_employee (
            id INTEGER PRIMARY KEY,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            team TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS inferred_tasks (
            id INTEGER PRIMARY KEY,
            email TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL
        );
        """
    )


def seed_from_emails(conn: sqlite3.Connection, records_iter, max_records: int | None):
    employee_id = {}
    first_seen = {}

    def get_employee_id(email: str, ts: datetime) -> int:
        if email in employee_id:
            if ts < first_seen[email]:
                first_seen[email] = ts
            return employee_id[email]

        name = _infer_name(email)
        discord_handle = email
        emp = (
            name or email,
            "Unknown",
            "Unknown",
            email,
            discord_handle,
            None,
            "Unknown",
            ts.date().isoformat(),
        )
        cur = conn.execute(
            """
            INSERT INTO employees (full_name, role, team, email, discord_handle, manager_id, location, start_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            emp,
        )
        emp_id = int(cur.lastrowid)
        employee_id[email] = emp_id
        first_seen[email] = ts
        return emp_id

    events_batch = []
    edge_map = {}
    max_ts = None
    processed = 0
    llm_calls = 0
    for rec in records_iter:
        if llm_calls < LLM_MAX_CALLS:
            llm = _llm_enrich(rec)
            llm_calls += 1
        else:
            llm = {
                "role": "Unknown",
                "team": "Unknown",
                "task_title": "Unknown",
                "task_description": "Unknown",
            }
        from_id = get_employee_id(rec.sender, rec.timestamp)
        for r in rec.recipients:
            to_id = get_employee_id(r, rec.timestamp)
            topic = _infer_topic(rec.subject, rec.body)
            capacity = _infer_capacity(rec.subject, rec.body)
            summary = rec.subject if rec.subject else rec.body[:120]
            events_batch.append(
                (
                    rec.timestamp.isoformat(),
                    from_id,
                    to_id,
                    "email",
                    capacity,
                    topic,
                    summary,
                )
            )
            key = (from_id, to_id, "email", capacity)
            entry = edge_map.get(key)
            if not entry:
                edge_map[key] = {"count": 0, "last": rec.timestamp, "topics": set()}
                entry = edge_map[key]
            entry["count"] += 1
            if rec.timestamp > entry["last"]:
                entry["last"] = rec.timestamp
            entry["topics"].add(topic)
            if not max_ts or rec.timestamp > max_ts:
                max_ts = rec.timestamp

        if len(events_batch) >= 1000:
            conn.executemany(
                """
                INSERT INTO comm_events (timestamp, from_employee_id, to_employee_id, channel, capacity, topic, summary)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                events_batch,
            )
            events_batch = []

        conn.execute(
            """
            INSERT INTO inferred_employee (email, role, team)
            VALUES (?, ?, ?)
            """,
            (rec.sender, llm["role"], llm["team"]),
        )
        conn.execute(
            """
            INSERT INTO inferred_tasks (email, title, description)
            VALUES (?, ?, ?)
            """,
            (rec.sender, llm["task_title"], llm["task_description"]),
        )

        processed += 1
        if processed % 50 == 0:
            print(f"Processed {processed} records")
        if max_records is not None and processed >= max_records:
            break

    if events_batch:
        conn.executemany(
            """
            INSERT INTO comm_events (timestamp, from_employee_id, to_employee_id, channel, capacity, topic, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            events_batch,
        )

    conn.commit()

    now = max_ts or datetime.now(timezone.utc)
    for (from_id, to_id, channel, capacity), entry in edge_map.items():
        last_dt = entry["last"]
        days_ago = (now - last_dt).days
        recency = 1.0 if days_ago <= 30 else 0.5
        weight = round(entry["count"] * recency, 3)
        conn.execute(
            """
            INSERT INTO comm_edges (from_employee_id, to_employee_id, channel, capacity, weight, message_count_30d, last_interaction_at, topics, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                from_id,
                to_id,
                channel,
                capacity,
                weight,
                entry["count"],
                last_dt.isoformat(),
                json.dumps(sorted(entry["topics"])),
                "Auto-aggregated from comm_events",
            ),
        )

    conn.commit()


def main():
    parser = argparse.ArgumentParser(description="Onboarding email ingestion pipeline")
    parser.add_argument("--input", required=True, help="Path to email JSON or JSONL dataset")
    parser.add_argument("--output", default="onboarding/data/onboarding.db", help="Output SQLite DB path")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing DB")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Input not found: {input_path}")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() and args.overwrite:
        output_path.unlink()

    records_iter = iter_records(input_path)
    first = next(records_iter, None)
    if not first:
        raise SystemExit("No records loaded. Check input format or field mapping.")

    conn = sqlite3.connect(str(output_path))
    try:
        ensure_schema(conn)
        from itertools import chain
        seed_from_emails(conn, chain([first], records_iter), MAX_RECORDS)
    finally:
        conn.close()

    print(f"Wrote SQLite DB to {output_path}")


if __name__ == "__main__":
    main()
