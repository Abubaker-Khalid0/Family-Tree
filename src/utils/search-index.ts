/**
 * search-index.ts
 * ------------------------------------------------------------------
 * Search index and matching engine for the family tree.
 * Builds a pre-computed index of all searchable people with
 * normalized names, paternal search keys, and contextual metadata.
 *
 * Paternal search: every person is indexed by their own name AND
 * by "[person name] [father name]" so that queries like
 * "سيد أحمد محمد" match a person named "سيد أحمد" whose father
 * is "محمد".
 *
 * The father is resolved exclusively via person.fatherId →
 * dataAccess.getPerson(fatherId). Mother names are never used
 * in the search key.
 * ------------------------------------------------------------------
 */

import type { DataAccess, Person } from '@/types';
import { normalizeArabic, collapseSpaces } from './arabic-normalize';

// === Types ===

/**
 * A single entry in the search index.
 */
export interface SearchEntry {
  /** Person's unique ID */
  personId: string;

  /** Original display name (unchanged) */
  displayName: string;

  /** Full triple name: اسم + أب + جد */
  tripleName: string;

  /** Normalized triple name for search matching */
  normalizedTripleName: string;

  /** Compact triple name (no spaces) for search matching */
  compactTripleName: string;

  /** Normalized person name */
  normalizedName: string;

  /** Compact person name (normalized, all spaces removed) */
  compactName: string;

  /** Gender for contextual display */
  gender: 'male' | 'female';

  // --- Father info (resolved via fatherId only) ---

  /** Father's original display name, or '' if no father */
  fatherDisplayName: string;

  /** Father's normalized name, or '' if no father */
  normalizedFatherName: string;

  /** Grandfather's original display name, or '' if no grandfather */
  grandfatherDisplayName: string;

  /**
   * Combined paternal display name: "[person name] [father name]"
   * Empty string if no father.
   * Used only for search — never replaces the person's display name.
   */
  paternalDisplayName: string;

  /** Normalized version of the combined paternal name, or '' */
  normalizedPaternalName: string;

  /** Compact version of the normalized paternal name (all spaces removed), or '' */
  compactPaternalName: string;

  // --- Mother info ---

  /** Mother's original display name, or '' if no mother */
  motherDisplayName: string;

  // --- Display context (not used for matching) ---

  /** Father label for display: "ابن" or "ابنة", or null if no father */
  fatherLabel: string | null;

  /** First known spouse display name, or null */
  spouseName: string | null;

  /** The ancestry path from root → person (array of person IDs) */
  pathToRoot: string[];

  /** Brief ancestry path as display text: "مضوي ← حاج أحمد ← ..." */
  ancestryText: string;
}

/**
 * Match quality tiers, ordered from best to worst.
 * Lower numeric value = better rank.
 */
export type MatchTier =
  | 'paternal_exact'
  | 'paternal_compact'
  | 'paternal_prefix'
  | 'name_exact'
  | 'name_compact'
  | 'name_prefix'
  | 'name_substring'
  | 'paternal_substring';

/**
 * A search result with match metadata.
 */
export interface SearchResult {
  entry: SearchEntry;
  matchTier: MatchTier;
}

// === Path Finding ===

/**
 * Computes the path from a person up to the root, following
 * fatherId or motherId references (blood relationships).
 *
 * @returns Array of person IDs from root (first) to person (last)
 */
export function getPathToRoot(personId: string, dataAccess: DataAccess): string[] {
  const path: string[] = [personId];
  const visited = new Set<string>([personId]);

  let current = dataAccess.getPerson(personId);
  while (current) {
    const parentId = current.fatherId ?? current.motherId;
    if (!parentId || visited.has(parentId)) break;
    visited.add(parentId);
    path.unshift(parentId);
    current = dataAccess.getPerson(parentId);
  }

  return path;
}

/**
 * Resolves the father's name exclusively through person.fatherId.
 * Returns empty string if fatherId is null or invalid.
 * Never falls back to mother.
 */
function resolveFatherName(person: Person, dataAccess: DataAccess): string {
  if (!person.fatherId) return '';
  const father = dataAccess.getPerson(person.fatherId);
  return father ? father.name.trim() : '';
}

