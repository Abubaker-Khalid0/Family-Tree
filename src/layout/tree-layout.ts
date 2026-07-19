/**
 * tree-layout.ts
 * ------------------------------------------------------------------
 * Custom recursive layout engine for the family tree.
 * Computes absolute positions for all visible nodes and SVG path
 * strings for all connector edges.
 *
 * Layout strategy:
 * - Top-down recursive subtree sizing (leaf-first width calculation)
 * - Each expanded person shows spouses below, then children below spouses
 * - Orthogonal connectors with rounded corners (bus-bar pattern)
 * - Progressive reveal: only expanded nodes show their branches
 * ------------------------------------------------------------------
 */

import type { DataAccess, Person, Spouse } from '@/types';

// === Layout Constants ===

export const NODE_W = 140;
export const NODE_H = 48;
export const SPOUSE_W = 120;
export const SPOUSE_H = 36;
export const UNION_H = 2;
export const V_GAP = 40;
export const ROW_H = NODE_H + V_GAP;
export const H_GAP = 8;
export const MARRIAGE_GAP = 14;

// === Output Types ===

export type LaidNode = {
  id: string;
  kind: 'person' | 'spouse' | 'root';
  personId: string;
  name: string;
  relation: string;
  notes: string;
  gender: 'male' | 'female';
  x: number;
  y: number;
  w: number;
  h: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isExpandable: boolean;
  spouseCount: number;
  childCount: number;
  isLinked?: boolean;
  spouseLabel?: string;
  /** When person has exactly one known spouse, her name is shown inline */
  singleSpouseName?: string;
};

export type LaidEdge = {
  id: string;
  d: string;
};

export type LayoutResult = {
  width: number;
  height: number;
  nodes: LaidNode[];
  edges: LaidEdge[];
};

type SubtreeResult = {
  width: number;
  height: number;
  personCenterX: number;
  nodes: LaidNode[];
  edges: LaidEdge[];
};

// === Path Utilities ===

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

/**
 * Orthogonal connector from (x1,y1) to (x2,y2).
 * Goes vertical → horizontal → vertical with small rounded corners.
 * Handles edge cases where distances are too small for curves.
 */
