import { NextResponse } from "next/server";
import type { OrgEdge, OrgNode } from "@/lib/types";

type GraphView = "knowledge" | "departments" | "employees";
const GRAPH_REVALIDATE_SECONDS = 60;
export const revalidate = 60;

type BackendGraphNode = {
  id: string;
  type: "employee" | "topic";
  name: string;
  role?: string;
};

type BackendGraphEdge = {
  source: string;
  target: string;
  weight?: number;
};

type BackendKnowledgeGraph = {
  nodes: BackendGraphNode[];
  edges: BackendGraphEdge[];
};

type BackendDepartmentGraph = {
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ source: string; target: string; weight?: number }>;
};

type BackendEmployee = {
  id: number;
  full_name: string;
  role: string;
  team: string;
};

type BackendEmployeeEdge = {
  from_employee_id: number;
  to_employee_id: number;
  weight?: number;
  channel: string;
  capacity: string;
};

const DEPLOYED_BACKEND_URL = "https://hacknation-openai-challenge.onrender.com";
const LOCAL_BACKEND_URL = "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 7_000;

const columnPosition = (
  index: number,
  maxRows: number,
  startX: number,
  startY: number,
  columnGap: number,
  rowGap: number
): { x: number; y: number } => {
  const col = Math.floor(index / maxRows);
  const row = index % maxRows;
  return {
    x: startX + col * columnGap,
    y: startY + row * rowGap,
  };
};

const aggregateEdges = <T extends { source: string; target: string; weight?: number }>(
  edges: T[]
): Array<{ source: string; target: string; weight: number }> => {
  const map = new Map<string, number>();
  for (const edge of edges) {
    const key = `${edge.source}__${edge.target}`;
    const current = map.get(key) ?? 0;
    map.set(key, current + (edge.weight ?? 1));
  }
  return Array.from(map.entries()).map(([key, weight]) => {
    const [source, target] = key.split("__");
    return { source, target, weight };
  });
};

const normalizeKnowledgeGraph = (payload: BackendKnowledgeGraph): { nodes: OrgNode[]; edges: OrgEdge[] } => {
  const employeeNodes = payload.nodes.filter((node) => node.type === "employee");
  const topicNodes = payload.nodes.filter((node) => node.type === "topic");
  const allNodeIds = new Set(payload.nodes.map((node) => node.id));

  const nodes: OrgNode[] = [
    ...employeeNodes.map((node, index) => {
      const position = columnPosition(index, 8, 120, 90, 190, 88);
      return {
        id: node.id,
        label: node.name,
        type: "stakeholder",
        x: position.x,
        y: position.y,
        latest: `Role: ${node.role ?? "Unknown"}`,
        owner: node.name,
        deps: "Knowledge graph employee node.",
        status: "aligned",
      } satisfies OrgNode;
    }),
    ...topicNodes.map((node, index) => {
      const position = columnPosition(index, 8, 700, 90, 190, 88);
      return {
        id: node.id,
        label: node.name,
        type: "decision",
        x: position.x,
        y: position.y,
        latest: "Topic inferred from communication metadata.",
        owner: "Org Graph API",
        deps: "Derived from comm edge topics.",
        status: "aligned",
      } satisfies OrgNode;
    }),
  ];

  const edges: OrgEdge[] = aggregateEdges(
    payload.edges.filter((edge) => allNodeIds.has(edge.source) && allNodeIds.has(edge.target))
  )
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 120)
    .map((edge, index) => ({
      id: `knowledge-edge-${index + 1}`,
      source: edge.source,
      target: edge.target,
      status: "aligned",
      weight: Math.round(edge.weight * 1000) / 1000,
    }));

  return { nodes, edges };
};

const normalizeDepartmentGraph = (payload: BackendDepartmentGraph): { nodes: OrgNode[]; edges: OrgEdge[] } => {
  const allNodeIds = new Set(payload.nodes.map((node) => node.id));
  const centerX = 440;
  const centerY = 330;
  const radius = Math.max(210, payload.nodes.length * 22);

  const nodes: OrgNode[] = payload.nodes.map((node, index) => {
    const theta = (Math.PI * 2 * index) / Math.max(payload.nodes.length, 1);
    return {
      id: node.id,
      label: node.label,
      type: "team",
      x: Math.round(centerX + radius * Math.cos(theta)),
      y: Math.round(centerY + radius * Math.sin(theta)),
      latest: "Department communication cluster.",
      owner: "Org Graph API",
      deps: "Role-level projection of employee communication.",
      status: "aligned",
    };
  });

  const edges: OrgEdge[] = aggregateEdges(
    payload.edges.filter((edge) => allNodeIds.has(edge.source) && allNodeIds.has(edge.target))
  )
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 120)
    .map((edge, index) => ({
      id: `department-edge-${index + 1}`,
      source: edge.source,
      target: edge.target,
      status: "aligned",
      weight: Math.round(edge.weight * 1000) / 1000,
    }));

  return { nodes, edges };
};

const TEAM_ORDER = ["Exec", "Engineering", "People", "Growth", "Revenue"];