/**
 * Resolves the grandfather's name (father of father).
 * Returns empty string if not available.
 */
function resolveGrandfatherName(person: Person, dataAccess: DataAccess): string {
  if (!person.fatherId) return '';
  const father = dataAccess.getPerson(person.fatherId);
  if (!father || !father.fatherId) return '';
  const grandfather = dataAccess.getPerson(father.fatherId);
  return grandfather ? grandfather.name.trim() : '';
}

/**
 * Resolves the mother's name through person.motherId.
 * Returns empty string if motherId is null or invalid.
 */
function resolveMotherName(person: Person, dataAccess: DataAccess): string {
  if (!person.motherId) return '';
  const mother = dataAccess.getPerson(person.motherId);
  return mother ? mother.name.trim() : '';
}

/**
 * Gets the first known spouse display name, or null.
 */
function resolveFirstSpouseName(
  person: Person,
  dataAccess: DataAccess,
): string | null {
  for (const spouse of person.spouses) {
    if (!dataAccess.isSpouseNameUnknown(spouse)) {
      return dataAccess.getSpouseDisplayName(spouse);
    }
  }
  return null;
}

/**
 * Builds ancestry display text from a path of person IDs.
 * Example: "مضوي ← حاج أحمد ← عبدالماجد"
 */
function buildAncestryText(path: string[], dataAccess: DataAccess): string {
  return path
    .map(id => dataAccess.getPerson(id)?.name ?? '؟')
    .join(' ← ');
}

// === Index Builder ===

/**
 * Builds the complete search index from all people in the data.
 * Should be called once at app initialization.
 *
 * For each person, creates:
 * - normalizedName / compactName (person name only)
 * - normalizedPaternalName / compactPaternalName ("[name] [fatherName]")
 * - Father resolved ONLY via fatherId — never from mother
 */
export function buildSearchIndex(dataAccess: DataAccess, people: Person[]): SearchEntry[] {
  const entries: SearchEntry[] = [];

  for (const person of people) {
    // Skip unknown persons
    const name = person.name?.trim();
    if (!name || name === '؟') continue;

    const normalizedName = normalizeArabic(name);
    const compactName = collapseSpaces(normalizedName);

    // Father — resolved exclusively via fatherId
    const fatherDisplayName = resolveFatherName(person, dataAccess);
    const normalizedFatherName = fatherDisplayName ? normalizeArabic(fatherDisplayName) : '';

    // Grandfather — father of father
    const grandfatherDisplayName = resolveGrandfatherName(person, dataAccess);

    // Mother — resolved via motherId
    const motherDisplayName = resolveMotherName(person, dataAccess);

    // Triple name: اسم + أب + جد
    let tripleName = name;
    if (fatherDisplayName) {
      tripleName += ` ${fatherDisplayName}`;
      if (grandfatherDisplayName) {
        tripleName += ` ${grandfatherDisplayName}`;
      }
    }
    const normalizedTripleName = normalizeArabic(tripleName);
    const compactTripleName = collapseSpaces(normalizedTripleName);

    // Paternal combined key: "[person name] [father name]"
    const hasFather = fatherDisplayName.length > 0;
    const paternalDisplayName = hasFather ? `${name} ${fatherDisplayName}` : '';
    const normalizedPaternalName = hasFather
      ? `${normalizedName} ${normalizedFatherName}`
      : '';
    const compactPaternalName = hasFather
      ? collapseSpaces(normalizedPaternalName)
      : '';

    // Father label for display
    const fatherLabel = hasFather
      ? (person.gender === 'male' ? 'ابن' : 'ابنة')
      : null;

    // Additional context (not used for matching)
    const spouseName = resolveFirstSpouseName(person, dataAccess);
    const pathToRoot = getPathToRoot(person.id, dataAccess);
    const ancestryText = buildAncestryText(pathToRoot, dataAccess);

    entries.push({
      personId: person.id,
      displayName: name,
      tripleName,
      normalizedTripleName,
      compactTripleName,
      normalizedName,
      compactName,
      gender: person.gender,
      fatherDisplayName,
      normalizedFatherName,
      grandfatherDisplayName,
      paternalDisplayName,
      normalizedPaternalName,
      compactPaternalName,
      motherDisplayName,
      fatherLabel,
      spouseName,
      pathToRoot,
      ancestryText,
    });
  }

  return entries;
}

