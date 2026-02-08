import json
import random
from datetime import date, datetime, timedelta
from pathlib import Path

from .db import Base, engine, SessionLocal, DATA_DIR
from .models import (
    Employee,
    CommEvent,
    CommEdge,
    Board,
    BoardColumn,
    Task,
    BoardCard,
)


def seed_employees(session):
    employees = [
        (1, "Helena Richter", "CEO", "Exec", "helena.richter@acme.com", "helena.ceo", None, "Munich", date(2017, 4, 3)),
        (2, "Lukas Vogel", "CTO", "Exec", "lukas.vogel@acme.com", "lukas.cto", 1, "Berlin", date(2018, 1, 15)),
        (3, "Ava Mueller", "SWE", "Engineering", "ava.mueller@acme.com", "ava.eng", 2, "Munich", date(2019, 6, 1)),
        (4, "Noah Stein", "SWE", "Engineering", "noah.stein@acme.com", "noah.eng", 2, "Berlin", date(2020, 2, 10)),
        (5, "Maya Ortiz", "SWE", "Engineering", "maya.ortiz@acme.com", "maya.eng", 2, "Remote", date(2020, 9, 7)),
        (6, "Liam Chen", "SWE", "Engineering", "liam.chen@acme.com", "liam.eng", 2, "Berlin", date(2021, 3, 8)),
        (7, "Priya Nair", "SWE", "Engineering", "priya.nair@acme.com", "priya.eng", 2, "Munich", date(2021, 7, 12)),
        (8, "Ethan Brooks", "SWE", "Engineering", "ethan.brooks@acme.com", "ethan.eng", 2, "Remote", date(2022, 1, 17)),
        (9, "Sofia Park", "SWE", "Engineering", "sofia.park@acme.com", "sofia.eng", 2, "Munich", date(2022, 5, 2)),
        (10, "Jonas Weber", "SWE", "Engineering", "jonas.weber@acme.com", "jonas.eng", 2, "Berlin", date(2022, 8, 22)),
        (11, "Emma Fischer", "SWE", "Engineering", "emma.fischer@acme.com", "emma.eng", 2, "Remote", date(2023, 1, 9)),
        (12, "David Klein", "SWE", "Engineering", "david.klein@acme.com", "david.eng", 2, "Munich", date(2023, 6, 5)),
        (13, "Lea Hoffmann", "HR", "People", "lea.hoffmann@acme.com", "lea.hr", 1, "Munich", date(2019, 2, 4)),
        (14, "Tobias Berg", "HR", "People", "tobias.berg@acme.com", "tobias.hr", 1, "Berlin", date(2021, 11, 1)),
        (15, "Nina Schaefer", "Marketing", "Growth", "nina.schaefer@acme.com", "nina.mktg", 1, "Berlin", date(2019, 9, 16)),
        (16, "Felix Braun", "Marketing", "Growth", "felix.braun@acme.com", "felix.mktg", 1, "Munich", date(2020, 4, 20)),
        (17, "Clara Wolf", "Marketing", "Growth", "clara.wolf@acme.com", "clara.mktg", 1, "Remote", date(2021, 6, 28)),
        (18, "Oliver Hahn", "Sales", "Revenue", "oliver.hahn@acme.com", "oliver.sales", 1, "Berlin", date(2018, 11, 5)),
        (19, "Mia Schubert", "Sales", "Revenue", "mia.schubert@acme.com", "mia.sales", 1, "Munich", date(2020, 10, 12)),
        (20, "Samuel Koch", "Sales", "Revenue", "samuel.koch@acme.com", "samuel.sales", 1, "Remote", date(2022, 2, 14)),
    ]

    for e in employees:
        session.add(
            Employee(
                id=e[0],
                full_name=e[1],
                role=e[2],
                team=e[3],
                email=e[4],
                discord_handle=e[5],
                manager_id=e[6],
                location=e[7],
                start_date=e[8],
            )
        )


