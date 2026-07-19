/**
 * Core family data type definitions.
 * These interfaces define the structure of the family tree data model,
 * data access layer, and validation system.
 */

// === Core Family Data Types ===

/**
 * Represents a spouse entry attached to a Person.
 * A spouse can be "external" (not independently in the tree) or "linked"
 * (references another Person already in the tree via personId).
 */
export interface Spouse {
  /** Unique identifier for this spouse entry */
  id: string;

  /** Whether this spouse is external (standalone) or linked (references another Person) */
  type: 'external' | 'linked';

  /**
   * Display name for the spouse.
   * For "external" type: the spouse's actual display name.
   * For "linked" type: may be empty since the name is resolved from personId.
   */
  name: string;

  /** Descriptive label, e.g., "الزوجة الأولى" (First Wife) */
  label: string;

  /** IDs of children belonging to this spouse pairing */
  childrenIds: string[];

  /**
   * Reference to an existing Person.id in the tree.
   * Only present for type "linked" — used to resolve display name and
   * indicate this spouse exists elsewhere in the tree.
   */
  personId?: string;
}

/**
 * Represents a person (family member) in the family tree.
 */
export interface Person {
  /** Unique identifier for this person (e.g., "p001") */
  id: string;

  /** Full Arabic name of the person */
  name: string;

  /** Gender of the person */
  gender: 'male' | 'female';

  /** Relationship description (e.g., "الجد الأكبر") */
  relation: string;

  /** ID of the person's father, or null if unknown/not in tree */
  fatherId: string | null;

  /** ID of the person's mother, or null if unknown/not in tree */
  motherId: string | null;

  /** Array of spouse entries for this person */
  spouses: Spouse[];

  /** Additional notes about the person (displayed as secondary text if non-empty) */
  notes: string;
}

/**
 * Top-level family data structure containing the root person reference
 * and the complete people array.
 */
export interface FamilyData {
  /** ID of the root person from which the tree rendering begins */
  rootPersonId: string;

  /** Complete array of all people in the family tree */
  people: Person[];
}

// === Data Access Layer ===

/**
 * Describes a validation issue found during data integrity checks at startup.
 */
export interface ValidationIssue {
  /** Category of the validation issue */
  type: 'duplicate_id' | 'missing_reference' | 'invalid_root' | 'missing_id';

  /** Human-readable description of the issue */
  message: string;

  /** The person ID where the issue was detected (if applicable) */
  personId?: string;

  /** The referenced ID that could not be resolved (if applicable) */
  referencedId?: string;
}

/**
 * Public interface for the data access layer.
 * Provides indexed lookup, name resolution, and validation for family data.
 * Designed so that replacing the static data source with an API requires
 * changes only within the data-access module implementation.
 */
export interface DataAccess {
  /**
   * Retrieve a person by their unique ID.
   * @param id - The person's unique identifier
   * @returns The Person object, or null if not found
   */
  getPerson(id: string): Person | null;

  /**
   * Retrieve the root person of the family tree.
   * @returns The root Person object, or null if the root ID is invalid
   */
  getRoot(): Person | null;

  /**
   * Resolve the display name for a spouse entry.
   * For "external" spouses, returns the spouse's name field.
   * For "linked" spouses with a valid personId, returns the referenced person's name.
   * @param spouse - The spouse entry to resolve
   * @returns The resolved display name string
   */
  getSpouseDisplayName(spouse: Spouse): string;

  /**
   * Check if a spouse's resolved display name matches unknown patterns
   * ("غير معروفة", "غير معروف", "غير معروف/ة").
   * @param spouse - The spouse entry to check
   * @returns true if the spouse name is considered unknown
   */
  isSpouseNameUnknown(spouse: Spouse): boolean;

  /**
   * Get the resolved children Person objects for a given spouse entry.
   * @param spouse - The spouse entry whose children to resolve
   * @returns Array of Person objects for valid childrenIds
   */
  getSpouseChildren(spouse: Spouse): Person[];

  /**
   * Determine if a person has at least one spouse with non-empty childrenIds,
   * indicating the node can be expanded.
   * @param person - The person to check
   * @returns true if the person has expandable branches
   */
  personHasExpandableBranch(person: Person): boolean;

  /**
   * Get the first character (initial) of a name for avatar display.
   * Returns "؟" for empty, null, undefined, or whitespace-only strings.
   * @param name - The name string to extract the initial from
   * @returns A single character initial
   */
  getInitial(name: string): string;

  /** Array of validation issues detected during data initialization */
  readonly validationIssues: ValidationIssue[];

  /** Whether the root person ID references a valid person in the data */
  readonly isRootValid: boolean;
}
