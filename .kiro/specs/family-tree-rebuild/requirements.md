# Requirements Document

## Introduction

This document specifies the requirements for a complete architectural rebuild of an existing Arabic interactive family tree application. The current application is built with plain HTML, CSS, and JavaScript with manual SVG connector lines, manual pan/zoom, CSS-only animations, and DOM-based state management. The rebuild migrates to a modern stack (React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Flow, ELK.js, Motion for React) while preserving all existing functionality and data. The family tree contains 86 people across 6+ generations with the root person "مضوي" (p001) as the great grandfather. The application is fully Arabic RTL with a strict monochrome visual design.

## Glossary

- **Application**: The rebuilt Arabic interactive family tree viewer
- **Tree_Viewport**: The main interactive canvas area where the family tree graph is rendered using React Flow
- **Person_Node**: A custom React Flow node representing a family member from the data model
- **Spouse_Node**: A custom React Flow node representing a spouse entry (external or linked) attached to a Person_Node
- **Connector_Edge**: A React Flow edge connecting nodes in the tree hierarchy
- **ELK_Layout_Engine**: The ELK.js-based automatic graph layout system that computes node positions
- **Data_Model**: The existing FAMILY_DATA structure containing people array with IDs, relationships, and spouse.childrenIds groupings
- **Expand_State**: The set of currently expanded Person_Nodes whose children and spouses are visible
- **Linked_Spouse**: A spouse entry of type "linked" that references another person already existing in the tree via personId
- **External_Spouse**: A spouse entry of type "external" that represents a person not independently present in the family tree
- **Root_Person**: The topmost ancestor in the tree (مضوي, p001) from which all rendering begins
- **Application_Shell**: The overall page layout including header, toolbar, and Tree_Viewport
- **Toolbar**: The control bar containing tree manipulation actions (collapse all, reset view)
- **Motion_Library**: The Motion for React animation library used for all UI transitions
- **Reduced_Motion_Mode**: A mode respecting the user's prefers-reduced-motion OS setting

## Requirements

### Requirement 1: Technology Stack Foundation

**User Story:** As a developer, I want the application rebuilt on a modern stack, so that it is maintainable, type-safe, and leverages current best practices.

#### Acceptance Criteria

1. THE Application SHALL be built using React 18+ with TypeScript and bundled with Vite, producing a functional development build that serves in a browser without errors
2. THE Application SHALL use Tailwind CSS for utility-first styling, with Tailwind configured as the sole CSS framework and no other CSS framework dependencies present
3. THE Application SHALL use shadcn/ui components for standard UI elements (buttons, dialogs, tooltips), with all interactive UI primitives sourced from the shadcn/ui library
4. THE Application SHALL use React Flow (@xyflow/react) as the graph rendering engine for the Tree_Viewport
5. THE Application SHALL use ELK.js (elkjs) for automatic hierarchical graph layout computation
6. THE Application SHALL use Motion for React (motion/react) for all UI animations and transitions, with no other animation libraries present in the dependency list
7. THE Application SHALL enforce strict TypeScript with noImplicitAny enabled and no ts-ignore or any type assertions suppressing type errors in the codebase
8. WHEN the application is built using the production build command, THE Application SHALL complete the build with zero TypeScript compilation errors and zero type warnings
9. THE Application SHALL declare all required dependencies (React 18+, TypeScript, Vite, Tailwind CSS, @xyflow/react, elkjs, motion/react) with pinned versions in the package.json file

### Requirement 2: Arabic RTL Interface

**User Story:** As an Arabic-speaking user, I want the entire interface in Arabic with proper RTL layout, so that I can read and navigate the tree naturally.

#### Acceptance Criteria

1. THE Application SHALL render the HTML document with lang="ar" and dir="rtl" attributes
2. THE Application SHALL use the IBM Plex Sans Arabic font family as the primary typeface with Tahoma as the fallback typeface
3. THE Application SHALL display all UI labels, buttons, tooltips, and status messages in Arabic
4. THE Application SHALL render the tree layout in RTL direction where sibling nodes flow from right to left
5. WHEN a text element contains an Arabic name that exceeds 2 lines within the card width, THE Application SHALL visually truncate the name with an ellipsis and display the full name in a tooltip on hover
6. IF the IBM Plex Sans Arabic font fails to load, THEN THE Application SHALL render all text using the fallback typeface without blocking page display

