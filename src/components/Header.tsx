import { BORDERS, TEXT_COLORS, CONNECTOR_COLORS } from '../utils/constants';

/**
 * Sticky header component displaying the app title and subtitle instruction.
 * On viewports < 768px, the subtitle is hidden and only the title is shown.
 */
export function Header() {
  return (
    <header
      className="sticky top-0 z-50 bg-white px-4 py-3 md:py-4"
      style={{
        borderBottom: `${BORDERS.defaultWidth}px solid ${CONNECTOR_COLORS.strongDivider}`,
      }}
    >
      <div className="flex flex-col items-center md:flex-row md:justify-center md:gap-3">
        <h1
          className="font-bold leading-tight"
          style={{ fontSize: '18px', color: TEXT_COLORS.primary }}
        >
          شجرة العائلة
        </h1>
        <p
          className="hidden md:block"
          style={{ fontSize: '12px', color: TEXT_COLORS.muted }}
        >
          اضغط على أي شخص لعرض فرعه
        </p>
      </div>
    </header>
  );
}
