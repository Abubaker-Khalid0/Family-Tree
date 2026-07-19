import { type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { CONNECTOR_COLORS } from '@/utils/constants';
import type { RoutePoint } from '@/types/tree-state';

/**
 * ConnectorEdge — Custom React Flow edge rendered as an orthogonal (step) path
 * with rounded corners at bends.
 *
 * Routing strategy:
 * - If the edge carries ELK-computed routing points (data.points), the path is
 *   built directly from those points. ELK plans the entire tree's edge routing
 *   holistically, so sibling connectors share a clean horizontal "bus bar" and
 *   never overlap. This is the professional genealogical look.
 * - Otherwise, it falls back to React Flow's getSmoothStepPath.
 *
 * Styling: Black stroke, 2px width, round linecap/linejoin, no arrowheads.
 * Accessibility: aria-hidden="true" to exclude decorative lines from the a11y tree.
 */

/** Corner radius applied at orthogonal bends (px). */
const CORNER_RADIUS = 8;

/**
 * Builds an SVG path string from a list of orthogonal routing points,
 * inserting rounded corners at each bend. Assumes segments are axis-aligned
 * (horizontal or vertical), which ELK's ORTHOGONAL routing guarantees.
 */
function buildRoundedOrthogonalPath(points: RoutePoint[], radius: number): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    const p0 = points[0]!;
    const p1 = points[1]!;
    return `M ${p0.x},${p0.y} L ${p1.x},${p1.y}`;
  }

  const p0 = points[0]!;
  let d = `M ${p0.x},${p0.y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;

    // Distance we can safely round without overshooting adjacent segments.
    const distIn = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const distOut = Math.hypot(next.x - curr.x, next.y - curr.y);
    const r = Math.min(radius, distIn / 2, distOut / 2);

    // Direction unit vectors into and out of the corner.
    const inX = Math.sign(curr.x - prev.x);
    const inY = Math.sign(curr.y - prev.y);
    const outX = Math.sign(next.x - curr.x);
    const outY = Math.sign(next.y - curr.y);

    // Point where the incoming segment stops (before the corner).
    const p1x = curr.x - inX * r;
    const p1y = curr.y - inY * r;
    // Point where the outgoing segment resumes (after the corner).
    const p2x = curr.x + outX * r;
    const p2y = curr.y + outY * r;

    d += ` L ${p1x},${p1y}`;
    // Quadratic curve through the corner vertex for a smooth rounded bend.
    d += ` Q ${curr.x},${curr.y} ${p2x},${p2y}`;
  }

  const last = points[points.length - 1]!;
  d += ` L ${last.x},${last.y}`;

  return d;
}

export function ConnectorEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const points = (data as { points?: RoutePoint[] } | undefined)?.points;

  let edgePath: string;

  if (points && points.length >= 2) {
    // Render the exact orthogonal routing computed by ELK.
    edgePath = buildRoundedOrthogonalPath(points, CORNER_RADIUS);
  } else {
    // Fallback: React Flow's own step routing.
    [edgePath] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: CORNER_RADIUS,
      offset: 0,
    });
  }

  return (
    <path
      id={id}
      d={edgePath}
      fill="none"
      stroke={CONNECTOR_COLORS.line}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      markerEnd=""
      markerStart=""
      aria-hidden="true"
      style={{
        opacity: 1,
        transition: 'opacity 0.3s ease',
      }}
    />
  );
}

export default ConnectorEdge;
