/**
 * Layout type definitions.
 * These types represent the output of the ELK layout computation,
 * including positioned nodes with coordinates and dimensions.
 */

import type { VisibleNode, VisibleEdge } from './tree-state';

/**
 * A visible node augmented with computed position and dimensions
 * from the ELK layout engine.
 */
export interface PositionedNode extends VisibleNode {
  /** Computed position from the layout engine */
  position: {
    /** Horizontal coordinate (pixels) */
    x: number;
    /** Vertical coordinate (pixels) */
    y: number;
  };

  /** Computed or assigned width of the node (pixels) */
  width: number;

  /** Computed or assigned height of the node (pixels) */
  height: number;
}

/**
 * The complete result of an ELK layout computation.
 * Contains all positioned nodes, routed edges, and timing metadata.
 */
export interface LayoutResult {
  /** All nodes with computed positions and dimensions */
  nodes: PositionedNode[];

  /** All edges connecting the positioned nodes */
  edges: VisibleEdge[];

  /** Time in milliseconds taken by the ELK computation */
  computationTimeMs: number;
}
