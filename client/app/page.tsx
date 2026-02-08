"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { FlowBoard } from "@/components/FlowBoard";
import { makeInitialState, stamp } from "@/lib/initial-state";
import type { Conflict, DemoState } from "@/lib/types";

const MAX_FEED_ITEMS = 8;

const rise = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

type GraphView = "knowledge" | "departments" | "employees";

const GRAPH_VIEWS: Array<{ id: GraphView; label: string }> = [
  { id: "knowledge", label: "Knowledge" },
  { id: "departments", label: "Departments" },
  { id: "employees", label: "Employees" },
];

export default function Home() {
  const [state, setState] = useState<DemoState>(makeInitialState);
  const [command, setCommand] = useState("What changed today?");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pulse, setPulse] = useState<"idle" | "meeting" | "resolve" | "query">("idle");
  const [graphView, setGraphView] = useState<GraphView>("knowledge");

  useEffect(() => {
    let canceled = false;

    const loadGraphFromApi = async () => {
      setState((prev) => ({
        ...prev,
        graphState: `Loading ${graphView} graph from API...`,
      }));
      try {
        const response = await fetch(`/api/graph/live?view=${graphView}`);
        if (!response.ok) {
          throw new Error(`Graph API failed with status ${response.status}`);
        }

        const payload = (await response.json()) as {
          nodes: DemoState["nodes"];
          edges: DemoState["edges"];
          error?: string;
          view?: GraphView;
        };

        if (!Array.isArray(payload.nodes) || payload.nodes.length === 0) {
          throw new Error(payload.error ?? "Graph API returned no nodes.");
        }

        if (canceled) {
          return;
        }

        setState((prev) => ({
          ...prev,
          nodes: payload.nodes,
          edges: payload.edges,
          graphState: `${payload.view ?? graphView} graph (${payload.nodes.length} nodes, ${payload.edges.length} edges)`,
        }));
      } catch {
        if (canceled) {
          return;
        }
        setState((prev) => ({
          ...prev,
          graphState: `Backend unavailable for ${graphView}; using local fallback graph.`,
        }));
      }
    };

    void loadGraphFromApi();
    return () => {
      canceled = true;
    };
  }, [graphView]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }
    const exists = state.nodes.some((node) => node.id === selectedNodeId);
    if (!exists) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, state.nodes]);

  const selectedNode = useMemo(
    () => state.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [state.nodes, selectedNodeId]
  );

  const activity = useMemo(() => state.activity.slice(0, MAX_FEED_ITEMS), [state.activity]);
  const timeline = useMemo(() => state.timeline.slice(0, MAX_FEED_ITEMS), [state.timeline]);

  const addActivity = (next: DemoState, text: string): DemoState => ({
    ...next,
    activity: [{ time: stamp(), text }, ...next.activity],
  });

  const addTimeline = (next: DemoState, text: string): DemoState => ({
    ...next,
    timeline: [{ time: stamp(), text }, ...next.timeline],
  });

  const triggerPulse = (nextPulse: "meeting" | "resolve" | "query") => {
    setPulse(nextPulse);
    window.setTimeout(() => setPulse("idle"), 900);
  };

  const resolveConflict = (conflictId: string): void => {
    triggerPulse("resolve");
    setState((prev) => {
      const target = prev.conflicts.find((c) => c.id === conflictId);
      if (!target || target.status === "resolved") {
        return prev;
      }

      let next: DemoState = {
        ...prev,
        alignment: 100,
        graphState: "Conflict resolved and truth propagated",
        conflicts: prev.conflicts.map((conflict: Conflict) =>
          conflict.id === conflictId ? { ...conflict, status: "resolved" } : conflict
        ),
        nodes: prev.nodes.map((node) => {
          if (node.id === "launch_date") {
            return {
              ...node,
              status: "aligned",
              latest: "Single launch date locked: May 24",
              deps: "All downstream plans synced",
            };
          }
          if (node.id === "exec") {
            return {
              ...node,
              status: "aligned",
              latest: "Aligned launch brief generated",
            };
          }
          return node;
        }),
        edges: prev.edges.map((edge) => {
          if (edge.id === "e2" || edge.id === "e3") {
            return { ...edge, status: "aligned" };
          }
          return edge;
        }),
      };

      next = addActivity(
        next,
        "Resolved launch date conflict, chose May 24 based on latest approved roadmap."
      );
      next = addActivity(
        next,
        "Routed update to Sarah (Marketing), Priya (Product), and Founder briefing channel."
      );
      next = addTimeline(next, "v1.13 Launch date conflict resolved and versioned.");
      return next;
    });
  };

  const onMeetingEnded = (): void => {
    triggerPulse("meeting");
    setState((prev) => {
      let next: DemoState = {
        ...prev,
        alignment: 96,
        graphState: "Meeting event ingested",
      };

      if (prev.meetingApplied) {
        next = addActivity(next, "Meeting replay ignored; current state already reflects latest notes.");
        return next;
      }

      next = {
        ...next,
        meetingApplied: true,
        conflicts: prev.conflicts.map((conflict) =>
          conflict.id === "launch-date-conflict" ? { ...conflict, status: "open" } : conflict
        ),
        nodes: prev.nodes.map((node) => {
          if (node.id === "launch_date") {
            return {
              ...node,
              status: "conflict",
              latest: "Meeting notes mention May 24; prior doc still says May 10",
            };
          }
          if (node.id === "exec") {
            return { ...node, status: "pending" };
          }
          return node;
        }),
        edges: prev.edges.map((edge) => {
          if (edge.id === "e2") {
            return { ...edge, status: "conflict" };
          }
          if (edge.id === "e3") {
            return { ...edge, status: "pending" };
          }
          return edge;
        }),
      };

      next = addActivity(next, "Ingested meeting transcript from Product weekly sync.");
      next = addActivity(next, "Detected contradiction in launch date references across team artifacts.");
      next = addTimeline(next, "v1.13 Candidate update created from meeting transcript.");
      return next;
    });
  };

  const onRunCommand = (): void => {
    const query = command.trim().toLowerCase();
    if (!query) {
      return;
    }

    triggerPulse("query");
    setState((prev) => {
      let next = prev;
      if (query.includes("what changed today")) {
        next = addActivity(
          next,
          "Responded to founder query: 1 conflict detected, stakeholder routing pending."
        );
        next = addTimeline(next, "Query served: daily organizational diff.");
      } else {
        next = addActivity(
          next,
          `Interpreted command: \"${command.trim()}\" (MVP parser supports daily diff best).`
        );
      }
      return next;
    });
  };

  return (
    <div className="app-shell">
      <div className="app-bg" />
      <div className="app-grid">
        <motion.header
          className="hero-card"
          variants={rise}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="hero-title-wrap">
            <div>
              <p className="eyebrow">AI Chief of Staff</p>
              <h1>Organizational Intelligence Console</h1>
            </div>
            <motion.div
              className={`alignment-pill ${state.alignment >= 98 ? "good" : "pending"}`}
              animate={{ scale: pulse === "resolve" ? [1, 1.06, 1] : 1 }}
              transition={{ duration: 0.45 }}
            >
              <Sparkles size={14} /> {state.alignment}% aligned
            </motion.div>
          </div>

          <div className="command-row">
            <div className={`command-shell ${pulse === "query" ? "active" : ""}`}>
              <WandSparkles size={15} />
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                aria-label="Command bar"
              />
            </div>
            <motion.button whileTap={{ scale: 0.97 }} className="btn ghost" onClick={onRunCommand}>
              Run Query
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              className={`btn primary ${pulse === "meeting" ? "flash" : ""}`}
              onClick={onMeetingEnded}
            >
              Simulate Meeting Ended
            </motion.button>
          </div>
        </motion.header>

        <main className="layout">
          <motion.section
            className="panel"
            variants={rise}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.45, delay: 0.08 }}
          >
            <div className="panel-header">
              <h2>Deconfliction Console</h2>
              <span>{state.conflicts.filter((c) => c.status === "open").length} open</span>
            </div>
            <ul className="conflict-list">
              <AnimatePresence>
                {state.conflicts.map((conflict) => (
                  <motion.li
                    key={conflict.id + conflict.status}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.98 }}
                    transition={{ duration: 0.3 }}
                    className={`conflict-item ${conflict.status}`}
                  >
                    <p className="conflict-title">
                      {conflict.status === "resolved" ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <AlertTriangle size={14} />
                      )}
                      {conflict.title}
                    </p>
                    <p className="conflict-meta">{conflict.detail}</p>
                    {conflict.status === "open" ? (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        whileHover={{ y: -1 }}
                        className="btn resolve"
                        onClick={() => resolveConflict(conflict.id)}
                      >
                        Resolve
                      </motion.button>
                    ) : (
                      <p className="conflict-resolved-copy">Resolved and routed to impacted stakeholders.</p>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>

          <motion.section
            className={`panel graph-panel ${pulse !== "idle" ? `pulse-${pulse}` : ""}`}
            variants={rise}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.45, delay: 0.14 }}
          >
            <div className="panel-header">
              <h2>Living Graph</h2>
              <div className="graph-header-controls">
                <div className="graph-view-toggle" role="tablist" aria-label="Graph view">
                  {GRAPH_VIEWS.map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      role="tab"
                      aria-selected={graphView === view.id}
                      className={`graph-view-btn ${graphView === view.id ? "active" : ""}`}
                      onClick={() => setGraphView(view.id)}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
                <span>{state.graphState}</span>
              </div>
            </div>
            <div className="graph-wrap">
              <FlowBoard
                nodes={state.nodes}
                edges={state.edges}
                selectedNodeId={selectedNodeId}
                onNodeSelect={setSelectedNodeId}
              />

              <AnimatePresence>
                {selectedNode && (
                  <motion.aside
                    className="context-card"
                    initial={{ opacity: 0, x: 24, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    transition={{ duration: 0.24 }}
                  >
                    <h3>{selectedNode.label}</h3>
                    <p>{selectedNode.latest}</p>
                    <p>Owner: {selectedNode.owner}</p>
                    <p>{selectedNode.deps}</p>
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>
          </motion.section>

          <motion.section
            className="panel right-stack"
            variants={rise}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.45, delay: 0.18 }}
          >
            <div className="split-panel">
              <div className="panel-header">
                <h2>Agent Activity Log</h2>
                <Activity size={14} />
              </div>
              <ul className="log-list">
                <AnimatePresence initial={false}>
                  {activity.map((item, idx) => (
                    <motion.li
                      layout
                      key={`${item.time}-${item.text}-${idx}`}
                      className="log-item"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.25 }}
                    >
                      <span className="row-icon">
                        <Sparkles size={13} />
                      </span>
                      <div>
                        <span className="log-time">{item.time}</span>
                        <p>{item.text}</p>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            <div className="split-panel">
              <div className="panel-header">
                <h2>Version Timeline</h2>
                <GitBranch size={14} />
              </div>
              <ol className="timeline-list">
                <AnimatePresence initial={false}>
                  {timeline.map((item, idx) => (
                    <motion.li
                      layout
                      key={`${item.time}-${item.text}-${idx}`}
                      className="timeline-item"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                    >
                      <span className="log-time">{item.time}</span>
                      <p>{item.text}</p>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            </div>
          </motion.section>
        </main>
      </div>
    </div>
  );
}
