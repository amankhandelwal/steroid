/**
 * This is the background service worker.
 * It is responsible for managing tabs, handling commands, and other core extension logic.
 */
console.log("Steroid background script loaded.");

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
            console.log(`Content script injected into tab: ${tab.url}`);
          } else {
            console.log(`Content script already exists in tab: ${tab.url}`);
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
          console.log(`Content script injected into activated tab: ${tab.url}`);
        }
      } catch (error) {
        // Silently ignore injection failures
        console.debug(`Could not inject into activated tab ${tab.url}:`, error);
      }
    }

    // Continue with existing tab history tracking
    await pushTabToHistory(activeInfo.tabId, activeInfo.windowId);
    await updateTabAccessTime(activeInfo.tabId);
    console.log(`Tab activated: ${activeInfo.tabId} in window ${activeInfo.windowId}`);
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
  console.log(`Tab ${tabId} added to history. History size: ${newHistory.length}`);
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
    console.log(`History cleaned. Removed ${history.length - cleanedHistory.length} closed tabs`);
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

    console.log(`Tab removed: ${tabId}. Cleaned up history and access times.`);
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

        // Limit to most recent 50 tabs for performance
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
            console.log('Successfully closed current tab');
            safeSendResponse(sendResponse, { success: true, message: 'Closed current tab' });
          }
        });
      } else {
        safeSendResponse(sendResponse, { success: false, error: 'Current tab has no ID' });
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
        console.log(`Successfully closed ${tabIds.length} tab(s)`);
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

      console.log('All tabs:', tabs);

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

      console.log('URL Map after processing:', urlMap);

      urlMap.forEach((tabIds, url) => {
        if (tabIds.length > 1) {
          console.log(`Found ${tabIds.length} duplicates for URL: ${url}. Keeping tab ID ${tabIds[0]} and closing the rest.`);
          // Keep the first tab, close the rest
          tabIds.slice(1).forEach((tabId) => {
            tabsToClose.push(tabId);
          });
        }
      });

      console.log('Tabs to close:', tabsToClose);

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
            console.log(`Successfully ungrouped ${tabIds.length} tabs from group ${groupId}`);
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
  }
});
