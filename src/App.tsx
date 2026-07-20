import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  Home,
  Info,
  Minus,
  Plus,
  RotateCcw,
  X,
  Link2,
  HelpCircle,
  Search,
  User,
} from 'lucide-react';
import SearchDialog from '@/components/SearchDialog';
import { EditRequestDialog } from '@/components/EditRequestDialog';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { dataAccess } from '@/data';
import type { Person } from '@/types';
import {
  layoutFamily,
  type LaidNode,
  NODE_H,
  NODE_W,
  SPOUSE_H,
  SPOUSE_W,
} from '@/layout/tree-layout';
import {
  SEMANTIC_ROOT,
  SEMANTIC_FAMILY,
  SEMANTIC_SPOUSE,
  SEMANTIC_ACTIVE,
  SEMANTIC_UNKNOWN,
  TEXT_COLORS,
  CONNECTOR_COLORS,
  type SemanticCategory,
} from '@/utils/constants';
import { stripPatronymic } from '@/utils/linked-spouse';

// ---------------------------------------------------------------------------
// Semantic Style Resolver
// ---------------------------------------------------------------------------

/**
 * Resolves the semantic category of a node.
 * Priority: unknown → spouse → root → family
 */
function resolveCategory(node: LaidNode): SemanticCategory {
  // Unknown: invalid name or empty
  if (!node.name || node.name.trim().length === 0 || node.name === '؟') {
    return 'unknown';
  }
  if (node.kind === 'spouse') {
    return 'spouse';
  }
  if (node.kind === 'root') {
    return 'root';
  }
  return 'family';
}

function getCategoryColors(category: SemanticCategory) {
  switch (category) {
    case 'root': return SEMANTIC_ROOT;
    case 'family': return SEMANTIC_FAMILY;
    case 'spouse': return SEMANTIC_SPOUSE;
    case 'unknown': return SEMANTIC_UNKNOWN;
  }
}

// ---------------------------------------------------------------------------
// Root-only initial state; users progressively reveal branches.
// ---------------------------------------------------------------------------
const INITIAL_EXPANDED = new Set<string>();

type Viewport = { x: number; y: number; scale: number };

