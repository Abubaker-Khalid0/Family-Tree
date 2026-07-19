/**
 * SearchDialog.tsx
 * ------------------------------------------------------------------
 * "ابحث عن اسمي" — Arabic name search dialog for the family tree.
 * Allows users to type a name, view matching people with contextual
 * disambiguation, and navigate to the selected person in the tree.
 * ------------------------------------------------------------------
 */

import { AnimatePresence, motion } from 'motion/react';
import { Search, X, User, ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FAMILY_DATA } from '@/data/family-data';
import { dataAccess } from '@/data';
import {
  SEMANTIC_ROOT,
  SEMANTIC_FAMILY,
  TEXT_COLORS,
  CONNECTOR_COLORS,
} from '@/utils/constants';
import {
  buildSearchIndex,
  searchPeople,
  type SearchEntry,
  type SearchResult,
} from '@/utils/search-index';

// === Pre-built search index (computed once) ===
const SEARCH_INDEX = buildSearchIndex(dataAccess, FAMILY_DATA.people);

// === Component Props ===

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectPerson: (personId: string, pathToRoot: string[]) => void;
}

// === Main Component ===

export default function SearchDialog({
  open,
  onClose,
  onSelectPerson,
}: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('');
      // Delay focus to after animation
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  // Search results
  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchPeople(query, SEARCH_INDEX, 50);
  }, [query]);

  const handleSelect = useCallback(
    (entry: SearchEntry) => {
      onSelectPerson(entry.personId, entry.pathToRoot);
      onClose();
    },
    [onSelectPerson, onClose],
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(2px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            className="fixed inset-x-0 z-50 mx-auto flex flex-col bg-white rounded-2xl
                        top-3 bottom-auto max-h-[70vh] max-w-[calc(100%-24px)]
                        sm:top-[10vh] sm:max-h-[80vh] sm:max-w-[520px]"
            style={{
              boxShadow: '0 24px 80px -12px rgba(0,0,0,0.28)',
              border: `1.5px solid ${CONNECTOR_COLORS.strongDivider}`,
            }}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {/* Search Input Header */}
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: `1.5px solid ${CONNECTOR_COLORS.subtleDivider}` }}
            >
              <Search
                className="h-5 w-5 shrink-0"
                strokeWidth={1.75}
                style={{ color: TEXT_COLORS.muted }}
              />
              <input
                ref={inputRef}
                type="text"
                dir="rtl"
                placeholder="ابحث عن اسمي في الشجرة..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-[13px]"
                style={{ color: TEXT_COLORS.primary }}
                aria-label="ابحث عن اسم في شجرة العائلة"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors hover:bg-neutral-100"
                  aria-label="مسح البحث"
                  style={{ color: TEXT_COLORS.muted }}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-neutral-100 sm:hidden"
                aria-label="إغلاق"
                style={{ color: TEXT_COLORS.primary }}
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            {/* Results Area */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain px-2 py-2"
              role="listbox"
              aria-label="نتائج البحث"
            >
              {query.trim() === '' ? (
                <EmptyState />
              ) : results.length === 0 ? (
                <NoResults query={query} />
              ) : (
                <ResultsList results={results} onSelect={handleSelect} />
              )}
            </div>

            {/* Footer hint */}
            <div
              className="hidden items-center justify-between px-4 py-2 text-[11px] sm:flex"
              style={{
                borderTop: `1px solid ${CONNECTOR_COLORS.subtleDivider}`,
                color: TEXT_COLORS.muted,
              }}
            >
              <span>{results.length > 0 ? `${results.length} نتيجة` : ''}</span>
              <span>Esc للإغلاق</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// === Sub-components ===

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className="mb-3 grid h-12 w-12 place-items-center rounded-full"
        style={{
          border: `1.5px solid ${CONNECTOR_COLORS.strongDivider}`,
          backgroundColor: SEMANTIC_FAMILY.background,
        }}
      >
        <Search className="h-5 w-5" style={{ color: SEMANTIC_FAMILY.primary }} />
      </div>
      <p className="text-[12px] leading-relaxed" style={{ color: TEXT_COLORS.muted }}>
        اكتب اسمك أو اسم أحد أفراد العائلة
        <br />
        للعثور عليه في الشجرة والتنقل إليه مباشرةً
      </p>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className="mb-3 grid h-12 w-12 place-items-center rounded-full"
        style={{
          border: `1.5px solid ${CONNECTOR_COLORS.strongDivider}`,
          backgroundColor: '#FFF5F5',
        }}
      >
        <User className="h-5 w-5" style={{ color: '#B91C1C' }} />
      </div>
      <p className="text-[14px] font-semibold" style={{ color: TEXT_COLORS.primary }}>
        لا توجد نتائج
      </p>
      <p className="mt-1 text-[12px]" style={{ color: TEXT_COLORS.muted }}>
        لم يتم العثور على "{query}" في شجرة العائلة
      </p>
    </div>
  );
}

