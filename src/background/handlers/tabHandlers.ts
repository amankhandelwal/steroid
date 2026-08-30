/**
 * Message handlers for plain tab operations: listing, switching, creating,
 * closing and de-duplicating tabs.
 */

import { safeSendResponse } from '../messaging';
import { getTabAccessTimes } from '../tabHistory';
import { ExtensionMessage, SendResponse } from '../types';

/**
 * GET_TABS — return every tab, annotated with its last access time and sorted
 * most-recently-used first.
 */
export function handleGetTabs(_message: ExtensionMessage, sendResponse: SendResponse): boolean {
  chrome.tabs.query({}, async (tabs) => {
    try {
      // Get access times for chronological sorting
      const accessTimes = await getTabAccessTimes();

      // Add access time data to each tab
      const tabsWithAccessTime = tabs.map(tab => ({
        ...tab,
        lastAccessed: accessTimes[tab.id!] || 0
      }));

      // Sort by last accessed (most recent first) when no search query.
      // Return ALL tabs so the frontend search can reach every tab; the
      // frontend caps the default (empty-query) view itself.
      tabsWithAccessTime.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

      safeSendResponse(sendResponse, tabsWithAccessTime);
    } catch (error) {
      console.error('Error fetching tabs with access times:', error);
      safeSendResponse(sendResponse, tabs); // Fallback to original tabs
    }
  });
  return true; // Asynchronous response
}

/** Focus the window owning a tab, replying with the outcome of the switch. */
function focusTabWindow(windowId: number, sendResponse: SendResponse): void {
  chrome.windows.update(windowId, { focused: true }, () => {
    if (chrome.runtime.lastError) {
      safeSendResponse(sendResponse, { success: false, error: chrome.runtime.lastError.message });
    } else {
      safeSendResponse(sendResponse, { success: true });
    }
  });
}

/** SWITCH_TO_TAB — activate the requested tab and focus its window. */
export function handleSwitchToTab(
  message: ExtensionMessage,
  sendResponse: SendResponse
): boolean | undefined {
  const tabId = message.tabId as number | null | undefined;

  // tabId 0 is technically valid, so guard against null/undefined only.
  if (tabId === undefined || tabId === null) {
    safeSendResponse(sendResponse, { success: false, error: 'No tab ID provided' });
    return undefined;
  }

  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) {
      safeSendResponse(sendResponse, {
        success: false,
        error: chrome.runtime.lastError?.message || 'Tab not found'
      });
      return;
    }

    chrome.tabs.update(tabId, { active: true }, () => {
      if (chrome.runtime.lastError) {
        safeSendResponse(sendResponse, { success: false, error: chrome.runtime.lastError.message });
        return;
      }

      if (!tab.windowId) {
        safeSendResponse(sendResponse, { success: true });
        return;
      }

      focusTabWindow(tab.windowId, sendResponse);
    });
  });
  return true;
}

/** CLOSE_CURRENT_TAB — close the currently active tab in the current window. */
export function handleCloseCurrentTab(_message: ExtensionMessage, sendResponse: SendResponse): boolean {
  // Close the currently active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError || tabs.length === 0) {
      safeSendResponse(sendResponse, { success: false, error: 'No active tab found' });
      return;
    }

    const currentTabId = tabs[0].id;
    if (currentTabId) {
      chrome.tabs.remove(currentTabId, () => {
        if (chrome.runtime.lastError) {
          console.error('Error closing current tab:', chrome.runtime.lastError.message);
          safeSendResponse(sendResponse, { success: false, error: chrome.runtime.lastError.message });
        } else {
          safeSendResponse(sendResponse, { success: true, message: 'Closed current tab' });
        }
      });
    } else {
      safeSendResponse(sendResponse, { success: false, error: 'Current tab has no ID' });
    }
  });
  return true;
}

