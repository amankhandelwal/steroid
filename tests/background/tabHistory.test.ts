/**
 * Tab history / access-time tracking, including the concurrency guarantee that
 * rapid tab events cannot clobber each other's writes (FIND-016).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanupTabAccessTimes,
  cleanupTabHistory,
  getPreviousTab,
  getTabAccessTimes,
  pushTabToHistory,
  updateTabAccessTime,
  type TabHistoryEntry
} from '../../src/background/tabHistory';
import { installChromeMock, type ChromeMock } from '../helpers/chromeMock';

const historyOf = (chromeMock: ChromeMock): TabHistoryEntry[] =>
  (chromeMock.storage.local.data.tabHistory as TabHistoryEntry[]) ?? [];

describe('tab history', () => {
  let chromeMock: ChromeMock;

  beforeEach(() => {
    chromeMock = installChromeMock();
    chromeMock.tabs.get.mockResolvedValue({ id: 1 });
  });

  it('moves an already-tracked tab to the front without duplicating it', async () => {
    await pushTabToHistory(1, 100);
    await pushTabToHistory(2, 100);
    await pushTabToHistory(1, 100);

    expect(historyOf(chromeMock).map(entry => entry.tabId)).toEqual([1, 2]);
  });

  it('keeps both writes when two activations race', async () => {
    await Promise.all([pushTabToHistory(1, 100), pushTabToHistory(2, 100)]);

    // Without serialization the second read starts from the pre-first-write
    // state and one of these entries disappears.
    expect(historyOf(chromeMock).map(entry => entry.tabId).sort()).toEqual([1, 2]);
  });

  it('caps the history at 100 entries, keeping the most recent', async () => {
    for (let tabId = 1; tabId <= 105; tabId++) {
      await pushTabToHistory(tabId, 100);
    }

    const history = historyOf(chromeMock);
    expect(history).toHaveLength(100);
    expect(history[0].tabId).toBe(105);
  });

  it('returns the most recent tab that is not the current one and still exists', async () => {
    await pushTabToHistory(1, 100);
    await pushTabToHistory(2, 100);
    await pushTabToHistory(3, 100);

    chromeMock.tabs.get.mockImplementation(async (tabId: number) => {
      if (tabId === 2) throw new Error('No tab with id 2');
      return { id: tabId };
    });

    const previous = await getPreviousTab(3);
    expect(previous?.tabId).toBe(1);
  });

  it('returns null when history holds nothing usable', async () => {
    await pushTabToHistory(5, 100);
    expect(await getPreviousTab(5)).toBeNull();
  });

  it('drops closed tabs during cleanup and leaves storage alone when nothing changed', async () => {
    await pushTabToHistory(1, 100);
    await pushTabToHistory(2, 100);

    chromeMock.tabs.get.mockImplementation(async (tabId: number) => {
      if (tabId === 1) throw new Error('No tab with id 1');
      return { id: tabId };
    });

    await cleanupTabHistory();
    expect(historyOf(chromeMock).map(entry => entry.tabId)).toEqual([2]);

    const writesBefore = chromeMock.storage.local.set.mock.calls.length;
    await cleanupTabHistory();
    expect(chromeMock.storage.local.set.mock.calls.length).toBe(writesBefore);
  });
});

describe('tab access times', () => {
  let chromeMock: ChromeMock;

  beforeEach(() => {
    chromeMock = installChromeMock();
  });

  it('records an access time per tab', async () => {
    await updateTabAccessTime(7);
    const times = await getTabAccessTimes();

    expect(times[7]).toBeGreaterThan(0);
  });

  it('keeps both writes when two activations race', async () => {
    await Promise.all([updateTabAccessTime(1), updateTabAccessTime(2)]);
    const times = await getTabAccessTimes();

    expect(Object.keys(times).sort()).toEqual(['1', '2']);
  });

  it('prunes access times for tabs that no longer exist', async () => {
    await updateTabAccessTime(1);
    await updateTabAccessTime(2);

    await cleanupTabAccessTimes([2]);
    const times = await getTabAccessTimes();

    expect(times[1]).toBeUndefined();
    expect(times[2]).toBeGreaterThan(0);
  });

  it('starts from an empty record when storage holds nothing', async () => {
    expect(await getTabAccessTimes()).toEqual({});
  });
});