### Requirement 3: Data-Driven Tree Rendering

**User Story:** As a user, I want the family tree rendered from the existing data model, so that all 86 people and their relationships are accurately represented.

#### Acceptance Criteria

1. WHEN the Application initializes, THE Application SHALL import and parse the Data_Model, building a lookup index that maps each of the 86 person IDs to its corresponding person object
2. WHEN the Application starts, THE Application SHALL render the Root_Person (مضوي, p001) as a visible node displaying the person's name and an expand control
3. THE Application SHALL derive parent-child relationships exclusively from the spouse.childrenIds arrays in the Data_Model, resolving each child ID to the corresponding person object via the lookup index
4. THE Application SHALL read and utilize the following data fields for each person: id, name, gender, relation, fatherId, motherId, spouses (including nested id, type, name, label, childrenIds, and personId for linked spouses), and notes
5. THE Application SHALL handle both spouse types: "external" spouses displayed by their name property, and "linked" spouses resolved to the referenced person object via personId in the lookup index
6. IF a referenced person ID (in childrenIds, fatherId, motherId, or spouse.personId) does not exist in the Data_Model, THEN THE Application SHALL log a validation warning to the console and omit the broken reference from the rendered tree while continuing to render all valid nodes
7. IF the Data_Model contains a duplicate person ID, THEN THE Application SHALL log a validation warning and use only the last occurrence of that ID in the lookup index

### Requirement 4: Progressive Disclosure (Expand/Collapse)

**User Story:** As a user, I want to expand and collapse branches on demand, so that I can explore the tree without being overwhelmed by the full 86-person graph.

#### Acceptance Criteria

1. WHEN the Application loads, THE Application SHALL display only the Root_Person node in collapsed state
2. WHEN a user clicks or taps a Person_Node that has children (defined as having at least one spouse entry with a non-empty childrenIds array), THE Application SHALL expand that node by one level to reveal its immediate spouse nodes and their direct children nodes
3. WHEN a user clicks or taps an expanded Person_Node, THE Application SHALL collapse that node and hide all its descendants, removing them from the visible tree
4. WHEN a node is expanded or collapsed, THE ELK_Layout_Engine SHALL recompute the layout to position all currently visible nodes
5. WHEN nodes appear after expansion, THE Application SHALL animate their appearance using the Motion_Library with a staggered entry effect delayed by 50ms per node
6. WHEN a node is collapsed, THE Application SHALL animate the removal of hidden nodes with a fade-out transition lasting 250ms
7. THE Application SHALL maintain Expand_State in React state so that expanded branches persist during re-renders
8. WHILE Reduced_Motion_Mode is active, THE Application SHALL skip all expand/collapse animations and apply visibility changes instantly

### Requirement 5: Multiple Spouse Support

**User Story:** As a user, I want to see all spouses of a person with children correctly grouped under each spouse, so that complex family structures are accurately displayed.

#### Acceptance Criteria

1. WHEN a Person_Node is expanded, THE Application SHALL display each spouse entry from that person's spouses array in the order they appear in the data, rendered as individual Spouse_Nodes positioned below the Person_Node
2. THE Application SHALL render children as Person_Nodes grouped directly below their respective Spouse_Node, based on that spouse's childrenIds array, maintaining the order defined in the array
3. WHEN a spouse has an empty childrenIds array, THE Application SHALL display the Spouse_Node without a children section below it
4. THE Application SHALL visually distinguish Spouse_Nodes from Person_Nodes by rendering Spouse_Nodes with a dashed border style
5. THE Application SHALL display the spouse label text (e.g., "الزوجة الأولى", "الزوجة الثانية") below the spouse name within the Spouse_Node
6. IF a spouse's display name resolves to "غير معروفة" or "غير معروف", THEN THE Application SHALL hide that Spouse_Node and render its children directly below the parent Person_Node
7. IF a spouse entry has type "linked" with a valid personId, THEN THE Application SHALL resolve and display the linked person's name as the spouse display name

### Requirement 6: Linked Spouse Handling

**User Story:** As a user, I want linked spouses (two people in the same tree married to each other) displayed correctly without duplication or infinite loops.

#### Acceptance Criteria

