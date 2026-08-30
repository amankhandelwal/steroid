/**
 * Minimal in-memory stand-in for the Chrome extension APIs the source touches.
 *
 * Only the surface actually exercised by the tests is implemented; anything
 * else is a bare `vi.fn()` so an unexpected call fails loudly rather than
 * silently succeeding.
 */

import { vi } from 'vitest';

export interface ChromeMock {
  runtime: {
    lastError: { message: string } | undefined;
    sendMessage: ReturnType<typeof vi.fn>;
    onMessage: { addListener: ReturnType<typeof vi.fn>; removeListener: ReturnType<typeof vi.fn> };
  };
  storage: {
    local: {
      data: Record<string, unknown>;
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    };
  };
  tabs: Record<string, ReturnType<typeof vi.fn>>;
  tabGroups: { TAB_GROUP_ID_NONE: number } & Record<string, unknown>;
  windows: Record<string, ReturnType<typeof vi.fn>>;
  scripting: Record<string, ReturnType<typeof vi.fn>>;
  action: { onClicked: { addListener: ReturnType<typeof vi.fn> } };
}

/**
 * Install a fresh `globalThis.chrome` mock and return it for per-test tuning.
 * `storage.local` is backed by a real object so read-modify-write cycles behave
 * like the real API (including their interleaving).
 */
export function installChromeMock(): ChromeMock {
  const data: Record<string, unknown> = {};

  const chromeMock: ChromeMock = {
    runtime: {
      lastError: undefined,
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() }
    },
    storage: {
      local: {
        data,
        get: vi.fn(async (key: string) => ({ [key]: data[key] })),
        set: vi.fn(async (entries: Record<string, unknown>) => {
          Object.assign(data, entries);
        })
      }
    },
    tabs: {
      query: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      create: vi.fn(),
      move: vi.fn(),
      group: vi.fn(),
      ungroup: vi.fn(),
      sendMessage: vi.fn()
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      update: vi.fn(),
      query: vi.fn()
    },
    windows: {
      update: vi.fn(),
      create: vi.fn()
    },
    scripting: {
      executeScript: vi.fn()
    },
    action: {
      onClicked: { addListener: vi.fn() }
    }
  };

  (globalThis as unknown as { chrome: ChromeMock }).chrome = chromeMock;
  return chromeMock;
}

/** Build a `chrome.tabs.Tab`-shaped object with sane defaults. */
export function makeTab(overrides: Partial<chrome.tabs.Tab> & { id: number }): chrome.tabs.Tab {
  return {
    index: 0,
    windowId: 1,
    highlighted: false,
    active: false,
    pinned: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    title: `Tab ${overrides.id}`,
    url: `https://example.com/${overrides.id}`,
    ...overrides
  } as chrome.tabs.Tab;
}

/** Build a `chrome.tabGroups.TabGroup`-shaped object with sane defaults. */
export function makeGroup(
  overrides: Partial<chrome.tabGroups.TabGroup> & { id: number }
): chrome.tabGroups.TabGroup {
  return {
    collapsed: false,
    color: 'blue',
    title: `Group ${overrides.id}`,
    windowId: 1,
    ...overrides
  } as chrome.tabGroups.TabGroup;
}
