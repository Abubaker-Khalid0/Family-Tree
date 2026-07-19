import { motion } from 'motion/react';

/**
 * Centered Arabic loading indicator displayed while layout is computing.
 * Renders "جاري التحميل..." with a subtle pulse animation.
 */
export function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <motion.p
        className="text-lg font-medium text-[#6b6b6b]"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        جاري التحميل...
      </motion.p>
    </div>
  );
}