1. WHEN a spouse entry has type "linked" with a personId, THE Application SHALL resolve the spouse display name from the referenced person in the Data_Model
2. THE Application SHALL render linked spouse children under the canonical parent node only (the node whose expand action was triggered by the user)
3. THE Application SHALL prevent infinite expansion loops by maintaining a visited person ID set during tree traversal and refusing to expand any person ID already present in the set
4. WHEN a linked spouse is encountered during expansion, THE Application SHALL display a visual indicator (such as a link icon or badge) on the Spouse_Node indicating that this spouse exists elsewhere in the tree
5. THE Application SHALL assign canonical ownership of shared children to the first parent encountered in a top-down traversal from the Root_Person, ensuring children are never rendered as duplicates under both linked spouses simultaneously
6. IF a linked spouse's personId references a person ID that does not exist in the Data_Model, THEN THE Application SHALL log a validation warning and display the Spouse_Node with a fallback display name

### Requirement 7: Custom Node Design

**User Story:** As a user, I want person and spouse nodes to have a clean, monochrome card design that displays essential information clearly.

#### Acceptance Criteria

1. THE Person_Node SHALL display the person's Arabic name as the primary text element with bold font weight, truncated to a maximum of 2 visible lines with overflow hidden
2. THE Person_Node SHALL display the person's notes (if non-empty) as secondary text below the name in a smaller font size and muted color; IF no notes are present, THEN THE Person_Node SHALL display the person's relation as secondary text instead
3. WHEN a Person_Node has expandable children, THE Person_Node SHALL display a downward-pointing chevron indicator that rotates upward when the node is in expanded state
4. THE Spouse_Node SHALL display the spouse name and label in a card narrower than the Person_Node card, using dashed black borders and the same border radius as Person_Node
5. WHEN a spouse name is unknown ("غير معروفة", "غير معروف", or "غير معروف/ة"), THE Application SHALL hide that Spouse_Node and connect the parent Person_Node directly to the children via connector lines
6. THE Person_Node SHALL use a solid black border of 2px width with 14px border radius on a white background
7. WHILE a Person_Node is in expanded state, THE Application SHALL apply a 3px border width and a light gray background to that Person_Node to distinguish it from collapsed nodes
8. IF a person's name is empty or null, THEN THE Person_Node SHALL display a placeholder character ("؟") as the name initial

### Requirement 8: ELK.js Automatic Layout

**User Story:** As a user, I want the tree automatically laid out in a clean hierarchy, so that nodes never overlap and the structure is easy to follow.

#### Acceptance Criteria

1. THE ELK_Layout_Engine SHALL compute a top-to-bottom (layered) hierarchical layout for all visible nodes
2. THE ELK_Layout_Engine SHALL use the "layered" algorithm with a minimum horizontal spacing of 20px between sibling nodes and a minimum vertical spacing of 40px between layers
3. WHEN nodes are added or removed due to expand/collapse, THE ELK_Layout_Engine SHALL recompute the layout within 200ms for up to 50 visible nodes
4. THE ELK_Layout_Engine SHALL respect RTL ordering by placing siblings from right to left within each layer
5. THE ELK_Layout_Engine SHALL position every node such that no two node bounding boxes overlap by fewer than 20px of horizontal clearance or 40px of vertical clearance
6. THE ELK_Layout_Engine SHALL handle wide families (10+ children) by distributing them horizontally while maintaining a minimum of 20px gap between adjacent sibling nodes
7. WHEN the number of visible nodes exceeds 50, THE ELK_Layout_Engine SHALL complete layout recomputation within 500ms
8. IF the ELK_Layout_Engine fails to compute a layout, THEN THE ELK_Layout_Engine SHALL retain the last successfully computed layout and display an error message indicating the layout could not be updated

### Requirement 9: Animations

**User Story:** As a user, I want smooth, professional animations when interacting with the tree, so that the experience feels polished and responsive.

#### Acceptance Criteria

