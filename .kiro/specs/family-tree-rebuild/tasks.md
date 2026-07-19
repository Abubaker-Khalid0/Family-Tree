# Implementation Plan: Family Tree Rebuild

## Overview

Complete architectural rebuild of the Arabic interactive family tree application from plain HTML/CSS/JS to a modern React/TypeScript/Vite stack with React Flow, ELK.js, and Motion for React. The implementation follows a bottom-up approach: foundational tooling and types first, then data layer, layout engine, state management, rendering components, and finally integration with animations and accessibility.

## Tasks

- [x] 1. Project scaffolding and configuration
  - [x] 1.1 Initialize Vite + React + TypeScript project
    - Run `npm create vite@latest` with React TypeScript template in the project root
    - Configure `tsconfig.json` with `strict: true`, `noImplicitAny: true`
    - Set up path aliases (`@/` pointing to `src/`)
    - Update `index.html` with `lang="ar"` and `dir="rtl"` attributes
    - _Requirements: 1.1, 1.7, 1.8, 1.9, 2.1_

  - [x] 1.2 Install and configure Tailwind CSS with design tokens
    - Install Tailwind CSS, PostCSS, Autoprefixer
    - Create `tailwind.config.ts` with monochrome color palette (`#000`, `#fff`, `#6b6b6b`, `#d8d8d8`, `#f2f2f2`)
    - Add IBM Plex Sans Arabic font import in `src/styles/globals.css` with Tahoma fallback
    - Configure font family, border radius tokens (14px cards, 999px pill), spacing scale
    - _Requirements: 1.2, 2.2, 2.6, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [x] 1.3 Install core dependencies with pinned versions
    - Install `@xyflow/react`, `elkjs`, `motion` (motion/react), `shadcn/ui` CLI
    - Install `fast-check` and `vitest` as dev dependencies
    - Install `@testing-library/react` and `@testing-library/jest-dom` as dev dependencies
    - Pin all dependency versions in `package.json` (exact versions, no ^ or ~)
    - _Requirements: 1.4, 1.5, 1.6, 1.9_

  - [x] 1.4 Set up shadcn/ui and configure components
    - Initialize shadcn/ui with `npx shadcn-ui@latest init`
    - Install Button, Tooltip, Alert, and Dialog components from shadcn/ui
    - Configure shadcn/ui to use monochrome color scheme
    - _Requirements: 1.3_

  - [x] 1.5 Create directory structure and placeholder files
    - Create `src/components/`, `src/hooks/`, `src/data/`, `src/layout/`, `src/types/`, `src/utils/`, `src/__tests__/` directories
    - Create placeholder `index.ts` barrel files for each module
    - _Requirements: 17.4_

- [x] 2. Type definitions and data layer
  - [x] 2.1 Define TypeScript interfaces for family data types
    - Create `src/types/family.ts` with `Person`, `Spouse`, `FamilyData` interfaces
    - Create `src/types/tree-state.ts` with `VisibleNode`, `VisibleEdge`, `ExpandState` types
    - Create `src/types/layout.ts` with `PositionedNode`, `LayoutResult` types
    - Document all required and optional properties with JSDoc comments
    - _Requirements: 17.2, 3.4_

  - [x] 2.2 Migrate family data to TypeScript module
    - Create `src/data/family-data.ts` exporting a typed `FAMILY_DATA` constant
    - Convert the existing `data.js` content to typed TypeScript (Person[], FamilyData)
    - Ensure all 86 people and their relationships are preserved exactly
    - _Requirements: 3.1, 3.4_

  - [x] 2.3 Implement data-access module with lookup index and validation
    - Create `src/data/data-access.ts` implementing the `DataAccess` interface
    - Build lookup Map from `people` array (Map<string, Person>)
    - Implement `getPerson`, `getRoot`, `getSpouseDisplayName`, `isSpouseNameUnknown`, `getSpouseChildren`, `personHasExpandableBranch`, `getInitial` methods
    - Implement startup validation pipeline: duplicate IDs, missing references (fatherId, motherId, childrenIds, personId), rootPersonId check
    - Log validation issues as console group with count header
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 5.6, 5.7, 6.1, 6.6, 7.8, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [ ]* 2.4 Write property tests for data-access module (Properties 1-6, 13-15)
    - **Property 1: Lookup Index Round-Trip** — For any valid people array, building the lookup index and querying each ID returns the same person object
    - **Property 2: Duplicate ID Handling** — Duplicate IDs map to the last occurrence and are reported as validation issues
    - **Property 3: Reference Integrity Validation** — All broken fatherId, motherId, childrenIds, and personId references are detected
    - **Property 4: Broken References Excluded** — Visible tree includes valid persons and excludes non-existent referenced IDs
    - **Property 5: Spouse Display Name Resolution** — External spouses return name field; linked spouses return referenced person's name
    - **Property 6: Unknown Spouse Exclusion** — Spouses matching unknown patterns are excluded from visible nodes
    - **Property 13: Leaf Node Detection** — Persons without expandable children have isExpandable=false
    - **Property 14: Secondary Text Selection** — Non-empty notes used as secondary text; otherwise relation field used
    - **Property 15: Name Initial Fallback** — Empty/null/whitespace names return "؟"; non-empty return first character
    - **Validates: Requirements 3.1, 3.5, 3.6, 3.7, 5.6, 5.7, 6.1, 7.2, 7.8, 12.6, 14.1, 14.2, 14.3, 14.4, 19.4**

