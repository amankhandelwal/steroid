// @vitest-environment jsdom

/**
 * Tests for FIND-033: while the palette is open, focus must stay inside it, so
 * the page cannot start receiving keystrokes at their source (which would
 * bypass the shadow-host seal entirely — see `eventContainment.test.ts`).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { containFocus, getShadowHost } from '../../src/utils/focusContainment';

interface Palette {
  host: HTMLElement;
  container: HTMLElement;
  input: HTMLInputElement;
}

function mountPalette(): Palette {
  const host = document.createElement('div');
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadowRoot.appendChild(container);

  const input = document.createElement('input');
  container.appendChild(input);

  return { host, container, input };
}

describe('getShadowHost', () => {
  it('resolves the host element from a node inside a shadow tree', () => {
    const { host, container } = mountPalette();

    expect(getShadowHost(container)).toBe(host);
  });

  it('returns null for a node in the main document', () => {
    const node = document.createElement('div');
    document.body.appendChild(node);

    expect(getShadowHost(node)).toBeNull();
  });

  it('returns null for a null node', () => {
    expect(getShadowHost(null)).toBeNull();
  });
});

describe('containFocus', () => {
  let palette: Palette;
  let refocus: ReturnType<typeof vi.fn>;
  let dispose: () => void;

  beforeEach(() => {
    palette = mountPalette();
    refocus = vi.fn(() => palette.input.focus());
    dispose = containFocus(palette.host, refocus);
  });

  afterEach(() => {
    dispose();
    document.body.innerHTML = '';
  });

  it('pulls focus back when it lands on a page element', () => {
    const pageInput = document.createElement('input');
    document.body.appendChild(pageInput);

    pageInput.focus();

    expect(refocus).toHaveBeenCalled();
    expect(document.activeElement).toBe(palette.host);
  });

  it('leaves focus alone when it moves within the palette', () => {
    const secondInput = document.createElement('input');
    palette.container.appendChild(secondInput);

    palette.input.focus();
    secondInput.focus();

    expect(refocus).not.toHaveBeenCalled();
  });

  it('gives up rather than looping forever against a page that keeps stealing focus', () => {
    const pageInput = document.createElement('input');
    document.body.appendChild(pageInput);
    document.addEventListener('focusin', () => pageInput.focus());

    pageInput.focus();

    // Bounded: the guard stops fighting instead of recursing until the stack blows.
    expect(refocus.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it('stops containing focus once disposed', () => {
    const pageInput = document.createElement('input');
    document.body.appendChild(pageInput);

    dispose();
    pageInput.focus();

    expect(refocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(pageInput);
  });
});