1. WHEN nodes appear after expansion, THE Motion_Library SHALL animate each node with a fade from opacity 0 to 1 and a vertical translation of 10px upward to final position, lasting 320ms, with a staggered delay of 50ms per node up to a maximum total stagger of 500ms
2. WHEN nodes disappear after collapse, THE Motion_Library SHALL animate them with a fade from opacity 1 to 0 lasting 250ms
3. WHEN the layout is recomputed, THE Motion_Library SHALL animate node position changes with a spring-based transition that settles within 500ms
4. WHILE Reduced_Motion_Mode is active, THE Application SHALL skip all animated transitions and apply layout and visibility changes within a single animation frame
5. THE Application SHALL use a consistent easing curve (cubic-bezier 0.22, 0.61, 0.36, 1) for all non-spring animations
6. IF a collapse is triggered while an expansion animation is still in progress on the same node, THEN THE Application SHALL cancel the expansion animation and begin the collapse animation from the current visual state
7. WHEN the operating system or browser reports prefers-reduced-motion: reduce, THE Application SHALL activate Reduced_Motion_Mode

### Requirement 10: Mobile-First Responsive Design

**User Story:** As a mobile user, I want to navigate the family tree using touch gestures on any screen size, so that I can explore the tree on my phone or tablet.

#### Acceptance Criteria

1. THE Application SHALL render responsively from 320px viewport width up to 4K displays without horizontal scrollbar or content overflow
2. THE Application SHALL support touch-based pan gestures (single finger drag) on the Tree_Viewport
3. THE Application SHALL support pinch-to-zoom gestures on touch devices with a zoom range clamped between 0.3x and 3x
4. THE Application SHALL support mouse wheel zoom on desktop devices with the same 0.3x to 3x zoom range
5. WHEN the viewport is smaller than 768px, THE Application SHALL reduce node card width and spacing for compact display while maintaining minimum touch target sizes
6. THE Application SHALL support pointer-based drag for panning on desktop via React Flow's built-in pan controls
7. THE Application SHALL use a minimum touch target size of 44x44 pixels for all interactive elements including node cards and toolbar buttons
8. WHEN the device orientation changes, THE Application SHALL reflow the layout within 300ms without losing the current expand state or viewport position

### Requirement 11: Application Shell

**User Story:** As a user, I want a clear application layout with a header showing the family name, a toolbar for tree controls, and the tree viewport filling the remaining space.

#### Acceptance Criteria

1. THE Application_Shell SHALL display a sticky header at the top with the title "شجرة العائلة" and a subtitle instruction "اضغط على أي شخص لعرض فرعه"
2. THE Application_Shell SHALL display a Toolbar containing at minimum: "العودة للجذر" (Return to Root), "طي الكل" (Collapse All), "ملاءمة العرض" (Fit View), "تكبير" (Zoom In), "تصغير" (Zoom Out), and "إعادة تعيين" (Reset View) buttons
3. THE Tree_Viewport SHALL fill the remaining viewport height below the header and Toolbar using CSS calc(100vh - header height)
4. THE Application_Shell SHALL use a white background with black text throughout (monochrome design)
5. THE Application_Shell header SHALL have a solid black bottom border of 2px separating it from the Tree_Viewport
6. WHEN the viewport is smaller than 768px, THE header SHALL condense to a single line with the title only, and the toolbar SHALL use icon-only buttons with Arabic tooltips

### Requirement 12: Node Interaction States

**User Story:** As a user, I want clear visual feedback when I interact with nodes, so that I know what is clickable and what state each node is in.

#### Acceptance Criteria

1. WHILE a Person_Node is in default state (not hovered, focused, pressed, or expanded), THE Person_Node SHALL display with a solid black border (2px) and white background
2. WHEN a user hovers over a clickable Person_Node, THE Person_Node SHALL display a visible box shadow to indicate interactivity
3. WHEN a user presses a clickable Person_Node, THE Person_Node SHALL visually scale down (to no less than 95% of original size) within 150ms to provide tactile feedback
4. WHEN a Person_Node receives keyboard focus, THE Person_Node SHALL display a 2px solid black outline with a 3px offset from the card edge
5. WHILE a Person_Node is in expanded state, THE Person_Node SHALL display with a highlighted background distinct from the default white and a border width at least 1px thicker than the default state border
6. WHEN a Person_Node is a leaf node (has no children in the data source), THE Person_Node SHALL omit the chevron indicator, render as a non-button element (no pointer cursor, no hover shadow, no press scale effect), and not respond to click or keyboard activation events
7. IF a Person_Node references a person ID that does not exist in the data source or has missing required fields (name), THEN THE Application SHALL render that node with a gray border, display a warning icon within the card boundaries, and not expand on interaction

### Requirement 13: Connector Edge Design

**User Story:** As a user, I want clean connector lines between parents, spouses, and children, so that I can trace lineage relationships visually.