def seed_comm_events_and_edges(session):
    random.seed(42)
    now = datetime.utcnow()

    channels = ["email", "discord", "meeting", "docs"]
    capacities = ["FYI", "decision", "coordination", "support", "escalation"]
    topics = [
        "hiring",
        "release",
        "bugfix",
        "pricing",
        "roadmap",
        "onboarding",
        "security",
        "performance",
        "marketing_launch",
        "enterprise_request",
    ]

    def add_event(frm, to, channel, capacity, topic, summary, days_ago):
        session.add(
            CommEvent(
                timestamp=now - timedelta(days=days_ago),
                from_employee_id=frm,
                to_employee_id=to,
                channel=channel,
                capacity=capacity,
                topic=topic,
                summary=summary,
            )
        )

    engineers = list(range(3, 13))
    for e in engineers:
        add_event(e, 2, "discord", "coordination", "release", "Align on sprint priorities", random.randint(1, 20))
        add_event(2, e, "email", "FYI", "roadmap", "CTO update to engineer", random.randint(1, 25))

    for i, e1 in enumerate(engineers):
        for e2 in engineers[i + 1 :]:
            if random.random() < 0.35:
                add_event(e1, e2, "discord", "support", "bugfix", "Pair debugging session", random.randint(1, 30))

    sales = [18, 19, 20]
    for s in sales:
        add_event(s, 1, "email", "decision", "pricing", "Customer pricing escalation", random.randint(1, 15))
        add_event(1, s, "meeting", "decision", "pricing", "Pricing decision alignment", random.randint(1, 20))
        eng = random.choice(engineers)
        add_event(s, eng, "email", "coordination", "enterprise_request", "Feature request from prospect", random.randint(1, 25))

    marketing = [15, 16, 17]
    for m in marketing:
        add_event(m, 1, "meeting", "coordination", "marketing_launch", "Launch planning sync", random.randint(1, 20))
        add_event(m, random.choice(sales), "email", "FYI", "marketing_launch", "Campaign asset share", random.randint(1, 25))
        add_event(m, random.choice(engineers), "docs", "support", "performance", "Landing page perf review", random.randint(1, 28))

    hr = [13, 14]
    for h in hr:
        add_event(h, 1, "meeting", "decision", "hiring", "Headcount review", random.randint(1, 20))
        add_event(h, 2, "email", "coordination", "hiring", "Role intake alignment", random.randint(1, 25))
        for e in engineers:
            if random.random() < 0.25:
                add_event(h, e, "email", "support", "onboarding", "Onboarding check-in", random.randint(1, 30))

    add_event(1, 2, "meeting", "decision", "roadmap", "Exec alignment on roadmap", random.randint(1, 10))
    add_event(2, 1, "email", "FYI", "release", "CTO weekly update", random.randint(1, 12))
    add_event(1, 2, "discord", "coordination", "performance", "Follow-up on perf risks", random.randint(1, 15))
    add_event(2, 1, "meeting", "decision", "security", "Security posture review", random.randint(1, 18))

    session.flush()
    events = session.query(CommEvent).all()
    edge_map = {}

    for ev in events:
        key = (ev.from_employee_id, ev.to_employee_id, ev.channel, ev.capacity)
        entry = edge_map.get(key)
        if not entry:
            edge_map[key] = {
                "from_employee_id": ev.from_employee_id,
                "to_employee_id": ev.to_employee_id,
                "channel": ev.channel,
                "capacity": ev.capacity,
                "message_count": 0,
                "last_interaction": ev.timestamp,
                "topics": set(),
            }
            entry = edge_map[key]
        entry["message_count"] += 1
        entry["topics"].add(ev.topic)
        if ev.timestamp > entry["last_interaction"]:
            entry["last_interaction"] = ev.timestamp

    for entry in edge_map.values():
        days_ago = max(0, (now - entry["last_interaction"]).days)
        recency_factor = max(0.1, 1.0 - (days_ago / 30.0))
        weight = float(entry["message_count"]) * recency_factor
        session.add(
            CommEdge(
                from_employee_id=entry["from_employee_id"],
                to_employee_id=entry["to_employee_id"],
                channel=entry["channel"],
                capacity=entry["capacity"],
                weight=round(weight, 3),
                message_count_30d=entry["message_count"],
                last_interaction_at=entry["last_interaction"],
                topics=json.dumps(sorted(entry["topics"])),
                notes="Auto-aggregated from comm_events",
            )
        )


