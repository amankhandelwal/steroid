/**
 * Tab message handlers — every code path must answer the sender (FIND-004),
 * and GET_TABS must return every open tab, uncapped (FIND-007).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleCloseDuplicateTabs,
  handleCloseTab,
  handleGetTabs,
  handleOpenUrl,
  handleSwitchToTab
} from '../../src/background/handlers/tabHandlers';
import { messageHandlers } from '../../src/background/handlers';
import { installChromeMock, makeTab, type ChromeMock } from '../helpers/chromeMock';

/** Resolve once the handler has replied, so async paths can be asserted on. */
function captureResponse() {
  let resolve!: (value: unknown) => void;
  const replied = new Promise<unknown>(r => (resolve = r));
  const sendResponse = vi.fn((response?: unknown) => resolve(response));
  return { sendResponse, replied };
}

describe('handleGetTabs', () => {
  let chromeMock: ChromeMock;

  beforeEach(() => {
    chromeMock = installChromeMock();
  });

  it('returns every open tab, sorted most-recently-accessed first', async () => {
    const tabs = Array.from({ length: 60 }, (_, i) => makeTab({ id: i + 1 }));
    chromeMock.tabs.query.mockImplementation((_query: unknown, callback: (t: unknown) => void) =>
      callback(tabs)
    );
    chromeMock.storage.local.data.tabAccessTimes = { 60: 3000, 59: 2000, 1: 1000 };

    const { sendResponse, replied } = captureResponse();
    expect(handleGetTabs({ type: 'GET_TABS' }, sendResponse)).toBe(true);

    const response = (await replied) as Array<{ id: number }>;
    // 60 tabs: the old unconditional `.slice(0, 50)` hid the untouched ones
    // from search entirely.
    expect(response).toHaveLength(60);
    expect(response.slice(0, 3).map(tab => tab.id)).toEqual([60, 59, 1]);
  });

  it('falls back to the raw tab list if access times cannot be read', async () => {
    const tabs = [makeTab({ id: 1 })];
    chromeMock.tabs.query.mockImplementation((_query: unknown, callback: (t: unknown) => void) =>
      callback(tabs)
    );
    chromeMock.storage.local.get.mockRejectedValue(new Error('storage unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendResponse, replied } = captureResponse();
    handleGetTabs({ type: 'GET_TABS' }, sendResponse);

    expect(await replied).toEqual(tabs);
  });
});

describe('handleSwitchToTab', () => {
  let chromeMock: ChromeMock;

  beforeEach(() => {
    chromeMock = installChromeMock();
  });

  it('replies with an error instead of going silent when no tab id is given', () => {
    const { sendResponse } = captureResponse();
    const kept = handleSwitchToTab({ type: 'SWITCH_TO_TAB' }, sendResponse);

    expect(kept).toBeUndefined(); // replied synchronously; port need not stay open
    expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'No tab ID provided' });
  });

  it('accepts tab id 0 rather than rejecting it as falsy', async () => {
    chromeMock.tabs.get.mockImplementation((_id: number, callback: (tab: unknown) => void) =>
      callback(makeTab({ id: 0, windowId: 5 }))
    );
    chromeMock.tabs.update.mockImplementation((_id: number, _props: unknown, callback: () => void) =>
      callback()
    );
    chromeMock.windows.update.mockImplementation((_id: number, _props: unknown, callback: () => void) =>
      callback()
    );

    const { sendResponse, replied } = captureResponse();
    handleSwitchToTab({ type: 'SWITCH_TO_TAB', tabId: 0 }, sendResponse);

    expect(await replied).toEqual({ success: true });
    expect(chromeMock.tabs.update).toHaveBeenCalledWith(0, { active: true }, expect.any(Function));
  });

  it('reports a missing tab instead of a false success', async () => {
    chromeMock.tabs.get.mockImplementation((_id: number, callback: (tab: unknown) => void) =>
      callback(undefined)
    );

    const { sendResponse, replied } = captureResponse();
    handleSwitchToTab({ type: 'SWITCH_TO_TAB', tabId: 42 }, sendResponse);

    expect(await replied).toMatchObject({ success: false, error: 'Tab not found' });
  });
});