function ResultsList({
  results,
  onSelect,
}: {
  results: SearchResult[];
  onSelect: (entry: SearchEntry) => void;
}) {
  return (
    <ul className="space-y-1">
      {results.map((result, index) => (
        <ResultCard
          key={result.entry.personId}
          result={result}
          index={index}
          onSelect={() => onSelect(result.entry)}
        />
      ))}
    </ul>
  );
}

function ResultCard({
  result,
  index,
  onSelect,
}: {
  result: SearchResult;
  index: number;
  onSelect: () => void;
}) {
  const { entry, matchTier } = result;
  const isRoot = entry.personId === dataAccess.getRoot()?.id;
  const palette = isRoot ? SEMANTIC_ROOT : SEMANTIC_FAMILY;
  const initial = entry.displayName.charAt(0) || '؟';

  // Spouse context
  const spouseLine = entry.spouseName
    ? `${entry.gender === 'male' ? 'تزوج' : 'تزوجت'} ${entry.spouseName}`
    : null;

  // Mother context
  const motherLine = entry.motherDisplayName
    ? `الأم: ${entry.motherDisplayName}`
    : null;

  // Match badge
  const isExactTier = matchTier === 'paternal_exact' || matchTier === 'paternal_compact'
    || matchTier === 'name_exact' || matchTier === 'name_compact';
  const isPrefixTier = matchTier === 'paternal_prefix' || matchTier === 'name_prefix';
  const badgeLabel = isExactTier ? null : isPrefixTier ? 'بادئة' : 'جزئي';

  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.15) }}
      role="option"
    >
      <button
        type="button"
        onClick={onSelect}
        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors
                   hover:bg-neutral-50 active:bg-neutral-100
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ '--tw-ring-color': palette.primary } as React.CSSProperties}
      >
        {/* Avatar circle */}
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{
            border: `1.5px solid ${palette.primary}`,
            backgroundColor: palette.background,
          }}
        >
          <span
            className="text-[12px] font-bold leading-none"
            style={{ color: palette.primary }}
          >
            {initial}
          </span>
        </div>

        {/* Text content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Triple name row with match badge */}
          <div className="flex items-center gap-2">
            <span
              className="truncate text-[14px] font-bold leading-tight"
              style={{ color: TEXT_COLORS.primary }}
            >
              {entry.tripleName}
            </span>
            {badgeLabel && (
              <span
                className="shrink-0 rounded-full px-1.5 py-px text-[9px]"
                style={{
                  backgroundColor: palette.soft,
                  color: palette.darkText,
                }}
              >
                {badgeLabel}
              </span>
            )}
          </div>

          {/* Spouse + Mother line */}
          {(spouseLine || motherLine) && (
            <span
              className="mt-0.5 truncate text-[11px] leading-tight"
              style={{ color: TEXT_COLORS.muted }}
            >
              {[spouseLine, motherLine].filter(Boolean).join(' • ')}
            </span>
          )}

          {/* Ancestry path */}
          {entry.pathToRoot.length > 2 && (
            <span
              className="mt-0.5 truncate text-[10px] leading-tight"
              style={{ color: TEXT_COLORS.muted }}
            >
              {entry.ancestryText}
            </span>
          )}
        </div>

        {/* Navigate arrow */}
        <ChevronLeft
          className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={1.75}
          style={{ color: TEXT_COLORS.muted }}
        />
      </button>
    </motion.li>
  );
}
