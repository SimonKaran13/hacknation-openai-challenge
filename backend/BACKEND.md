# Backend: Communications Graph + Tasks DB

Minimal backend project with:
1) Communications graph database
2) Tasks database

## Setup
See `README.md` in the repo root for environment setup and dependencies.

## Seed the DB
```bash
python -m backend.app.seed
```
Creates `backend/data/org.db` with a fictional 20-person company.

## Run Server
```bash
uvicorn backend.main:app --reload
```

### Web Views
- `http://127.0.0.1:8000/graph` — top edges + per-employee top contacts
- `http://127.0.0.1:8000/graph/viz` — visual comms flow graph (grouped by team)
- `http://127.0.0.1:8000/graph/departments` — role-level comms graph (CEO/CTO/SWE/HR/Marketing/Sales)
- `http://127.0.0.1:8000/tasks` — task table with filters
- `http://127.0.0.1:8000/boards/1` — Engineering board
- `http://127.0.0.1:8000/boards/2` — Go-to-Market board

### JSON API
- `GET /api/graph/employees`
- `GET /api/graph/edges`
- `GET /api/graph/departments`
- `POST /api/employees`
- `DELETE /api/employees/{id}`
- `POST /api/comm/events`
- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/{id}`
- `GET /api/boards`
- `GET /api/boards/{id}`

### JSON API Payloads
Base URL (local): `http://127.0.0.1:8000`

Employees
- `GET /api/graph/employees` returns a list of employees.
- `POST /api/employees` payload:
```json
{
  "full_name": "Jane Doe",
  "role": "CTO",
  "team": "Engineering",
  "email": "jane@corp.com",
  "discord_handle": "jane#1234",
  "manager_id": null,
  "location": "Berlin",
  "start_date": "2024-01-10"
}
```
- `DELETE /api/employees/{id}` deletes an employee.

Comms Graph
- `GET /api/graph/edges` returns aggregated communication edges.
- `POST /api/comm/events` payload (creates event and upserts edge aggregate):
```json
{
  "timestamp": "2026-02-07T10:15:00",
  "from_employee_id": 2,
  "to_employee_id": 5,
  "channel": "slack",
  "capacity": "1:1",
  "topic": "Delivery timeline",
  "summary": "Clarified milestones and blockers"
}
```
- `GET /api/graph/summary` returns summary stats.
- `GET /api/graph/knowledge` returns nodes and edges for the knowledge graph.
- `GET /api/graph/departments` returns a role-level comms graph.

Tasks
- `GET /api/tasks` returns a list of tasks.
- `POST /api/tasks` payload:
```json
{
  "title": "Fix onboarding flow",
  "description": "Audit and update docs",
  "status": "In Progress",
  "priority": "High",
  "assignee_id": 3,
  "reporter_id": 1,
  "due_date": "2026-02-20",
  "labels": ["docs", "onboarding"],
  "related_topic": "Process",
  "parent_board_id": 1
}
```
- `PUT /api/tasks/{id}` payload is the same as `POST /api/tasks`.

Boards
- `GET /api/boards` returns all boards.
- `GET /api/boards/{id}` returns board details with columns and cards.

## CLI
```bash
python -m backend.app.cli graph-summary
python -m backend.app.cli tasks-summary
```

## Graph Modeling
This project uses SQLite for persistence and NetworkX to build:
- a communications flow graph (employees as nodes, comm edges as weighted edges)
- a knowledge graph (employee -> topic edges based on comm topics)