describe('handleOpenUrl', () => {
  let chromeMock: ChromeMock;

  beforeEach(() => {
    chromeMock = installChromeMock();
  });

  it('replies after opening the tab', async () => {
    const tab = makeTab({ id: 9 });
    chromeMock.tabs.create.mockImplementation((_props: unknown, callback: (t: unknown) => void) =>
      callback(tab)
    );

    const { sendResponse, replied } = captureResponse();
    handleOpenUrl({ type: 'OPEN_URL', url: 'https://example.com' }, sendResponse);

    expect(await replied).toEqual({ success: true, tab });
    expect(chromeMock.tabs.create).toHaveBeenCalledWith(
      { url: 'https://example.com' },
      expect.any(Function)
    );
  });

  it('replies with an error when no URL is given', () => {
    const { sendResponse } = captureResponse();
    handleOpenUrl({ type: 'OPEN_URL' }, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'No URL provided' });
  });
});

describe('handleCloseTab', () => {
  let chromeMock: ChromeMock;

  beforeEach(() => {
    chromeMock = installChromeMock();
  });

  it('closes a single tab id', async () => {
    chromeMock.tabs.remove.mockImplementation((_ids: number[], callback: () => void) => callback());

    const { sendResponse, replied } = captureResponse();
    handleCloseTab({ type: 'CLOSE_TAB', tabId: 4 }, sendResponse);

    expect(chromeMock.tabs.remove).toHaveBeenCalledWith([4], expect.any(Function));
    expect(await replied).toEqual({ success: true, closedCount: 1 });
  });

  it('closes a batch of tab ids', async () => {
    chromeMock.tabs.remove.mockImplementation((_ids: number[], callback: () => void) => callback());

    const { sendResponse, replied } = captureResponse();
    handleCloseTab({ type: 'CLOSE_TAB', tabIds: [1, 2, 3] }, sendResponse);

    expect(await replied).toEqual({ success: true, closedCount: 3 });
  });

  it('replies with an error when nothing was targeted', () => {
    const { sendResponse } = captureResponse();
    handleCloseTab({ type: 'CLOSE_TAB' }, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'No tab IDs provided' });
  });
});

describe('handleCloseDuplicateTabs', () => {
  let chromeMock: ChromeMock;

  beforeEach(() => {
    chromeMock = installChromeMock();
  });

  it('keeps the first tab per URL, ignoring the hash fragment', async () => {
    chromeMock.tabs.query.mockImplementation((_query: unknown, callback: (t: unknown) => void) =>
      callback([
        makeTab({ id: 1, url: 'https://example.com/a' }),
        makeTab({ id: 2, url: 'https://example.com/a#section' }),
        makeTab({ id: 3, url: 'https://example.com/b' })
      ])
    );
    chromeMock.tabs.remove.mockImplementation((_ids: number[], callback: () => void) => callback());

    const { sendResponse, replied } = captureResponse();
    handleCloseDuplicateTabs({ type: 'CLOSE_DUPLICATE_TABS' }, sendResponse);

    expect(chromeMock.tabs.remove).toHaveBeenCalledWith([2], expect.any(Function));
    expect(await replied).toEqual({ success: true, closedCount: 1 });
  });

  it('reports zero when there is nothing to close', async () => {
    chromeMock.tabs.query.mockImplementation((_query: unknown, callback: (t: unknown) => void) =>
      callback([makeTab({ id: 1, url: 'https://example.com/a' })])
    );

    const { sendResponse, replied } = captureResponse();
    handleCloseDuplicateTabs({ type: 'CLOSE_DUPLICATE_TABS' }, sendResponse);

    expect(await replied).toEqual({ success: true, closedCount: 0 });
    expect(chromeMock.tabs.remove).not.toHaveBeenCalled();
  });
});

describe('messageHandlers registry', () => {
  it('exposes a handler for every message type the UI sends', () => {
    const expected = [
      'GET_TABS',
      'GET_PREVIOUS_TAB',
      'SWITCH_TO_PREVIOUS_TAB',
      'SWITCH_TO_TAB',
      'CLOSE_CURRENT_TAB',
      'NEW_TAB',
      'CLOSE_TAB',
      'OPEN_URL',
      'CLOSE_DUPLICATE_TABS',
      'CREATE_TAB_GROUP',
      'DELETE_TAB_GROUP',
      'GET_TAB_GROUPS',
      'SET_API_KEY',
      'GET_API_KEY_STATUS',
      'SMART_GROUP_TABS',
      'UNGROUP_ALL_TABS'
    ];

    expect(Object.keys(messageHandlers).sort()).toEqual(expected.sort());
    for (const type of expected) {
      expect(typeof messageHandlers[type]).toBe('function');
    }
  });
});
