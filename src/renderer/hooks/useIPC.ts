import { useEffect } from 'react';

type Cleanup = () => void;

/** Attach an IPC listener and clean it up on unmount. */
export function useIPCListener(
  attach: (cleanup: Cleanup) => void,
  deps: React.DependencyList = [],
): void {
  useEffect(() => {
    let cleanup: Cleanup | null = null;
    attach((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
