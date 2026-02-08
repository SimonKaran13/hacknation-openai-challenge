"use client";

import { memo, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import type { OrgEdge, OrgNode } from "@/lib/types";

type FlowNodeData = {
  label: string;
  status: OrgNode["status"];
  selected: boolean;
};

type Props = {
  nodes: OrgNode[];
  edges: OrgEdge[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
};

const StatusNode = memo(({ data }: NodeProps<FlowNodeData>) => {
  return (
    <div className={`flow-node ${data.status} ${data.selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="flow-handle" />
      <div className="flow-node-dot" />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} className="flow-handle" />
    </div>
  );
});

StatusNode.displayName = "StatusNode";

const nodeTypes = { statusNode: StatusNode };

export function FlowBoard({ nodes, edges, selectedNodeId, onNodeSelect }: Props) {
  const flowNodes = useMemo<Node<FlowNodeData>[]>(
    () =>
      nodes.map((node) => ({
        id: node.id,
        type: "statusNode",
        position: { x: node.x, y: node.y },
        draggable: false,
        selectable: false,
        data: {
          label: node.label,
          status: node.status,
          selected: node.id === selectedNodeId,
        },
      })),
    [nodes, selectedNodeId]
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: edge.status !== "aligned",
        className: `flow-edge ${edge.status}`,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edge.status === "conflict" ? "#f97373" : edge.status === "pending" ? "#fbbf24" : "#60a5fa",
        },
        style: {
          strokeWidth: edge.status === "conflict" ? 2.2 : 1.8,
        },
      })),
    [edges]
  );

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onNodeSelect(node.id)}
      proOptions={{ hideAttribution: true }}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
    >
      <Background color="rgba(148,163,184,0.2)" size={1.4} gap={22} />
      <Controls position="bottom-right" showInteractive={false} />
    </ReactFlow>
  );
}