export default function App() {
  const [expanded, setExpanded] = useState<Set<string>>(INITIAL_EXPANDED);
  const [selected, setSelected] = useState<Person | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [editRequestOpen, setEditRequestOpen] = useState(false);
  const [welcomeSeen, setWelcomeSeen] = useState(() => {
    try { return localStorage.getItem('family-tree-welcome') === '1'; } catch { return false; }
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const didInitialFit = useRef(false);
  // Track the last toggled node to keep it stable on screen
  const lastToggledRef = useRef<{ personId: string; screenX: number; screenY: number } | null>(null);

  const layout = useMemo(() => layoutFamily(dataAccess, expanded), [expanded]);

  // After layout changes due to toggle, adjust viewport to keep the toggled node in place
  useEffect(() => {
    const info = lastToggledRef.current;
    if (!info) return;
    const node = layout.nodes.find((n) => n.personId === info.personId && n.kind !== 'spouse');
    if (!node) return;
    // The node's world center
    const worldCx = node.x + node.w / 2;
    const worldCy = node.y + node.h / 2;
    // Adjust viewport so the world point appears at the saved screen position
    setViewport((v) => ({
      ...v,
      x: info.screenX - worldCx * v.scale,
      y: info.screenY - worldCy * v.scale,
    }));
    lastToggledRef.current = null;
  }, [layout]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const obs = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setViewportSize({ w: rect.width, h: rect.height });
    });
    obs.observe(el);
    const rect = el.getBoundingClientRect();
    setViewportSize({ w: rect.width, h: rect.height });
    return () => obs.disconnect();
  }, []);

  // Center the root on first mount once we know sizes.
  useEffect(() => {
    if (didInitialFit.current) return;
    if (viewportSize.w === 0) return;
    const root = dataAccess.getRoot();
    if (!root) return;
    const rootNode = layout.nodes.find((n) => n.id === root.id);
    if (!rootNode) return;
    const cx = rootNode.x + rootNode.w / 2;
    const targetY = 120;
    setViewport({
      scale: 1,
      x: viewportSize.w / 2 - cx,
      y: targetY - rootNode.y,
    });
    didInitialFit.current = true;
  }, [viewportSize.w, viewportSize.h, layout.nodes]);

  const toggle = useCallback((node: LaidNode) => {
    if (!node.isExpandable) return;
    // Save the screen position of the toggled node before layout changes
    const worldCx = node.x + node.w / 2;
    const worldCy = node.y + node.h / 2;
    const screenX = viewport.x + worldCx * viewport.scale;
    const screenY = viewport.y + worldCy * viewport.scale;
    lastToggledRef.current = { personId: node.personId, screenX, screenY };

    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.personId)) {
        // Collapse this node and everything below it
        const person = dataAccess.getPerson(node.personId);
        if (person) {
          const stack: Person[] = [person];
          while (stack.length) {
            const cur = stack.pop()!;
            next.delete(cur.id);
            for (const sp of cur.spouses) {
              const children = dataAccess.getSpouseChildren(sp);
              for (const c of children) stack.push(c);
            }
          }
        }
      } else {
        next.add(node.personId);
      }
      return next;
    });
  }, [viewport]);

  const openDetails = useCallback((node: LaidNode) => {
    const person = dataAccess.getPerson(node.personId);
    if (person) setSelected(person);
  }, []);

  const clampScale = (s: number) => Math.min(2.5, Math.max(0.3, s));

  const zoom = (delta: number, center?: { x: number; y: number }) => {
    setViewport((v) => {
      const newScale = clampScale(v.scale + delta);
      if (newScale === v.scale) return v;
      const cx = center?.x ?? viewportSize.w / 2;
      const cy = center?.y ?? viewportSize.h / 2;
      const worldX = (cx - v.x) / v.scale;
      const worldY = (cy - v.y) / v.scale;
      return {
        scale: newScale,
        x: cx - worldX * newScale,
        y: cy - worldY * newScale,
      };
    });
  };

  const returnToRoot = useCallback(() => {
    const root = dataAccess.getRoot();
    if (!root) return;
    const rootNode = layout.nodes.find((n) => n.id === root.id);
    if (!rootNode) return;
    const cx = rootNode.x + rootNode.w / 2;
    setViewport({
      scale: 1,
      x: viewportSize.w / 2 - cx,
      y: 120 - rootNode.y,
    });
  }, [layout.nodes, viewportSize.w]);

  const resetView = useCallback(() => {
    setExpanded(new Set<string>());
    didInitialFit.current = false;
    requestAnimationFrame(() => {
      const root = dataAccess.getRoot();
      if (!root) return;
      const newLayout = layoutFamily(dataAccess, new Set<string>());
      const rootNode = newLayout.nodes.find((n) => n.id === root.id);
      if (!rootNode) return;
      const cx = rootNode.x + rootNode.w / 2;
      setViewport({ scale: 1, x: viewportSize.w / 2 - cx, y: 120 - rootNode.y });
      didInitialFit.current = true;
    });
  }, [viewportSize.w]);

  // -------------------- Search: expand path and focus --------------------
  const expandPathAndFocus = useCallback(
    (personId: string, pathToRoot: string[]) => {
      // Build the set of expanded nodes: every node in the path except the last
      // (the target person itself doesn't need to be expanded, just visible)
      const newExpanded = new Set<string>();
      for (let i = 0; i < pathToRoot.length - 1; i++) {
        const item = pathToRoot[i];
        if (item) {
          newExpanded.add(item);
        }
      }
      setExpanded(newExpanded);

      // After the next layout recomputation, center on the target person
      requestAnimationFrame(() => {
        const newLayout = layoutFamily(dataAccess, newExpanded);
        const targetNode = newLayout.nodes.find(
          (n) => n.personId === personId && n.kind !== 'spouse',
        );
        if (!targetNode) return;
        const cx = targetNode.x + targetNode.w / 2;
        const cy = targetNode.y + targetNode.h / 2;
        setViewport({
          scale: 1,
          x: viewportSize.w / 2 - cx,
          y: viewportSize.h / 2 - cy,
        });
        // Also select the person to show the highlight
        const person = dataAccess.getPerson(personId);
        if (person) setSelected(person);
      });
    },
    [viewportSize.w, viewportSize.h],
  );

  // -------------------- Pan + zoom gestures --------------------
  const drag = useRef<{
    active: boolean;
    id: number | null;
    startX: number;
    startY: number;
    vx: number;
    vy: number;
  }>({ active: false, id: null, startX: 0, startY: 0, vx: 0, vy: 0 });
  const pinch = useRef<{ active: boolean; d: number; scale: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      drag.current = {
        active: true,
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        vx: viewport.x,
        vy: viewport.y,
      };
    } else if (pointers.current.size === 2) {
      drag.current.active = false;
      const values = Array.from(pointers.current.values());
      if (values.length >= 2) {
        const a = values[0]!;
        const b = values[1]!;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        pinch.current = { active: true, d, scale: viewport.scale };
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current?.active && pointers.current.size >= 2) {
      const values = Array.from(pointers.current.values());
      if (values.length >= 2) {
        const a = values[0]!;
        const b = values[1]!;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const factor = d / pinch.current.d;
        const newScale = clampScale(pinch.current.scale * factor);
        const rect = containerRef.current?.getBoundingClientRect();
        const cx = rect ? (a.x + b.x) / 2 - rect.left : viewportSize.w / 2;
        const cy = rect ? (a.y + b.y) / 2 - rect.top : viewportSize.h / 2;
        setViewport((v) => {
          const worldX = (cx - v.x) / v.scale;
          const worldY = (cy - v.y) / v.scale;
          return {
            scale: newScale,
            x: cx - worldX * newScale,
            y: cy - worldY * newScale,
          };
        });
      }
    } else if (drag.current.active && drag.current.id === e.pointerId) {
      const dx = e.clientX - drag.current.startX;
      const dy = e.clientY - drag.current.startY;
      setViewport((v) => ({ ...v, x: drag.current.vx + dx, y: drag.current.vy + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (drag.current.id === e.pointerId) drag.current.active = false;
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = rect ? e.clientX - rect.left : viewportSize.w / 2;
      const cy = rect ? e.clientY - rect.top : viewportSize.h / 2;
      zoom(-e.deltaY * 0.01, { x: cx, y: cy });
    } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      setViewport((v) => ({ ...v, x: v.x - e.deltaX }));
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = rect ? e.clientX - rect.left : viewportSize.w / 2;
      const cy = rect ? e.clientY - rect.top : viewportSize.h / 2;
      zoom(-e.deltaY * 0.003, { x: cx, y: cy });
    }
  };

  // Check if root is valid
  if (!dataAccess.isRootValid) {
    return (
      <div className="flex flex-col bg-white items-center justify-center" style={{ color: TEXT_COLORS.primary, height: '100dvh' }}>
        <p className="text-lg font-bold">خطأ: لم يتم العثور على الشخص الجذر</p>
      </div>
    );
  }

  return (
    <div className="relative flex w-screen flex-col overflow-hidden bg-white" style={{ color: TEXT_COLORS.primary, height: '100dvh' }}>
      <Header onOpenSearch={() => setSearchOpen(true)} onOpenEditRequest={() => setEditRequestOpen(true)} />
      <Breadcrumbs expanded={expanded} setExpanded={setExpanded} lastToggledRef={lastToggledRef} viewport={viewport} layout={layout} />
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        role="application"
        aria-label="شجرة العائلة التفاعلية"
      >
        <TreeCanvas
          layout={layout}
          viewport={viewport}
          selected={selected}
          onToggle={toggle}
          onOpenDetails={openDetails}
        />
        <Toolbar
          onHome={returnToRoot}
          onZoomIn={() => zoom(0.2)}
          onZoomOut={() => zoom(-0.2)}
          onReset={resetView}
          scale={viewport.scale}
        />
      </div>
      <DetailsSheet person={selected} onClose={() => setSelected(null)} />
      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectPerson={expandPathAndFocus}
      />
      <EditRequestDialog
        open={editRequestOpen}
        onClose={() => setEditRequestOpen(false)}
      />
      {!welcomeSeen && (
        <WelcomePopup onClose={() => {
          setWelcomeSeen(true);
          try { localStorage.setItem('family-tree-welcome', '1'); } catch {}
        }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header({ onOpenSearch, onOpenEditRequest }: { onOpenSearch: () => void; onOpenEditRequest: () => void }) {
  return (
    <header className="relative z-20 bg-white" style={{ borderBottom: `2px solid ${CONNECTOR_COLORS.strongDivider}` }}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/logo.png"
            alt="شجرة العائلة"
            className="h-9 w-9 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg" style={{ color: TEXT_COLORS.primary }}>
       الاحمدية - بربر - السودان
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Search Button — icon only on mobile, text on sm+ */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-70 sm:px-3"
            style={{ borderColor: SEMANTIC_FAMILY.primary, color: SEMANTIC_FAMILY.primary }}
            aria-label="ابحث عن اسمك"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">ابحث عن اسمك</span>
          </button>
          {/* طلب تعديل — يفتح فورم */}
          <button
            type="button"
            onClick={onOpenEditRequest}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-70 sm:px-3"
            style={{ borderColor: TEXT_COLORS.primary, color: TEXT_COLORS.primary }}
            aria-label="طلب اضافة"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="hidden sm:inline">طلب اضافة</span>
          </button>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Canvas: SVG connectors + absolutely positioned node cards
// ---------------------------------------------------------------------------
function TreeCanvas({
  layout,
  viewport,
  selected,
  onToggle,
  onOpenDetails,
}: {
  layout: ReturnType<typeof layoutFamily>;
  viewport: Viewport;
  selected: Person | null;
  onToggle: (node: LaidNode) => void;
  onOpenDetails: (node: LaidNode) => void;
}) {
  return (
    <div
      className="absolute left-0 top-0 origin-top-left will-change-transform"
      style={{
        width: layout.width,
        height: layout.height,
        transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
      }}
    >
      <svg
        width={layout.width}
        height={layout.height}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <AnimatePresence>
          {layout.edges.map((e) => (
            <motion.path
              key={e.id}
              d={e.d}
              fill="none"
              stroke={CONNECTOR_COLORS.line}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            />
          ))}
        </AnimatePresence>
      </svg>
      <AnimatePresence>
        {layout.nodes.map((n, i) => (
          <NodeCard
            key={n.id}
            node={n}
            index={i}
            isSelected={selected?.id === n.personId}
            onToggle={onToggle}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node card — semantic color system
// ---------------------------------------------------------------------------
function NodeCard({
  node,
  index,
  isSelected,
  onToggle,
  onOpenDetails,
}: {
  node: LaidNode;
  index: number;
  isSelected: boolean;
  onToggle: (node: LaidNode) => void;
  onOpenDetails: (node: LaidNode) => void;
}) {
  const isSpouse = node.kind === 'spouse';
  const isRoot = node.kind === 'root';
  const hasChildren = node.isExpandable;
  const isPerson = !isSpouse;
  const category = resolveCategory(node);
  const palette = getCategoryColors(category);
  const isLinkedSpouse = isSpouse && node.isLinked;
  const isExternalSpouse = isSpouse && !node.isLinked;

  // Determine border style
  const borderWidth = isRoot ? 2.5 : isSpouse ? 1.5 : 1.5;
  const borderStyle = isExternalSpouse ? 'dashed' : 'solid';
  const borderColor = palette.primary;
  const bgColor = node.isExpanded && !isSpouse ? palette.background : 'white';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.96 }}
      transition={{
        duration: 0.32,
        ease: [0.4, 0, 0.2, 1],
        delay: Math.min(index * 0.015, 0.18),
      }}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.w,
        minHeight: node.h,
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (isSpouse) return;
          if (hasChildren) onToggle(node);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`${node.name} — ${node.relation || node.notes}`}
        aria-expanded={hasChildren ? node.isExpanded : undefined}
        className={[
          'group relative flex h-full w-full items-center gap-1.5 rounded-[14px] px-2.5',
          'transition-[transform,background-color,box-shadow] duration-200 ease-out',
          isSpouse ? 'cursor-default' : '',
          hasChildren && !isSpouse ? 'cursor-pointer active:scale-[0.985] hover:-translate-y-[1px] hover:shadow-md' : '',
          !hasChildren && !isSpouse ? 'cursor-default' : '',
          // Focus visible
          'focus-visible:outline-none',
        ].join(' ')}
        style={{
          backgroundColor: bgColor,
          border: `${borderWidth}px ${borderStyle} ${borderColor}`,
          // Selected state: black outer outline
          outline: isSelected ? `2.5px solid ${TEXT_COLORS.primary}` : undefined,
          outlineOffset: isSelected ? '3px' : undefined,
          // Expanded state: green ring
          boxShadow: node.isExpanded && !isSpouse
            ? `0 0 0 2.5px ${SEMANTIC_ACTIVE.primary}, 0 2px 8px -2px rgba(0,0,0,0.08)`
            : isRoot && !node.isExpanded
              ? '0 2px 8px -2px rgba(0,0,0,0.12)'
              : undefined,
        }}
      >
        {/* Info icon circle - only for person nodes */}
        {isPerson && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(node);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`معلومات ${node.name}`}
            role="button"
            tabIndex={0}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              border: `1.5px solid ${palette.primary}`,
              backgroundColor: palette.background,
              color: palette.primary,
            }}
          >
            <Info className="h-3 w-3" strokeWidth={2.25} />
          </div>
        )}

        {/* Unknown icon for unknown spouse */}
        {category === 'unknown' && isSpouse && (
          <HelpCircle size={12} className="shrink-0" style={{ color: SEMANTIC_UNKNOWN.primary }} />
        )}

        {/* Name + relation */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center py-1.5">
          <span
            className={[
              'block w-full text-center font-bold leading-tight',
              isRoot ? 'text-[14px]' : isSpouse ? 'text-[12px]' : 'text-[13px]',
            ].join(' ')}
            style={{ color: TEXT_COLORS.primary }}
            title={node.name}
          >
            {node.name}
          </span>
          {/* Single spouse name inline */}
          {!isSpouse && node.singleSpouseName && (
            <span className="mt-0.5 block w-full text-center text-[9.5px] leading-tight" style={{ color: TEXT_COLORS.muted }}>
              {node.gender === 'male' ? 'تزوج من' : 'تزوجت من'} {node.singleSpouseName}
            </span>
          )}
          {/* Relationship badge — skip entirely when inline spouse name already shown */}
          {(node.relation || node.notes || node.spouseLabel) && !(
            !isSpouse && node.singleSpouseName
          ) && (
            <span
              className={[
                'mt-0.5 inline-block text-center leading-tight rounded-full px-1.5 py-px',
                isRoot ? 'text-[10px]' : 'text-[9.5px]',
              ].join(' ')}
              style={{
                backgroundColor: palette.soft,
                color: palette.darkText,
              }}
            >
              {stripPatronymic(node.notes || node.relation || node.spouseLabel || '')}
            </span>
          )}
        </div>

        {/* Linked badge for spouse */}
        {isLinkedSpouse && (
          <Link2 size={12} className="shrink-0" style={{ color: SEMANTIC_SPOUSE.primary }} />
        )}

        {/* Expand chevron */}
        {hasChildren && !isSpouse && (
          <div
            aria-hidden
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full transition-transform duration-300"
            style={{
              border: `1.5px solid ${node.isExpanded ? SEMANTIC_ACTIVE.primary : palette.primary}`,
              backgroundColor: node.isExpanded ? SEMANTIC_ACTIVE.primary : 'white',
              color: node.isExpanded ? 'white' : palette.primary,
              transform: node.isExpanded ? 'rotate(180deg)' : undefined,
            }}
          >
            <ChevronDown className="h-3 w-3" strokeWidth={2.25} />
          </div>
        )}
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumbs - shows the navigation path from root to the deepest expanded node
// ---------------------------------------------------------------------------
function Breadcrumbs({
  expanded,
  setExpanded,
  lastToggledRef,
  viewport,
  layout,
}: {
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  lastToggledRef: React.MutableRefObject<{ personId: string; screenX: number; screenY: number } | null>;
  viewport: Viewport;
  layout: ReturnType<typeof layoutFamily>;
}) {
  // Build the path from root to deepest expanded node
  const path = useMemo(() => {
    const root = dataAccess.getRoot();
    if (!root) return [];

    const trail: { id: string; name: string }[] = [{ id: root.id, name: root.name }];
    let current: Person | null = root;

    while (current && expanded.has(current.id)) {
      let foundNext: Person | null = null;
      for (const sp of current.spouses) {
        const children = dataAccess.getSpouseChildren(sp);
        const expandedChild = children.find(c => expanded.has(c.id));
        if (expandedChild) {
          foundNext = expandedChild;
          break;
        }
      }
      if (foundNext) {
        trail.push({ id: foundNext.id, name: foundNext.name });
        current = foundNext;
      } else {
        break;
      }
    }

    return trail;
  }, [expanded]);

  if (path.length <= 1) return null;

  const handleClick = (personId: string, index: number) => {
    setExpanded((prev) => {
      const next = new Set<string>();
      for (let i = 0; i <= index && i < path.length; i++) {
        const item = path[i];
        if (item && prev.has(item.id)) {
          next.add(item.id);
        }
      }
      return next;
    });

    const node = layout.nodes.find(n => n.personId === personId && n.kind !== 'spouse');
    if (node) {
      const worldCx = node.x + node.w / 2;
      const worldCy = node.y + node.h / 2;
      const screenX = viewport.x + worldCx * viewport.scale;
      const screenY = viewport.y + worldCy * viewport.scale;
      lastToggledRef.current = { personId, screenX, screenY };
    }
  };

  return (
    <nav
      aria-label="مسار التصفح"
      className="relative z-20 bg-white px-4 py-2 overflow-x-auto"
      style={{ borderBottom: `1px solid ${CONNECTOR_COLORS.subtleDivider}` }}
    >
      <ol className="flex items-center gap-1 text-[12px] whitespace-nowrap">
        {path.map((item, i) => (
          <li key={item.id} className="flex items-center gap-1">
            {i > 0 && (
              <span className="mx-0.5" style={{ color: TEXT_COLORS.muted }}>‹</span>
            )}
            {i < path.length - 1 ? (
              <button
                type="button"
                onClick={() => handleClick(item.id, i)}
                className="hover:underline transition-colors"
                style={{ color: TEXT_COLORS.secondary }}
              >
                {item.name}
              </button>
            ) : (
              <span className="font-bold" style={{ color: TEXT_COLORS.primary }}>{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------
function Toolbar({
  onHome,
  onZoomIn,
  onZoomOut,
  onReset,
  scale,
}: {
  onHome: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  scale: number;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
      style={{ bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-white p-1"
        style={{
          border: `1.5px solid ${CONNECTOR_COLORS.strongDivider}`,
          boxShadow: '0 2px 12px -4px rgba(0,0,0,0.15)',
        }}
      >
        <ToolBtn label="العودة إلى الجد الأكبر" onClick={onHome}>
          <Home className="h-4 w-4" strokeWidth={1.75} />
        </ToolBtn>
        <Divider />
        <ToolBtn label="تصغير" onClick={onZoomOut}>
          <Minus className="h-4 w-4" strokeWidth={2} />
        </ToolBtn>
        <span className="min-w-[38px] px-1 text-center font-mono text-[11px] tabular-nums" style={{ color: TEXT_COLORS.secondary }}>
          {Math.round(scale * 100)}%
        </span>
        <ToolBtn label="تكبير" onClick={onZoomIn}>
          <Plus className="h-4 w-4" strokeWidth={2} />
        </ToolBtn>
        <Divider />
        <ToolBtn label="إعادة ضبط العرض" onClick={onReset}>
          <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
        </ToolBtn>
      </div>
    </div>
  );
}

function ToolBtn({
  children,
  label,
  onClick,
  pressed,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed}
        className={[
          'grid h-9 w-9 place-items-center rounded-full transition-colors',
          'hover:bg-neutral-100 active:bg-neutral-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white',
          pressed ? 'bg-neutral-900 text-white hover:bg-neutral-900' : '',
        ].join(' ')}
        style={{
          color: pressed ? 'white' : TEXT_COLORS.primary,
          // Focus ring color
          '--tw-ring-color': TEXT_COLORS.primary,
        } as React.CSSProperties}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 sm:block"
        style={{ border: `1px solid ${CONNECTOR_COLORS.strongDivider}`, color: TEXT_COLORS.primary }}
      >
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px" style={{ backgroundColor: CONNECTOR_COLORS.subtleDivider }} />;
}

// ---------------------------------------------------------------------------
// Details bottom sheet (mobile) / side panel (desktop)
// ---------------------------------------------------------------------------
function DetailsSheet({
  person,
  onClose,
}: {
  person: Person | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!person) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [person, onClose]);

  const spouseCount = person?.spouses?.length ?? 0;
  const childCount =
    person?.spouses?.reduce((s, m) => s + m.childrenIds.length, 0) ?? 0;

  // Determine the semantic category for the selected person
  const personCategory: SemanticCategory = person
    ? person.id === dataAccess.getRoot()?.id
      ? 'root'
      : 'family'
    : 'family';
  const detailPalette = getCategoryColors(personCategory);

  return (
    <AnimatePresence>
      {person && (
        <>
          <motion.div
            className="fixed inset-0 z-30 backdrop-blur-[1px]"
            style={{ backgroundColor: CONNECTOR_COLORS.overlay }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          {/* Mobile: bottom sheet */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`تفاصيل ${person.name}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl bg-white p-5 sm:hidden"
            style={{ borderTop: `3px solid ${detailPalette.primary}` }}
          >
            <SheetHandle />
            <DetailsBody
              person={person}
              spouseCount={spouseCount}
              childCount={childCount}
              onClose={onClose}
              palette={detailPalette}
            />
          </motion.aside>
          {/* Desktop: side sheet */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`تفاصيل ${person.name}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-40 hidden w-[360px] bg-white p-6 shadow-[0_0_40px_-12px_rgba(0,0,0,0.15)] sm:block"
            style={{ borderLeft: `3px solid ${detailPalette.primary}` }}
          >
            <DetailsBody
              person={person}
              spouseCount={spouseCount}
              childCount={childCount}
              onClose={onClose}
              palette={detailPalette}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SheetHandle() {
  return (
    <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ backgroundColor: CONNECTOR_COLORS.strongDivider }} aria-hidden />
  );
}

function DetailsBody({
  person,
  spouseCount,
  childCount,
  onClose,
  palette,
}: {
  person: Person;
  spouseCount: number;
  childCount: number;
  onClose: () => void;
  palette: ReturnType<typeof getCategoryColors>;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
            style={{ border: `2px solid ${palette.primary}`, backgroundColor: palette.background }}
          >
            <User className="h-5 w-5" style={{ color: palette.primary }} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight" style={{ color: TEXT_COLORS.primary }}>
              {person.name}
            </h2>
            {person.relation && (
              <span
                className="mt-0.5 inline-block text-[11px] rounded-full px-2 py-px"
                style={{ backgroundColor: palette.soft, color: palette.darkText }}
              >
                {person.relation}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          style={{ border: `1.5px solid ${CONNECTOR_COLORS.strongDivider}`, color: TEXT_COLORS.primary }}
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Stat label="عدد الأزواج" value={spouseCount} />
        <Stat label="عدد الأبناء" value={childCount} />
      </div>

      <div className="mt-5 rounded-2xl p-4" style={{ border: `1.5px solid ${CONNECTOR_COLORS.strongDivider}` }}>
        <p className="mb-1 text-[10.5px] uppercase tracking-[0.14em]" style={{ color: TEXT_COLORS.muted }}>
          ملاحظة
        </p>
        <p className="text-[13.5px] leading-relaxed" style={{ color: TEXT_COLORS.secondary }}>
          {person.notes ? stripPatronymic(person.notes) : 'لا توجد ملاحظات إضافية موثقة لهذا الفرد في الأرشيف.'}
        </p>
      </div>

      {/* زر إضافة للملاحظات — يرسل للداشبورد */}
      <button
        type="button"
        onClick={() => {
          const note = prompt('ملاحظة (اختياري):') || '';
          fetch('http://localhost:3333/api/notes/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId: person.id, note }),
          })
            .then(r => {
              if (!r.ok) throw new Error('Server error');
              return r.json();
            })
            .then(d => { if (d.success) alert('✅ ' + d.message); else alert('❌ ' + (d.error || 'خطأ')); })
            .catch(() => alert('❌ الداشبورد غير متصلة\nشغّل: node admin-server.mjs'));
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-colors hover:bg-neutral-50"
        style={{ border: `1.5px solid ${CONNECTOR_COLORS.strongDivider}`, color: TEXT_COLORS.secondary }}
      >
        📋 إضافة للملاحظات
      </button>

      {person.spouses && person.spouses.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10.5px] uppercase tracking-[0.14em]" style={{ color: TEXT_COLORS.muted }}>
            الزيجات
          </p>
          <ul className="space-y-2">
            {person.spouses.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ border: `1.5px solid ${SEMANTIC_SPOUSE.soft}`, backgroundColor: SEMANTIC_SPOUSE.background }}
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold" style={{ color: TEXT_COLORS.primary }}>
                    {dataAccess.getSpouseDisplayName(m)}
                  </p>
                  <p className="text-[11px]" style={{ color: SEMANTIC_SPOUSE.darkText }}>{m.label}</p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px]"
                  style={{ backgroundColor: SEMANTIC_SPOUSE.soft, color: SEMANTIC_SPOUSE.darkText }}
                >
                  {m.childrenIds.length} من الأبناء
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl p-3" style={{ border: `1.5px solid ${CONNECTOR_COLORS.strongDivider}` }}>
      <p className="text-[22px] font-bold leading-none tabular-nums" style={{ color: TEXT_COLORS.primary }}>
        {value}
      </p>
      <p className="mt-1 text-[11px]" style={{ color: TEXT_COLORS.muted }}>{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome Popup — mobile only, shown once
// ---------------------------------------------------------------------------
function WelcomePopup({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(true);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 350);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60] sm:hidden"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Popup Card */}
          <motion.div
            className="fixed inset-0 z-[61] flex items-center justify-center px-6 sm:hidden"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          >
            <div
              className="relative w-full max-w-[340px] overflow-hidden rounded-3xl bg-white"
              style={{ boxShadow: '0 32px 80px -16px rgba(0,0,0,0.35)' }}
            >
              {/* Top decorative bar */}
              <div
                className="h-1.5 w-full"
                style={{ background: 'linear-gradient(90deg, #1B5E20, #C5A028, #1B5E20)' }}
              />

              {/* Content */}
              <div className="flex flex-col items-center px-6 pb-7 pt-8">
                {/* Logo */}
                <motion.img
                  src="/logo.png"
                  alt="شجرة العائلة"
                  className="h-28 w-28 object-contain"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.15 }}
                />

                {/* Title */}
                <h2
                  className="mt-5 text-center text-xl font-bold leading-tight"
                  style={{ color: '#1B5E20' }}
                >
                  أهلاً وسهلاً
                </h2>
                <p
                  className="mt-1 text-center text-[13px] font-semibold"
                  style={{ color: '#C5A028' }}
                >
                  شجرة الاحمدية - بربر - السودان
                </p>

                {/* Description */}
                <p
                  className="mt-4 text-center text-[13px] leading-relaxed"
                  style={{ color: TEXT_COLORS.secondary }}
                >
                  تصفّح شجرة الأحمدية واستكشف الفروع .
                  <br />
                </p>

                {/* CTA Button */}
                <motion.button
                  type="button"
                  onClick={handleClose}
                  className="mt-6 w-full rounded-2xl px-6 py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90 active:opacity-80"
                  style={{
                    background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)',
                    boxShadow: '0 4px 16px -4px rgba(27,94,32,0.4)',
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  ابدأ الاستكشاف
                </motion.button>

                {/* Decorative dots */}
                <div className="mt-4 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#C5A028' }} />
                  <span className="h-1.5 w-6 rounded-full" style={{ backgroundColor: '#1B5E20' }} />
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#C5A028' }} />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Suppress unused import warnings
void NODE_W;
void NODE_H;
void SPOUSE_W;
void SPOUSE_H;
