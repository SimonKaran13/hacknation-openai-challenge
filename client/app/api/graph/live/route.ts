import { NextResponse } from "next/server";
import type { OrgEdge, OrgNode } from "@/lib/types";

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

const BACKEND_URL =
  process.env.BACKEND_URL ?? "https://hacknation-openai-challenge.onrender.com";

const positionFor = (index: number, total: number, x: number): { x: number; y: number } => {
  if (total <= 1) {
    return { x, y: 230 };
  }
  const top = 72;
  const bottom = 390;
  const step = (bottom - top) / (total - 1);
  return { x, y: Math.round(top + index * step) };
};

export async function GET() {
  const response = await fetch(`${BACKEND_URL}/api/graph/knowledge`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to load graph from backend API." },
      { status: response.status }
    );
  }

  const payload = (await response.json()) as BackendKnowledgeGraph;
  const employeeNodes = payload.nodes.filter((node) => node.type === "employee");
  const topicNodes = payload.nodes.filter((node) => node.type === "topic");
  const allNodeIds = new Set(payload.nodes.map((node) => node.id));

  const nodes: OrgNode[] = [
    ...employeeNodes.map((node, index) => {
      const position = positionFor(index, employeeNodes.length, 190);
      return {
        id: node.id,
        label: node.name,
        type: "stakeholder",
        x: position.x,
        y: position.y,
        latest: `Role: ${node.role ?? "Unknown"}`,
        owner: node.name,
        deps: "Sourced from backend employee graph.",
        status: "aligned",
      } satisfies OrgNode;
    }),
    ...topicNodes.map((node, index) => {
      const position = positionFor(index, topicNodes.length, 540);
      return {
        id: node.id,
        label: node.name,
        type: "decision",
        x: position.x,
        y: position.y,
        latest: "Knowledge topic extracted from communication edges.",
        owner: "Org Graph API",
        deps: "Derived from comm edge topics in SQLite.",
        status: "aligned",
      } satisfies OrgNode;
    }),
  ];

  const edges: OrgEdge[] = payload.edges
    .filter((edge) => allNodeIds.has(edge.source) && allNodeIds.has(edge.target))
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 80)
    .map((edge, index) => ({
      id: `api-edge-${index + 1}`,
      source: edge.source,
      target: edge.target,
      status: "aligned",
    }));

  return NextResponse.json({
    nodes,
    edges,
    source: "backend:/api/graph/knowledge",
  });
}
