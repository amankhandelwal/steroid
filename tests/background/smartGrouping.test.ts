/**
 * Smart-grouping window arithmetic — the 15-tabs-per-window invariant must hold
 * against a window's *pre-existing* tabs and against oversized single groups
 * (FIND-015).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_TABS_PER_WINDOW,
  countTabs,
  enforceWindowTabLimit,
  getAvailableWindowCapacity,
  getMostCommonWindowId,
  packGroupsIntoWindows
} from '../../src/background/smartGrouping';
import type { GroupSuggestion } from '../../src/services/openaiService';
import { installChromeMock, makeTab, type ChromeMock } from '../helpers/chromeMock';

const group = (name: string, size: number, offset = 0): GroupSuggestion => ({
  groupName: name,
  tabIds: Array.from({ length: size }, (_, i) => offset + i + 1)
});

describe('getMostCommonWindowId', () => {
  it('picks the window holding the most of the given tabs', () => {
    const map = new Map([[1, 10], [2, 10], [3, 20]]);
    expect(getMostCommonWindowId([1, 2, 3], map)).toBe(10);
  });

  it('returns null when none of the tabs have a known window', () => {
    expect(getMostCommonWindowId([1, 2], new Map())).toBeNull();
  });
});

describe('enforceWindowTabLimit', () => {
  it('leaves a window that already fits untouched', () => {
    const windows = enforceWindowTabLimit([{ groups: [group('Docs', 5), group('Code', 4, 5)] }]);

    expect(windows).toHaveLength(1);
    expect(countTabs(windows[0].groups)).toBe(9);
  });

  it('splits an over-capacity window across several windows', () => {
    const windows = enforceWindowTabLimit([
      { groups: [group('A', 8), group('B', 8, 8), group('C', 8, 16)] }
    ]);

    expect(windows.length).toBeGreaterThan(1);
    for (const window of windows) {
      expect(countTabs(window.groups)).toBeLessThanOrEqual(MAX_TABS_PER_WINDOW);
    }
  });

  it('splits a single oversized group into sequentially named sub-groups', () => {
    const windows = enforceWindowTabLimit([{ groups: [group('Research', 32)] }]);
    const names = windows.flatMap(window => window.groups.map(g => g.groupName));

    expect(names).toEqual(['Research', 'Research 2', 'Research 3']);
    for (const window of windows) {
      expect(countTabs(window.groups)).toBeLessThanOrEqual(MAX_TABS_PER_WINDOW);
    }
  });

  it('preserves every tab exactly once while splitting', () => {
    const windows = enforceWindowTabLimit([{ groups: [group('Big', 40)] }]);
    const tabIds = windows.flatMap(window => window.groups.flatMap(g => g.tabIds));

    expect(tabIds).toHaveLength(40);
    expect(new Set(tabIds).size).toBe(40);
  });
});

describe('packGroupsIntoWindows', () => {
  it('honours a reduced first-window capacity, then falls back to the full limit', () => {
    const chunks = packGroupsIntoWindows([group('A', 4), group('B', 4, 4), group('C', 10, 8)], 5);

    expect(countTabs(chunks[0].groups)).toBe(4);
    expect(chunks).toHaveLength(2);
    expect(countTabs(chunks[1].groups)).toBe(14);
  });

  it('still emits a first chunk when capacity is zero, so no group is dropped', () => {
    const chunks = packGroupsIntoWindows([group('A', 3), group('B', 3, 3)], 0);
    const tabIds = chunks.flatMap(chunk => chunk.groups.flatMap(g => g.tabIds));

    expect(tabIds).toHaveLength(6);
  });

  it('returns nothing for no groups', () => {
    expect(packGroupsIntoWindows([], 15)).toEqual([]);
  });
});

describe('getAvailableWindowCapacity', () => {
  let chromeMock: ChromeMock;

  beforeEach(() => {
    chromeMock = installChromeMock();
  });

  it("subtracts a window's pre-existing (non-batch) tabs from the budget", async () => {
    // 10 tabs already live in window 1, none of them part of this batch.
    chromeMock.tabs.query.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeTab({ id: 100 + i, windowId: 1 }))
    );

    const capacity = await getAvailableWindowCapacity(1, new Map([[1, 2], [2, 2]]));

    expect(capacity).toBe(MAX_TABS_PER_WINDOW - 10);
  });

  it('does not double-count batch tabs that already live in the window', async () => {
    chromeMock.tabs.query.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => makeTab({ id: i + 1, windowId: 1 }))
    );

    const batchTabsInWindowOne = new Map([[1, 1], [2, 1], [3, 1]]);
    const capacity = await getAvailableWindowCapacity(1, batchTabsInWindowOne);

    // 5 live tabs, 3 of them in this batch => only 2 permanently occupy space.
    expect(capacity).toBe(MAX_TABS_PER_WINDOW - 2);
  });

  it('reports no capacity for an already-full window', async () => {
    chromeMock.tabs.query.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => makeTab({ id: 200 + i, windowId: 3 }))
    );

    expect(await getAvailableWindowCapacity(3, new Map())).toBeLessThanOrEqual(0);
  });
});
