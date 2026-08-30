/**
 * Message handlers for AI-assisted tab organisation: smart grouping and the
 * bulk "ungroup everything" escape hatch.
 */

import { smartGroupTabs, TabInfo, WindowSuggestion } from '../../services/openaiService';
import { safeSendResponse } from '../messaging';
import {
  MAX_TABS_PER_WINDOW,
  applyWindowGroups,
  countTabs,
  enforceWindowTabLimit,
  getAvailableWindowCapacity,
  getMostCommonWindowId,
  packGroupsIntoWindows
} from '../smartGrouping';
import { ExtensionMessage, SendResponse } from '../types';

/** Handle smart grouping: fetch ungrouped tabs, call OpenAI, organize into windows and groups */
async function runSmartGroupTabs(sendResponse: SendResponse): Promise<void> {
  try {
    const allTabs = await chrome.tabs.query({});

    // Filter to meaningful, ungrouped tabs
    const ungroupedTabs: TabInfo[] = allTabs
      .filter(tab =>
        tab.id !== undefined &&
        tab.url &&
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('edge://') &&
        tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE
      )
      .map(tab => ({
        id: tab.id!,
        title: tab.title || 'Untitled',
        url: tab.url!,
        windowId: tab.windowId
      }));

    if (ungroupedTabs.length === 0) {
      safeSendResponse(sendResponse, { success: false, error: 'No ungrouped tabs available to group.' });
      return;
    }

    const result = await smartGroupTabs(ungroupedTabs);

    if (!result.success || !result.windows) {
      safeSendResponse(sendResponse, { success: false, error: result.error });
      return;
    }

    // Enforce max tabs per window as a safeguard against AI overloading a single window
    const enforcedWindows = enforceWindowTabLimit(result.windows);

    // Build a map of tabId -> current windowId for move decisions
    const tabWindowMap = new Map<number, number>();
    for (const tab of ungroupedTabs) {
      tabWindowMap.set(tab.id, tab.windowId);
    }

    let totalGroupCount = 0;
    let totalTabCount = 0;
    let colorIndex = 0;
    const usedWindowIds = new Set<number>();

    for (const windowSuggestion of enforcedWindows) {
      // Collect all tabIds in this window suggestion
      const allTabIds = windowSuggestion.groups.flatMap(g => g.tabIds);
      const preferredWindowId = getMostCommonWindowId(allTabIds, tabWindowMap);

      // Decide whether the preferred existing window has room for the first
      // chunk; if not, everything routes to fresh windows.
      let chunks: WindowSuggestion[];
      let firstChunkWindowId: number | null = null;

      if (preferredWindowId !== null && !usedWindowIds.has(preferredWindowId)) {
        const capacity = await getAvailableWindowCapacity(preferredWindowId, tabWindowMap);
        const packed = packGroupsIntoWindows(windowSuggestion.groups, capacity);
        const firstChunkTabs = countTabs(packed[0].groups);

        if (capacity > 0 && firstChunkTabs <= capacity) {
          chunks = packed;
          firstChunkWindowId = preferredWindowId;
        } else {
          chunks = packGroupsIntoWindows(windowSuggestion.groups, MAX_TABS_PER_WINDOW);
        }
      } else {
        chunks = packGroupsIntoWindows(windowSuggestion.groups, MAX_TABS_PER_WINDOW);
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkTabIds = chunk.groups.flatMap(g => g.tabIds);
        if (chunkTabIds.length === 0) continue;

        let targetWindowId: number;
        if (i === 0 && firstChunkWindowId !== null) {
          targetWindowId = firstChunkWindowId;
        } else {
          const firstTabId = chunkTabIds[0];
          const newWindow = await chrome.windows.create({ tabId: firstTabId });
          if (newWindow?.id === undefined) {
            console.error('Failed to create window for smart group chunk');
            continue;
          }
          targetWindowId = newWindow.id;
          tabWindowMap.set(firstTabId, targetWindowId);
        }

        usedWindowIds.add(targetWindowId);

        const { groupCount, tabCount, nextColorIndex } = await applyWindowGroups(
          chunk, targetWindowId, tabWindowMap, colorIndex
        );
        totalGroupCount += groupCount;
        totalTabCount += tabCount;
        colorIndex = nextColorIndex;
      }
    }

    safeSendResponse(sendResponse, {
      success: true,
      groupCount: totalGroupCount,
      tabCount: totalTabCount,
      message: `Created ${totalGroupCount} groups with ${totalTabCount} tabs across ${usedWindowIds.size} windows`
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    safeSendResponse(sendResponse, { success: false, error: message });
  }
}

/** Handle ungrouping all tabs across all windows */
async function runUngroupAllTabs(sendResponse: SendResponse): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});

    const groupedTabIds = tabs
      .filter(tab => tab.id !== undefined && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE)
      .map(tab => tab.id!);

    if (groupedTabIds.length === 0) {
      safeSendResponse(sendResponse, { success: true, ungroupedCount: 0, message: 'No grouped tabs to ungroup.' });
      return;
    }

    await chrome.tabs.ungroup(groupedTabIds as [number, ...number[]]);

    safeSendResponse(sendResponse, {
      success: true,
      ungroupedCount: groupedTabIds.length,
      message: `Ungrouped ${groupedTabIds.length} tabs`
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    safeSendResponse(sendResponse, { success: false, error: message });
  }
}

/** SMART_GROUP_TABS — organise ungrouped tabs into AI-suggested windows/groups. */
export function handleSmartGroupTabs(_message: ExtensionMessage, sendResponse: SendResponse): boolean {
  runSmartGroupTabs(sendResponse);
  return true; // Asynchronous response
}

/** UNGROUP_ALL_TABS — dissolve every tab group across all windows. */
export function handleUngroupAllTabs(_message: ExtensionMessage, sendResponse: SendResponse): boolean {
  runUngroupAllTabs(sendResponse);
  return true; // Asynchronous response
}