- [x] 3. Tree state management
  - [x] 3.1 Implement useTreeState hook
    - Create `src/hooks/useTreeState.ts`
    - Manage `expandedIds` as a `Set<string>` in React state
    - Implement `expand`, `collapse`, `collapseAll`, `toggleNode` actions
    - Derive visible nodes/edges by traversing from root through expanded nodes only
    - Maintain visited-persons set to prevent infinite loops from linked spouses
    - Implement canonical ownership of shared children (first parent in top-down traversal)
    - Handle spouse ordering (maintain data array order), children ordering (maintain childrenIds order)
    - Exclude unknown-name spouses from visible nodes, connecting children directly to parent
    - On initial load, show only root node in collapsed state
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 5.1, 5.2, 5.3, 5.6, 6.2, 6.3, 6.5, 16.1_

  - [x] 3.2 Implement linked-spouse resolution utility
    - Create `src/utils/linked-spouse.ts`
    - Implement canonical ownership algorithm: top-down traversal from root, first parent owns shared children
    - Resolve linked spouse display names from lookup index
    - Return fallback name when linked personId doesn't exist
    - Provide visual indicator flag for linked spouse nodes
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

  - [ ]* 3.3 Write property tests for tree state (Properties 7-12)
    - **Property 7: Tree Structure Matches Data** — Visible nodes include spouses in data order with children matching childrenIds
    - **Property 8: Expand Reveals One Level** — Expanding adds exactly spouse nodes and direct children, no deeper
    - **Property 9: Collapse Removes All Descendants** — Collapsing removes all descendants from visible set
    - **Property 10: Canonical Ownership** — Shared children appear only under first parent encountered from root
    - **Property 11: No Infinite Traversal Loops** — Traversal visits each person ID at most once, result is finite
    - **Property 12: Visible Nodes Equal Reachable Through Expanded Paths** — Visible set is exactly root + all nodes reachable through expanded IDs
    - **Validates: Requirements 3.3, 3.4, 4.2, 4.3, 5.1, 5.2, 6.2, 6.3, 6.5, 16.1**

