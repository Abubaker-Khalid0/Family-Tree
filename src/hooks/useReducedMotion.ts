import { useState, useEffect } from 'react';

/**
 * Media query string for detecting reduced motion preference.
 */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Hook that detects the user's `prefers-reduced-motion` OS/browser setting.
 *
 * When the user has requested reduced motion, all animated transitions
 * should be skipped or limited to ≤1ms duration (Reduced Motion Mode).
 *
 * Handles SSR gracefully by defaulting to `false` when `window` is unavailable.
 *
 * @returns `true` when the system reports `prefers-reduced-motion: reduce`
 *
 * @example
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 * const duration = prefersReducedMotion ? 0 : TIMING.nodeEnter;
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    // SSR guard: default to false if window/matchMedia is unavailable
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

    // Sync state in case it changed between initial render and effect
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
