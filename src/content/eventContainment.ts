/**
 * Event containment for the palette's shadow root.
 *
 * Keyboard events are `composed: true`, so a keystroke made inside the palette
 * does not stop at the shadow boundary — it escapes the shadow root and keeps
 * bubbling `#steroid-host → body → html → document → window`. On the way out it
 * is *retargeted*: every listener above the shadow boundary sees
 * `event.target === #steroid-host`, a bare `<div>`, not the input the user
 * actually typed into.
 *
 * Site hotkey layers (e.g. GitHub's `github/hotkey`) listen on `document` in the
 * bubble phase and ignore events whose target is a form field. A retargeted
 * `<div>` is not a form field, so they conclude the user pressed a bare key and
 * run their shortcut — GitHub navigates away while the user is typing a search
 * query into the palette.
 *
 * The host element is the last node the event passes through before the page can
 * see it, so that is where it has to be stopped.
 */

/** Key events that must never escape the palette into the host page. */
const CONTAINED_KEY_EVENTS = ['keydown', 'keypress', 'keyup'] as const;

/**
 * Stop key events originating inside the palette's shadow tree from reaching the
 * host page.
 *
 * Registered in the **bubble** phase, deliberately: a capture-phase listener on
 * the host fires *before* the event descends into the shadow tree and would stop
 * the palette's own input from ever seeing the keystroke. In the bubble phase the
 * palette has already handled the event and the page has not yet seen it.
 *
 * Neither `preventDefault()` (the search input still needs its default typing
 * behaviour; the palette's own handlers prevent the keys they consume) nor
 * `stopImmediatePropagation()` (nothing else of ours listens on the host node) is
 * used here.
 *
 * Residual, accepted: a page listening on `document`/`window` in the *capture*
 * phase still sees these events, because capture runs top-down and reaches those
 * nodes before the host. Closing that would require the content script to run at
 * `document_start`.
 *
 * @param host The palette's shadow host element.
 * @returns A disposer that removes the listeners.
 */
export function sealKeyEventsAtHost(host: HTMLElement): () => void {
  const seal = (event: Event): void => {
    event.stopPropagation();
  };

  for (const type of CONTAINED_KEY_EVENTS) {
    host.addEventListener(type, seal);
  }

  return () => {
    for (const type of CONTAINED_KEY_EVENTS) {
      host.removeEventListener(type, seal);
    }
  };
}
