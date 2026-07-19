/**
 * useTreeKeyboard.ts
 * ------------------------------------------------------------------
 * Provides arrow-key navigation within the family tree based on the
 * logical tree hierarchy. Handles:
 * - Right/Left arrows: move between siblings (RTL-aware)
 * - Down arrow: move to first child of focused node
 * - Up arrow: move to parent of focused node
 *
 * Tab and Enter/Space are handled natively by the browser and
 * PersonNode's onKeyDown handler respectively.
 *
 * Validates: Requirements 15.1, 15.2
 */

import { useCallback, useMemo } from 'react';
import type { VisibleNode, VisibleEdge } from '@/types';

/**
 * Options for the useTreeKeyboard hook.
 */
export interface UseTreeKeyboardOptions {
  /** Currently visible nodes in the tree */
  visibleNodes: VisibleNode[];
  /** Currently visible edges in the tree */
  visibleEdges: VisibleEdge[];
  /** Callback to toggle expand/collapse on a person node */
  toggleNode: (personId: string) => void;
}

/**
 * Return value from the useTreeKeyboard hook.
 */
export interface UseTreeKeyboardResult {
  /** Attach this as an onKeyDown handler to the tree container */
  handleKeyDown: (event: React.KeyboardEvent) => void;
}

/**
 * Finds the React Flow node DOM element for a given node ID and focuses
 * the interactive button element within it.
 */
function focusNodeById(nodeId: string): void {
  // React Flow renders nodes with data-id attribute
  const nodeEl = document.querySelector(
    `[data-id="${nodeId}"]`,
  ) as HTMLElement | null;

  if (!nodeEl) return;

  // Focus the role="button" element inside the node, or the node itself
  const buttonEl = nodeEl.querySelector('[role="button"]') as HTMLElement | null;
  if (buttonEl) {
    buttonEl.focus();
  } else {
    // For leaf nodes or spouse nodes, focus the first focusable element
    const focusable = nodeEl.querySelector('[tabindex]') as HTMLElement | null;
    if (focusable) {
      focusable.focus();
    }
  }
}

/**
 * Gets the node ID from the currently focused element by traversing up
 * the DOM to find the React Flow node wrapper with data-id.
 */
function getActiveNodeId(): string | null {
  const activeEl = document.activeElement;
  if (!activeEl) return null;

  // Walk up to find the React Flow node container with data-id
  const nodeWrapper = activeEl.closest('[data-id]') as HTMLElement | null;
  if (!nodeWrapper) return null;

  return nodeWrapper.getAttribute('data-id');
}

/**
 * Hook that provides keyboard navigation for the family tree.
 *
 * Arrow keys navigate the logical tree hierarchy:
 * - Right arrow (RTL): previous sibling
 * - Left arrow (RTL): next sibling
 * - Down arrow: first child of the focused node
 * - Up arrow: parent of the focused node
 */
export function useTreeKeyboard({
  visibleNodes,
  visibleEdges,
}: UseTreeKeyboardOptions): UseTreeKeyboardResult {
  // Build lookup maps for efficient navigation
  const { nodeMap, childrenMap, siblingGroups } = useMemo(() => {
    // Map node ID -> VisibleNode
    const nodeMap = new Map<string, VisibleNode>();
    for (const node of visibleNodes) {
      nodeMap.set(node.id, node);
    }

    // Build children map: parentNodeId -> child node IDs (in order)
    // Use edges to determine children relationships (edge source -> target)
    const childrenMap = new Map<string, string[]>();
    for (const edge of visibleEdges) {
      const children = childrenMap.get(edge.source) ?? [];
      children.push(edge.target);
      childrenMap.set(edge.source, children);
    }

    // Build sibling groups: parentNodeId -> list of child node IDs
    // Siblings are nodes that share the same parentNodeId
    const siblingGroups = new Map<string | null, string[]>();
    for (const node of visibleNodes) {
      const parentId = node.parentNodeId;
      const group = siblingGroups.get(parentId) ?? [];
      group.push(node.id);
      siblingGroups.set(parentId, group);
    }

    return { nodeMap, childrenMap, siblingGroups };
  }, [visibleNodes, visibleEdges]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { key } = event;

      // Only handle arrow keys
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(key)) {
        return;
      }

      const activeNodeId = getActiveNodeId();
      if (!activeNodeId) return;

      const activeNode = nodeMap.get(activeNodeId);
      if (!activeNode) return;

      let targetNodeId: string | null = null;

      switch (key) {
        case 'ArrowRight': {
          // RTL: Right arrow moves to the PREVIOUS sibling
          const parentId = activeNode.parentNodeId;
          const siblings = siblingGroups.get(parentId);
          if (siblings && siblings.length > 1) {
            const currentIndex = siblings.indexOf(activeNodeId);
            if (currentIndex > 0) {
              targetNodeId = siblings[currentIndex - 1] ?? null;
            }
          }
          break;
        }

        case 'ArrowLeft': {
          // RTL: Left arrow moves to the NEXT sibling
          const parentId = activeNode.parentNodeId;
          const siblings = siblingGroups.get(parentId);
          if (siblings && siblings.length > 1) {
            const currentIndex = siblings.indexOf(activeNodeId);
            if (currentIndex < siblings.length - 1) {
              targetNodeId = siblings[currentIndex + 1] ?? null;
            }
          }
          break;
        }

        case 'ArrowDown': {
          // Down arrow: move to first child of the focused node
          const children = childrenMap.get(activeNodeId);
          if (children && children.length > 0) {
            targetNodeId = children[0] ?? null;
          }
          break;
        }

        case 'ArrowUp': {
          // Up arrow: move to parent of the focused node
          const parentId = activeNode.parentNodeId;
          if (parentId) {
            targetNodeId = parentId;
          }
          break;
        }
      }

      if (targetNodeId) {
        event.preventDefault();
        focusNodeById(targetNodeId);
      }
    },
    [nodeMap, childrenMap, siblingGroups],
  );

  return { handleKeyDown };
}
