import argparse
from collections import defaultdict
from sqlalchemy import desc

from .db import SessionLocal
from .models import Employee, CommEdge, Task
from .graph import graph_summary


def graph_summary_cmd():
    session = SessionLocal()
    try:
        summary = graph_summary(session)
        print(f"Graph nodes: {summary['nodes']} edges: {summary['edges']}")
        print("Top 15 edges by weight:")
        edges = session.query(CommEdge).order_by(desc(CommEdge.weight)).limit(15).all()
        for e in edges:
            print(
                f"- {e.from_employee.full_name} -> {e.to_employee.full_name} "
                f"{e.channel}/{e.capacity} weight={e.weight:.2f} msgs={e.message_count_30d}"
            )

        print("\nTop 5 contacts per role:")
        employees = session.query(Employee).all()
        role_groups = defaultdict(list)
        for e in employees:
            role_groups[e.role].append(e.id)

        for role, ids in role_groups.items():
            contact_scores = defaultdict(float)
            edges = session.query(CommEdge).filter(CommEdge.from_employee_id.in_(ids)).all()
            for e in edges:
                contact_scores[e.to_employee_id] += e.weight
            top = sorted(contact_scores.items(), key=lambda x: x[1], reverse=True)[:5]
            names = []
            for emp_id, score in top:
                emp = session.query(Employee).filter(Employee.id == emp_id).first()
                if emp:
                    names.append(f"{emp.full_name} ({score:.2f})")
            print(f"- {role}: " + ", ".join(names))
    finally:
        session.close()


def tasks_summary():
    session = SessionLocal()
    try:
        print("Open tasks per role:")
        employees = session.query(Employee).all()
        role_by_id = {e.id: e.role for e in employees}
        counts = defaultdict(int)
        tasks = session.query(Task).filter(Task.status != "done").all()
        for t in tasks:
            if t.assignee_id:
                counts[role_by_id.get(t.assignee_id, "Unknown")] += 1
        for role, count in counts.items():
            print(f"- {role}: {count}")

        print("\nTop urgent tasks:")
        urgent = (
            session.query(Task)
            .filter(Task.priority == "urgent")
            .order_by(desc(Task.updated_at))
            .limit(10)
            .all()
        )
        for t in urgent:
            assignee = t.assignee.full_name if t.assignee else "Unassigned"
            print(f"- {t.title} ({assignee}) status={t.status}")
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description="Org CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("graph-summary")
    sub.add_parser("tasks-summary")
    args = parser.parse_args()

    if args.cmd == "graph-summary":
        graph_summary_cmd()
    elif args.cmd == "tasks-summary":
        tasks_summary()


if __name__ == "__main__":
    main()