def seed_boards_and_tasks(session):
    random.seed(42)
    now = datetime.utcnow()

    boards = [
        Board(name="Platform Jira", description="Engineering delivery board", owner_id=2),
        Board(name="Go-to-Market", description="Launch and revenue board", owner_id=1),
    ]
    session.add_all(boards)
    session.flush()

    columns = ["Backlog", "Todo", "In Progress", "Blocked", "Done"]
    board_columns = []
    for b in boards:
        for idx, name in enumerate(columns):
            board_columns.append(BoardColumn(board_id=b.id, name=name, order_index=idx))
    session.add_all(board_columns)
    session.flush()

    def mk_task(title, description, status, priority, assignee_id, reporter_id, due_days, labels, related_topic, board_id):
        created = now - timedelta(days=random.randint(5, 60))
        updated = created + timedelta(days=random.randint(0, 10))
        due = None if due_days is None else (date.today() + timedelta(days=due_days))
        return Task(
            title=title,
            description=description,
            status=status,
            priority=priority,
            assignee_id=assignee_id,
            reporter_id=reporter_id,
            created_at=created,
            updated_at=updated,
            due_date=due,
            labels=json.dumps(labels),
            related_topic=related_topic,
            parent_board_id=board_id,
        )

    for emp_id in range(1, 21):
        task = mk_task(
            title=f"Personal task for {emp_id}",
            description="Follow up on quarterly goals and team alignment.",
            status=random.choice(["todo", "in_progress", "done"]),
            priority=random.choice(["low", "medium", "high"]),
            assignee_id=emp_id,
            reporter_id=1,
            due_days=random.randint(3, 30),
            labels=["personal"],
            related_topic="Quarterly Alignment",
            board_id=None,
        )
        session.add(task)

    session.flush()

    eng_tasks = [
        ("Refactor auth service", "Break auth monolith into services.", "in_progress", "high", 3),
        ("Improve build times", "Cache dependencies and parallelize jobs.", "todo", "medium", 4),
        ("Fix flaky tests", "Stabilize integration tests. Reason: env mismatch.", "blocked", "high", 5),
        ("Add billing webhook", "Integrate payment provider webhook.", "todo", "urgent", None),
        ("Oncall runbook", "Document incident response steps.", "done", "medium", 6),
        ("DB migration plan", "Prepare schema migration for new users.", "in_progress", "high", 7),
        ("Security review", "Threat model API changes.", "blocked", "urgent", 5),
        ("Release 1.4", "Finalize release checklist.", "in_progress", "high", 8),
        ("Edge caching", "Add CDN caching for assets.", "todo", "medium", 9),
        ("Feature flags", "Rollout strategy for new UI.", "todo", "low", 10),
        ("API pagination", "Add pagination to search API.", "in_progress", "medium", 11),
        ("SLO dashboard", "Expose latency SLO dashboard.", "todo", "low", 12),
        ("Bug triage", "Weekly bug triage process.", "done", "low", 3),
        ("Infra costs", "Investigate cloud cost spikes.", "in_progress", "high", 4),
        ("SDK update", "Update client SDK to v2.", "todo", "medium", 6),
        ("Backup policy", "Define backup and restore policy.", "blocked", "high", 7),
        ("Service limits", "Set rate limits for public API.", "todo", "medium", None),
        ("Search relevance", "Tune ranking signals.", "in_progress", "medium", 8),
        ("Access logs", "Ship audit logs for enterprise.", "todo", "urgent", None),
        ("Incident postmortem", "Write postmortem for outage.", "done", "medium", 9),
    ]

    eng_board = boards[0]
    for title, desc, status, priority, assignee in eng_tasks:
        task = mk_task(
            title=title,
            description=desc + (" Blocked due to dependency." if status == "blocked" else ""),
            status=status,
            priority=priority,
            assignee_id=assignee,
            reporter_id=2,
            due_days=random.randint(5, 45),
            labels=["engineering", f"depends:{random.choice(['API', 'SEC', 'OPS'])}"] if status == "blocked" else ["engineering"],
            related_topic="Release 1.4",
            board_id=eng_board.id,
        )
        session.add(task)

    session.flush()

    gtm_tasks = [
        ("Launch webinar", "Plan webinar with key customers.", "todo", "high", 15),
        ("Pricing page update", "Revise pricing copy for enterprise.", "in_progress", "high", 16),
        ("Sales enablement", "Create battlecards for new features.", "in_progress", "medium", 18),
        ("Press outreach", "Pitch launch to tech press.", "todo", "medium", 17),
        ("Customer case study", "Draft case study with Acme Corp.", "blocked", "high", 19),
        ("Product demo", "Record updated demo video.", "done", "medium", 20),
        ("Campaign tracking", "UTM plan for launch.", "todo", "low", 15),
        ("Partner brief", "One-pager for channel partners.", "in_progress", "medium", 16),
        ("Lead routing", "Improve lead assignment rules.", "todo", "medium", 18),
        ("Launch checklist", "Cross-team checklist for launch.", "in_progress", "high", 1),
        ("Website refresh", "Update homepage messaging.", "todo", "medium", 17),
        ("NPS survey", "Prepare post-launch survey.", "done", "low", 15),
        ("Sales training", "Train sales on new positioning.", "blocked", "urgent", 18),
        ("Event booth", "Book booth for industry event.", "todo", "medium", 19),
        ("Customer webinar follow-up", "Send follow-up materials.", "in_progress", "low", 20),
    ]

    gtm_board = boards[1]
    for title, desc, status, priority, assignee in gtm_tasks:
        task = mk_task(
            title=title,
            description=desc + (" Blocked awaiting approval." if status == "blocked" else ""),
            status=status,
            priority=priority,
            assignee_id=assignee,
            reporter_id=1,
            due_days=random.randint(5, 40),
            labels=["gtm", f"depends:{random.choice(['LEGAL', 'FIN', 'ENG'])}"] if status == "blocked" else ["gtm"],
            related_topic="Launch Q2",
            board_id=gtm_board.id,
        )
        session.add(task)

    session.flush()

    tasks = session.query(Task).filter(Task.parent_board_id.isnot(None)).all()
    col_map = {}
    for c in board_columns:
        col_map[(c.board_id, c.name)] = c.id

    order_index = 0
    for t in tasks:
        col_name = {
            "todo": "Todo",
            "in_progress": "In Progress",
            "blocked": "Blocked",
            "done": "Done",
        }.get(t.status, "Backlog")
        session.add(
            BoardCard(
                board_id=t.parent_board_id,
                task_id=t.id,
                column_id=col_map[(t.parent_board_id, col_name)],
                order_index=order_index,
            )
        )
        order_index += 1


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    try:
        seed_employees(session)
        seed_comm_events_and_edges(session)
        seed_boards_and_tasks(session)
        session.commit()
    finally:
        session.close()

    print(f"Seeded database at {DATA_DIR / 'org.db'}")


if __name__ == "__main__":
    main()
