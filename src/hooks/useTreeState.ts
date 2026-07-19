/**
 * useTreeState.ts
 * ------------------------------------------------------------------
 * Manages the expand/collapse state of the family tree and derives
 * the visible nodes and edges by traversing from root through expanded
 * nodes only. Uses a visited set to prevent infinite loops from linked
 * spouses and implements canonical ownership of shared children.
 *
 * KEY ARCHITECTURE:
 * - Every expanded person with spouses generates:
 *   - A spouse node for each known spouse
 *   - A union (junction) node per spouse entry (always, even with zero children)
 *   - Children connect FROM the union node, not from the spouse or person directly
 * - Unknown spouses (name matches "غير معروفة" etc.) skip the spouse node
 *   but still use a union junction for their children
 * - This ensures clean orthogonal routing with no ambiguous paths
 * ------------------------------------------------------------------
 */

import { useCallback, useMemo, useState } from 'react';
import type {
  DataAccess,
  Person,
  PersonNodeData,
  SpouseNodeData,
  UnionNodeData,
  VisibleEdge,
  VisibleNode,
} from '@/types';

/**
 * Public interface returned by useTreeState.
 */
export interface TreeState {
  expandedIds: Set<string>;
  visibleNodes: VisibleNode[];
  visibleEdges: VisibleEdge[];
  expand: (personId: string) => void;
  collapse: (personId: string) => void;
  collapseAll: () => void;
  toggleNode: (personId: string) => void;
}

/**
 * Hook that manages tree expand/collapse state and derives the set of
 * visible nodes and edges for rendering.
 *
 * On initial load, only the root node is shown (collapsed state).
 * Expanding a person reveals its spouse nodes, union junctions, and direct children.
 * The derivation uses useMemo keyed on expandedIds for performance.
 */
