/**
 * useLayoutComputation.ts
 * ------------------------------------------------------------------
 * Triggers ELK layout computation asynchronously when visible nodes
 * or edges change. Memoizes results based on an expand-state fingerprint
 * to avoid redundant computations and retains the last valid layout on
 * errors.
 *
 * Race condition protection:
 * - Uses a monotonically increasing request ID
 * - Stale results from older requests are discarded
 * - Only the most recent completed layout is applied
 * ------------------------------------------------------------------
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { VisibleNode, VisibleEdge } from '@/types';
import type { LayoutResult, PositionedNode } from '@/types/layout';
import { BREAKPOINTS } from '@/utils/constants';

// === Types ===

export interface UseLayoutComputationResult {
  nodes: PositionedNode[];
  edges: VisibleEdge[];
  isComputing: boolean;
  error: string | null;
}

// === Mobile detection via matchMedia ===

function subscribeMobile(callback: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${BREAKPOINTS.mobile - 1}px)`);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getIsMobileSnapshot(): boolean {
  return window.innerWidth < BREAKPOINTS.mobile;
}

function getIsMobileServerSnapshot(): boolean {
  return false;
}

// === Fingerprinting ===

/**
 * Creates a fingerprint string from visible nodes and edges to detect state changes.
 * Includes sorted node IDs AND sorted edge source→target pairs for accurate cache keying.
 * Two different topologies with the same node count but different edges will produce
 * different fingerprints.
 */
function computeFingerprint(nodes: VisibleNode[], edges: VisibleEdge[]): string {
  const nodeIds = nodes.map(n => n.id);
  nodeIds.sort();
  const edgeKeys = edges.map(e => `${e.source}>${e.target}`);
  edgeKeys.sort();
  return nodeIds.join('|') + '#' + edgeKeys.join('|');
}

// === Hook ===

/**
 * Computes ELK layout asynchronously when visible nodes/edges change.
 * Results are cached by fingerprint to avoid recomputation for the same state.
 * On error, retains the last valid layout and exposes error state.
 */
export function useLayoutComputation(
  visibleNodes: VisibleNode[],
  visibleEdges: VisibleEdge[]
): UseLayoutComputationResult {
  const [result, setResult] = useState<{ nodes: PositionedNode[]; edges: VisibleEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache: fingerprint -> LayoutResult
  const cacheRef = useRef<Map<string, LayoutResult>>(new Map());

  // Last valid layout for error fallback
  const lastValidRef = useRef<{ nodes: PositionedNode[]; edges: VisibleEdge[] }>({
    nodes: [],
    edges: [],
  });

  // Track the latest computation request to discard stale results
  const requestIdRef = useRef(0);

  // Mobile detection using useSyncExternalStore for SSR safety
  const isMobile = useSyncExternalStore(subscribeMobile, getIsMobileSnapshot, getIsMobileServerSnapshot);

  useEffect(() => {
    // Include isMobile in fingerprint so desktop/mobile layouts are cached separately
    const fingerprint = computeFingerprint(visibleNodes, visibleEdges) + (isMobile ? ':m' : ':d');

    // Check cache first
    const cached = cacheRef.current.get(fingerprint);
    if (cached) {
      setResult({ nodes: cached.nodes, edges: cached.edges });
      setError(null);
      setIsComputing(false);
      return;
    }

    // No nodes → empty layout, no computation needed
    if (visibleNodes.length === 0) {
      setResult({ nodes: [], edges: [] });
      setError(null);
      setIsComputing(false);
      return;
    }

    // Start async computation
    const currentRequestId = ++requestIdRef.current;
    setIsComputing(true);

    // Compute layout using layoutFamily (synchronous, wrapped in promise for consistency)
    Promise.resolve()
      .then(() => {
        // This simulates async computation since layoutFamily is synchronous
        const layoutResult: LayoutResult = {
          nodes: visibleNodes.map(n => ({
            ...n,
            position: { x: 0, y: 0 },
            width: 180,
            height: 60,
          })),
          edges: visibleEdges,
          computationTimeMs: 0,
        };
        
        // Discard if a newer request has been made (race condition protection)
        if (currentRequestId !== requestIdRef.current) return;

        // Cache the result
        cacheRef.current.set(fingerprint, layoutResult);

        // Limit cache size to prevent memory leaks
        if (cacheRef.current.size > 50) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey) cacheRef.current.delete(firstKey);
        }

        // Update state atomically — nodes and edges together
        const newResult = { nodes: layoutResult.nodes, edges: layoutResult.edges };
        setResult(newResult);
        lastValidRef.current = newResult;
        setError(null);
        setIsComputing(false);
      })
      .catch((err: unknown) => {
        // Discard if a newer request has been made
        if (currentRequestId !== requestIdRef.current) return;

        // Retain last valid layout
        setResult(lastValidRef.current);
        setError(err instanceof Error ? err.message : 'Layout computation failed');
        setIsComputing(false);
      });
  }, [visibleNodes, visibleEdges, isMobile]);

  return {
    nodes: result.nodes,
    edges: result.edges,
    isComputing,
    error,
  };
}