function orth(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(x1 - x2) < 1) return line(x1, y1, x2, y2);
  const midY = y1 + (y2 - y1) / 2;

  // Clamp radius based on available space
  const maxR = 6;
  const halfDx = Math.abs(x2 - x1) / 2;
  const halfDyTop = Math.abs(midY - y1);
  const halfDyBot = Math.abs(y2 - midY);
  const r = Math.min(maxR, halfDx, halfDyTop, halfDyBot);

  if (r < 1) {
    // Not enough space for curves, just draw straight lines
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }

  const dx = Math.sign(x2 - x1);
  const dy1 = Math.sign(midY - y1);
  const dy2 = Math.sign(y2 - midY);
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${midY - r * dy1}`,
    `Q ${x1} ${midY} ${x1 + r * dx} ${midY}`,
    `L ${x2 - r * dx} ${midY}`,
    `Q ${x2} ${midY} ${x2} ${midY + r * dy2}`,
    `L ${x2} ${y2}`,
  ].join(' ');
}

function shiftPath(d: string, dx: number, _dy: number): string {
  return d.replace(/([MLQ])\s*([-\d.]+)\s+([-\d.]+)/g, (_m, cmd, x, yv) => {
    const nx = parseFloat(x) + dx;
    const ny = parseFloat(yv) + _dy;
    return `${cmd} ${nx} ${ny}`;
  });
}

// === Layout Engine ===

function layoutSubtree(
  person: Person,
  dataAccess: DataAccess,
  expanded: Set<string>,
  visited: Set<string>,
  y: number,
  isRoot: boolean,
): SubtreeResult {
  // Prevent infinite loops from linked spouses
  if (visited.has(person.id)) {
    return { width: 0, height: 0, personCenterX: 0, nodes: [], edges: [] };
  }
  visited.add(person.id);

  const isExpandable = dataAccess.personHasExpandableBranch(person);
  const isOpen = expanded.has(person.id);
  const spouses = person.spouses;

  const personNode = (x: number, inlineSpouseName?: string): LaidNode => ({
    id: person.id,
    kind: isRoot ? 'root' : 'person',
    personId: person.id,
    name: person.name,
    relation: person.relation,
    notes: person.notes,
    gender: person.gender,
    x,
    y,
    w: NODE_W,
    h: NODE_H,
    hasChildren: isExpandable,
    isExpanded: isOpen,
    isExpandable,
    spouseCount: spouses.length,
    childCount: spouses.reduce((s, sp) => s + sp.childrenIds.length, 0),
    singleSpouseName: inlineSpouseName,
  });

  if (!isOpen || spouses.length === 0) {
    // Even when collapsed, show single spouse name inline
    const closedKnownSpouses = spouses.filter(sp => !dataAccess.isSpouseNameUnknown(sp));
    const closedSingleSpouse = closedKnownSpouses.length === 1 ? closedKnownSpouses[0] : null;
    const closedSpouseName = closedSingleSpouse ? dataAccess.getSpouseDisplayName(closedSingleSpouse) : undefined;
    return {
      width: NODE_W,
      height: NODE_H,
      personCenterX: NODE_W / 2,
      nodes: [personNode(0, closedSpouseName)],
      edges: [],
    };
  }

  // Determine if we need a spouse row or can skip directly to children
  // Skip spouse row when: all spouses unknown OR only one known spouse (shown inline)
  const knownSpouses = spouses.filter(sp => !dataAccess.isSpouseNameUnknown(sp));
  const singleKnownSpouse = knownSpouses.length === 1 ? knownSpouses[0] : null;
  // Show separate spouse row only when there are 2+ known spouses
  const hasVisibleSpouseRow = knownSpouses.length >= 2;
  const spouseY = hasVisibleSpouseRow ? y + ROW_H : y;
  const childY = hasVisibleSpouseRow ? y + 2 * ROW_H : y + ROW_H;

  type Block = {
    spouse: Spouse;
    childLayouts: SubtreeResult[];
    childrenWidth: number;
    blockWidth: number;
    maxChildHeight: number;
    isUnknown: boolean;
  };

  // Determine which spouses to show.
  // If any child in any spouse group is expanded, show only that spouse's block.
  const eligibleSpouses = spouses.filter(sp => sp.childrenIds.length > 0 || !dataAccess.isSpouseNameUnknown(sp));

  // Check if any spouse has an expanded child — if so, focus on that spouse only
  const focusedSpouse = eligibleSpouses.find(sp => {
    const children = dataAccess.getSpouseChildren(sp);
    return children.some(c => expanded.has(c.id));
  });
  const visibleSpouses = focusedSpouse ? [focusedSpouse] : eligibleSpouses;

  const blocks: Block[] = visibleSpouses
    .map((sp) => {
      // Treat as "no separate node" if unknown OR if it's the single known spouse (shown inline)
      const isUnknown = dataAccess.isSpouseNameUnknown(sp) || (singleKnownSpouse !== null && singleKnownSpouse !== undefined && sp.id === singleKnownSpouse.id);
      const children = dataAccess.getSpouseChildren(sp);

      // Focus mode: if any child is expanded, show only that child
      const expandedChild = children.find(c => expanded.has(c.id));
      const visibleChildren = expandedChild ? [expandedChild] : children;

      const childLayouts = visibleChildren.map((c) =>
        layoutSubtree(c, dataAccess, expanded, visited, childY, false),
      );
      const childrenWidth =
        childLayouts.reduce((s, c) => s + c.width, 0) +
        Math.max(0, childLayouts.length - 1) * H_GAP;
      const blockWidth = Math.max(childrenWidth, SPOUSE_W, NODE_W);
      const maxChildHeight = childLayouts.reduce((h, c) => Math.max(h, c.height), 0);
      return { spouse: sp, childLayouts, childrenWidth, blockWidth, maxChildHeight, isUnknown };
    });

  if (blocks.length === 0) {
    return {
      width: NODE_W,
      height: NODE_H,
      personCenterX: NODE_W / 2,
      nodes: [personNode(0)],
      edges: [],
    };
  }

  const totalWidth = Math.max(
    NODE_W,
    blocks.reduce((s, b) => s + b.blockWidth, 0) +
      Math.max(0, blocks.length - 1) * MARRIAGE_GAP,
  );

  const personCenterX = totalWidth / 2;
  const inlineSpouseName = singleKnownSpouse ? dataAccess.getSpouseDisplayName(singleKnownSpouse) : undefined;
  const nodes: LaidNode[] = [personNode(personCenterX - NODE_W / 2, inlineSpouseName)];
  const edges: LaidEdge[] = [];

  let cursor = 0;
  let maxBottom = spouseY + SPOUSE_H;

  // First pass: place spouse nodes and collect their center positions
  const spouseCenters: number[] = [];

  for (const b of blocks) {
    const blockCenterX = cursor + b.blockWidth / 2;

    if (!b.isUnknown) {
      // Add spouse node
      const spouseX = blockCenterX - SPOUSE_W / 2;
      const spouseDisplayName = dataAccess.getSpouseDisplayName(b.spouse);

      nodes.push({
        id: `${person.id}:${b.spouse.id}`,
        kind: 'spouse',
        personId: person.id,
        name: spouseDisplayName,
        relation: b.spouse.label,
        notes: '',
        gender: b.spouse.type === 'linked' && b.spouse.personId
          ? (dataAccess.getPerson(b.spouse.personId)?.gender ?? 'female')
          : 'female',
        x: spouseX,
        y: spouseY,
        w: SPOUSE_W,
        h: SPOUSE_H,
        hasChildren: false,
        isExpanded: false,
        isExpandable: false,
        spouseCount: 0,
        childCount: 0,
        isLinked: b.spouse.type === 'linked',
        spouseLabel: b.spouse.label,
      });

      spouseCenters.push(blockCenterX);
    } else {
      spouseCenters.push(blockCenterX);
    }

    cursor += b.blockWidth + MARRIAGE_GAP;
  }

  // Draw edges from person to spouses using fan-out bus pattern
  // (vertical line down from person, then horizontal bus, then vertical drops to each spouse)
  const knownSpouseCenters = spouseCenters.filter((_, i) => !blocks[i]?.isUnknown);

  if (knownSpouseCenters.length === 1) {
    // Single spouse: direct orthogonal connection
    const knownBlock = blocks.find(b => b && !b.isUnknown);
    if (knownBlock && knownSpouseCenters[0] !== undefined) {
      edges.push({
        id: `e-${person.id}-${knownBlock.spouse.id}-spouse`,
        d: orth(personCenterX, y + NODE_H, knownSpouseCenters[0], spouseY),
      });
    }
  } else if (knownSpouseCenters.length > 1) {
    // Multiple spouses: fan-out pattern
    // Vertical line from person down to spouse bus Y
    const spouseBusY = y + NODE_H + (V_GAP * 0.4);
    edges.push({
      id: `e-${person.id}-spouse-stem`,
      d: line(personCenterX, y + NODE_H, personCenterX, spouseBusY),
    });

    // Horizontal bus connecting all spouse centers
    const validCenters = knownSpouseCenters.filter((c) => c !== undefined) as number[];
    if (validCenters.length > 0) {
      const first = Math.min(...validCenters);
      const last = Math.max(...validCenters);
      edges.push({
        id: `e-${person.id}-spouse-bus-h`,
        d: line(first, spouseBusY, last, spouseBusY),
      });

      // Vertical drops from bus to each spouse
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (block && !block.isUnknown && spouseCenters[i] !== undefined) {
          const cx = spouseCenters[i]!;
          edges.push({
            id: `e-${person.id}-${block.spouse.id}-spouse-drop`,
            d: line(cx, spouseBusY, cx, spouseY),
          });
        }
      }
    }
  }

  // Handle unknown spouses connectors
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block && block.isUnknown && block.childLayouts.length > 0 && spouseCenters[i] !== undefined) {
      const blockCenterX = spouseCenters[i]!;
      const busY = childY - V_GAP / 2;
      edges.push({
        id: `e-${person.id}-${block.spouse.id}-bus-down`,
        d: orth(personCenterX, y + NODE_H, blockCenterX, busY),
      });
    }
  }

  // Second pass: lay out children for each block
  cursor = 0;
  for (const b of blocks) {
    const blockCenterX = cursor + b.blockWidth / 2;

    if (b.childLayouts.length > 0) {
      const busY = childY - V_GAP / 2;

      if (!b.isUnknown) {
        // Spouse bottom to children bus
        edges.push({
          id: `e-${b.spouse.id}-bus-down`,
          d: line(blockCenterX, spouseY + SPOUSE_H, blockCenterX, busY),
        });
      }

      let childCursor = blockCenterX - b.childrenWidth / 2;
      const childCentersAbs: number[] = [];

      for (const cl of b.childLayouts) {
        if (cl.width === 0) {
          continue; // Skip empty layouts (visited nodes)
        }
        for (const n of cl.nodes) {
          nodes.push({ ...n, x: n.x + childCursor });
        }
        for (const e of cl.edges) {
          edges.push({ id: e.id, d: shiftPath(e.d, childCursor, 0) });
        }
        childCentersAbs.push(childCursor + cl.personCenterX);
        childCursor += cl.width + H_GAP;
      }

      // Horizontal bus bar connecting siblings
      if (childCentersAbs.length > 1) {
        const first = childCentersAbs[0]!;
        const last = childCentersAbs[childCentersAbs.length - 1]!;
        edges.push({
          id: `e-${b.spouse.id}-bus-h`,
          d: line(first, busY, last, busY),
        });
      }

      // Drop lines from bus to each child
      for (let i = 0; i < childCentersAbs.length; i++) {
        const cx = childCentersAbs[i]!;
        edges.push({
          id: `e-${b.spouse.id}-drop-${i}`,
          d: line(cx, busY, cx, childY),
        });
      }

      maxBottom = Math.max(maxBottom, childY + b.maxChildHeight);
    }

    cursor += b.blockWidth + MARRIAGE_GAP;
  }

  return {
    width: totalWidth,
    height: maxBottom - y,
    personCenterX,
    nodes,
    edges,
  };
}

/**
 * Computes the full tree layout starting from the root person.
 */
export function layoutFamily(
  dataAccess: DataAccess,
  expanded: Set<string>,
): LayoutResult {
  const PAD = 48;
  const root = dataAccess.getRoot();
  if (!root) {
    return { width: 0, height: 0, nodes: [], edges: [] };
  }

  const visited = new Set<string>();
  const s = layoutSubtree(root, dataAccess, expanded, visited, PAD, true);

  // Shift all by PAD on x for margin
  const nodes = s.nodes.map((n) => ({ ...n, x: n.x + PAD }));
  const edges = s.edges.map((e) => ({ id: e.id, d: shiftPath(e.d, PAD, 0) }));

  return {
    width: s.width + PAD * 2,
    height: s.height + PAD * 2,
    nodes,
    edges,
  };
}
