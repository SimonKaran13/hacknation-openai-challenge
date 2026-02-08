from datetime import datetime
import json

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import desc
from pydantic import BaseModel
from pathlib import Path

from .db import SessionLocal
from .models import (
    Employee,
    CommEdge,
    CommEvent,
    Task,
    Board,
    BoardColumn,
    BoardCard,
    ChangeLog,
)
from .graph import graph_summary, build_knowledge_graph, build_department_graph


app = FastAPI(title="Org Graph + Tasks")
BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


def get_session():
    return SessionLocal()


class CommEventIn(BaseModel):
    timestamp: datetime
    from_employee_id: int
    to_employee_id: int
    channel: str
    capacity: str
    topic: str
    summary: str


class EmployeeIn(BaseModel):
    full_name: str
    role: str
    team: str
    email: str
    discord_handle: str
    manager_id: int | None = None
    location: str
    start_date: str


class TaskIn(BaseModel):
    title: str
    description: str
    status: str
    priority: str
    assignee_id: int | None = None
    reporter_id: int
    due_date: str | None = None
    labels: list[str]
    related_topic: str
    parent_board_id: int | None = None


class ChangeLogIn(BaseModel):
    action: str
    entity_type: str
    entity_id: str | None = None
    before_json: dict | None = None
    after_json: dict | None = None
    evidence: str | None = None
    source: str




@app.get("/api/graph/employees")
def api_employees():
    session = get_session()
    try:
        employees = session.query(Employee).all()
        return [
            {
                "id": e.id,
                "full_name": e.full_name,
                "role": e.role,
                "team": e.team,
                "email": e.email,
                "discord_handle": e.discord_handle,
                "manager_id": e.manager_id,
                "location": e.location,
                "start_date": e.start_date.isoformat(),
            }
            for e in employees
        ]
    finally:
        session.close()


@app.post("/api/employees")
def api_create_employee(payload: EmployeeIn):
    session = get_session()
    try:
        emp = Employee(
            full_name=payload.full_name,
            role=payload.role,
            team=payload.team,
            email=payload.email,
            discord_handle=payload.discord_handle,
            manager_id=payload.manager_id,
            location=payload.location,
            start_date=datetime.fromisoformat(payload.start_date).date(),
        )
        session.add(emp)
        session.commit()
        session.refresh(emp)
        return {"id": emp.id}
    finally:
        session.close()


@app.delete("/api/employees/{employee_id}")
def api_delete_employee(employee_id: int):
    session = get_session()
    try:
        emp = session.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        session.delete(emp)
        session.commit()
        return {"status": "deleted"}
    finally:
        session.close()


@app.get("/api/graph/edges")
def api_edges():
    session = get_session()
    try:
        edges = session.query(CommEdge).order_by(desc(CommEdge.weight)).all()
        return [
            {
                "id": e.id,
                "from_employee_id": e.from_employee_id,
                "to_employee_id": e.to_employee_id,
                "channel": e.channel,
                "capacity": e.capacity,
                "weight": e.weight,
                "message_count_30d": e.message_count_30d,
                "last_interaction_at": e.last_interaction_at.isoformat(),
                "topics": json.loads(e.topics),
                "notes": e.notes,
            }
            for e in edges
        ]
    finally:
        session.close()


@app.post("/api/comm/events")
def api_create_comm_event(payload: CommEventIn):
    session = get_session()
    try:
        event = CommEvent(
            timestamp=payload.timestamp,
            from_employee_id=payload.from_employee_id,
            to_employee_id=payload.to_employee_id,
            channel=payload.channel,
            capacity=payload.capacity,
            topic=payload.topic,
            summary=payload.summary,
        )
        session.add(event)

        edge = (
            session.query(CommEdge)
            .filter(CommEdge.from_employee_id == payload.from_employee_id)
            .filter(CommEdge.to_employee_id == payload.to_employee_id)
            .filter(CommEdge.channel == payload.channel)
            .filter(CommEdge.capacity == payload.capacity)
            .first()
        )
        if edge:
            edge.message_count_30d += 1
            if payload.timestamp > edge.last_interaction_at:
                edge.last_interaction_at = payload.timestamp
            topics = set(json.loads(edge.topics))
            topics.add(payload.topic)
            edge.topics = json.dumps(sorted(topics))
            days_ago = (datetime.utcnow() - edge.last_interaction_at).days
            recency_factor = 1.0 if days_ago <= 30 else 0.5
            edge.weight = round(edge.message_count_30d * recency_factor, 3)
        else:
            edge = CommEdge(
                from_employee_id=payload.from_employee_id,
                to_employee_id=payload.to_employee_id,
                channel=payload.channel,
                capacity=payload.capacity,
                weight=1.0,
                message_count_30d=1,
                last_interaction_at=payload.timestamp,
                topics=json.dumps([payload.topic]),
                notes="Auto-aggregated from comm_events",
            )
            session.add(edge)

        session.commit()
        return {"status": "ok", "edge_id": edge.id}
    finally:
        session.close()