// === Search Engine ===

/**
 * Searches the index for people matching the given query.
 *
 * Matching strategy (in priority order):
 *
 * 1. Exact match on normalizedPaternalName
 * 2. Exact match on compactPaternalName
 * 3. Prefix match on normalizedPaternalName or compactPaternalName
 * 4. Exact match on normalizedName
 * 5. Exact match on compactName
 * 6. Prefix match on normalizedName or compactName
 * 7. Substring match on normalizedName or compactName
 * 8. Substring match on normalizedPaternalName or compactPaternalName
 *
 * This ensures that a query like "سيد أحمد محمد" ranks a person
 * named "سيد أحمد" with father "محمد" above a person named "محمد"
 * or someone with a different father.
 *
 * @param query - The user's search input
 * @param index - The pre-built search index
 * @param maxResults - Maximum number of results to return (default: 50)
 * @returns Sorted array of search results
 */
export function searchPeople(
  query: string,
  index: SearchEntry[],
  maxResults = 50,
): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const nq = normalizeArabic(trimmed);
  const cq = collapseSpaces(nq);

  if (!nq) return [];

  // 8 priority buckets
  const t1: SearchResult[] = []; // triple exact
  const t2: SearchResult[] = []; // triple compact exact
  const t3: SearchResult[] = []; // triple/paternal prefix
  const t4: SearchResult[] = []; // name exact
  const t5: SearchResult[] = []; // name compact exact
  const t6: SearchResult[] = []; // name prefix
  const t7: SearchResult[] = []; // name substring
  const t8: SearchResult[] = []; // triple/paternal substring

  for (const entry of index) {
    // --- Tier 1: Exact triple name (normalized) ---
    if (entry.normalizedTripleName && entry.normalizedTripleName === nq) {
      t1.push({ entry, matchTier: 'paternal_exact' });
      continue;
    }

    // --- Tier 2: Exact triple name (compact) ---
    if (entry.compactTripleName && entry.compactTripleName === cq) {
      t2.push({ entry, matchTier: 'paternal_compact' });
      continue;
    }

    // --- Tier 3: Prefix triple/paternal ---
    if (
      (entry.normalizedTripleName && entry.normalizedTripleName.startsWith(nq)) ||
      (entry.compactTripleName && entry.compactTripleName.startsWith(cq)) ||
      (entry.normalizedPaternalName && entry.normalizedPaternalName.startsWith(nq)) ||
      (entry.compactPaternalName && entry.compactPaternalName.startsWith(cq))
    ) {
      t3.push({ entry, matchTier: 'paternal_prefix' });
      continue;
    }

    // --- Tier 4: Exact name (normalized) ---
    if (entry.normalizedName === nq) {
      t4.push({ entry, matchTier: 'name_exact' });
      continue;
    }

    // --- Tier 5: Exact name (compact) ---
    if (entry.compactName === cq) {
      t5.push({ entry, matchTier: 'name_compact' });
      continue;
    }

    // --- Tier 6: Prefix name ---
    if (
      entry.normalizedName.startsWith(nq) ||
      entry.compactName.startsWith(cq)
    ) {
      t6.push({ entry, matchTier: 'name_prefix' });
      continue;
    }

    // --- Tier 7: Substring name ---
    if (
      entry.normalizedName.includes(nq) ||
      entry.compactName.includes(cq)
    ) {
      t7.push({ entry, matchTier: 'name_substring' });
      continue;
    }

    // --- Tier 8: Substring triple/paternal ---
    if (
      (entry.normalizedTripleName && entry.normalizedTripleName.includes(nq)) ||
      (entry.compactTripleName && entry.compactTripleName.includes(cq)) ||
      (entry.normalizedPaternalName && entry.normalizedPaternalName.includes(nq)) ||
      (entry.compactPaternalName && entry.compactPaternalName.includes(cq))
    ) {
      t8.push({ entry, matchTier: 'paternal_substring' });
    }
  }

  return [...t1, ...t2, ...t3, ...t4, ...t5, ...t6, ...t7, ...t8].slice(0, maxResults);
}
