import { useEffect, useState } from 'react';
import {
  Home,
  FoldVertical,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BREAKPOINTS, TOUCH } from '@/utils/constants';

export interface ToolbarProps {
  onReturnToRoot: () => void;
  onCollapseAll: () => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

interface ToolbarAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export function Toolbar({
  onReturnToRoot,
  onCollapseAll,
  onFitView,
  onZoomIn,
  onZoomOut,
  onResetView,
}: ToolbarProps) {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < BREAKPOINTS.mobile
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS.mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const actions: ToolbarAction[] = [
    { label: 'العودة للجذر', icon: <Home className="size-4" />, onClick: onReturnToRoot },
    { label: 'طي الكل', icon: <FoldVertical className="size-4" />, onClick: onCollapseAll },
    { label: 'ملاءمة العرض', icon: <Maximize2 className="size-4" />, onClick: onFitView },
    { label: 'تكبير', icon: <ZoomIn className="size-4" />, onClick: onZoomIn },
    { label: 'تصغير', icon: <ZoomOut className="size-4" />, onClick: onZoomOut },
    { label: 'إعادة تعيين', icon: <RotateCcw className="size-4" />, onClick: onResetView },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 p-2 border-b-2 border-black bg-white">
        {actions.map((action) => (
          <Tooltip key={action.label}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={isMobile ? 'icon' : 'default'}
                onClick={action.onClick}
                aria-label={action.label}
                className="border-black"
                style={{ minWidth: TOUCH.minTarget, minHeight: TOUCH.minTarget }}
              >
                {action.icon}
                {!isMobile && <span>{action.label}</span>}
              </Button>
            </TooltipTrigger>
            {isMobile && (
              <TooltipContent>
                <p>{action.label}</p>
              </TooltipContent>
            )}
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
