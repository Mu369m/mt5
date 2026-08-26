/**
 * @file frontend/src/components/ui/tooltip.tsx
 * @description Beginner-friendly interactive tooltip indicator component.
 * Displays brief plain-language tooltips when hovering over settings widgets.
 */

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  content: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div 
      className="relative inline-flex items-center ml-1 cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible(!visible)}
    >
      <HelpCircle className="w-3.5 h-3.5 text-accent-cyan opacity-60 hover:opacity-100 transition-opacity" />
      
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-64 p-3 text-xs leading-relaxed text-slate-200 glass-panel bg-slate-950 rounded-custom -left-32 bottom-6 pointer-events-none"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <div className="absolute left-1/2 bottom-[-5px] -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[rgba(18,23,33,0.9)]"></div>
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tooltip;
