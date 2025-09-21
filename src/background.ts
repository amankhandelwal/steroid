import { addTabToHistory, getPreviousTabId } from './utils/tabHistory';

const TAB_ACCESS_TIMES_KEY = 'tabAccessTimes';

/**
 * Retrieves all tab access times from chrome.storage.local.
 * @returns A promise that resolves to a map of tabId to timestamp.
 */
async function getTabAccessTimes(): Promise<Record<number, number>> {
  const result = await chrome.storage.local.get(TAB_ACCESS_TIMES_KEY);
  return result[TAB_ACCESS_TIMES_KEY] || {};
}

/**
 * Saves the provided tab access times to chrome.storage.local.
 * @param accessTimes The map of tabId to timestamp to save.
 */
async function saveTabAccessTimes(accessTimes: Record<number, number>): Promise<void> {
  await chrome.storage.local.set({ [TAB_ACCESS_TIMES_KEY]: accessTimes });
}

/**
 * Updates the last accessed time for a given tabId.
 * @param tabId The ID of the tab to update.
 */
async function updateTabAccessTime(tabId: number): Promise<void> {
  const accessTimes = await getTabAccessTimes();
  accessTimes[tabId] = Date.now();
  await saveTabAccessTimes(accessTimes);
}

/**
 * This is the background service worker.
 * It is responsible for managing tabs, handling commands, and other core extension logic.
 */
console.log("Steroid background script loaded.");

// Listen for tab activation events to track history and access times
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await addTabToHistory(activeInfo.tabId);
  await updateTabAccessTime(activeInfo.tabId);
});

// Listen for tab update events to track access times (e.g., URL change)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) { // Only update if URL changed, indicating active use
    await updateTabAccessTime(tabId);
  }
});

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "GET_TABS") {
    chrome.tabs.query({}, (tabs) => {
      sendResponse(tabs);
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

  } else if (message.type === "CLOSE_TAB") {
    if (!message.tabId && !message.tabIds) return;
    const tabIdsToClose = message.tabIds || [message.tabId];
    chrome.tabs.remove(tabIdsToClose, () => {
      sendResponse({ success: true });
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
          sendResponse({ success: true, closedCount: tabsToClose.length });
        });
      } else {
        sendResponse({ success: true, closedCount: 0 });
      }
    });
    return true; // Asynchronous response
  } else if (message.type === "SWITCH_TO_PREVIOUS_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (activeTabs) => {
      if (activeTabs.length > 0) {
        const currentTabId = activeTabs[0].id!;
        const previousTabId = await getPreviousTabId(currentTabId);
        if (previousTabId) {
          chrome.tabs.update(previousTabId, { active: true });
          sendResponse({ success: true, tabId: previousTabId });
        } else {
          sendResponse({ success: false, message: "No previous tab found." });
        }
      } else {
        sendResponse({ success: false, message: "No active tab found." });
      }
    });
    return true; // Asynchronous response
  } else if (message.type === "GET_PREVIOUS_TAB_DETAILS") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (activeTabs) => {
      if (activeTabs.length > 0) {
        const currentTabId = activeTabs[0].id!;
        const previousTabId = await getPreviousTabId(currentTabId);
        if (previousTabId) {
          chrome.tabs.get(previousTabId, (tab) => {
            if (tab) {
              sendResponse({ success: true, tabTitle: tab.title, tabUrl: tab.url });
            } else {
              sendResponse({ success: false, message: "Previous tab details not found." });
            }
          });
        } else {
          sendResponse({ success: false, message: "No previous tab found." });
        }
      } else {
        sendResponse({ success: false, message: "No active tab found." });
      }
    });
    return true; // Asynchronous response
  } else if (message.type === "GET_TAB_ACCESS_TIMES") {
    const accessTimes = await getTabAccessTimes();
    sendResponse({ success: true, accessTimes });
    return true; // Asynchronous response
  } else if (message.type === "CREATE_TAB_GROUP") {
    if (!message.tabIds || message.tabIds.length === 0) {
      sendResponse({ success: false, message: "No tab IDs provided for grouping." });
      return true;
    }
    try {
      const groupId = await chrome.tabs.group({
        tabIds: message.tabIds,
      });
      if (message.groupName) {
        await chrome.tabGroups.update(groupId, { title: message.groupName });
      }
      sendResponse({ success: true, groupId });
    } catch (error) {
      console.error("Error creating tab group:", error);
      sendResponse({ success: false, message: `Error creating tab group: ${error.message}` });
    }
    return true; // Asynchronous response
  } else if (message.type === "DELETE_TAB_GROUP") {
    if (!message.groupId) {
      sendResponse({ success: false, message: "No group ID provided for ungrouping." });
      return true;
    }
    try {
      await chrome.tabs.ungroup(message.groupId);
      sendResponse({ success: true });
    } catch (error) {
      console.error("Error ungrouping tabs:", error);
      sendResponse({ success: false, message: `Error ungrouping tabs: ${error.message}` });
    }
    return true; // Asynchronous response
  } else if (message.type === "GET_TAB_GROUPS") {
    try {
      const tabGroups = await chrome.tabGroups.query({});
      sendResponse({ success: true, tabGroups });
    } catch (error) {
      console.error("Error fetching tab groups:", error);
      sendResponse({ success: false, message: `Error fetching tab groups: ${error.message}` });
    }
    return true; // Asynchronous response
  } else if (message.type === "GET_TAB_GROUP_TABS") {
    if (!message.groupId) {
      sendResponse({ success: false, message: "No group ID provided." });
      return true;
    }
    try {
      const group = await chrome.tabGroups.get(message.groupId);
      if (group) {
        const tabsInGroup = await chrome.tabs.query({ groupId: message.groupId });
        sendResponse({ success: true, tabIds: tabsInGroup.map(tab => tab.id!) });
      } else {
        sendResponse({ success: false, message: "Tab group not found." });
      }
    } catch (error) {
      console.error("Error fetching tabs in group:", error);
      sendResponse({ success: false, message: `Error fetching tabs in group: ${error.message}` });
    }
    return true; // Asynchronous response
  }
});
