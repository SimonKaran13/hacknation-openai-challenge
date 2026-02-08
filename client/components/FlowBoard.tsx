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

const hashToOffset = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 5;
  }
  return 20 + hash * 10;
};

export function FlowBoard({ nodes, edges, selectedNodeId, onNodeSelect }: Props) {
  const translateExtent = useMemo<[[number, number], [number, number]]>(() => {
    if (!nodes.length) {
      return [
        [-400, -300],
        [1120, 760],
      ];
    }

    const minX = Math.min(...nodes.map((node) => node.x));
    const maxX = Math.max(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxY = Math.max(...nodes.map((node) => node.y));
    const nodeWidth = 180;
    const nodeHeight = 64;
    const viewportPadding = 280;

    return [
      [minX - viewportPadding, minY - viewportPadding],
      [maxX + nodeWidth + viewportPadding, maxY + nodeHeight + viewportPadding],
    ];
  }, [nodes]);

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
        pathOptions: {
          offset: hashToOffset(`${edge.source}->${edge.target}`),
          borderRadius: 10,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edge.status === "conflict" ? "#f97373" : edge.status === "pending" ? "#fbbf24" : "#60a5fa",
        },
        style: {
          strokeWidth:
            edge.status === "conflict"
              ? 2.4
              : edge.weight
                ? Math.max(1.4, Math.min(4.2, 1.2 + edge.weight * 0.45))
                : 1.8,
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
      translateExtent={translateExtent}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onNodeSelect(node.id)}
      proOptions={{ hideAttribution: true }}
      panOnDrag
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
    >
      <Background color="rgba(148,163,184,0.2)" size={1.4} gap={22} />
      <Controls position="bottom-right" showInteractive={false} />
    </ReactFlow>
  );
}
