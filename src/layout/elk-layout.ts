/**
 * ELK Layout Module.
 * Computes node positions using the ELK layered algorithm
 * configured for top-to-bottom direction with orthogonal edge routing.
 *
 * Post-layout, edges are computed manually using a "bus bar" pattern
 * (like professional genealogy charts) instead of ELK's edge routing.
 * This produces clean connectors where siblings share a horizontal line.
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import type { VisibleNode, VisibleEdge, RoutePoint } from '../types/tree-state';
import type { PositionedNode, LayoutResult } from '../types/layout';
import { NODE_DIMENSIONS, SPACING } from '../utils/constants';

const elk = new ELK();

/**
 * Computes the layout for visible nodes and edges using the ELK layered algorithm.
 *
 * @param nodes - The visible nodes to position
 * @param edges - The visible edges connecting the nodes
 * @param isMobile - Whether to use mobile node dimensions
 * @returns A LayoutResult with positioned nodes, edges, and computation time
 */
export async function computeElkLayout(
  nodes: VisibleNode[],
  edges: VisibleEdge[],
  isMobile: boolean
): Promise<LayoutResult> {
  const startTime = performance.now();

  // Determine node dimensions based on viewport
  const personDims = isMobile
    ? NODE_DIMENSIONS.personNode.mobile
    : NODE_DIMENSIONS.personNode.desktop;
  const spouseDims = isMobile
    ? NODE_DIMENSIONS.spouseNode.mobile
    : NODE_DIMENSIONS.spouseNode.desktop;
  const unionDims = isMobile
    ? NODE_DIMENSIONS.unionNode.mobile
    : NODE_DIMENSIONS.unionNode.desktop;

  // Build ELK graph
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(SPACING.elkVerticalSpacing),
      'elk.spacing.nodeNode': String(SPACING.elkHorizontalSpacing),
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.nodePlacement.networkSimplex.nodeFlexibility.default': 'NODE_SIZE',
    },
    children: nodes.map((node) => {
      let dims: { width: number; height: number };
      const layoutOpts: Record<string, string> = {};

      if (node.type === 'union') {
        dims = unionDims;
        layoutOpts['elk.layered.layering.layerConstraint'] = 'NONE';
      } else if (node.type === 'spouse') {
        dims = spouseDims;
      } else {
        dims = personDims;
      }

      return {
        id: node.id,
        width: dims.width,
        height: dims.height,
        layoutOptions: layoutOpts,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layoutResult = await elk.layout(elkGraph);

  // Map ELK results back to PositionedNode[]
  const positionedNodes: PositionedNode[] = nodes.map((node) => {
    const elkNode = layoutResult.children?.find((child) => child.id === node.id);
    let dims: { width: number; height: number };

    if (node.type === 'union') {
      dims = unionDims;
    } else if (node.type === 'spouse') {
      dims = spouseDims;
    } else {
      dims = personDims;
    }

    return {
      ...node,
      position: {
        x: elkNode?.x ?? 0,
        y: elkNode?.y ?? 0,
      },
      width: dims.width,
      height: dims.height,
    };
  });

  // --- Manual "bus bar" edge routing ---
  // Instead of ELK's edge routing (which routes each edge independently),
  // we compute orthogonal connectors using positioned node coordinates.
  // For each edge: source-bottom-center → target-top-center via an
  // orthogonal midpoint (professional genealogy "bus bar" style).
  const nodeMap = new Map<string, PositionedNode>();
  for (const n of positionedNodes) {
    nodeMap.set(n.id, n);
  }

  const routedEdges: VisibleEdge[] = edges.map((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);

    if (!source || !target) {
      return edge;
    }

    // Source: bottom-center
    const sx = source.position.x + source.width / 2;
    const sy = source.position.y + source.height;

    // Target: top-center
    const tx = target.position.x + target.width / 2;
    const ty = target.position.y;

    // Midpoint Y for the horizontal segment (halfway between source bottom and target top)
    const midY = sy + (ty - sy) / 2;

    let points: RoutePoint[];

    if (Math.abs(sx - tx) < 1) {
      // Straight vertical line (no bend needed)
      points = [
        { x: sx, y: sy },
        { x: tx, y: ty },
      ];
    } else {
      // Orthogonal connector: down → horizontal → down
      points = [
        { x: sx, y: sy },
        { x: sx, y: midY },
        { x: tx, y: midY },
        { x: tx, y: ty },
      ];
    }

    return { ...edge, points };
  });

  const computationTimeMs = performance.now() - startTime;

  return {
    nodes: positionedNodes,
    edges: routedEdges,
    computationTimeMs,
  };
}
