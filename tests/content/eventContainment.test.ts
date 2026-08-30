// @vitest-environment jsdom

/**
 * Regression tests for FIND-031: key events typed into the palette must never
 * reach the host page.
 *
 * The bug these guard against: keyboard events are `composed: true`, so they
 * escape the palette's shadow root and bubble on to `document`, retargeted so
 * that `event.target` is the shadow host — a bare `<div>`. Site hotkey layers
 * (GitHub's `github/hotkey`, etc.) listen on `document` in the bubble phase and
 * skip events targeting a form field; a retargeted `<div>` is not a form field,
 * so they run their single-letter shortcuts while the user types in the palette.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sealKeyEventsAtHost } from '../../src/content/eventContainment';

interface Palette {
  host: HTMLElement;
  container: HTMLElement;
  input: HTMLInputElement;
}

/** Build the real host → shadow root → container → input nesting used in production. */
function mountPalette(): Palette {
  const host = document.createElement('div');
  host.id = 'steroid-host';
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadowRoot.appendChild(container);

  const input = document.createElement('input');
  container.appendChild(input);

  return { host, container, input };
}

/** Dispatch a key event the way the browser does for a real keystroke. */
function pressKey(target: EventTarget, type: string, key = 's'): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    key,
    bubbles: true,
    composed: true,
    cancelable: true
  });
  target.dispatchEvent(event);
  return event;
}

/** Stands in for a site's global hotkey handler (bubble phase, on `document`). */
function spyOnDocument(type: string): { count: () => number; detach: () => void } {
  let count = 0;
  const listener = () => {
    count += 1;
  };
  document.addEventListener(type, listener);
  return {
    count: () => count,
    detach: () => document.removeEventListener(type, listener)
  };
}

describe('sealKeyEventsAtHost', () => {
  let palette: Palette;
  let dispose: () => void;

  beforeEach(() => {
    palette = mountPalette();
    dispose = sealKeyEventsAtHost(palette.host);
  });

  afterEach(() => {
    dispose();
    document.body.innerHTML = '';
  });

  it.each(['keydown', 'keypress', 'keyup'])(
    'stops %s originating inside the palette from reaching the page',
    (type) => {
      const page = spyOnDocument(type);

      pressKey(palette.input, type);

      expect(page.count()).toBe(0);
      page.detach();
    }
  );

  it('still delivers key events to listeners inside the palette', () => {
    const seen: string[] = [];
    palette.container.addEventListener('keydown', () => seen.push('palette'));

    pressKey(palette.input, 'keydown');

    expect(seen).toEqual(['palette']);
  });

  it('does not prevent the default action, so typing into the palette still works', () => {
    const event = pressKey(palette.input, 'keydown');

    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves key events originating outside the palette untouched', () => {
    const page = spyOnDocument('keydown');
    const pageInput = document.createElement('input');
    document.body.appendChild(pageInput);

    pressKey(pageInput, 'keydown');

    expect(page.count()).toBe(1);
    page.detach();
  });

  it('stops sealing once disposed', () => {
    const page = spyOnDocument('keydown');

    dispose();
    pressKey(palette.input, 'keydown');

    expect(page.count()).toBe(1);
    page.detach();
  });
});
