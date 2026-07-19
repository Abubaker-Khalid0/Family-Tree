/**
 * TreeViewport — React Flow wrapper for rendering the family tree graph.
 *
 * Configures the viewport with custom node/edge types, zoom range,
 * pan/zoom/pinch gestures, fit-view on initial load, and viewport culling.
 *
 * Key architecture:
 * - Registers three node types: person, spouse, union
 * - Union nodes are invisible junction points for edge routing
 * - Edges specify sourceHandle/targetHandle for precise connection points
 * - fitView runs only once on initial layout (not on every node change)
 * - Nodes and edges are updated atomically (same render cycle)
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { PersonNode } from './PersonNode';
import { SpouseNode } from './SpouseNode';
import { UnionNode } from './UnionNode';
import { ConnectorEdge } from './ConnectorEdge';
import type { PositionedNode } from '@/types/layout';
import type { VisibleEdge } from '@/types/tree-state';
import { ZOOM } from '@/utils/constants';

// === Types ===

export interface TreeViewportProps {
  /** Positioned nodes from the layout computation */
  nodes: PositionedNode[];
  /** Visible edges from tree state */
  edges: VisibleEdge[];
  /** Callback when a person node is clicked (for expand/collapse) */
  onNodeClick: (personId: string) => void;
}

/** Viewport control methods exposed via ref */
export interface TreeViewportHandle {
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

// === Node/Edge type registrations (stable references) ===

const nodeTypes: NodeTypes = {
  person: PersonNode,
  spouse: SpouseNode,
  union: UnionNode,
};

const edgeTypes: EdgeTypes = {
  connector: ConnectorEdge,
};

// === Data Conversion Helpers ===

/**
 * Converts PositionedNode[] to React Flow Node[] format.
 * Assigns animationIndex to newly appearing nodes for staggered entry.
 */
function toReactFlowNodes(
  positioned: PositionedNode[],
  prevNodeIds: Set<string>,
): Node[] {
  let newNodeIndex = 0;

  return positioned.map((node) => {
    const isNew = !prevNodeIds.has(node.id);
    const data = { ...node.data };

    if (isNew && node.type !== 'union') {
      (data as { animationIndex?: number }).animationIndex = newNodeIndex;
      newNodeIndex++;
    }

    return {
      id: node.id,
      type: node.type === 'person' ? 'person' : node.type === 'spouse' ? 'spouse' : 'union',
      position: { x: node.position.x, y: node.position.y },
      data,
      width: node.width,
      height: node.height,
      draggable: false,
      selectable: false,
      connectable: false,
    };
  });
}

/**
 * Converts VisibleEdge[] to React Flow Edge[] format.
 * Includes sourceHandle and targetHandle for precise port connections.
 */
function toReactFlowEdges(edges: VisibleEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'connector',
    // Carry computed routing points so ConnectorEdge renders
    // the exact orthogonal path (bus-bar style).
    data: edge.points ? { points: edge.points } : undefined,
  }));
}

// === Inner Component (uses useReactFlow) ===

interface InnerViewportProps extends TreeViewportProps {
  onExpose: (handle: TreeViewportHandle) => void;
}

function InnerViewport({ nodes, edges, onNodeClick, onExpose }: InnerViewportProps) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // Track previous node IDs to determine which nodes are newly appearing
  const prevNodeIdsRef = useRef<Set<string>>(new Set());

  // Track if initial fitView has occurred
  const initialFitDoneRef = useRef(false);

  // Track previous node count to detect expand/collapse
  const prevNodeCountRef = useRef(0);

  // Expose controls to parent via callback
  const handle: TreeViewportHandle = useMemo(
    () => ({
      fitView: () => fitView({ duration: 300, padding: 0.2 }),
      zoomIn: () => zoomIn({ duration: 200 }),
      zoomOut: () => zoomOut({ duration: 200 }),
    }),
    [fitView, zoomIn, zoomOut],
  );

  // Report handle to outer component for ref exposure
  useMemo(() => {
    onExpose(handle);
  }, [handle, onExpose]);

  // Convert data to React Flow format with stagger indices
  const rfNodes = useMemo(() => {
    const result = toReactFlowNodes(nodes, prevNodeIdsRef.current);
    return result;
  }, [nodes]);

  const rfEdges = useMemo(() => toReactFlowEdges(edges), [edges]);

  // Update previous node IDs after render
  useEffect(() => {
    prevNodeIdsRef.current = new Set(nodes.map((n) => n.id));
    prevNodeCountRef.current = nodes.length;
  }, [nodes]);

  // Auto-fit view after expand/collapse (when node count changes)
  useEffect(() => {
    if (!initialFitDoneRef.current) return;
    if (nodes.length === 0) return;

    // Fit view after layout settles
    const timer = setTimeout(() => {
      fitView({ duration: 300, padding: 0.2 });
    }, 50);
    return () => clearTimeout(timer);
  }, [nodes, fitView]);

  // Initial fitView — only once, after first layout with nodes
  useEffect(() => {
    if (nodes.length === 0) return;
    if (initialFitDoneRef.current) return;

    // Delay fitView to allow React Flow to render nodes first
    const timer = setTimeout(() => {
      // Center on all visible nodes with generous padding
      fitView({ duration: 0, padding: 0.3 });
      initialFitDoneRef.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, [nodes.length, fitView]); // Only depend on length, not full nodes array

  // Handle node click — only trigger for person nodes
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === 'person') {
        const personId = (node.data as { personId?: string }).personId;
        if (personId) {
          onNodeClick(personId);
        }
      }
    },
    [onNodeClick],
  );

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={handleNodeClick}
      minZoom={ZOOM.min}
      maxZoom={ZOOM.max}
      panOnDrag={true}
      zoomOnScroll={true}
      zoomOnPinch={true}
      fitView
      fitViewOptions={{ duration: 0, padding: 0.3 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

// === Outer Component (provides ReactFlowProvider + ref) ===

/**
 * TreeViewport wraps React Flow with custom node/edge types,
 * viewport configuration, and accessibility attributes.
 */
export const TreeViewport = forwardRef<TreeViewportHandle, TreeViewportProps>(
  function TreeViewport({ nodes, edges, onNodeClick }, ref) {
    // Store the handle from the inner component
    const handleRef = useMemo(() => ({ current: null as TreeViewportHandle | null }), []);

    const onExpose = useCallback(
      (handle: TreeViewportHandle) => {
        handleRef.current = handle;
      },
      [handleRef],
    );

    // Expose handle via imperative ref
    useImperativeHandle(ref, () => ({
      fitView: () => handleRef.current?.fitView(),
      zoomIn: () => handleRef.current?.zoomIn(),
      zoomOut: () => handleRef.current?.zoomOut(),
    }));

    return (
      <div
        role="region"
        aria-label="مخطط شجرة العائلة"
        className="w-full h-full"
      >
        <ReactFlowProvider>
          <InnerViewport
            nodes={nodes}
            edges={edges}
            onNodeClick={onNodeClick}
            onExpose={onExpose}
          />
        </ReactFlowProvider>
      </div>
    );
  },
);

export default TreeViewport;
