import { memo, useCallback, type KeyboardEvent } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { motion } from 'motion/react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  COLORS,
  BORDERS,
  TIMING,
  EASING,
  SEMANTIC_ROOT,
  SEMANTIC_FAMILY,
  SEMANTIC_ACTIVE,
  SEMANTIC_UNKNOWN,
  TEXT_COLORS,
  type SemanticCategory,
} from '@/utils/constants';
import type { PersonNodeData } from '@/types/tree-state';

/**
 * Determines if a person node has an invalid/missing name.
 * Returns true if the name is empty, null, undefined, or whitespace-only.
 */
function isNameInvalid(name: string | null | undefined): boolean {
  return !name || name.trim().length === 0;
}

/**
 * Determines secondary text to display.
 * If notes is non-empty after trimming, show notes; otherwise show relation.
 */
function getSecondaryText(data: PersonNodeData): string {
  if (data.notes && data.notes.trim().length > 0) {
    return data.notes;
  }
  return data.relation;
}

/**
 * PersonNode - Custom React Flow node for family members.
 *
 * Renders a person card with:
 * - Bold Arabic name (2-line clamp with ellipsis)
 * - Secondary text (notes or relation)
 * - Chevron indicator for expandable nodes
 * - Interaction states (hover, press, focus)
 * - Expanded state styling
 * - Leaf node non-interactive behavior
 * - Enter/exit animations via motion.div
 *
 * Handle architecture:
 * - One target handle at top ("target-top") for incoming parent edge
 * - One default source handle at bottom for outgoing edges to spouse/union nodes
 *   React Flow will use this for all source connections since handle IDs on edges
 *   match to the default source when no explicit ID is found
 */
function PersonNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as PersonNodeData;
  const {
    name,
    isExpanded,
    isExpandable,
    isRoot: _isRoot,
  } = nodeData;

  const nameInvalid = isNameInvalid(name);
  const displayName = nameInvalid ? '؟' : name;
  const secondaryText = getSecondaryText(nodeData);
  const isLeaf = !isExpandable;

  // Build aria-label
  const ariaLabel = isLeaf
    ? (nameInvalid ? '؟' : name)
    : isExpanded
      ? `${nameInvalid ? '؟' : name}، ${nodeData.relation}. اضغط لطي الفرع`
      : `${nameInvalid ? '؟' : name}، ${nodeData.relation}. اضغط لعرض الزوج/ة والأبناء`;

  // Determine if this is an invalid reference node
  const hasInvalidReference = nameInvalid && !isExpandable;

  /**
   * Keyboard handler for Enter/Space activation on expandable nodes.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isLeaf) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.currentTarget.click();
      }
    },
    [isLeaf],
  );

  // Determine semantic category
  const category: SemanticCategory = hasInvalidReference
    ? 'unknown'
    : _isRoot
      ? 'root'
      : 'family';
  const palette = category === 'root' ? SEMANTIC_ROOT
    : category === 'unknown' ? SEMANTIC_UNKNOWN
    : SEMANTIC_FAMILY;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        opacity: {
          duration: TIMING.nodeEnter / 1000,
          ease: EASING.standard as unknown as [number, number, number, number],
          delay: Math.min(
            ((nodeData as PersonNodeData & { animationIndex?: number }).animationIndex ?? 0) * (TIMING.staggerDelay / 1000),
            TIMING.maxStaggerTotal / 1000,
          ),
        },
      }}
      className="relative"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Top handle for incoming edge from parent/union */}
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-none"
        style={{ width: 1, height: 1, minWidth: 0, minHeight: 0 }}
      />

      <div
        className={cn(
          'flex flex-col items-center justify-center px-2 py-2 text-center select-none',
          'transition-shadow transition-transform',
          !isLeaf && 'cursor-pointer',
          !isLeaf && 'hover:shadow-md',
          !isLeaf && 'active:scale-95',
          isLeaf && 'cursor-default',
          !isLeaf && 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px]',
        )}
        style={{
          border: `${isExpanded ? BORDERS.expandedWidth : BORDERS.defaultWidth}px solid ${palette.primary}`,
          borderRadius: `${BORDERS.cardRadius}px`,
          backgroundColor: isExpanded ? palette.background : COLORS.white,
          boxShadow: isExpanded
            ? `0 0 0 2.5px ${SEMANTIC_ACTIVE.primary}, 0 2px 8px -2px rgba(0,0,0,0.08)`
            : _isRoot
              ? '0 2px 8px -2px rgba(0,0,0,0.12)'
              : undefined,
          outlineColor: palette.primary,
          width: '100%',
          height: '100%',
        }}
        tabIndex={isLeaf ? -1 : 0}
        role={isLeaf ? undefined : 'button'}
        aria-label={ariaLabel}
        aria-expanded={isLeaf ? undefined : isExpanded}
        onKeyDown={isLeaf ? undefined : handleKeyDown}
      >
        {/* Warning icon for invalid reference nodes */}
        {hasInvalidReference && (
          <AlertTriangle
            size={14}
            className="absolute top-1 left-1"
            style={{ color: SEMANTIC_UNKNOWN.primary }}
          />
        )}

        {/* Person name - bold, 2-line clamp */}
        <span
          className={cn(
            'font-bold text-sm leading-tight w-full',
            'line-clamp-2 overflow-hidden text-ellipsis',
          )}
          title={nameInvalid ? undefined : name}
          style={{ color: TEXT_COLORS.primary }}
        >
          {displayName}
        </span>

        {/* Secondary text (notes or relation) as semantic badge */}
        <span
          className="text-xs leading-tight mt-0.5 w-full truncate rounded-full px-1.5 py-px text-center"
          style={{
            backgroundColor: palette.soft,
            color: palette.darkText,
          }}
        >
          {secondaryText}
        </span>

        {/* Chevron indicator for expandable nodes */}
        {!isLeaf && !hasInvalidReference && (
          <ChevronDown
            size={14}
            className={cn(
              'mt-0.5 transition-transform duration-200',
              isExpanded && 'rotate-180',
            )}
            style={{ color: isExpanded ? SEMANTIC_ACTIVE.primary : palette.primary }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Bottom handle for outgoing edges — single source used for all outgoing connections */}
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        className="!bg-transparent !border-none"
        style={{ width: 1, height: 1, minWidth: 0, minHeight: 0 }}
      />
    </motion.div>
  );
}

/**
 * Custom comparison for PersonNode memoization.
 */
function arePersonNodePropsEqual(prev: NodeProps, next: NodeProps): boolean {
  const prevData = prev.data as unknown as PersonNodeData;
  const nextData = next.data as unknown as PersonNodeData;

  return (
    prevData.personId === nextData.personId &&
    prevData.name === nextData.name &&
    prevData.relation === nextData.relation &&
    prevData.notes === nextData.notes &&
    prevData.isExpanded === nextData.isExpanded &&
    prevData.isExpandable === nextData.isExpandable &&
    prevData.isRoot === nextData.isRoot &&
    prevData.gender === nextData.gender
  );
}

export const PersonNode = memo(PersonNodeComponent, arePersonNodePropsEqual);
export type { PersonNodeData };
