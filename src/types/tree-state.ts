/**
 * Tree state type definitions.
 * These types represent the visual state of the family tree,
 * including which nodes and edges are currently visible based on the expand state.
 */

// === Node Data Types ===

/**
 * Data payload for a person node in the visual tree.
 * Contains all display-relevant information derived from the Person model.
 */
export interface PersonNodeData {
  /** The underlying Person's unique ID */
  personId: string;

  /** Display name (Arabic) */
  name: string;

  /** Relationship description or notes text used as secondary display */
  relation: string;

  /** Additional notes about the person */
  notes: string;

  /** Gender of the person */
  gender: 'male' | 'female';

  /** Whether this node is currently expanded (showing children) */
  isExpanded: boolean;

  /** Whether this node can be expanded (has spouse entries with children) */
  isExpandable: boolean;

  /** Whether this node is the root of the tree */
  isRoot: boolean;

  /** Index for staggered entry animation (0-based, used to compute delay) */
  animationIndex?: number;
}

/**
 * Data payload for a spouse node in the visual tree.
 * Contains display-relevant information derived from the Spouse model.
 */
export interface SpouseNodeData {
  /** The underlying Spouse entry's unique ID */
  spouseId: string;

  /** Resolved display name for the spouse */
  name: string;

  /** Descriptive label (e.g., "الزوجة الأولى") */
  label: string;

  /** Whether this is an external or linked spouse */
  type: 'external' | 'linked';

  /** Whether this spouse references another person in the tree */
  isLinked: boolean;

  /**
   * Whether this spouse node should be visually hidden.
   * True when the resolved name matches unknown patterns,
   * in which case children connect directly to the parent person node.
   */
  isHidden: boolean;

  /** Index for staggered entry animation (0-based, used to compute delay) */
  animationIndex?: number;
}

/**
 * Data payload for a union (junction) node in the visual tree.
 * This is an invisible node that represents the marriage/union point
 * from which children descend. It provides clean edge routing.
 */
export interface UnionNodeData {
  /** The parent person's ID */
  personId: string;

  /** The spouse entry's ID */
  spouseId: string;

  /** This is always a union node */
  isUnion: true;
}

// === Expand State ===

/**
 * Represents the set of currently expanded person IDs.
 * A person ID in this set means its immediate spouse nodes and children are visible.
 */
export type ExpandState = Set<string>;

// === Visible Tree Structure ===

/**
 * Represents a node visible in the rendered tree.
 * Each visible node corresponds to either a person, a spouse, or a union junction
 * in the current expand state.
 */
export interface VisibleNode {
  /**
   * Unique node key in the visual tree.
   * For person nodes: the personId.
   * For spouse nodes: a compound key (e.g., "personId:spouseId").
   * For union nodes: a compound key (e.g., "union:personId:spouseId").
   */
  id: string;

  /** Whether this node represents a person, spouse, or union junction */
  type: 'person' | 'spouse' | 'union';

  /** The person this node represents or belongs to */
  personId: string;

  /** For spouse nodes, the ID of the spouse entry */
  spouseId?: string;

  /** Parent node ID in the visual hierarchy, or null for the root node */
  parentNodeId: string | null;

  /** Display data for this node (PersonNodeData, SpouseNodeData, or UnionNodeData) */
  data: PersonNodeData | SpouseNodeData | UnionNodeData;
}

/**
 * Represents a visible edge (connector) between two nodes in the rendered tree.
 */
export interface RoutePoint {
  x: number;
  y: number;
}

export interface VisibleEdge {
  /** Unique edge identifier */
  id: string;

  /** Source node ID (parent side of the connection) */
  source: string;

  /** Target node ID (child side of the connection) */
  target: string;

  /** Optional source handle ID for precise connection */
  sourceHandle?: string;

  /** Optional target handle ID for precise connection */
  targetHandle?: string;

  /**
   * Orthogonal routing points computed by the ELK layout engine
   * (absolute coordinates: start → bend points → end).
   * When present, the edge is rendered along these points instead of
   * React Flow's default step routing, producing clean tree "bus bar"
   * connectors that all siblings share.
   */
  points?: RoutePoint[];
}
