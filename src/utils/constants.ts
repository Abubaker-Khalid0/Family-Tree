/**
 * Design tokens and constants for the family tree application.
 * All visual, spacing, timing, and sizing values are centralized here.
 */

// === Color Palette (Monochrome - Legacy) ===
export const COLORS = {
  black: '#000000',
  white: '#ffffff',
  grayDark: '#6b6b6b',
  grayMedium: '#d8d8d8',
  grayLight: '#f2f2f2',
} as const;

// === Semantic Color System ===

/** Root / explicit ancestor — maroon family */
export const SEMANTIC_ROOT = {
  primary: '#6B2D3E',
  background: '#FFF7F9',
  soft: '#F3E1E7',
  darkText: '#481624',
} as const;

/** Family members / descendants — blue family */
export const SEMANTIC_FAMILY = {
  primary: '#315F85',
  background: '#F4F8FC',
  soft: '#DCE8F2',
  darkText: '#203F59',
} as const;

/** Spouses — warm brown-gold family */
export const SEMANTIC_SPOUSE = {
  primary: '#93652F',
  background: '#FCF8F2',
  soft: '#F0E3D1',
  darkText: '#5B3B17',
} as const;

/** Active / expanded state — green (interaction overlay, not identity) */
export const SEMANTIC_ACTIVE = {
  primary: '#1F5B47',
  background: '#F2F9F5',
  soft: '#DDEDE6',
  darkText: '#143C2F',
} as const;

/** Unknown / incomplete records — neutral gray */
export const SEMANTIC_UNKNOWN = {
  primary: '#6B7280',
  background: '#F8F9FA',
  soft: '#E7E9EC',
  darkText: '#374151',
} as const;

/** Global neutral text colors */
export const TEXT_COLORS = {
  primary: '#111111',
  secondary: '#5F6368',
  muted: '#7A7A7A',
} as const;

/** Connector and divider colors */
export const CONNECTOR_COLORS = {
  line: '#262626',
  subtleDivider: 'rgba(0, 0, 0, 0.12)',
  strongDivider: 'rgba(0, 0, 0, 0.22)',
  overlay: 'rgba(0, 0, 0, 0.30)',
} as const;

/**
 * Semantic node category type.
 * Determines which color palette to apply to a node.
 */
export type SemanticCategory = 'root' | 'family' | 'spouse' | 'unknown';

/**
 * Resolves the semantic color palette for a given category.
 */
export function getSemanticPalette(category: SemanticCategory) {
  switch (category) {
    case 'root': return SEMANTIC_ROOT;
    case 'family': return SEMANTIC_FAMILY;
    case 'spouse': return SEMANTIC_SPOUSE;
    case 'unknown': return SEMANTIC_UNKNOWN;
  }
}

// === Spacing ===
export const SPACING = {
  /** Gap between sibling UI elements (px) */
  siblingGap: 16,
  /** Padding within container elements (px) */
  containerPadding: 12,
  /** Horizontal spacing between sibling nodes in ELK layout (px) */
  elkHorizontalSpacing: 30,
  /** Vertical spacing between layers in ELK layout (px) */
  elkVerticalSpacing: 50,
  /** Additional horizontal spacing between spouse groups */
  elkSpouseGroupGap: 40,
} as const;

// === Animation Timing (ms) ===
export const TIMING = {
  /** Node enter/appear animation duration */
  nodeEnter: 320,
  /** Node exit/disappear animation duration */
  nodeExit: 250,
  /** Stagger delay between sequential node animations */
  staggerDelay: 50,
  /** Maximum total stagger duration cap */
  maxStaggerTotal: 500,
  /** Edge fade-in duration */
  edgeAppear: 400,
  /** Edge fade-out duration */
  edgeDisappear: 220,
  /** Press scale animation duration */
  pressScale: 150,
  /** Orientation change reflow duration */
  orientationReflow: 300,
  /** Spring-based layout animation settle time */
  springSettle: 500,
} as const;

// === Easing ===
export const EASING = {
  /** Standard cubic-bezier values for non-spring animations */
  standard: [0.22, 0.61, 0.36, 1] as readonly [number, number, number, number],
} as const;

// === Spring Configuration ===
export const SPRING = {
  /** Spring config for layout position transitions (settles within 500ms) */
  layout: { type: 'spring' as const, stiffness: 200, damping: 25, mass: 1 },
} as const;

// === Node Dimensions (px) ===
export const NODE_DIMENSIONS = {
  personNode: {
    desktop: { width: 140, height: 72 },
    mobile: { width: 120, height: 72 },
  },
  spouseNode: {
    desktop: { width: 130, height: 56 },
    mobile: { width: 110, height: 56 },
  },
  unionNode: {
    desktop: { width: 2, height: 2 },
    mobile: { width: 2, height: 2 },
  },
} as const;

// === Borders (px) ===
export const BORDERS = {
  /** Default border width for cards/panels */
  defaultWidth: 2,
  /** Border width for expanded/highlighted nodes */
  expandedWidth: 3,
  /** Border radius for cards and panels */
  cardRadius: 14,
  /** Border radius for pill-shaped elements (avatars, circular buttons) */
  pillRadius: 999,
  /** Focus outline width */
  focusOutlineWidth: 2,
  /** Focus outline offset from card edge */
  focusOutlineOffset: 3,
} as const;

// === Zoom Range ===
export const ZOOM = {
  /** Minimum zoom level */
  min: 0.3,
  /** Maximum zoom level */
  max: 3,
} as const;

// === Typography (px) ===
export const TYPOGRAPHY = {
  /** Minimum body text size */
  minBodySize: 12,
  /** Minimum heading text size */
  minHeadingSize: 18,
} as const;

// === Touch Targets (px) ===
export const TOUCH = {
  /** Minimum touch target size for interactive elements */
  minTarget: 44,
} as const;

// === Breakpoints (px) ===
export const BREAKPOINTS = {
  /** Mobile breakpoint threshold */
  mobile: 768,
} as const;
