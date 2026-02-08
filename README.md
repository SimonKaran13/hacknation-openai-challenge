# HackNation OpenAI Challenge

A prototype “AI Chief of Staff” that organizes internal communication into a living source of truth, making decisions and changes targeted, transparent, and actionable.

## TL;DR / Overview
- Backend API + database for company communications, tasks, and employees.
- Client UI dashboard consumes the API.
- An external (cloud) agent ingests messages from Discord/email/meeting notes and updates the system via the API.
- Includes a standalone onboarding proof-of-concept that bootstraps a database from email data.

## Problem & Motivation
Teams lose context when decisions and actions are scattered across chats, emails, and meetings. This project centralizes those signals into a structured backend and exposes them via an API for dashboards and automation.

## Solution
The system captures communications and tasks in a database, exposes them through a backend API, and enables:
- a UI to visualize tasks and communication graphs, and
- an external agent to update records, log changes, and notify stakeholders.

## System Architecture
![System Architecture](assets/system_architecture.svg)

## Repository Structure
- `backend/` — FastAPI backend, database models, API routes, seed script
- `client/` — Next.js frontend MVP
- `onboarding/` — PoC pipeline to bootstrap a DB from email data (decoupled)
- `backend/data/` — local SQLite database (created by seed)

## Setup & Installation
### Backend (Linux/macOS)
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend (Linux/macOS)
```bash
cd client
pnpm install
pnpm run dev
```

### Dependencies
- Python 3.11+
- Node.js 18+ (for frontend)
- Backend packages in `requirements.txt`
- Frontend packages in `client/package.json`

### Environment / Config
- `DATABASE_URL` (optional): when set, backend uses Postgres instead of local SQLite.
- Local dev defaults to `backend/data/org.db`.
- TODO: Deployed API base URL (add after deployment)

## Running the Project
### Backend
Seed the local DB:
```bash
python -m backend.app.seed
```

Run the server:
```bash
uvicorn backend.main:app --reload
```

### Client UI
```bash
cd client
pnpm run dev
```
Open: `http://localhost:3000`

### Agent (External)
The agent is **not part of this repo** and runs in the cloud. It should send structured updates to the backend API (e.g., create/update tasks, employees, comm events, change log entries). See `backend/BACKEND.md` for the full list of API calls and payloads.

## Onboarding Proof of Concept
The `onboarding/` folder contains a decoupled PoC that ingests a Kaggle email dataset and writes a SQLite DB in the same schema as the backend. It demonstrates how a new company could bootstrap employee/task/communication data from historical emails.

- Dataset: Kaggle Enron Email Dataset — https://www.kaggle.com/datasets/jivfur/enron-emails
- Pipeline entry: `onboarding/pipeline.py`
- This module is optional and not required to run the core system.

## Tech Stack
- Backend: Python, FastAPI, SQLAlchemy, SQLite/Postgres
- Frontend: Next.js, TypeScript
- TODO: Add any additional libraries/infrastructure if used

## Contributing / Development Notes
- Use `backend/BACKEND.md` for API endpoints and backend specifics.
- Keep `DATABASE_URL` unset for local SQLite testing.
- The agent is external and should call the API; it should not access the DB directly in production.
