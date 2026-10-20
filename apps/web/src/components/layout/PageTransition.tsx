import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

/** A gentle page-turn whenever the route changes. */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="[perspective:1800px]">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, rotateY: -7, x: 14 }}
        animate={{ opacity: 1, rotateY: 0, x: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: 'left center' }}
      >
        {children}
      </motion.div>
    </div>
  );
}