/** NEW_TAB — open a blank tab. */
export function handleNewTab(_message: ExtensionMessage, sendResponse: SendResponse): boolean {
  // Create a new tab
  chrome.tabs.create({}, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Error creating new tab:', chrome.runtime.lastError.message);
      safeSendResponse(sendResponse, { success: false, error: chrome.runtime.lastError.message });
    } else {
      safeSendResponse(sendResponse, { success: true, message: 'Created new tab', tab });
    }
  });
  return true;
}

/** Read the tab ids to close, supporting both `tabIds` and a single `tabId`. */
function readTabIdsToClose(message: ExtensionMessage): number[] {
  // Support both single tabId and array of tabIds
  return Array.isArray(message.tabIds)
    ? (message.tabIds as number[])
    : (message.tabId ? [message.tabId as number] : []);
}

/** CLOSE_TAB — close one or many tabs. */
export function handleCloseTab(
  message: ExtensionMessage,
  sendResponse: SendResponse
): boolean | undefined {
  const tabIds = readTabIdsToClose(message);

  if (tabIds.length === 0) {
    safeSendResponse(sendResponse, { success: false, error: 'No tab IDs provided' });
    return undefined;
  }

  chrome.tabs.remove(tabIds, () => {
    if (chrome.runtime.lastError) {
      console.error('Error closing tabs:', chrome.runtime.lastError.message);
      safeSendResponse(sendResponse, { success: false, error: chrome.runtime.lastError.message });
    } else {
      safeSendResponse(sendResponse, { success: true, closedCount: tabIds.length });
    }
  });
  return true;
}

/** OPEN_URL — open the given URL in a new tab. */
export function handleOpenUrl(
  message: ExtensionMessage,
  sendResponse: SendResponse
): boolean | undefined {
  const url = message.url as string | undefined;

  if (!url) {
    safeSendResponse(sendResponse, { success: false, error: 'No URL provided' });
    return undefined;
  }

  chrome.tabs.create({ url }, (tab) => {
    if (chrome.runtime.lastError) {
      safeSendResponse(sendResponse, { success: false, error: chrome.runtime.lastError.message });
    } else {
      safeSendResponse(sendResponse, { success: true, tab });
    }
  });
  return true;
}

/**
 * Collect the duplicate tabs to close: tabs are grouped by their URL ignoring
 * the hash fragment, and every tab after the first of each group is returned.
 */
function collectDuplicateTabIds(tabs: chrome.tabs.Tab[]): number[] {
  const urlMap = new Map<string, number[]>();
  const tabsToClose: number[] = [];

  tabs.forEach((tab) => {
    if (tab.url && tab.id) {
      try {
        const url = new URL(tab.url);
        url.hash = ''; // Ignore hash for duplicate detection
        const normalizedUrl = url.toString();

        if (!urlMap.has(normalizedUrl)) {
          urlMap.set(normalizedUrl, []);
        }
        urlMap.get(normalizedUrl)?.push(tab.id);
      } catch (e) {
        console.error('Error normalizing URL:', tab.url, e);
      }
    }
  });

  urlMap.forEach((tabIds) => {
    if (tabIds.length > 1) {
      // Keep the first tab, close the rest
      tabIds.slice(1).forEach((tabId) => {
        tabsToClose.push(tabId);
      });
    }
  });

  return tabsToClose;
}

/** CLOSE_DUPLICATE_TABS — keep the first tab per URL and close the rest. */
export function handleCloseDuplicateTabs(_message: ExtensionMessage, sendResponse: SendResponse): boolean {
  chrome.tabs.query({}, (tabs) => {
    const tabsToClose = collectDuplicateTabIds(tabs);

    if (tabsToClose.length > 0) {
      chrome.tabs.remove(tabsToClose, () => {
        safeSendResponse(sendResponse, { success: true, closedCount: tabsToClose.length });
      });
    } else {
      safeSendResponse(sendResponse, { success: true, closedCount: 0 });
    }
  });
  return true; // Asynchronous response
}
