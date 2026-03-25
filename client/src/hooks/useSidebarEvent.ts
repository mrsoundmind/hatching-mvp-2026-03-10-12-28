/**
 * Typed useEffect wrapper for CustomEvent listening with automatic cleanup.
 *
 * Every sidebar component uses this hook to subscribe to autonomy CustomEvents.
 * Never use raw window.addEventListener in sidebar components.
 */

import { useEffect, useCallback } from 'react';
import type { AutonomyEventName } from '@/lib/autonomyEvents';

export function useSidebarEvent<T>(
  eventName: AutonomyEventName | string,
  handler: (detail: T) => void,
  deps: React.DependencyList = []
): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableHandler = useCallback((e: Event) => {
    handler((e as CustomEvent<T>).detail);
  }, deps);

  useEffect(() => {
    window.addEventListener(eventName, stableHandler);
    return () => window.removeEventListener(eventName, stableHandler);
  }, [eventName, stableHandler]);
}
