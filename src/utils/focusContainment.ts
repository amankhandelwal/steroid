/**
 * Focus containment for the palette's shadow root.
 *
 * `sealKeyEventsAtHost` stops key events that *originate* inside the palette. If
 * the page steals focus while the palette is open — sites do this on load, on
 * async render, or from their own shortcuts — subsequent keystrokes originate on
 * a page element and never pass through the shadow host, so the seal never sees
 * them. Keeping focus pinned to the palette closes that hole.
 */

/**
 * Maximum refocus attempts within a single task before giving up.
 *
 * A page that synchronously re-steals focus from its own `focusin` handler would
 * otherwise ping-pong with us until the stack overflows. The counter resets on
 * the next microtask, i.e. once the synchronous fight is over.
 */
const MAX_REFOCUS_ATTEMPTS_PER_TASK = 5;

/**
 * Resolve the shadow host of the tree a node belongs to.
 *
 * @returns The host element, or `null` when the node is not inside a shadow tree
 *   (a plain-document mount, or a test fixture).
 */
export function getShadowHost(node: Node | null): Element | null {
  const root = node?.getRootNode();

  if (root && root.nodeType === Node.DOCUMENT_FRAGMENT_NODE && 'host' in root) {
    return (root as ShadowRoot).host;
  }

  return null;
}

/**
 * Keep focus inside `host`'s shadow tree: whenever focus lands anywhere else,
 * `refocus` is invoked to pull it back.
 *
 * Detection relies on a standard retargeting rule — while any node inside a
 * shadow tree holds focus, `document.activeElement` is that tree's host element —
 * so escaping focus is exactly `document.activeElement !== host`.
 *
 * @param host The palette's shadow host element.
 * @param refocus Pulls focus back into the palette (typically focuses its input).
 * @returns A disposer that stops containing focus.
 */
export function containFocus(host: Element, refocus: () => void): () => void {
  const doc = host.ownerDocument;
  let attemptsInCurrentTask = 0;
  let resetScheduled = false;

  /** Clear the attempt budget once the current synchronous burst has unwound. */
  const scheduleAttemptReset = (): void => {
    if (resetScheduled) {
      return;
    }
    resetScheduled = true;
    queueMicrotask(() => {
      attemptsInCurrentTask = 0;
      resetScheduled = false;
    });
  };

  const handleFocusIn = (): void => {
    if (doc.activeElement === host) {
      return;
    }

    scheduleAttemptReset();

    if (attemptsInCurrentTask >= MAX_REFOCUS_ATTEMPTS_PER_TASK) {
      return;
    }
    attemptsInCurrentTask += 1;

    refocus();
  };

  doc.addEventListener('focusin', handleFocusIn, true);

  return () => {
    doc.removeEventListener('focusin', handleFocusIn, true);
  };
}