- [x] 4. ELK layout engine integration
  - [x] 4.1 Implement ELK layout module
    - Create `src/layout/elk-layout.ts`
    - Build ELK graph from visible nodes/edges (ElkNode[] + ElkEdge[])
    - Configure ELK layered algorithm: top-to-bottom direction, 20px horizontal spacing, 40px vertical spacing, orthogonal edge routing, RTL sibling ordering
    - Set node dimensions: PersonNode 140px×72px (desktop), 120px×72px (mobile); SpouseNode 126px×60px (desktop), 106px×60px (mobile)
    - Return positioned nodes with x/y coordinates after ELK computation
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.6_

  - [x] 4.2 Implement useLayoutComputation hook
    - Create `src/hooks/useLayoutComputation.ts`
    - Call ELK layout asynchronously when visible nodes/edges change
    - Memoize results based on expand state fingerprint (avoid recomputation for same state)
    - Return `LayoutResult` with positioned React Flow nodes and edges
    - Handle layout errors: retain last valid layout, expose error state
    - Track `isComputing` state for loading indicator
    - Ensure layout completes within 200ms for ≤50 nodes, 500ms for 50-86 nodes
    - _Requirements: 8.3, 8.7, 8.8, 16.3, 16.4, 16.6_

  - [ ]* 4.3 Write property tests for layout (Properties 16-18, 20)
    - **Property 16: RTL Sibling Ordering** — Sibling nodes have x-coordinates in descending order (right-to-left)
    - **Property 17: Non-Overlap Spacing Invariant** — No two bounding boxes overlap with <20px horizontal or <40px vertical clearance
    - **Property 18: Zero-Children Spouse Has No Child Edges** — Spouse nodes with empty childrenIds have no outgoing edges
    - **Property 20: Layout Memoization** — Same inputs produce cached results without new ELK computation
    - **Validates: Requirements 2.4, 8.2, 8.4, 8.5, 8.6, 16.3, 20.1, 20.2, 20.5**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Custom React Flow nodes
  - [x] 6.1 Implement PersonNode component
    - Create `src/components/PersonNode.tsx` as a custom React Flow node
    - Render person card: bold Arabic name (2-line clamp with ellipsis), secondary text (notes or relation), title tooltip for truncated names
    - Show chevron indicator for expandable nodes (rotates upward when expanded)
    - Apply interaction states: hover shadow, press scale (95%), focus outline (2px solid black, 3px offset)
    - Render expanded state: 3px border, light gray (#f2f2f2) background
    - Render leaf nodes as non-interactive (no cursor, no hover, no press scale, no chevron)
    - Handle invalid/missing name: display "؟" placeholder
    - Wrap in `motion.div` for enter/exit animations
    - Use solid black 2px border, 14px border-radius, white background for default state
    - Handle gray border + warning icon for nodes with invalid references
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 7.8, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 20.3_

  - [x] 6.2 Implement SpouseNode component
    - Create `src/components/SpouseNode.tsx` as a custom React Flow node
    - Render spouse card: narrower than PersonNode, dashed black border, 14px border-radius
    - Display spouse name + label text below name
    - Show link icon/badge for linked spouses (type "linked")
    - If spouse name is unknown, component should not render (handled by state layer exclusion)
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 6.4, 7.4, 7.5_

  - [x] 6.3 Implement ConnectorEdge component
    - Create `src/components/ConnectorEdge.tsx` as a custom React Flow edge
    - Render orthogonal (step) edge with rounded corners at bends
    - Black (#000) stroke, 2.5px width, round stroke-linecap
    - No arrowheads on either end
    - Add `aria-hidden="true"` to SVG path element
    - Animate opacity on mount (0→1 over 400ms) and unmount (1→0 over 220ms)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 15.7_

  - [ ]* 6.4 Write unit tests for PersonNode and SpouseNode
    - Test default rendering with valid person data
    - Test expanded state styling (3px border, gray background)
    - Test leaf node renders without chevron and as non-interactive
    - Test truncated name shows tooltip
    - Test "؟" placeholder for empty names
    - Test SpouseNode dashed border and label rendering
    - Test linked spouse indicator badge
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 12.1, 12.5, 12.6_

- [x] 7. Application shell and toolbar
  - [x] 7.1 Implement Header component
    - Create `src/components/Header.tsx`
    - Sticky header with title "شجرة العائلة" and subtitle "اضغط على أي شخص لعرض فرعه"
    - Solid black bottom border (2px)
    - On viewport < 768px: single-line title only
    - _Requirements: 11.1, 11.4, 11.5, 11.6_

  - [x] 7.2 Implement Toolbar component
    - Create `src/components/Toolbar.tsx`
    - Buttons: "العودة للجذر", "طي الكل", "ملاءمة العرض", "تكبير", "تصغير", "إعادة تعيين"
    - Use shadcn/ui Button components with monochrome styling
    - Minimum touch target 44×44px
    - On viewport < 768px: icon-only buttons with Arabic tooltips
    - Wire buttons to tree state actions and React Flow viewport controls
    - _Requirements: 11.2, 11.6, 10.7_

  - [x] 7.3 Implement LoadingState and ErrorState components
    - Create `src/components/LoadingState.tsx`: centered Arabic loading text "جاري التحميل..."
    - Create `src/components/ErrorState.tsx`: Arabic error messages with retry button
    - Handle data load failure: "تعذّر تحميل بيانات الشجرة"
    - Handle root not found: "لم يتم العثور على الشخص الجذر ضمن البيانات"
    - Handle inline layout error near affected node
    - _Requirements: 19.1, 19.2, 19.3, 19.5_

  - [x] 7.4 Implement App.tsx application shell
    - Create `src/App.tsx` with flex column layout: Header → Toolbar → TreeViewport
    - TreeViewport fills remaining height via `calc(100vh - header height)`
    - White background, black text throughout
    - Error boundary wrapping the tree viewport
    - Provide tree state context to child components
    - _Requirements: 11.3, 11.4, 18.1_

- [x] 8. TreeViewport and React Flow integration
  - [x] 8.1 Implement TreeViewport component
    - Create `src/components/TreeViewport.tsx`
    - Wrap `<ReactFlow>` with custom node types (PersonNode, SpouseNode) and edge types (ConnectorEdge)
    - Configure viewport: zoom range 0.3x–3x, pan on drag, touch support
    - Set `role="region"` and `aria-label="مخطط شجرة العائلة"` on viewport container
    - Enable React Flow's built-in viewport culling for performance
    - Support pinch-to-zoom on touch devices, mouse wheel zoom on desktop
    - Fit view on initial load (center root node)
    - _Requirements: 4.4, 10.1, 10.2, 10.3, 10.4, 10.6, 15.4, 16.5_

  - [x] 8.2 Wire expand/collapse interaction to tree state
    - Connect PersonNode click handler to `useTreeState.toggleNode`
    - On expand: trigger layout recomputation with new visible nodes
    - On collapse: animate removal then trigger layout recomputation
    - Maintain expand state through re-renders
    - Move focus to toggled node after expand/collapse, update aria-expanded
    - _Requirements: 4.2, 4.3, 4.4, 4.7, 15.2, 15.8_

  - [x] 8.3 Implement responsive breakpoint behavior
    - Reduce node card width on viewport < 768px (120px PersonNode, 106px SpouseNode)
    - Adjust ELK spacing for compact mobile layout
    - Handle device orientation changes: reflow layout within 300ms preserving state
    - Ensure minimum 44×44px touch targets on all interactive elements
    - No horizontal scrollbar or content overflow on 320px viewport
    - _Requirements: 10.1, 10.5, 10.7, 10.8_

- [x] 9. Animations and reduced motion
  - [x] 9.1 Implement node enter/exit animations with Motion
    - Configure Motion for node appearance: fade (0→1) + translate Y (10px up), 320ms duration, staggered 50ms per node (max 500ms total)
    - Configure Motion for node disappearance: fade (1→0), 250ms duration
    - Configure spring-based position transitions for layout changes (settles within 500ms)
    - Use consistent easing: cubic-bezier(0.22, 0.61, 0.36, 1) for non-spring animations
    - Handle animation interruption: cancel expansion if collapse triggered mid-animation
    - _Requirements: 4.5, 4.6, 9.1, 9.2, 9.3, 9.5, 9.6_

  - [x] 9.2 Implement useReducedMotion hook and reduced motion mode
    - Create `src/hooks/useReducedMotion.ts`
    - Detect `prefers-reduced-motion: reduce` media query
    - When active: skip all animations, apply changes within single frame (≤1ms transitions)
    - Integrate with Motion components to conditionally disable animations
    - _Requirements: 4.8, 9.4, 9.7, 15.5_

- [x] 10. Keyboard navigation and accessibility
  - [x] 10.1 Implement useTreeKeyboard hook
    - Create `src/hooks/useTreeKeyboard.ts`
    - Tab: move focus sequentially through interactive elements in DOM order
    - Arrow keys: Right/Left between siblings, Down to first child, Up to parent (logical tree hierarchy)
    - Enter/Space: expand or collapse focused expandable node
    - Maintain focus position within tree structure
    - _Requirements: 15.1, 15.2_

  - [x] 10.2 Add ARIA attributes and focus management
    - Set `aria-label` on expandable PersonNodes: name + expand instruction (e.g., "مضوي، الجد الأكبر. اضغط لعرض الزوج/ة والأبناء")
    - Set `aria-label` on leaf PersonNodes: name only
    - Set `aria-expanded` on expandable nodes reflecting current state
    - Maintain visible focus indicators: 2px solid black outline, 3px offset
    - After expand/collapse: move focus to toggled node button, update aria-expanded
    - _Requirements: 15.1, 15.2, 15.3, 15.6, 15.8_

  - [ ]* 10.3 Write property test for accessibility (Property 19)
    - **Property 19: aria-label Correctness** — Expandable nodes include name + expand instruction; leaf nodes include name only
    - **Validates: Requirements 15.3**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Performance optimization and memoization
  - [x] 12.1 Implement component memoization
    - Wrap PersonNode and SpouseNode with `React.memo` with custom comparison
    - Prevent re-renders of unrelated nodes when sibling branches expand/collapse
    - Memoize visible node/edge derivation with `useMemo` keyed on expandedIds
    - _Requirements: 16.2_

  - [x] 12.2 Implement layout caching
    - Add fingerprint-based caching to `useLayoutComputation`
    - Cache ELK results keyed on serialized expand state
    - Ensure identical expand states return cached results without ELK recomputation
    - Verify layout timing: <300ms for ≤50 nodes, <600ms for 50-86 nodes
    - _Requirements: 16.3, 16.4, 16.6_

- [x] 13. Design token constants and final styling
  - [x] 13.1 Create constants module with all design tokens
    - Create `src/utils/constants.ts`
    - Define color palette: `#000`, `#fff`, `#6b6b6b`, `#d8d8d8`, `#f2f2f2`
    - Define spacing: 16px between siblings, 12px padding
    - Define timing: 320ms enter, 250ms exit, 50ms stagger, 400ms edge appear, 220ms edge disappear
    - Define easing: cubic-bezier(0.22, 0.61, 0.36, 1)
    - Define node dimensions, border widths, border radii
    - Define zoom range: 0.3x–3x
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 14. Integration and wiring
  - [x] 14.1 Wire all components together in App.tsx
    - Connect `useTreeState` → `useLayoutComputation` → `TreeViewport`
    - Pass toolbar actions (collapseAll, fitView, zoomIn, zoomOut, resetView) to Toolbar
    - Conditionally render LoadingState while layout is computing on initial load
    - Conditionally render ErrorState when root is invalid or data fails to load
    - Ensure Tree_Viewport renders the root node on initial successful load
    - _Requirements: 3.2, 4.1, 11.2, 11.3, 19.1, 19.2, 19.3_

  - [x] 14.2 Implement custom React hook for external state consumption
    - Create a `useTreeExternalState` hook (or extend `useTreeState`) that exposes expanded node IDs and current viewport position via React Flow's `useReactFlow`
    - Ensure external code can consume tree state without directly reading internal component state
    - _Requirements: 17.5_

  - [x] 14.3 Verify module separation and data layer isolation
    - Ensure data-access module is the single entry point for data (replace static data with API → only data-access changes)
    - Ensure layout module does not import rendering components
    - Ensure rendering components don't compute layout directly
    - Validate all public interfaces match TypeScript interface definitions
    - _Requirements: 17.1, 17.3_

  - [ ]* 14.4 Write integration tests for full expand/collapse cycle
    - Test full expand/collapse with React Flow rendering
    - Test keyboard navigation flow (Tab, arrows, Enter/Space)
    - Test error boundary behavior on data load failure
    - Test that p001 renders as root with correct name
    - Test that p021/p030 linked spouse pair shows children only under canonical parent
    - _Requirements: 4.2, 4.3, 6.2, 6.5, 15.1, 15.2_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `data.js` file is the source of truth for the 86-person dataset — migrate it to TypeScript exactly
- All UI text must be in Arabic — no English strings in the rendered application
- The monochrome palette is strictly enforced: only black, white, and defined grays

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2", "3.2", "13.1"] },
    { "id": 5, "tasks": ["2.3"] },
    { "id": 6, "tasks": ["2.4", "3.1"] },
    { "id": 7, "tasks": ["3.3", "4.1"] },
    { "id": 8, "tasks": ["4.2"] },
    { "id": 9, "tasks": ["4.3", "6.1", "6.2", "6.3"] },
    { "id": 10, "tasks": ["6.4", "7.1", "7.2", "7.3"] },
    { "id": 11, "tasks": ["7.4", "8.1"] },
    { "id": 12, "tasks": ["8.2", "8.3"] },
    { "id": 13, "tasks": ["9.1", "9.2"] },
    { "id": 14, "tasks": ["10.1", "10.2"] },
    { "id": 15, "tasks": ["10.3", "12.1", "12.2"] },
    { "id": 16, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 17, "tasks": ["14.4"] }
  ]
}
```
