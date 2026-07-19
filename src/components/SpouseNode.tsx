/**
 * SpouseNode — Custom React Flow node for rendering spouse entries.
 *
 * Displays a narrower card with a dashed border, showing the spouse's name
 * and label. Linked spouses display a link icon badge indicating they
 * exist elsewhere in the tree.
 *
 * Handle architecture:
 * - "target-top": receives edge from parent person node
 * - "source-bottom": sends edge to union junction node below
 */

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { motion } from 'motion/react';
import { Link2 } from 'lucide-react';

import type { SpouseNodeData } from '@/types/tree-state';
import { TIMING, EASING, BORDERS, SEMANTIC_SPOUSE, TEXT_COLORS } from '@/utils/constants';

/** Exit transition configuration matching design tokens */
export const spouseNodeExitTransition = {
  duration: TIMING.nodeExit / 1000,
};

function SpouseNodeComponent({ data }: NodeProps) {
  const spouseData = data as unknown as SpouseNodeData;

  // Compute stagger delay based on animationIndex
  const staggerDelay = Math.min(
    ((spouseData as SpouseNodeData & { animationIndex?: number }).animationIndex ?? 0) * (TIMING.staggerDelay / 1000),
    TIMING.maxStaggerTotal / 1000,
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        opacity: {
          duration: TIMING.nodeEnter / 1000,
          ease: EASING.standard as unknown as [number, number, number, number],
          delay: staggerDelay,
        },
      }}
      className="flex flex-col items-center justify-center px-2 py-1.5"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: BORDERS.cardRadius,
        border: `1.5px ${spouseData.isLinked ? 'solid' : 'dashed'} ${SEMANTIC_SPOUSE.primary}`,
        backgroundColor: SEMANTIC_SPOUSE.background,
      }}
    >
      {/* Top handle for incoming edge from parent */}
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-none"
        style={{ width: 1, height: 1, minWidth: 0, minHeight: 0 }}
      />

      {/* Spouse name + linked badge */}
      <div className="flex items-center justify-center gap-1 w-full">
        <span
          className="text-xs font-medium text-center truncate leading-tight"
          title={spouseData.name}
          style={{ color: TEXT_COLORS.primary }}
        >
          {spouseData.name}
        </span>
        {spouseData.isLinked && (
          <Link2
            size={12}
            className="shrink-0"
            style={{ color: SEMANTIC_SPOUSE.primary }}
            aria-label="مرتبط/ة بشخص آخر في الشجرة"
          />
        )}
      </div>

      {/* Spouse label (e.g., "الزوجة الأولى") */}
      {spouseData.label && (
        <span
          className="text-[10px] text-center truncate w-full leading-tight rounded-full px-1.5 py-px mt-0.5"
          style={{ backgroundColor: SEMANTIC_SPOUSE.soft, color: SEMANTIC_SPOUSE.darkText }}
        >
          {spouseData.label}
        </span>
      )}

      {/* Bottom handle for outgoing edge to union node */}
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
 * Custom comparison for SpouseNode memoization.
 */
function areSpouseNodePropsEqual(prev: NodeProps, next: NodeProps): boolean {
  const prevData = prev.data as unknown as SpouseNodeData;
  const nextData = next.data as unknown as SpouseNodeData;

  return (
    prevData.spouseId === nextData.spouseId &&
    prevData.name === nextData.name &&
    prevData.label === nextData.label &&
    prevData.type === nextData.type &&
    prevData.isLinked === nextData.isLinked &&
    prevData.isHidden === nextData.isHidden
  );
}

export const SpouseNode = memo(SpouseNodeComponent, areSpouseNodePropsEqual);
export default SpouseNode;
