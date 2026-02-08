import type { DemoState } from "@/lib/types";

const SEEDED_TIME = "09:00";

export const makeInitialState = (): DemoState => ({
  alignment: 98,
  meetingApplied: false,
  graphState: "Awaiting events",
  conflicts: [
    {
      id: "launch-date-conflict",
      title: "Launch date mismatch",
      detail: "Product says May 10; Go-to-market plan says May 24.",
      impacted: ["Decision: Launch Date", "Team: Marketing", "Team: Product"],
      status: "open",
    },
  ],
  nodes: [
    {
      id: "product",
      label: "Product",
      type: "team",
      x: 170,
      y: 110,
      latest: "Launch prep in progress",
      owner: "Priya (PM)",
      deps: "Depends on campaign lock + legal review",
      status: "aligned",
    },
    {
      id: "marketing",
      label: "Marketing",
      type: "team",
      x: 520,
      y: 120,
      latest: "Campaign copy draft complete",
      owner: "Sarah (Lead)",
      deps: "Depends on final launch date",
      status: "aligned",
    },
    {
      id: "launch_date",
      label: "Launch Date",
      type: "decision",
      x: 350,
      y: 240,
      latest: "Conflicting date references detected",
      owner: "AI Chief of Staff",
      deps: "Linked to Product roadmap + GTM timeline",
      status: "conflict",
    },
    {
      id: "exec",
      label: "Founder",
      type: "stakeholder",
      x: 350,
      y: 370,
      latest: "Awaiting aligned launch recommendation",
      owner: "Amina",
      deps: "Needs approved single source of truth",
      status: "pending",
    },
  ],
  edges: [
    { id: "e1", source: "product", target: "launch_date", status: "aligned" },
    { id: "e2", source: "marketing", target: "launch_date", status: "conflict" },
    { id: "e3", source: "launch_date", target: "exec", status: "pending" },
  ],
  activity: [
    {
      time: SEEDED_TIME,
      text: "System initialized with current organizational memory snapshot.",
    },
    {
      time: SEEDED_TIME,
      text: "Detected contradictory launch dates from Product and Marketing artifacts.",
    },
  ],
  timeline: [
    {
      time: SEEDED_TIME,
      text: "v1.12 Truth state synced from workspace docs.",
    },
  ],
});

export const stamp = (): string =>
  new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
