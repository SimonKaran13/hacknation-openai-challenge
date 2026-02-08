export type NodeStatus = "aligned" | "conflict" | "pending";
export type EdgeStatus = "aligned" | "conflict" | "pending";

export type OrgNode = {
  id: string;
  label: string;
  type: "team" | "decision" | "stakeholder";
  x: number;
  y: number;
  latest: string;
  owner: string;
  deps: string;
  status: NodeStatus;
};

export type OrgEdge = {
  id: string;
  source: string;
  target: string;
  status: EdgeStatus;
  weight?: number;
};

export type Conflict = {
  id: string;
  title: string;
  detail: string;
  impacted: string[];
  status: "open" | "resolved";
};

export type TimelineItem = {
  time: string;
  text: string;
};

export type DemoState = {
  alignment: number;
  meetingApplied: boolean;
  conflicts: Conflict[];
  nodes: OrgNode[];
  edges: OrgEdge[];
  activity: TimelineItem[];
  timeline: TimelineItem[];
  graphState: string;
};
