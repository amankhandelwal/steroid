/**
 * useFocusContainment - Keeps keyboard focus pinned to the palette while it is
 * mounted, so the host page cannot start receiving the user's keystrokes.
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { containFocus, getShadowHost } from '../utils/focusContainment';

/**
 * @param containerRef Any element inside the palette's shadow tree; the shadow
 *   host is resolved from it, so the host does not need to be prop-drilled.
 * @param refocus Pulls focus back into the palette (typically focuses its input).
 */
export function useFocusContainment(
  containerRef: RefObject<HTMLElement | null>,
  refocus: () => void
): void {
  // Keep the latest callback without re-running the effect (and thus re-attaching
  // the listener) on every render.
  const refocusRef = useRef(refocus);
  refocusRef.current = refocus;

  useEffect(() => {
    const host = getShadowHost(containerRef.current);
    if (!host) {
      return;
    }

    return containFocus(host, () => refocusRef.current());
  }, [containerRef]);
}