const normalizeEmployeeGraph = (
  employees: BackendEmployee[],
  edgesRaw: BackendEmployeeEdge[]
): { nodes: OrgNode[]; edges: OrgEdge[] } => {
  const orderedTeams = Array.from(new Set([...TEAM_ORDER, ...employees.map((employee) => employee.team)]));
  const byTeam = new Map<string, BackendEmployee[]>();
  for (const team of orderedTeams) {
    byTeam.set(team, []);
  }
  for (const employee of employees) {
    const group = byTeam.get(employee.team);
    if (group) {
      group.push(employee);
    } else {
      byTeam.set(employee.team, [employee]);
    }
  }

  const nodeIds = new Set<string>();
  const nodes: OrgNode[] = [];
  for (const [teamIndex, team] of orderedTeams.entries()) {
    const members = byTeam.get(team) ?? [];
    for (const [memberIndex, employee] of members.entries()) {
      const id = `emp::${employee.id}`;
      nodeIds.add(id);
      nodes.push({
        id,
        label: employee.full_name,
        type: "stakeholder",
        x: 110 + teamIndex * 240,
        y: 90 + memberIndex * 92,
        latest: `${employee.team} · ${employee.role}`,
        owner: employee.full_name,
        deps: "Direct communication network node.",
        status: "aligned",
      });
    }
  }

  const aggregated = aggregateEdges(
    edgesRaw.map((edge) => ({
      source: `emp::${edge.from_employee_id}`,
      target: `emp::${edge.to_employee_id}`,
      weight: edge.weight ?? 0,
    }))
  );

  const edges: OrgEdge[] = aggregated
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 160)
    .map((edge, index) => ({
      id: `employee-edge-${index + 1}`,
      source: edge.source,
      target: edge.target,
      status: "aligned",
      weight: Math.round(edge.weight * 1000) / 1000,
    }));

  return { nodes, edges };
};

const parseView = (value: string | null): GraphView => {
  if (value === "departments" || value === "employees" || value === "knowledge") {
    return value;
  }
  return "knowledge";
};

export async function GET(request: Request) {
  const view = parseView(new URL(request.url).searchParams.get("view"));
  const configured = process.env.BACKEND_URL?.trim();
  const baseUrls = Array.from(
    new Set([configured, DEPLOYED_BACKEND_URL, LOCAL_BACKEND_URL].filter(Boolean) as string[])
  );
  const errors: string[] = [];

  for (const baseUrl of baseUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      let nodes: OrgNode[] = [];
      let edges: OrgEdge[] = [];
      let source = "";

      if (view === "knowledge") {
        const response = await fetch(`${baseUrl}/api/graph/knowledge`, {
          next: { revalidate: GRAPH_REVALIDATE_SECONDS },
          signal: controller.signal,
        });

        if (!response.ok) {
          errors.push(`${baseUrl}/api/graph/knowledge -> HTTP ${response.status}`);
          continue;
        }
        const payload = (await response.json()) as BackendKnowledgeGraph;
        ({ nodes, edges } = normalizeKnowledgeGraph(payload));
        source = `${baseUrl}/api/graph/knowledge`;
      } else if (view === "departments") {
        const response = await fetch(`${baseUrl}/api/graph/departments`, {
          next: { revalidate: GRAPH_REVALIDATE_SECONDS },
          signal: controller.signal,
        });

        if (!response.ok) {
          errors.push(`${baseUrl}/api/graph/departments -> HTTP ${response.status}`);
          continue;
        }
        const payload = (await response.json()) as BackendDepartmentGraph;
        ({ nodes, edges } = normalizeDepartmentGraph(payload));
        source = `${baseUrl}/api/graph/departments`;
      } else {
        const [employeesResponse, edgesResponse] = await Promise.all([
          fetch(`${baseUrl}/api/graph/employees`, {
            next: { revalidate: GRAPH_REVALIDATE_SECONDS },
            signal: controller.signal,
          }),
          fetch(`${baseUrl}/api/graph/edges`, {
            next: { revalidate: GRAPH_REVALIDATE_SECONDS },
            signal: controller.signal,
          }),
        ]);

        if (!employeesResponse.ok || !edgesResponse.ok) {
          errors.push(
            `${baseUrl} employee-graph -> HTTP employees:${employeesResponse.status} edges:${edgesResponse.status}`
          );
          continue;
        }

        const employees = (await employeesResponse.json()) as BackendEmployee[];
        const employeeEdges = (await edgesResponse.json()) as BackendEmployeeEdge[];
        ({ nodes, edges } = normalizeEmployeeGraph(employees, employeeEdges));
        source = `${baseUrl}/api/graph/employees + /api/graph/edges`;
      }

      return NextResponse.json(
        {
          nodes,
          edges,
          source,
          view,
        },
        {
          headers: {
            "Cache-Control": `public, max-age=${GRAPH_REVALIDATE_SECONDS}, s-maxage=${GRAPH_REVALIDATE_SECONDS}, stale-while-revalidate=59`,
          },
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${baseUrl}/${view} -> ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  return NextResponse.json(
    {
      nodes: [],
      edges: [],
      source: null,
      error: "All graph backends failed.",
      details: errors,
      view,
    },
    {
      headers: {
        "Cache-Control": `public, max-age=${GRAPH_REVALIDATE_SECONDS}, s-maxage=${GRAPH_REVALIDATE_SECONDS}, stale-while-revalidate=59`,
      },
    }
  );
}