#### Acceptance Criteria

1. THE Connector_Edge SHALL be rendered as React Flow edges connecting parent nodes to spouse and child nodes using the React Flow edge API
2. THE Connector_Edge SHALL use a black (#000000) stroke color with 2.5px stroke width
3. THE Connector_Edge SHALL use orthogonal (step) edge routing with rounded corners at each bend point
4. WHEN new edges appear after expansion, THE Application SHALL animate edge opacity from 0 to 1 over 400ms synchronized with the appearance of their target nodes
5. WHEN edges disappear after collapse, THE Application SHALL fade them out (opacity 1 to 0) over 220ms before removal from the DOM
6. THE Connector_Edge SHALL use round stroke-linecap for clean visual termination at connection points
7. THE Connector_Edge SHALL NOT display arrowheads at either terminal point

### Requirement 14: Data Validation

**User Story:** As a developer, I want the application to validate data integrity at startup, so that broken references are detected early and reported without crashing.

#### Acceptance Criteria

1. WHEN the Application initializes, THE Application SHALL validate that all person IDs within the people array are unique
2. WHEN the Application initializes, THE Application SHALL validate that every non-null fatherId and motherId references an existing person ID in the people array
3. WHEN the Application initializes, THE Application SHALL validate that all childrenIds within spouse entries reference existing person IDs in the people array
4. WHEN the Application initializes, THE Application SHALL validate that the rootPersonId matches an existing person ID in the Data_Model
5. IF validation finds one or more issues, THEN THE Application SHALL log each issue as a warning to the browser console, prefixed with a single group header that includes the total number of issues found
6. IF validation finds issues but the rootPersonId is valid, THEN THE Application SHALL render the tree starting from the root, skipping any person nodes whose references are broken while continuing to display all persons with valid references
7. IF the rootPersonId does not match any existing person ID, THEN THE Application SHALL display an error message in the page content area indicating that the root person could not be found, and SHALL NOT attempt to render the tree

### Requirement 15: Accessibility

**User Story:** As a user with accessibility needs, I want to navigate the family tree using a keyboard and screen reader, so that the application is usable without a mouse or with assistive technology.

#### Acceptance Criteria

1. THE Application SHALL support keyboard navigation between visible nodes using Tab to move focus sequentially through interactive elements in DOM order, and arrow keys (Right/Left to move between siblings, Down to move to first child, Up to move to parent) relative to the tree's logical hierarchy
2. THE Application SHALL support expanding and collapsing nodes using Enter or Space keys when focus is on an expandable node
3. THE Person_Node SHALL include an aria-label describing the person's name and expand state (e.g., "مضوي، الجد الأكبر. اضغط لعرض الزوج/ة والأبناء") for expandable nodes, and an aria-label containing only the person's name for non-expandable leaf nodes
4. THE Tree_Viewport SHALL include role="region" with aria-label="مخطط شجرة العائلة"
5. WHILE Reduced_Motion_Mode is active, THE Application SHALL suppress all animations and apply transitions with a duration no greater than 1ms
6. THE Application SHALL maintain visible focus indicators on all interactive elements with a 2px solid black outline and a minimum outline-offset of 3px
7. THE Connector_Edge SHALL include aria-hidden="true" to exclude decorative lines from the accessibility tree
8. WHEN a node is expanded or collapsed, THE Application SHALL move focus to the toggled node's button element and update its aria-expanded attribute to reflect the new state

### Requirement 16: Performance

**User Story:** As a user with a large family tree, I want the application to remain responsive even with many expanded nodes, so that interaction never feels sluggish.

#### Acceptance Criteria

1. THE Application SHALL render only the currently expanded branches (not the full 86-person graph at once)
2. THE Application SHALL prevent unnecessary re-renders of Person_Node and Spouse_Node components when unrelated state changes occur (e.g., expanding a sibling branch SHALL NOT re-render already-visible nodes)
3. THE Application SHALL memoize the ELK layout computation so that identical Expand_State inputs produce cached results without recomputation
4. WHEN fewer than 50 nodes are visible, THE Application SHALL complete layout computation and render within 300ms of an expand/collapse action
5. THE Application SHALL use React Flow's built-in viewport culling to avoid rendering nodes that are outside the visible viewport area
6. WHEN between 50 and 86 nodes are visible, THE Application SHALL complete layout computation and render within 600ms of an expand/collapse action

### Requirement 17: Future-Ready Architecture

**User Story:** As a developer, I want the architecture to be modular and extensible, so that search, profiles, admin features, and API integration can be added later without major refactoring.

#### Acceptance Criteria

1. THE Application SHALL separate data access, layout computation, and rendering into distinct modules where each module contains logic for only one concern and does not directly reference internal implementation details of another module except through a defined public interface
2. THE Application SHALL define TypeScript interfaces for Person, Spouse, and FamilyData types that document all required and optional properties with their expected data types
3. THE Application SHALL structure the data layer behind a single data-access module such that replacing the static data source with a fetch call to an API endpoint requires modifications only within the data-access module and zero modifications to layout computation or rendering modules
4. THE Application SHALL organize components in a standard directory structure (components, hooks, types, utils, data) with clear separation of concerns
5. THE Application SHALL expose the tree state (currently expanded node identifiers and current viewport position) via a custom React hook that external code can consume without directly reading internal component state

### Requirement 18: Monochrome Visual Design

**User Story:** As a user, I want a strict black-and-white formal design, so that the family tree has an elegant, timeless aesthetic.

#### Acceptance Criteria

1. THE Application SHALL use only black (#000000), white (#ffffff), and gray shades (#6b6b6b, #d8d8d8, #f2f2f2) for all rendered foreground colors, background colors, borders, and shadows
2. THE Application SHALL use no colored accents, icons, or decorative elements outside the monochrome palette defined in criterion 1, including hover states, focus indicators, and selection highlights
3. THE Application SHALL use a border width of 2px for container elements such as cards and panels, and a border width of 3px for interactive or highlighted elements such as the currently expanded person node
4. THE Application SHALL use 14px border radius for cards and panels, and 999px (pill) border radius for avatar placeholders and circular button elements
5. THE Application SHALL maintain a minimum spacing of 16px between sibling UI elements and a minimum padding of 12px within container elements
6. THE Application SHALL render all body text at a minimum size of 12px and all heading text at a minimum size of 18px

### Requirement 19: Loading, Error, and Empty States

**User Story:** As a user, I want clear feedback when the application is loading, encounters an error, or has no data to display.

#### Acceptance Criteria

1. WHILE the ELK_Layout_Engine is computing the initial layout, THE Application SHALL display a centered Arabic loading indicator ("جاري التحميل...") within the Tree_Viewport area
2. IF the Data_Model fails to load or parse, THEN THE Application SHALL display an Arabic error message ("تعذّر تحميل بيانات الشجرة") with a retry button that re-attempts data loading when clicked
3. IF the Root_Person is not found in the Data_Model, THEN THE Application SHALL display an Arabic message ("لم يتم العثور على الشخص الجذر ضمن البيانات") in the Tree_Viewport area
4. IF a Person_Node has no spouses and no children, THEN THE Application SHALL render the node as a leaf without an expand affordance (no chevron, no button behavior)
5. WHEN an error occurs during expansion (e.g., layout computation failure), THE Application SHALL display an inline Arabic error message near the affected node without disrupting the rest of the visible tree

### Requirement 20: Large Family Support

**User Story:** As a user viewing families with many children (10+), deep nesting, or long Arabic names, I want the layout to remain readable and navigable.

#### Acceptance Criteria

1. WHEN a person has more than 8 children under one spouse, THE Application SHALL distribute them across the horizontal axis such that no two node bounding boxes overlap and the minimum gap between adjacent sibling nodes is at least 20px
2. THE Application SHALL support tree depth of at least 7 generations without node overlap, connector misalignment, or cards being rendered outside the pannable canvas area
3. WHEN a person's name exceeds the card width, THE Person_Node SHALL truncate the name to a maximum of 2 lines using ellipsis and SHALL expose the full untruncated name via a title attribute tooltip
4. WHEN more than 30 nodes are rendered in the DOM simultaneously, THE Application SHALL maintain a frame rate of at least 30 fps during pan and zoom interactions as measured over any continuous 2-second interval
5. IF a spouse entry has zero children, THEN THE Application SHALL display the spouse card without rendering any child connector line below it
6. WHILE the tree is expanded beyond the visible viewport, THE Application SHALL allow the user to reach any rendered node via pan or zoom without clipping or inaccessible regions
