import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export interface ErrorStateProps {
  type: 'data_load_failure' | 'root_not_found' | 'layout_error';
  message?: string;
  onRetry?: () => void;
}

const DEFAULT_MESSAGES: Record<ErrorStateProps['type'], string> = {
  data_load_failure: 'تعذّر تحميل بيانات الشجرة',
  root_not_found: 'لم يتم العثور على الشخص الجذر ضمن البيانات',
  layout_error: 'حدث خطأ أثناء حساب التخطيط',
};

/**
 * Error state component with Arabic messages and optional retry.
 *
 * - data_load_failure: Full-page centered error with retry button.
 * - root_not_found: Full-page centered error, no retry needed.
 * - layout_error: Inline compact format suitable for rendering near affected node.
 */
export function ErrorState({ type, message, onRetry }: ErrorStateProps) {
  const displayMessage = message || DEFAULT_MESSAGES[type];

  // Inline layout error — smaller format for use near affected area
  if (type === 'layout_error') {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-[#d8d8d8] bg-[#f2f2f2] px-3 py-2">
        <span className="text-sm text-[#6b6b6b]">{displayMessage}</span>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="text-xs border-[#6b6b6b] text-[#000000] hover:bg-[#d8d8d8]"
          >
            إعادة المحاولة
          </Button>
        )}
      </div>
    );
  }

  // Full-page centered error for data_load_failure and root_not_found
  return (
    <div className="flex items-center justify-center h-full w-full">
      <Alert
        variant="default"
        className="max-w-md border-[#000000] border-2 bg-[#ffffff]"
      >
        <AlertTitle className="text-lg font-bold text-[#000000]">
          خطأ
        </AlertTitle>
        <AlertDescription className="mt-2 text-sm text-[#6b6b6b]">
          {displayMessage}
        </AlertDescription>
        {type === 'data_load_failure' && onRetry && (
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={onRetry}
              className="border-[#000000] text-[#000000] hover:bg-[#f2f2f2]"
            >
              إعادة المحاولة
            </Button>
          </div>
        )}
      </Alert>
    </div>
  );
}