@app.get("/graph", response_class=HTMLResponse)
def graph_view(request: Request, employee_id: int | None = None):
    session = get_session()
    try:
        employees = session.query(Employee).all()
        top_edges = (
            session.query(CommEdge).order_by(desc(CommEdge.weight)).limit(20).all()
        )
        summary = graph_summary(session)

        top_contacts = []
        if employee_id:
            top_contacts = (
                session.query(CommEdge)
                .filter(CommEdge.from_employee_id == employee_id)
                .order_by(desc(CommEdge.weight))
                .limit(10)
                .all()
            )

        return templates.TemplateResponse(
            "graph.html",
            {
                "request": request,
                "employees": employees,
                "top_edges": top_edges,
                "top_contacts": top_contacts,
                "selected_employee_id": employee_id,
                "summary": summary,
            },
        )
    finally:
        session.close()


@app.get("/graph/viz", response_class=HTMLResponse)
def graph_viz(request: Request):
    return templates.TemplateResponse("graph_viz.html", {"request": request})


@app.get("/graph/departments", response_class=HTMLResponse)
def graph_departments(request: Request):
    return templates.TemplateResponse("graph_departments.html", {"request": request})

@app.get("/api/graph/summary")
def api_graph_summary():
    session = get_session()
    try:
        return graph_summary(session)
    finally:
        session.close()


@app.get("/api/graph/knowledge")
def api_graph_knowledge():
    session = get_session()
    try:
        G = build_knowledge_graph(session)
        nodes = [
            {"id": n, **G.nodes[n]}
            for n in G.nodes
        ]
        edges = [
            {"source": u, "target": v, **data}
            for u, v, data in G.edges(data=True)
        ]
        return {"nodes": nodes, "edges": edges}
    finally:
        session.close()


@app.get("/api/graph/departments")
def api_graph_departments():
    session = get_session()
    try:
        return build_department_graph(session)
    finally:
        session.close()


@app.get("/api/tasks")
def api_tasks():
    session = get_session()
    try:
        tasks = session.query(Task).all()
        return [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "status": t.status,
                "priority": t.priority,
                "assignee_id": t.assignee_id,
                "reporter_id": t.reporter_id,
                "created_at": t.created_at.isoformat(),
                "updated_at": t.updated_at.isoformat(),
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "labels": json.loads(t.labels),
                "related_topic": t.related_topic,
                "parent_board_id": t.parent_board_id,
            }
            for t in tasks
        ]
    finally:
        session.close()


@app.post("/api/tasks")
def api_create_task(payload: TaskIn):
    session = get_session()
    try:
        task = Task(
            title=payload.title,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            assignee_id=payload.assignee_id,
            reporter_id=payload.reporter_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            due_date=datetime.fromisoformat(payload.due_date).date() if payload.due_date else None,
            labels=json.dumps(payload.labels),
            related_topic=payload.related_topic,
            parent_board_id=payload.parent_board_id,
        )
        session.add(task)
        session.commit()
        session.refresh(task)
        return {"id": task.id}
    finally:
        session.close()


@app.put("/api/tasks/{task_id}")
def api_update_task(task_id: int, payload: TaskIn):
    session = get_session()
    try:
        task = session.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        task.title = payload.title
        task.description = payload.description
        task.status = payload.status
        task.priority = payload.priority
        task.assignee_id = payload.assignee_id
        task.reporter_id = payload.reporter_id
        task.updated_at = datetime.utcnow()
        task.due_date = datetime.fromisoformat(payload.due_date).date() if payload.due_date else None
        task.labels = json.dumps(payload.labels)
        task.related_topic = payload.related_topic
        task.parent_board_id = payload.parent_board_id
        session.commit()
        return {"status": "updated"}
    finally:
        session.close()


