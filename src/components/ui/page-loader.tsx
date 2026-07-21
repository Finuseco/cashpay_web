
'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

export function PageLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const previousPathRef = useRef(pathname + searchParams.toString());

  useEffect(() => {
    const currentPath = pathname + searchParams.toString();
    
    if (previousPathRef.current !== currentPath) {
      setIsLoading(true);
      previousPathRef.current = currentPath;
    }

    // Set a timeout to hide the loader after the new page is likely rendered
    const loadingTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 1000); // Duration for the loading bar to be visible

    return () => clearTimeout(loadingTimeout);
    
  }, [pathname, searchParams]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="fixed top-0 left-0 z-[200] h-1 bg-primary"
          role="status"
          aria-live="polite"
          aria-label="Loading new page"
        >
            <span className="sr-only">Chargement...</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
