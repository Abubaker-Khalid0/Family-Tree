/**
 * Linked spouse resolution and canonical ownership utilities.
 *
 * Solves the linked spouse problem (two people in the tree married to each other):
 * 1. Canonical ownership: First parent in top-down traversal from root owns shared children.
 * 2. Display resolution: Linked spouse nodes display the referenced person's name from lookup.
 * 3. Visual indicator: Linked spouse nodes are flagged for a link icon badge.
 * 4. No duplication: Children appear only under the canonical parent's spouse entry.
 */

import type { Person, Spouse } from '@/types';

/** Fallback display name when a linked spouse's personId doesn't exist in the lookup */
const FALLBACK_NAME = 'غير معروف/ة';

/**
 * Resolves the display name for a linked spouse.
 *
 * For "linked" type with a valid personId found in the lookup, returns the
 * referenced person's name. If personId is missing or doesn't exist in
 * the lookup index, returns a fallback name ("غير معروف/ة").
 * For "external" type, returns the spouse's own name field.
 *
 * @param spouse - The spouse entry to resolve
 * @param lookupIndex - Map of person IDs to Person objects
 * @returns The resolved display name string
 *
 * Validates: Requirements 6.1, 6.6
 */
export function resolveLinkedSpouseDisplayName(
  spouse: Spouse,
  lookupIndex: Map<string, Person>
): string {
  if (spouse.type === 'linked') {
    if (spouse.personId) {
      const referencedPerson = lookupIndex.get(spouse.personId);
      if (referencedPerson) {
        return referencedPerson.name;
      }
    }
    return FALLBACK_NAME;
  }

  // External spouse — return its own name field
  return spouse.name;
}

/**
 * Strips patronymic markers ("بنت" / "ابن") from Arabic names.
 * E.g. "أم الحسين بنت عبدالماجد" → "أم الحسين عبدالماجد"
 *      "نعيم ابن بابكر" → "نعيم بابكر"
 *
 * The word is removed only when it appears as a standalone word
 * (surrounded by spaces), not as part of a compound name.
 */
export function stripPatronymic(name: string): string {
  return name
    .replace(/ بنت /g, ' ')
    .replace(/ ابن /g, ' ')
    .trim();
}

/**
 * Determines if a person is the canonical owner of a shared child.
 *
 * During top-down traversal from root, the first parent encountered "owns"
 * shared children. This function checks whether the given person should
 * expand children by verifying the child hasn't been claimed by another
 * parent already (i.e., the child's ID is not yet in the visited set).
 *
 * @param personId - The person attempting to claim ownership of the child
 * @param childId - The child ID being claimed
 * @param visitedPersons - Set of person IDs already visited in top-down traversal
 * @returns true if this person is the canonical owner (child not yet visited)
 *
 * Validates: Requirements 6.2, 6.5
 */
export function isCanonicalOwner(
  _personId: string,
  childId: string,
  visitedPersons: Set<string>
): boolean {
  // The canonical owner is the first parent to encounter the child during
  // top-down traversal. If the child has already been visited, another
  // parent higher in the tree already owns it.
  return !visitedPersons.has(childId);
}

/**
 * Returns whether a spouse entry is of type "linked", indicating
 * the person exists elsewhere in the tree and should display a visual
 * indicator (link icon badge).
 *
 * @param spouse - The spouse entry to check
 * @returns true if the spouse is of type "linked"
 *
 * Validates: Requirements 6.4
 */
export function getLinkedSpouseIndicator(spouse: Spouse): boolean {
  return spouse.type === 'linked';
}

/**
 * Resolves children for a spouse entry, returning Person objects only if
 * the parent is the canonical owner of each child.
 *
 * Skips children whose IDs don't exist in the lookup index (broken references).
 * Skips children already visited (owned by another parent higher in the tree).
 *
 * @param spouse - The spouse entry whose children to resolve
 * @param lookupIndex - Map of person IDs to Person objects
 * @param visitedPersons - Set of person IDs already visited in top-down traversal
 * @returns Array of Person objects for canonically-owned, valid children
 *
 * Validates: Requirements 6.2, 6.5
 */
export function resolveSpouseChildren(
  spouse: Spouse,
  lookupIndex: Map<string, Person>,
  visitedPersons: Set<string>
): Person[] {
  const children: Person[] = [];

  for (const childId of spouse.childrenIds) {
    // Skip broken references — child ID doesn't exist in lookup
    const child = lookupIndex.get(childId);
    if (!child) {
      continue;
    }

    // Skip children already owned by a parent higher in the traversal
    if (!isCanonicalOwner(spouse.id, childId, visitedPersons)) {
      continue;
    }

    children.push(child);
  }

  return children;
}
