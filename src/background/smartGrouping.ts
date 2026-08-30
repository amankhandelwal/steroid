/**
 * Pure-ish helpers backing the AI "smart group" flow: window selection,
 * per-window tab limits, group bin-packing and group creation.
 *
 * The orchestration that consumes these lives in
 * `handlers/smartGroupHandlers.ts`.
 */

import { WindowSuggestion, GroupSuggestion } from '../services/openaiService';

export const MAX_TABS_PER_WINDOW = 15;

/**
 * Local stand-in for `chrome.tabGroups.ColorEnum`, which the installed
 * `@types/chrome@0.1.12` typings don't export (the actual runtime type is
 * `chrome.tabGroups.Color`, exposed as this same string union).
 */
type TabGroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';

/** Determine the best existing windowId for a set of tabs (most common window) */
export function getMostCommonWindowId(tabIds: number[], tabWindowMap: Map<number, number>): number | null {
  const windowCounts = new Map<number, number>();

  for (const tabId of tabIds) {
    const windowId = tabWindowMap.get(tabId);
    if (windowId !== undefined) {
      windowCounts.set(windowId, (windowCounts.get(windowId) || 0) + 1);
    }
  }

  let bestWindowId: number | null = null;
  let bestCount = 0;
  for (const [windowId, count] of windowCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestWindowId = windowId;
    }
  }

  return bestWindowId;
}

/** Update a tab group's title and color, retrying with delays if Chrome isn't ready */
async function updateTabGroupWithRetry(
  groupId: number,
  title: string,
  color: TabGroupColor
): Promise<void> {
  const MAX_RETRIES = 3;
  const DELAY_MS = 200;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await chrome.tabGroups.update(groupId, { title, color });
      return;
    } catch {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      } else {
        throw new Error(`Failed to update group title "${title}" after ${MAX_RETRIES} attempts`);
      }
    }
  }
}

/** Apply groups within a single target window, moving tabs as needed */
export async function applyWindowGroups(
  windowSuggestion: WindowSuggestion,
  targetWindowId: number,
  tabWindowMap: Map<number, number>,
  colorIndex: number
): Promise<{ groupCount: number; tabCount: number; nextColorIndex: number }> {
  const colors: TabGroupColor[] = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  let groupCount = 0;
  let tabCount = 0;
  let ci = colorIndex;

  for (const group of windowSuggestion.groups) {
    try {
      // Move tabs that aren't already in this window
      for (const tabId of group.tabIds) {
        const currentWindowId = tabWindowMap.get(tabId);
        if (currentWindowId !== undefined && currentWindowId !== targetWindowId) {
          await chrome.tabs.move(tabId, { windowId: targetWindowId, index: -1 });
          tabWindowMap.set(tabId, targetWindowId);
        }
      }

      // Cast: @types/chrome@0.1.12 types GroupOptions.tabIds as the tuple
      // `[number, ...number[]]` rather than `number[]` (same precedent as
      // `tabGroupHandlers.ts`'s `handleDeleteTabGroup`).
      const groupId = await chrome.tabs.group({ tabIds: group.tabIds as [number, ...number[]] });

      await updateTabGroupWithRetry(groupId, group.groupName, colors[ci % colors.length]);
      groupCount++;
      tabCount += group.tabIds.length;
      ci++;
    } catch (err) {
      console.error(`Failed to create/update group "${group.groupName}":`, err);
    }
  }

  return { groupCount, tabCount, nextColorIndex: ci };
}

/** Total tab count across all groups in a window suggestion */
export function countTabs(groups: GroupSuggestion[]): number {
  return groups.reduce((sum, g) => sum + g.tabIds.length, 0);
}

/**
 * Split any single group larger than the per-window limit into sequentially
 * named sub-groups ("Name", "Name 2", ...) each within the limit, so no group
 * can ever overflow a window on its own.
 */
function splitOversizedGroups(groups: GroupSuggestion[]): GroupSuggestion[] {
  const result: GroupSuggestion[] = [];

  for (const group of groups) {
    if (group.tabIds.length <= MAX_TABS_PER_WINDOW) {
      result.push(group);
      continue;
    }

    let part = 0;
    for (let i = 0; i < group.tabIds.length; i += MAX_TABS_PER_WINDOW) {
      part++;
      result.push({
        groupName: part === 1 ? group.groupName : `${group.groupName} ${part}`,
        tabIds: group.tabIds.slice(i, i + MAX_TABS_PER_WINDOW)
      });
    }
  }

  return result;
}

/**
 * Bin-pack groups into window-sized chunks. The first chunk is limited to
 * `firstCapacity` tabs (the free space in an existing destination window);
 * every subsequent chunk is limited to MAX_TABS_PER_WINDOW (a fresh window).
 * Groups are treated as atomic — callers must pre-split oversized groups.
 */
export function packGroupsIntoWindows(groups: GroupSuggestion[], firstCapacity: number): WindowSuggestion[] {
  const result: WindowSuggestion[] = [];
  let currentGroups: GroupSuggestion[] = [];
  let currentCount = 0;
  let capacity = Math.max(firstCapacity, 0);

  for (const group of groups) {
    if (currentGroups.length > 0 && currentCount + group.tabIds.length > capacity) {
      result.push({ groups: currentGroups });
      currentGroups = [];
      currentCount = 0;
      capacity = MAX_TABS_PER_WINDOW;
    }
    currentGroups.push(group);
    currentCount += group.tabIds.length;
  }

  if (currentGroups.length > 0) {
    result.push({ groups: currentGroups });
  }

  return result;
}

/**
 * Normalise AI window suggestions: split oversized groups, then split any
 * window whose total exceeds the per-window limit into multiple windows.
 */
export function enforceWindowTabLimit(windows: WindowSuggestion[]): WindowSuggestion[] {
  const result: WindowSuggestion[] = [];

  for (const window of windows) {
    const groups = splitOversizedGroups(window.groups);

    if (countTabs(groups) <= MAX_TABS_PER_WINDOW) {
      result.push({ groups });
      continue;
    }

    result.push(...packGroupsIntoWindows(groups, MAX_TABS_PER_WINDOW));
  }

  return result;
}

/**
 * Free tab slots remaining in an existing window, accounting for the fact that
 * batch tabs currently living in that window are either re-added here or moved
 * out — so only non-batch tabs count as permanently occupying space.
 */
export async function getAvailableWindowCapacity(
  windowId: number,
  tabWindowMap: Map<number, number>
): Promise<number> {
  const liveTabs = await chrome.tabs.query({ windowId });

  let batchTabsHere = 0;
  for (const wid of tabWindowMap.values()) {
    if (wid === windowId) batchTabsHere++;
  }

  const nonBatchTabs = Math.max(liveTabs.length - batchTabsHere, 0);
  return MAX_TABS_PER_WINDOW - nonBatchTabs;
}
