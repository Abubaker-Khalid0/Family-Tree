/**
 * arabic-normalize.ts
 * ------------------------------------------------------------------
 * Arabic text normalization utilities for the family tree search.
 * Handles hamza variants, ta marbuta, alef maksura, diacritics,
 * spacing inconsistencies, and compound name variations.
 * ------------------------------------------------------------------
 */

/**
 * Normalizes an Arabic string for search matching.
 *
 * Transformations applied (in order):
 * 1. Remove diacritics (tashkeel) and tatweel
 * 2. Normalize hamza variants: أ إ آ ٱ → ا
 * 3. Normalize ta marbuta: ة → ه
 * 4. Normalize alef maksura: ى → ي
 * 5. Normalize waw hamza: ؤ → و
 * 6. Normalize ya hamza: ئ → ي
 * 7. Collapse multiple spaces → single space
 * 8. Trim leading/trailing whitespace
 *
 * @param text - The original Arabic string
 * @returns Normalized string suitable for comparison
 */
export function normalizeArabic(text: string): string {
  return text
    // Remove Arabic diacritics (fathah, dammah, kasrah, shadda, sukun, etc.)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Remove tatweel (kashida)
    .replace(/\u0640/g, '')
    // Normalize hamza-carrying alef variants → bare alef
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize ta marbuta → ha
    .replace(/ة/g, 'ه')
    // Normalize alef maksura → ya
    .replace(/ى/g, 'ي')
    // Normalize waw hamza → waw
    .replace(/ؤ/g, 'و')
    // Normalize ya hamza → ya
    .replace(/ئ/g, 'ي')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Creates a "collapsed" version of a name with all spaces removed.
 * This handles cases like "أبو بكر" vs "ابوبكر" and "سيد أحمد" vs "سيداحمد".
 *
 * @param text - The normalized Arabic string
 * @returns String with all spaces removed
 */
export function collapseSpaces(text: string): string {
  return text.replace(/\s/g, '');
}

/**
 * Splits a name into individual tokens for token-based matching.
 *
 * @param text - The normalized Arabic string
 * @returns Array of tokens (words)
 */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
