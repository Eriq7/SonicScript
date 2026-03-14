/**
 * useIPC.ts — UNUSED: Generic React hook for attaching IPC listeners.
 *
 * NOTE: This hook is defined but not imported anywhere in the current codebase.
 * All IPC listener setup is done inline with useEffect() directly in each component.
 *
 * Main exports:
 *   - useIPCListener(attach, deps): void — attaches a listener on mount, cleans up
 *     on unmount; the caller passes a registration function that receives a cleanup fn
 */
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
