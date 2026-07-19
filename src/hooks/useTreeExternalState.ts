/**
 * useTreeExternalState.ts
 * ------------------------------------------------------------------
 * Exposes tree state (expanded node IDs + viewport position) via a
 * custom hook that external code can consume without directly reading
 * internal component state.
 * ------------------------------------------------------------------
 *
 * Validates: Requirements 17.5
 */

import { useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';

export interface TreeExternalState {
  /** Set of currently expanded person IDs */
  expandedIds: Set<string>;
  /** Current viewport position and zoom level from React Flow */
  viewport: { x: number; y: number; zoom: number };
}

/**
 * Hook that exposes the tree's expanded state and current viewport position.
 * Must be called within a ReactFlowProvider context (e.g. inside TreeViewport
 * or any component rendered as a child of ReactFlow).
 *
 * @param expandedIds - The current set of expanded person IDs from useTreeState
 * @returns TreeExternalState with expandedIds and viewport
 */
export function useTreeExternalState(expandedIds: Set<string>): TreeExternalState {
  const { getViewport } = useReactFlow();

  return useMemo(() => ({
    expandedIds,
    viewport: getViewport(),
  }), [expandedIds, getViewport]);
}