@app.get("/api/boards")
def api_boards():
    session = get_session()
    try:
        boards = session.query(Board).all()
        return [
            {
                "id": b.id,
                "name": b.name,
                "description": b.description,
                "owner_id": b.owner_id,
            }
            for b in boards
        ]
    finally:
        session.close()


@app.get("/api/boards/{board_id}")
def api_board(board_id: int):
    session = get_session()
    try:
        board = session.query(Board).filter(Board.id == board_id).first()
        if not board:
            return JSONResponse(status_code=404, content={"error": "Board not found"})

        columns = (
            session.query(BoardColumn)
            .filter(BoardColumn.board_id == board_id)
            .order_by(BoardColumn.order_index)
            .all()
        )
        cards = (
            session.query(BoardCard)
            .filter(BoardCard.board_id == board_id)
            .order_by(BoardCard.order_index)
            .all()
        )

        return {
            "board": {
                "id": board.id,
                "name": board.name,
                "description": board.description,
                "owner_id": board.owner_id,
            },
            "columns": [{"id": c.id, "name": c.name} for c in columns],
            "cards": [
                {
                    "id": c.id,
                    "task_id": c.task_id,
                    "column_id": c.column_id,
                    "order_index": c.order_index,
                }
                for c in cards
            ],
        }
    finally:
        session.close()


@app.get("/api/change-log")
def api_change_log():
    session = get_session()
    try:
        entries = session.query(ChangeLog).order_by(desc(ChangeLog.created_at)).all()
        return [
            {
                "id": e.id,
                "action": e.action,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "before_json": json.loads(e.before_json) if e.before_json else None,
                "after_json": json.loads(e.after_json) if e.after_json else None,
                "evidence": e.evidence,
                "source": e.source,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ]
    finally:
        session.close()


@app.post("/api/change-log")
def api_create_change_log(payload: ChangeLogIn):
    session = get_session()
    try:
        entry = ChangeLog(
            action=payload.action,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            before_json=json.dumps(payload.before_json)
            if payload.before_json is not None
            else None,
            after_json=json.dumps(payload.after_json)
            if payload.after_json is not None
            else None,
            evidence=payload.evidence,
            source=payload.source,
            created_at=datetime.utcnow(),
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)
        return {"id": entry.id}
    finally:
        session.close()


@app.get("/tasks", response_class=HTMLResponse)
def tasks_view(
    request: Request,
    assignee_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
):
    session = get_session()
    try:
        q = session.query(Task)
        if assignee_id:
            q = q.filter(Task.assignee_id == assignee_id)
        if status:
            q = q.filter(Task.status == status)
        if priority:
            q = q.filter(Task.priority == priority)

        tasks = q.order_by(desc(Task.updated_at)).limit(200).all()
        employees = session.query(Employee).all()

        return templates.TemplateResponse(
            "tasks.html",
            {
                "request": request,
                "tasks": tasks,
                "employees": employees,
                "selected_assignee": assignee_id,
                "selected_status": status,
                "selected_priority": priority,
            },
        )
    finally:
        session.close()


@app.get("/boards/{board_id}", response_class=HTMLResponse)
def board_view(request: Request, board_id: int):
    session = get_session()
    try:
        board = session.query(Board).filter(Board.id == board_id).first()
        if not board:
            return HTMLResponse("Board not found", status_code=404)

        columns = (
            session.query(BoardColumn)
            .filter(BoardColumn.board_id == board_id)
            .order_by(BoardColumn.order_index)
            .all()
        )
        cards = (
            session.query(BoardCard)
            .filter(BoardCard.board_id == board_id)
            .order_by(BoardCard.order_index)
            .all()
        )
        tasks = {t.id: t for t in session.query(Task).all()}

        columns_data = []
        for c in columns:
            col_cards = [cd for cd in cards if cd.column_id == c.id]
            columns_data.append(
                {
                    "id": c.id,
                    "name": c.name,
                    "cards": [
                        {
                            "task": tasks.get(cd.task_id),
                            "order_index": cd.order_index,
                        }
                        for cd in col_cards
                    ],
                }
            )

        return templates.TemplateResponse(
            "board.html",
            {
                "request": request,
                "board": board,
                "columns": columns_data,
            },
        )
    finally:
        session.close()
