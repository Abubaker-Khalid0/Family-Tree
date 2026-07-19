// Barrel file for utils module
export {
  COLORS,
  SPACING,
  TIMING,
  EASING,
  SPRING,
  NODE_DIMENSIONS,
  BORDERS,
  ZOOM,
  TYPOGRAPHY,
  TOUCH,
  BREAKPOINTS,
  SEMANTIC_ROOT,
  SEMANTIC_FAMILY,
  SEMANTIC_SPOUSE,
  SEMANTIC_ACTIVE,
  SEMANTIC_UNKNOWN,
  TEXT_COLORS,
  CONNECTOR_COLORS,
  getSemanticPalette,
} from './constants';

export type { SemanticCategory } from './constants';

export {
  resolveLinkedSpouseDisplayName,
  isCanonicalOwner,
  getLinkedSpouseIndicator,
  resolveSpouseChildren,
  stripPatronymic,
} from './linked-spouse';

export {
  normalizeArabic,
  collapseSpaces,
  tokenize,
} from './arabic-normalize';

export {
  buildSearchIndex,
  searchPeople,
  getPathToRoot,
} from './search-index';

export type {
  SearchEntry,
  SearchResult,
  MatchTier,
} from './search-index';
