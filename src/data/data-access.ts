/**
 * data-access.ts
 * ------------------------------------------------------------------
 * Data access layer: builds a lookup index from the people array,
 * validates all references at startup, and exposes a typed public API
 * consumed by layout and rendering layers.
 * ------------------------------------------------------------------
 *
 * Validates: Requirements 3.1, 3.2, 3.5, 3.6, 3.7, 5.6, 5.7, 6.1, 6.6, 7.8, 14.1–14.7
 */

import type { DataAccess, FamilyData, Person, Spouse, ValidationIssue } from '@/types';
import { resolveLinkedSpouseDisplayName, stripPatronymic } from '@/utils/linked-spouse';
import { FAMILY_DATA } from './family-data';

/** Patterns that identify an "unknown" spouse name */
const UNKNOWN_NAME_PATTERNS: ReadonlySet<string> = new Set([
  'غير معروفة',
  'غير معروف',
  'غير معروف/ة',
]);

/**
 * Creates a DataAccess instance from the given FamilyData.
 *
 * Builds a lookup Map (last occurrence wins for duplicate IDs),
 * runs the full validation pipeline, logs issues to the console,
 * and returns an object satisfying the DataAccess interface.
 */
export function createDataAccess(familyData: FamilyData): DataAccess {
  const issues: ValidationIssue[] = [];

  // --- Step (a): Check people array exists and is non-empty ---
  if (!familyData.people || familyData.people.length === 0) {
    issues.push({
      type: 'missing_reference',
      message: 'Family data contains no people entries',
    });
  }

  // --- Step (b): Build lookup index, flagging duplicate IDs ---
  const lookupIndex = new Map<string, Person>();
  const seenIds = new Set<string>();

  for (const person of familyData.people) {
    if (seenIds.has(person.id)) {
      issues.push({
        type: 'duplicate_id',
        message: `Duplicate person ID: "${person.id}"`,
        personId: person.id,
      });
    }
    seenIds.add(person.id);
    // Last occurrence wins
    lookupIndex.set(person.id, person);
  }

  // --- Step (c): Validate fatherId references ---
  for (const person of familyData.people) {
    if (person.fatherId !== null && !lookupIndex.has(person.fatherId)) {
      issues.push({
        type: 'missing_reference',
        message: `Person "${person.id}" references non-existent fatherId "${person.fatherId}"`,
        personId: person.id,
        referencedId: person.fatherId,
      });
    }
  }

  // --- Step (d): Validate motherId references ---
  for (const person of familyData.people) {
    if (person.motherId !== null && !lookupIndex.has(person.motherId)) {
      issues.push({
        type: 'missing_reference',
        message: `Person "${person.id}" references non-existent motherId "${person.motherId}"`,
        personId: person.id,
        referencedId: person.motherId,
      });
    }
  }

  // --- Step (e): Validate childrenIds references ---
  for (const person of familyData.people) {
    for (const spouse of person.spouses) {
      for (const childId of spouse.childrenIds) {
        if (!lookupIndex.has(childId)) {
          issues.push({
            type: 'missing_reference',
            message: `Person "${person.id}", spouse "${spouse.id}" references non-existent childId "${childId}"`,
            personId: person.id,
            referencedId: childId,
          });
        }
      }
    }
  }

  // --- Step (f): Validate linked spouse personId references ---
  for (const person of familyData.people) {
    for (const spouse of person.spouses) {
      if (spouse.type === 'linked' && spouse.personId && !lookupIndex.has(spouse.personId)) {
        issues.push({
          type: 'missing_reference',
          message: `Person "${person.id}", spouse "${spouse.id}" references non-existent linked personId "${spouse.personId}"`,
          personId: person.id,
          referencedId: spouse.personId,
        });
      }
    }
  }

  // --- Step (g): Validate rootPersonId ---
  const isRootValid = lookupIndex.has(familyData.rootPersonId);
  if (!isRootValid) {
    issues.push({
      type: 'invalid_root',
      message: `Root person ID "${familyData.rootPersonId}" does not exist in the data`,
      referencedId: familyData.rootPersonId,
    });
  }

  // --- Console logging ---
  if (issues.length > 0) {
    console.group(`⚠️ Family data validation: ${issues.length} issue(s) found`);
    issues.forEach(issue => console.warn(issue.message));
    console.groupEnd();
  }

  // --- DataAccess method implementations ---

  function getPerson(id: string): Person | null {
    return lookupIndex.get(id) ?? null;
  }

  function getRoot(): Person | null {
    return getPerson(familyData.rootPersonId);
  }

  function getSpouseDisplayName(spouse: Spouse): string {
    return stripPatronymic(resolveLinkedSpouseDisplayName(spouse, lookupIndex));
  }

  function isSpouseNameUnknown(spouse: Spouse): boolean {
    const displayName = getSpouseDisplayName(spouse);
    return UNKNOWN_NAME_PATTERNS.has(displayName);
  }

  function getSpouseChildren(spouse: Spouse): Person[] {
    const children: Person[] = [];
    for (const childId of spouse.childrenIds) {
      const child = lookupIndex.get(childId);
      if (child) {
        children.push(child);
      }
    }
    return children;
  }

  function personHasExpandableBranch(person: Person): boolean {
    return person.spouses.some(s => s.childrenIds.length > 0);
  }

  function getInitial(name: string): string {
    if (!name || name.trim().length === 0) {
      return '؟';
    }
    return name.trim().charAt(0);
  }

  return {
    getPerson,
    getRoot,
    getSpouseDisplayName,
    isSpouseNameUnknown,
    getSpouseChildren,
    personHasExpandableBranch,
    getInitial,
    validationIssues: issues,
    isRootValid,
  };
}

/** Pre-built data access instance using the static FAMILY_DATA */
export const dataAccess = createDataAccess(FAMILY_DATA);
