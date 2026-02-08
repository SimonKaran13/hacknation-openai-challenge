"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  LayoutList,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";

const STATUS_OPTIONS = ["todo", "in_progress", "blocked", "done"] as const;
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

const EMPTY_FORM = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  assignee_id: "",
  reporter_id: "",
  due_date: "",
  labels: "",
  related_topic: "",
  parent_board_id: "",
};

type ApiTask = {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: number | null;
  reporter_id: number;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  labels: string[];
  related_topic: string;
  parent_board_id: number | null;
};

type ApiBoard = {
  id: number;
  name: string;
  description: string;
  owner_id: number;
};

type ApiBoardDetail = {
  board: ApiBoard;
  columns: Array<{ id: number; name: string }>;
  cards: Array<{ id: number; task_id: number; column_id: number; order_index: number }>;
};

type TaskFormState = typeof EMPTY_FORM;

type TaskPayload = {
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: number | null;
  reporter_id: number;
  due_date: string | null;
  labels: string[];
  related_topic: string;
  parent_board_id: number | null;
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "N/A";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

const parseId = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [boards, setBoards] = useState<ApiBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [boardDetail, setBoardDetail] = useState<ApiBoardDetail | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [formState, setFormState] = useState<TaskFormState>(EMPTY_FORM);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");
  const [formError, setFormError] = useState<string | null>(null);

  const loadBoardDetail = useCallback(async (boardId: number) => {
    try {
      const response = await fetch(`/api/boards/${boardId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Board detail error (${response.status})`);
      }
      const payload = (await response.json()) as ApiBoardDetail;
      setBoardDetail(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load board.";
      setError(message);
      setBoardDetail(null);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksResponse, boardsResponse] = await Promise.all([
        fetch("/api/tasks", { cache: "no-store" }),
        fetch("/api/boards", { cache: "no-store" }),
      ]);

      if (!tasksResponse.ok) {
        throw new Error(`Tasks API error (${tasksResponse.status})`);
      }
      if (!boardsResponse.ok) {
        throw new Error(`Boards API error (${boardsResponse.status})`);
      }

      const tasksPayload = (await tasksResponse.json()) as { tasks?: ApiTask[]; error?: string } | ApiTask[];
      const boardsPayload = (await boardsResponse.json()) as { boards?: ApiBoard[]; error?: string } | ApiBoard[];

      const nextTasks = Array.isArray(tasksPayload) ? tasksPayload : tasksPayload.tasks ?? [];
      const nextBoards = Array.isArray(boardsPayload) ? boardsPayload : boardsPayload.boards ?? [];

      setTasks(nextTasks);
      setBoards(nextBoards);
      setLastSynced(new Date().toLocaleTimeString());

      return { tasks: nextTasks, boards: nextBoards };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to reach tasks service.";
      setError(message);
      return { tasks: [], boards: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);


  useEffect(() => {
    if (!selectedBoardId) {
      setBoardDetail(null);
      return;
    }
    void loadBoardDetail(selectedBoardId);
  }, [selectedBoardId, loadBoardDetail]);

  const boardsById = useMemo(() => new Map(boards.map((board) => [board.id, board])), [boards]);
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const filteredTasks = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }
      if (boardFilter !== "all" && String(task.parent_board_id ?? "") !== boardFilter) {
        return false;
      }
      if (!loweredQuery) {
        return true;
      }
      return (
        task.title.toLowerCase().includes(loweredQuery) ||
        task.description.toLowerCase().includes(loweredQuery) ||
        task.related_topic.toLowerCase().includes(loweredQuery)
      );
    });
  }, [tasks, query, statusFilter, boardFilter]);

  const selectTask = (task: ApiTask) => {
    setSelectedTaskId(task.id);
    setMode("edit");
    setFormError(null);
    setFormState({
      title: task.title ?? "",
      description: task.description ?? "",
      status: task.status ?? "todo",
      priority: task.priority ?? "medium",
      assignee_id: task.assignee_id ? String(task.assignee_id) : "",
      reporter_id: String(task.reporter_id ?? ""),
      due_date: task.due_date ?? "",
      labels: (task.labels ?? []).join(", "),
      related_topic: task.related_topic ?? "",
      parent_board_id: task.parent_board_id ? String(task.parent_board_id) : "",
    });
  };

  const deleteTask = useCallback(
    async (taskId: number) => {
      const task = tasksById.get(taskId);
      const label = task?.title ? ` "${task.title}"` : "";
      if (!window.confirm(`Delete task${label}? This cannot be undone.`)) {
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to delete task.");
        }
        if (selectedTaskId === taskId) {
          setSelectedTaskId(null);
          setMode("view");
          setFormState(EMPTY_FORM);
        }
        await loadAll();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to delete task.";
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [loadAll, selectedTaskId, tasksById]
  );

  const deleteBoard = useCallback(
    async (boardId: number) => {
      const board = boardsById.get(boardId);
      const label = board?.name ? ` "${board.name}"` : "";
      if (!window.confirm(`Delete board${label}? Tasks will remain but be unassigned.`)) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to delete board.");
        }
        if (selectedBoardId === boardId) {
          setSelectedBoardId(null);
          setBoardDetail(null);
        }
        if (boardFilter === String(boardId)) {
          setBoardFilter("all");
        }
        await loadAll();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to delete board.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [boardFilter, boardsById, loadAll, selectedBoardId]
  );

  const startCreate = () => {
    setMode("create");
    setSelectedTaskId(null);
    setFormError(null);
    setFormState({
      ...EMPTY_FORM,
      parent_board_id: selectedBoardId ? String(selectedBoardId) : "",
    });
  };

  const buildPayload = (): TaskPayload | null => {
    if (!formState.title.trim()) {
      setFormError("Title is required.");
      return null;
    }
    const reporterId = parseId(formState.reporter_id);
    if (!reporterId) {
      setFormError("Reporter ID is required.");
      return null;
    }

    setFormError(null);

    return {
      title: formState.title.trim(),
      description: formState.description.trim(),
      status: formState.status,
      priority: formState.priority,
      assignee_id: parseId(formState.assignee_id),
      reporter_id: reporterId,
      due_date: formState.due_date.trim() ? formState.due_date.trim() : null,
      labels: formState.labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
      related_topic: formState.related_topic.trim(),
      parent_board_id: parseId(formState.parent_board_id),
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    setSaving(true);
    setError(null);

    try {
      if (mode === "create") {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`Create failed (${response.status})`);
        }
        const result = (await response.json()) as { id?: number };
        const refreshed = await loadAll();
        const newTask = result.id ? refreshed.tasks.find((task) => task.id === result.id) : null;
        if (newTask) {
          selectTask(newTask);
        }
      } else if (mode === "edit" && selectedTaskId) {
        const response = await fetch(`/api/tasks/${selectedTaskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`Update failed (${response.status})`);
        }
        await loadAll();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save task.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const selectedTask = selectedTaskId ? tasksById.get(selectedTaskId) ?? null : null;
  const unmappedTasks = useMemo(() => {
    if (!boardDetail) {
      return [];
    }
    const mappedIds = new Set(boardDetail.cards.map((card) => card.task_id));
    return tasks.filter(
      (task) => task.parent_board_id === boardDetail.board.id && !mappedIds.has(task.id)
    );
  }, [boardDetail, tasks]);

  return (
    <>
      <header className="hero-card tasks-hero">
        <div className="hero-title-wrap">
          <div>
            <p className="eyebrow">Tasks & Boards</p>
            <h1>Delivery control center</h1>
          </div>
          <div className="tasks-hero-actions">
            <button className="btn ghost" onClick={() => void loadAll()} disabled={loading}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="btn primary" onClick={startCreate}>
              <Plus size={16} /> New Task
            </button>
          </div>
        </div>
        <div className="tasks-hero-meta">
          <div className="tasks-meta-card">
            <span>Boards</span>
            <strong>{boards.length}</strong>
          </div>
          <div className="tasks-meta-card">
            <span>Tasks</span>
            <strong>{tasks.length}</strong>
          </div>
          <div className="tasks-meta-card">
            <span>Last synced</span>
            <strong>{lastSynced ?? "N/A"}</strong>
          </div>
          {error ? <p className="tasks-error">{error}</p> : null}
        </div>
      </header>

      <main className="tasks-layout">
        <section className="panel tasks-panel tasks-panel-list">
          <div className="panel-header">
            <h2>Boards</h2>
            <span>{boards.length} total</span>
          </div>
          <div className="board-list">
            {boards.map((board) => (
              <div
                key={board.id}
                className={`board-card ${selectedBoardId === board.id ? "active" : ""}`}
              >
                <button className="board-card-main" onClick={() => setSelectedBoardId(board.id)}>
                  <h3>{board.name}</h3>
                  <p>{board.description}</p>
                </button>
                <div className="board-card-actions">
                  <span className="board-meta">Owner #{board.owner_id}</span>
                  <button
                    className="icon-button danger"
                    onClick={() => void deleteBoard(board.id)}
                    aria-label={`Delete ${board.name}`}
                    title="Delete board"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {!boards.length && !loading ? <p className="empty-state">No boards yet.</p> : null}
          </div>

          <div className="board-detail">
            <div className="panel-header">
              <h2>Board detail</h2>
              <span>{boardDetail ? boardDetail.columns.length : 0} columns</span>
            </div>
            {boardDetail ? (
              <>
                <div className="board-detail-meta">
                  <p>
                    <strong>{boardDetail.board.name}</strong>
                  </p>
                  <p>{boardDetail.board.description}</p>
                </div>
                <div className="board-columns">
                  {boardDetail.columns.map((column) => {
                    const cards = boardDetail.cards
                      .filter((card) => card.column_id === column.id)
                      .sort((a, b) => a.order_index - b.order_index);
                    return (
                      <div key={column.id} className="board-column">
                        <div className="board-column-header">
                          <span>{column.name}</span>
                          <span>{cards.length}</span>
                        </div>
                        <div className="board-column-cards">
                          {cards.map((card) => {
                            const task = tasksById.get(card.task_id);
                            return (
                              <button
                                key={card.id}
                                className="board-card-item"
                                onClick={() => task && selectTask(task)}
                              >
                                <span>{task ? task.title : `Task #${card.task_id}`}</span>
                                <span className={`status-pill ${task?.status ?? ""}`}>{task?.status ?? ""}</span>
                              </button>
                            );
                          })}
                          {!cards.length ? <p className="empty-state">No cards.</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="board-unmapped">
                  <div className="board-column-header">
                    <span>Unmapped tasks</span>
                    <span>{unmappedTasks.length}</span>
                  </div>
                  <div className="board-column-cards">
                    {unmappedTasks.map((task) => (
                      <button key={task.id} className="board-card-item" onClick={() => selectTask(task)}>
                        <span>{task.title}</span>
                        <span className={`status-pill ${task.status}`}>{task.status}</span>
                      </button>
                    ))}
                    {!unmappedTasks.length ? <p className="empty-state">No unmapped tasks.</p> : null}
                  </div>
                </div>
              </>
            ) : (
              <p className="empty-state">Select a board to inspect columns and cards.</p>
            )}
          </div>
        </section>

        <section className="panel tasks-panel tasks-panel-list tasks-panel-tasks">
          <div className="tasks-panel-sticky">
            <div className="panel-header">
              <h2>Tasks</h2>
              <span>{filteredTasks.length} visible</span>
            </div>

            <div className="task-filters">
              <div className="filter-input">
                <Search size={14} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, description, topic"
                />
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select value={boardFilter} onChange={(event) => setBoardFilter(event.target.value)}>
                <option value="all">All boards</option>
                {boards.map((board) => (
                  <option key={board.id} value={String(board.id)}>
                    {board.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="task-list">
            {filteredTasks.map((task) => (
              <button
                key={task.id}
                className={`task-row ${selectedTaskId === task.id ? "active" : ""}`}
                onClick={() => selectTask(task)}
              >
                <div>
                  <h3>{task.title}</h3>
                  <p>
                    {boardsById.get(task.parent_board_id ?? -1)?.name ?? "No board"} - {task.priority}
                  </p>
                </div>
                <div className="task-tags">
                  <span className={`status-pill ${task.status}`}>{task.status}</span>
                  <span className="task-id">#{task.id}</span>
                </div>
              </button>
            ))}
            {!filteredTasks.length && !loading ? <p className="empty-state">No tasks match.</p> : null}
          </div>
        </section>

        <section className="panel tasks-panel">
          <div className="panel-header">
            <h2>Task detail</h2>
            <span>{mode === "create" ? "Create" : selectedTask ? "Editing" : "Select"}</span>
          </div>

          {mode === "view" && !selectedTask ? (
            <div className="empty-state">
              <LayoutList size={20} />
              <p>Select a task or create a new one to edit fields.</p>
            </div>
          ) : (
            <div className="task-detail">
              <div className="task-detail-actions">
                {selectedTask ? (
                  <span className="task-detail-id">Task #{selectedTask.id}</span>
                ) : (
                  <span className="task-detail-id">New task</span>
                )}
                <div className="task-detail-actions-buttons">
                  <button className="btn ghost" onClick={startCreate}>
                    <Plus size={14} /> New
                  </button>
                  {selectedTask ? (
                    <button
                      className="btn danger"
                      onClick={() => void deleteTask(selectedTask.id)}
                      disabled={saving}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="form-grid">
                <label>
                  Title
                  <input
                    value={formState.title}
                    onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={formState.description}
                    onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Status
                    <select
                      value={formState.status}
                      onChange={(event) => setFormState({ ...formState, status: event.target.value })}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Priority
                    <select
                      value={formState.priority}
                      onChange={(event) => setFormState({ ...formState, priority: event.target.value })}
                    >
                      {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Assignee ID
                    <input
                      value={formState.assignee_id}
                      onChange={(event) => setFormState({ ...formState, assignee_id: event.target.value })}
                      placeholder="Optional"
                    />
                  </label>
                  <label>
                    Reporter ID
                    <input
                      value={formState.reporter_id}
                      onChange={(event) => setFormState({ ...formState, reporter_id: event.target.value })}
                      placeholder="Required"
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Due date (YYYY-MM-DD)
                    <input
                      value={formState.due_date}
                      onChange={(event) => setFormState({ ...formState, due_date: event.target.value })}
                    />
                  </label>
                  <label>
                    Parent board ID
                    <input
                      value={formState.parent_board_id}
                      onChange={(event) => setFormState({ ...formState, parent_board_id: event.target.value })}
                      placeholder="Optional"
                    />
                  </label>
                </div>
                <label>
                  Labels (comma separated)
                  <input
                    value={formState.labels}
                    onChange={(event) => setFormState({ ...formState, labels: event.target.value })}
                  />
                </label>
                <label>
                  Related topic
                  <input
                    value={formState.related_topic}
                    onChange={(event) => setFormState({ ...formState, related_topic: event.target.value })}
                  />
                </label>
              </div>

              {formError ? <p className="form-error">{formError}</p> : null}
              {selectedTask ? (
                <div className="task-audit">
                  <div>
                    <Clock size={14} /> Created {formatDateTime(selectedTask.created_at)}
                  </div>
                  <div>
                    <Pencil size={14} /> Updated {formatDateTime(selectedTask.updated_at)}
                  </div>
                  <div>
                    <CheckCircle2 size={14} />
                    {selectedTask.due_date ? `Due ${formatDateTime(selectedTask.due_date)}` : "No due date"}
                  </div>
                </div>
              ) : null}
              <button className="btn primary" onClick={handleSave} disabled={saving}>
                <Save size={16} /> {saving ? "Saving..." : mode === "create" ? "Create task" : "Save changes"}
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
