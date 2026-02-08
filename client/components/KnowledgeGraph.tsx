import type { OrgEdge, OrgNode } from "@/lib/types";

type Props = {
  nodes: OrgNode[];
  edges: OrgEdge[];
  onNodeClick: (node: OrgNode) => void;
};

const nodeColor = (status: OrgNode["status"]): { fill: string; stroke: string } => {
  if (status === "conflict") {
    return { fill: "#fdeceb", stroke: "#c0392b" };
  }
  if (status === "pending") {
    return { fill: "#fff4e4", stroke: "#b97a18" };
  }
  return { fill: "#e9f7ef", stroke: "#1f8a54" };
};

export function KnowledgeGraph({ nodes, edges, onNodeClick }: Props) {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return (
    <svg id="graphSvg" viewBox="0 0 720 460" role="img" aria-label="Knowledge graph">
      {edges.map((edge) => {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) {
          return null;
        }

        return (
          <line
            key={edge.id}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            className={`edge ${edge.status}`}
          />
        );
      })}

      {nodes.map((node) => {
        const { fill, stroke } = nodeColor(node.status);

        return (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={38}
              className="node-circle"
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
              onClick={() => onNodeClick(node)}
            />
            <text x={node.x} y={node.y + 5} className="node-label">
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
