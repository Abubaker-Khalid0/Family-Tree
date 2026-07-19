/**
 * UnionNode — Invisible junction node that represents a family union point.
 *
 * This node is a tiny (8x8px) transparent element that exists solely
 * to provide proper edge routing. Children connect from this union point,
 * which sits below the spouse node (or parent for unknown spouses).
 *
 * This creates a clean tree structure:
 *   Person → Spouse → Union → Children
 *
 * The union node provides the "fan-out" point where multiple children
 * branch off, ensuring clean orthogonal edge routing.
 */

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

function UnionNodeComponent(_props: NodeProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'transparent',
        position: 'relative',
      }}
    >
      {/* Top handle: receives edge from spouse/parent */}
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-none"
        style={{ left: '50%', width: 1, height: 1, minWidth: 0, minHeight: 0 }}
      />

      {/* Bottom handle: sends edges to children */}
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        className="!bg-transparent !border-none"
        style={{ left: '50%', width: 1, height: 1, minWidth: 0, minHeight: 0 }}
      />
    </div>
  );
}

export const UnionNode = memo(UnionNodeComponent);
export default UnionNode;
