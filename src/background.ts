/**
 * This is the background service worker.
 * It is responsible for managing tabs, handling commands, and other core extension logic.
 */

import { validateApiKey, setApiKey, smartGroupTabs, TabInfo, WindowSuggestion } from './services/openaiService';

// Inject content script into existing tabs when extension starts/updates
async function injectContentScriptIntoExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      // Skip chrome:// URLs and extension pages as they can't be scripted
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('edge://') && tab.id) {
        try {
          // Check if content script is already injected by testing if the host element exists
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return document.getElementById('steroid-host') !== null;
            }
          });

          const isAlreadyInjected = results[0]?.result;

          if (!isAlreadyInjected) {
            // Inject the content script
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
          } else {
            // Content script already exists
          }
        } catch (error) {
          // Silently ignore injection failures (usually due to protected pages)
          console.debug(`Could not inject into tab ${tab.url}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error injecting content scripts into existing tabs:', error);
  }
}

// Inject into existing tabs when extension starts
chrome.runtime.onStartup.addListener(injectContentScriptIntoExistingTabs);
chrome.runtime.onInstalled.addListener(injectContentScriptIntoExistingTabs);

// Also inject when a tab is activated (in case it was missed)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);

    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('edge://')) {
      try {
        // Check if content script exists
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeInfo.tabId },
          func: () => {
            return document.getElementById('steroid-host') !== null;
          }
        });

        const isAlreadyInjected = results[0]?.result;

        if (!isAlreadyInjected) {
          // Inject the content script
          await chrome.scripting.executeScript({
            target: { tabId: activeInfo.tabId },
            files: ['content.js']
          });
        }
      } catch (error) {
        // Silently ignore injection failures
        console.debug(`Could not inject into activated tab ${tab.url}:`, error);
      }
    }

    // Continue with existing tab history tracking
    await pushTabToHistory(activeInfo.tabId, activeInfo.windowId);
    await updateTabAccessTime(activeInfo.tabId);
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
});

// Constants for tab history management
const MAX_HISTORY_SIZE = 100;
const HISTORY_STORAGE_KEY = 'tabHistory';
const ACCESS_TIME_STORAGE_KEY = 'tabAccessTimes';

// Tab history management utilities
interface TabHistoryEntry {
  tabId: number;
  windowId: number;
  timestamp: number;
}

/**
 * Get the current tab history from storage
 */
async function getTabHistory(): Promise<TabHistoryEntry[]> {
  const result = await chrome.storage.local.get(HISTORY_STORAGE_KEY);
  return result[HISTORY_STORAGE_KEY] || [];
}

/**
 * Save tab history to storage
 */
async function saveTabHistory(history: TabHistoryEntry[]): Promise<void> {
  await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: history });
}

/**
 * Add a tab to the history stack
 */
async function pushTabToHistory(tabId: number, windowId: number): Promise<void> {
  const history = await getTabHistory();
  const timestamp = Date.now();

  // Remove existing entry for this tab (move-to-front behavior)
  const filteredHistory = history.filter(entry => entry.tabId !== tabId);

  // Add new entry at the beginning
  const newHistory = [{ tabId, windowId, timestamp }, ...filteredHistory];

  // Limit history size
  if (newHistory.length > MAX_HISTORY_SIZE) {
    newHistory.splice(MAX_HISTORY_SIZE);
  }

  await saveTabHistory(newHistory);
}

/**
 * Get the previous tab from history (excluding the current tab)
 */
async function getPreviousTab(currentTabId: number): Promise<TabHistoryEntry | null> {
  const history = await getTabHistory();

  // Find the first tab in history that's not the current tab and still exists
  for (const entry of history) {
    if (entry.tabId !== currentTabId) {
      try {
        // Check if tab still exists
        await chrome.tabs.get(entry.tabId);
        return entry;
      } catch (error) {
        // Tab doesn't exist anymore, continue to next
        console.log(`Tab ${entry.tabId} from history no longer exists`, error);
      }
    }
  }

  return null;
}

/**
 * Clean up history by removing closed tabs
 */
async function cleanupTabHistory(): Promise<void> {
  const history = await getTabHistory();
  const cleanedHistory: TabHistoryEntry[] = [];

  for (const entry of history) {
    try {
      // Check if tab still exists
      await chrome.tabs.get(entry.tabId);
      cleanedHistory.push(entry);
    } catch (error) {
      // Tab doesn't exist anymore, skip it
      console.log(`Removing closed tab ${entry.tabId} from history`, error);
    }
  }

  if (cleanedHistory.length !== history.length) {
    await saveTabHistory(cleanedHistory);
  }
}

/**
 * Track tab access times for chronological sorting
 */
async function updateTabAccessTime(tabId: number): Promise<void> {
  const result = await chrome.storage.local.get(ACCESS_TIME_STORAGE_KEY);
  const accessTimes = result[ACCESS_TIME_STORAGE_KEY] || {};

  accessTimes[tabId] = Date.now();

  await chrome.storage.local.set({ [ACCESS_TIME_STORAGE_KEY]: accessTimes });
}

/**
 * Get tab access times
 */
async function getTabAccessTimes(): Promise<Record<number, number>> {
  const result = await chrome.storage.local.get(ACCESS_TIME_STORAGE_KEY);
  return result[ACCESS_TIME_STORAGE_KEY] || {};
}

/**
 * Clean up access times for closed tabs
 */
async function cleanupTabAccessTimes(existingTabIds: number[]): Promise<void> {
  const accessTimes = await getTabAccessTimes();
  const cleanedAccessTimes: Record<number, number> = {};

  // Only keep access times for existing tabs
  existingTabIds.forEach(tabId => {
    if (accessTimes[tabId]) {
      cleanedAccessTimes[tabId] = accessTimes[tabId];
    }
  });

  await chrome.storage.local.set({ [ACCESS_TIME_STORAGE_KEY]: cleanedAccessTimes });
}

// Note: Tab activation listener moved above to handle content script injection

// Listen for tab removal events to clean up history and access times
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    // Clean up history and access times periodically
    await cleanupTabHistory();

    // Get current tabs to clean access times
    const tabs = await chrome.tabs.query({});
    const existingTabIds = tabs.map(tab => tab.id).filter(id => id !== undefined) as number[];
    await cleanupTabAccessTimes(existingTabIds);

  } catch (error) {
    console.error('Error handling tab removal:', error);
  }
});

// Helper function to safely send response with error handling
function safeSendResponse(sendResponse: (response?: any) => void, response: any) {
  try {
    if (chrome.runtime.lastError) {
      console.error('Runtime error before sending response:', chrome.runtime.lastError);
      return;
    }
    sendResponse(response);
  } catch (error) {
    console.error('Error sending response:', error);
  }
}

// Helper function to check if message port is still open
function isPortOpen(): boolean {
  try {
    return !chrome.runtime.lastError;
  } catch {
    return false;
  }
}

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Ensure message and sendResponse are valid
  if (!message || typeof sendResponse !== 'function') {
    console.error('Invalid message or sendResponse function');
    return false;
  }

  if (message.type === "GET_TABS") {
    chrome.tabs.query({}, async (tabs) => {
      try {
        // Get access times for chronological sorting
        const accessTimes = await getTabAccessTimes();

        // Add access time data to each tab
        const tabsWithAccessTime = tabs.map(tab => ({
          ...tab,
          lastAccessed: accessTimes[tab.id!] || 0
        }));

        // Sort by last accessed (most recent first) when no search query
        tabsWithAccessTime.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

        // Limit to most recent tabs for performance
        const limitedTabs = tabsWithAccessTime.slice(0, 50);

        safeSendResponse(sendResponse, limitedTabs);
      } catch (error) {
        console.error('Error fetching tabs with access times:', error);
        safeSendResponse(sendResponse, tabs); // Fallback to original tabs
      }
    });
    return true; // Asynchronous response

  } else if (message.type === "GET_PREVIOUS_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        if (tabs.length === 0) {
          safeSendResponse(sendResponse, { error: 'No active tab found' });
          return;
        }

        const currentTabId = tabs[0].id!;
        const previousTab = await getPreviousTab(currentTabId);

        if (previousTab) {
          // Get tab details
          const tabDetails = await chrome.tabs.get(previousTab.tabId);
          safeSendResponse(sendResponse, {
            success: true,
            tab: tabDetails,
            previousTabEntry: previousTab
          });
        } else {
          safeSendResponse(sendResponse, {
            success: false,
            message: 'No previous tab available'
          });
        }
      } catch (error) {
        console.error('Error getting previous tab:', error);
        safeSendResponse(sendResponse, { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
    return true; // Asynchronous response

  } else if (message.type === "SWITCH_TO_PREVIOUS_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        if (tabs.length === 0) {
          safeSendResponse(sendResponse, { error: 'No active tab found' });
          return;
        }

        const currentTabId = tabs[0].id!;
        const previousTab = await getPreviousTab(currentTabId);

        if (previousTab) {
          // Switch to the previous tab
          chrome.tabs.update(previousTab.tabId, { active: true });
          if (previousTab.windowId) {
            chrome.windows.update(previousTab.windowId, { focused: true });
          }
          safeSendResponse(sendResponse, { success: true });
        } else {
          safeSendResponse(sendResponse, {
            success: false,
            message: 'No previous tab available'
          });
        }
      } catch (error) {
        console.error('Error switching to previous tab:', error);
        safeSendResponse(sendResponse, { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
    return true; // Asynchronous response

  } else if (message.type === "SWITCH_TO_TAB") {
    if (!message.tabId) return;
    chrome.tabs.get(message.tabId, (tab) => {
      chrome.tabs.update(message.tabId, { active: true });
      if (tab.windowId) {
        chrome.windows.update(tab.windowId, { focused: true });
      }
    });
    return true;

  } else if (message.type === "CLOSE_CURRENT_TAB") {
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

  } else if (message.type === "NEW_TAB") {
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

  } else if (message.type === "CLOSE_TAB") {
    // Support both single tabId and array of tabIds
    const tabIds = Array.isArray(message.tabIds) ? message.tabIds : (message.tabId ? [message.tabId] : []);

    if (tabIds.length === 0) {
      safeSendResponse(sendResponse, { success: false, error: 'No tab IDs provided' });
      return;
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

  } else if (message.type === "OPEN_URL") {
    if (!message.url) return;
    chrome.tabs.create({ url: message.url });
    return true;

  } else if (message.type === "CLOSE_DUPLICATE_TABS") {
    chrome.tabs.query({}, (tabs) => {
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


      urlMap.forEach((tabIds, url) => {
        if (tabIds.length > 1) {
          // Keep the first tab, close the rest
          tabIds.slice(1).forEach((tabId) => {
            tabsToClose.push(tabId);
          });
        }
      });


      if (tabsToClose.length > 0) {
        chrome.tabs.remove(tabsToClose, () => {
          safeSendResponse(sendResponse, { success: true, closedCount: tabsToClose.length });
        });
      } else {
        safeSendResponse(sendResponse, { success: true, closedCount: 0 });
      }
    });
    return true; // Asynchronous response

  } else if (message.type === "CREATE_TAB_GROUP") {
    const { tabIds, groupName } = message;

    if (!tabIds || tabIds.length === 0) {
      safeSendResponse(sendResponse, { success: false, error: 'No tab IDs provided' });
      return;
    }

    chrome.tabs.group({ tabIds }, (groupId) => {
      if (chrome.runtime.lastError) {
        console.error('Error creating tab group:', chrome.runtime.lastError.message);
        safeSendResponse(sendResponse, { success: false, error: chrome.runtime.lastError.message });
      } else {
        // Set group name if provided
        if (groupName) {
          chrome.tabGroups.update(groupId, { title: groupName }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error setting group name:', chrome.runtime.lastError.message);
            }
            safeSendResponse(sendResponse, { success: true, groupId, message: `Created group "${groupName}" with ${tabIds.length} tabs` });
          });
        } else {
          const defaultName = `Group ${new Date().toLocaleTimeString()}`;
          chrome.tabGroups.update(groupId, { title: defaultName }, () => {
            safeSendResponse(sendResponse, { success: true, groupId, message: `Created group "${defaultName}" with ${tabIds.length} tabs` });
          });
        }
      }
    });
    return true; // Asynchronous response

  } else if (message.type === "DELETE_TAB_GROUP") {
    const { groupId } = message;

    if (!groupId) {
      safeSendResponse(sendResponse, { success: false, error: 'No group ID provided' });
      return;
    }

    // Get tabs in the group first
    chrome.tabs.query({ groupId }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying group tabs:', chrome.runtime.lastError.message);
        safeSendResponse(sendResponse, { success: false, error: chrome.runtime.lastError.message });
        return;
      }

      const tabIds = tabs.map(tab => tab.id).filter(id => id !== undefined) as number[];

      // Ungroup the tabs (this dissolves the group but keeps the tabs open)
      if (tabIds.length > 0) {
        chrome.tabs.ungroup(tabIds as [number, ...number[]], () => {
          if (chrome.runtime.lastError) {
            console.error('Error ungrouping tabs:', chrome.runtime.lastError.message);
            safeSendResponse(sendResponse, { success: false, error: chrome.runtime.lastError.message });
          } else {
            safeSendResponse(sendResponse, { success: true, message: `Ungrouped ${tabIds.length} tabs` });
          }
        });
      } else {
        safeSendResponse(sendResponse, { success: false, error: 'No tabs found in group' });
      }
    });
    return true; // Asynchronous response

  } else if (message.type === "GET_TAB_GROUPS") {
    chrome.tabGroups.query({}, (groups) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching tab groups:', chrome.runtime.lastError.message);
        safeSendResponse(sendResponse, []);
      } else {
        safeSendResponse(sendResponse, groups);
      }
    });
    return true; // Asynchronous response

  } else if (message.type === "SET_API_KEY") {
    const { apiKey } = message;

    if (!apiKey || typeof apiKey !== 'string') {
      safeSendResponse(sendResponse, { success: false, error: 'No API key provided' });
      return;
    }

    validateApiKey(apiKey).then((isValid) => {
      if (!isValid) {
        safeSendResponse(sendResponse, { success: false, error: 'Invalid API key. Please check and try again.' });
        return;
      }

      setApiKey(apiKey).then(() => {
        safeSendResponse(sendResponse, { success: true });
      }).catch((err) => {
        safeSendResponse(sendResponse, { success: false, error: `Failed to save key: ${err.message}` });
      });
    }).catch((err) => {
      safeSendResponse(sendResponse, { success: false, error: `Validation failed: ${err.message}` });
    });
    return true; // Asynchronous response

  } else if (message.type === "GET_API_KEY_STATUS") {
    chrome.storage.local.get('openai_api_key', (result) => {
      safeSendResponse(sendResponse, { hasKey: !!result.openai_api_key });
    });
    return true; // Asynchronous response

  } else if (message.type === "SMART_GROUP_TABS") {
    handleSmartGroupTabs(sendResponse);
    return true; // Asynchronous response

  } else if (message.type === "UNGROUP_ALL_TABS") {
    handleUngroupAllTabs(sendResponse);
    return true; // Asynchronous response
  }
});

/** Determine the best existing windowId for a set of tabs (most common window) */
function getMostCommonWindowId(tabIds: number[], tabWindowMap: Map<number, number>): number | null {
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

/** Apply groups within a single target window, moving tabs as needed */
async function applyWindowGroups(
  windowSuggestion: WindowSuggestion,
  targetWindowId: number,
  tabWindowMap: Map<number, number>,
  colorIndex: number
): Promise<{ groupCount: number; tabCount: number; nextColorIndex: number }> {
  const colors: chrome.tabGroups.ColorEnum[] = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
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

      const groupId = await chrome.tabs.group({
        tabIds: group.tabIds,
        createProperties: { windowId: targetWindowId }
      });
      await chrome.tabGroups.update(groupId, {
        title: group.groupName,
        color: colors[ci % colors.length]
      });
      groupCount++;
      tabCount += group.tabIds.length;
      ci++;
    } catch (err) {
      console.error(`Failed to create group "${group.groupName}":`, err);
    }
  }

  return { groupCount, tabCount, nextColorIndex: ci };
}

/** Handle smart grouping: fetch ungrouped tabs, call OpenAI, organize into windows and groups */
async function handleSmartGroupTabs(sendResponse: (response?: any) => void): Promise<void> {
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

    // Build a map of tabId -> current windowId for move decisions
    const tabWindowMap = new Map<number, number>();
    for (const tab of ungroupedTabs) {
      tabWindowMap.set(tab.id, tab.windowId);
    }

    let totalGroupCount = 0;
    let totalTabCount = 0;
    let colorIndex = 0;
    const usedWindowIds = new Set<number>();

    for (const windowSuggestion of result.windows) {
      // Collect all tabIds in this window suggestion
      const allTabIds = windowSuggestion.groups.flatMap(g => g.tabIds);
      let targetWindowId = getMostCommonWindowId(allTabIds, tabWindowMap);

      // If this windowId is already taken by a previous suggestion, create a new window
      if (targetWindowId === null || usedWindowIds.has(targetWindowId)) {
        const firstTabId = allTabIds[0];
        const newWindow = await chrome.windows.create({ tabId: firstTabId });
        targetWindowId = newWindow.id!;
        tabWindowMap.set(firstTabId, targetWindowId);
      }

      usedWindowIds.add(targetWindowId);

      const { groupCount, tabCount, nextColorIndex } = await applyWindowGroups(
        windowSuggestion, targetWindowId, tabWindowMap, colorIndex
      );
      totalGroupCount += groupCount;
      totalTabCount += tabCount;
      colorIndex = nextColorIndex;
    }

    safeSendResponse(sendResponse, {
      success: true,
      groupCount: totalGroupCount,
      tabCount: totalTabCount,
      message: `Created ${totalGroupCount} groups with ${totalTabCount} tabs across ${result.windows.length} windows`
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    safeSendResponse(sendResponse, { success: false, error: message });
  }
}

/** Handle ungrouping all tabs in the current window */
async function handleUngroupAllTabs(sendResponse: (response?: any) => void): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });

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