export function useTreeState(dataAccess: DataAccess): TreeState {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // --- Actions ---

  const expand = useCallback((personId: string) => {
    setExpandedIds(prev => {
      if (prev.has(personId)) return prev;
      const next = new Set(prev);
      next.add(personId);
      return next;
    });
  }, []);

  const collapse = useCallback((personId: string) => {
    setExpandedIds(prev => {
      if (!prev.has(personId)) return prev;
      const next = new Set(prev);
      next.delete(personId);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const toggleNode = useCallback((personId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }, []);

  // --- Derive visible nodes and edges ---

  const { visibleNodes, visibleEdges } = useMemo(() => {
    const nodes: VisibleNode[] = [];
    const edges: VisibleEdge[] = [];

    const root = dataAccess.getRoot();
    if (!root) {
      return { visibleNodes: nodes, visibleEdges: edges };
    }

    // Visited set prevents infinite loops from linked spouses
    const visitedPersons = new Set<string>();

    // Track added node IDs to prevent duplicates
    const addedNodeIds = new Set<string>();

    // BFS queue: each entry is [person, parentNodeId]
    const queue: Array<[Person, string | null]> = [[root, null]];

    while (queue.length > 0) {
      const [person, parentNodeId] = queue.shift()!;

      // Prevent infinite traversal — skip if already visited
      if (visitedPersons.has(person.id)) {
        continue;
      }
      visitedPersons.add(person.id);

      const isExpanded = expandedIds.has(person.id);
      const isExpandable = dataAccess.personHasExpandableBranch(person);
      const isRoot = parentNodeId === null;

      // Build PersonNodeData
      const personNodeData: PersonNodeData = {
        personId: person.id,
        name: person.name,
        relation: person.relation,
        notes: person.notes,
        gender: person.gender,
        isExpanded,
        isExpandable,
        isRoot,
      };

      // Add person node (guard against duplicate IDs)
      if (!addedNodeIds.has(person.id)) {
        const personNode: VisibleNode = {
          id: person.id,
          type: 'person',
          personId: person.id,
          parentNodeId,
          data: personNodeData,
        };
        nodes.push(personNode);
        addedNodeIds.add(person.id);
      }

      // If not expanded, don't process children
      if (!isExpanded) {
        continue;
      }

      // Process spouses in data array order
      for (const spouse of person.spouses) {
        const isUnknownName = dataAccess.isSpouseNameUnknown(spouse);
        const spouseNodeId = `${person.id}:${spouse.id}`;
        const unionNodeId = `union:${person.id}:${spouse.id}`;

        if (!isUnknownName) {
          // Add spouse node
          const spouseDisplayName = dataAccess.getSpouseDisplayName(spouse);
          const isLinked = spouse.type === 'linked';

          const spouseNodeData: SpouseNodeData = {
            spouseId: spouse.id,
            name: spouseDisplayName,
            label: spouse.label,
            type: spouse.type,
            isLinked,
            isHidden: false,
          };

          if (!addedNodeIds.has(spouseNodeId)) {
            const spouseNode: VisibleNode = {
              id: spouseNodeId,
              type: 'spouse',
              personId: person.id,
              spouseId: spouse.id,
              parentNodeId: person.id,
              data: spouseNodeData,
            };
            nodes.push(spouseNode);
            addedNodeIds.add(spouseNodeId);
          }

          // Edge: person -> spouse
          edges.push({
            id: `edge-${person.id}-to-${spouseNodeId}`,
            source: person.id,
            target: spouseNodeId,
            sourceHandle: 'source-bottom',
            targetHandle: 'target-top',
          });
        }

        // Resolve children with canonical ownership check
        const children = dataAccess.getSpouseChildren(spouse);
        const canonicalChildren = children.filter(child => !visitedPersons.has(child.id));

        // Always add union junction node for every spouse entry
        // (even with zero canonical children, to keep topology complete)
        const unionNodeData: UnionNodeData = {
          personId: person.id,
          spouseId: spouse.id,
          isUnion: true,
        };

        if (!addedNodeIds.has(unionNodeId)) {
          const unionNode: VisibleNode = {
            id: unionNodeId,
            type: 'union',
            personId: person.id,
            spouseId: spouse.id,
            parentNodeId: isUnknownName ? person.id : spouseNodeId,
            data: unionNodeData,
          };
          nodes.push(unionNode);
          addedNodeIds.add(unionNodeId);
        }

        // Edge: spouse (or person for unknown) -> union
        if (!isUnknownName) {
          edges.push({
            id: `edge-${spouseNodeId}-to-${unionNodeId}`,
            source: spouseNodeId,
            target: unionNodeId,
            sourceHandle: 'source-bottom',
            targetHandle: 'target-top',
          });
        } else {
          edges.push({
            id: `edge-${person.id}-to-${unionNodeId}`,
            source: person.id,
            target: unionNodeId,
            sourceHandle: 'source-bottom',
            targetHandle: 'target-top',
          });
        }

        // Add children connected from the union node
        for (const child of canonicalChildren) {
          edges.push({
            id: `edge-${unionNodeId}-to-${child.id}`,
            source: unionNodeId,
            target: child.id,
            sourceHandle: 'source-bottom',
            targetHandle: 'target-top',
          });

          // Enqueue child for processing
          queue.push([child, unionNodeId]);
        }
      }
    }

    // Development-only: validate graph integrity
    if (import.meta.env.DEV) {
      const nodeIds = new Set(nodes.map(n => n.id));
      const orphanEdges = edges.filter(e => !nodeIds.has(e.source) || !nodeIds.has(e.target));
      if (orphanEdges.length > 0) {
        console.warn(
          `[TreeState] ${orphanEdges.length} orphan edge(s) detected:`,
          orphanEdges.map(e => `${e.id}: ${e.source} → ${e.target}`),
        );
      }
      // Check for duplicate edge IDs
      const edgeIds = new Set<string>();
      for (const e of edges) {
        if (edgeIds.has(e.id)) {
          console.warn(`[TreeState] Duplicate edge ID: ${e.id}`);
        }
        edgeIds.add(e.id);
      }
    }

    return { visibleNodes: nodes, visibleEdges: edges };
  }, [expandedIds, dataAccess]);

  return {
    expandedIds,
    visibleNodes,
    visibleEdges,
    expand,
    collapse,
    collapseAll,
    toggleNode,
  };
}
