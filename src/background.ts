/**
 * This is the background service worker.
 * It is responsible for managing tabs, handling commands, and other core extension logic.
 */
console.log("Steroid background script loaded.");

interface TabHistoryState {
  previousTabIds: number[];
  tabAccessTimes: Record<number, number>;
}

const MAX_HISTORY_SIZE = 100;
const STORAGE_KEY = 'tabHistoryState';

class TabStateManager {
  private previousTabIds: number[] = [];
  private tabAccessTimes: Record<number, number> = {};
  private currentActiveTabId: number | null = null;

  constructor() {
    this.loadState();
    this.setupListeners();
  }

  private async loadState() {
    const storedState = await chrome.storage.local.get(STORAGE_KEY);
    if (storedState[STORAGE_KEY]) {
      const state: TabHistoryState = storedState[STORAGE_KEY];
      this.previousTabIds = state.previousTabIds || [];
      this.tabAccessTimes = state.tabAccessTimes || {};
    }
    console.log('TabStateManager loaded state:', { previousTabIds: this.previousTabIds, tabAccessTimes: this.tabAccessTimes });
  }

  private async saveState() {
    const state: TabHistoryState = {
      previousTabIds: this.previousTabIds,
      tabAccessTimes: this.tabAccessTimes,
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    console.log('TabStateManager saved state.');
  }

  private setupListeners() {
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
  }

  private async handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo) {
    const now = Date.now();
    this.tabAccessTimes[activeInfo.tabId] = now;

    // Update previousTabIds stack
    const index = this.previousTabIds.indexOf(activeInfo.tabId);
    if (index > -1) {
      this.previousTabIds.splice(index, 1); // Remove existing entry
    }
    if (this.currentActiveTabId !== null && this.currentActiveTabId !== activeInfo.tabId) {
      this.previousTabIds.unshift(this.currentActiveTabId); // Add previous active tab to the front
    }
    this.currentActiveTabId = activeInfo.tabId;

    // Trim history to MAX_HISTORY_SIZE
    if (this.previousTabIds.length > MAX_HISTORY_SIZE) {
      this.previousTabIds = this.previousTabIds.slice(0, MAX_HISTORY_SIZE);
    }

    await this.saveState();
    console.log('Tab activated:', activeInfo.tabId, 'History:', this.previousTabIds);
  }

  private async handleTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
    if (changeInfo.status === 'complete') {
      this.tabAccessTimes[tabId] = Date.now();
      await this.saveState();
    }
  }

  private async handleTabRemoved(tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) {
    delete this.tabAccessTimes[tabId];
    this.previousTabIds = this.previousTabIds.filter(id => id !== tabId);
    if (this.currentActiveTabId === tabId) {
      this.currentActiveTabId = null; // Reset if the removed tab was the active one
    }
    await this.saveState();
    console.log('Tab removed:', tabId, 'History:', this.previousTabIds);
  }

  public getTabAccessTimes(): Record<number, number> {
    return { ...this.tabAccessTimes };
  }

  public async getPreviousTabId(): Promise<number | null> {
    // Filter out tabs that no longer exist
    const existingTabs = await chrome.tabs.query({});
    const existingTabIds = new Set(existingTabs.map(tab => tab.id!));
    this.previousTabIds = this.previousTabIds.filter(id => existingTabIds.has(id));
    await this.saveState(); // Save state after cleaning up history

    return this.previousTabIds.length > 0 ? this.previousTabIds[0] : null;
  }

  public async switchBackToPreviousTab(): Promise<{ success: boolean; tabId?: number; message?: string }> {
    const previousTabId = await this.getPreviousTabId();
    if (previousTabId) {
      try {
        const tab = await chrome.tabs.get(previousTabId);
        await chrome.tabs.update(previousTabId, { active: true });
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        // Remove the switched tab from history as it's now active
        this.previousTabIds = this.previousTabIds.filter(id => id !== previousTabId);
        this.currentActiveTabId = previousTabId; // Update current active tab
        await this.saveState();
        return { success: true, tabId: previousTabId };
      } catch (error: any) {
        console.error('Error switching to previous tab:', error);
        return { success: false, message: `Error switching to previous tab: ${error.message}` };
      }
    }
    return { success: false, message: 'No previous tab in history.' };
  }
}

const tabStateManager = new TabStateManager();

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "GET_TABS") {
    console.log("GET_TABS message received.");
    chrome.tabs.query({}, (tabs) => {
      console.log("Tabs queried:", tabs);
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
    const response = await tabStateManager.switchBackToPreviousTab();
    sendResponse(response);
    return true;
  } else if (message.type === "GET_PREVIOUS_TAB_DETAILS") {
    const previousTabId = await tabStateManager.getPreviousTabId();
    if (previousTabId) {
      try {
        const tab = await chrome.tabs.get(previousTabId);
        sendResponse({ success: true, tabTitle: tab.title, tabUrl: tab.url });
      } catch (error: any) {
        console.error('Error getting previous tab details:', error);
        sendResponse({ success: false, message: `Error getting previous tab details: ${error.message}` });
      }
    } else {
      sendResponse({ success: false, message: "No previous tab in history." });
    }
    return true;
  } else if (message.type === "GET_TAB_ACCESS_TIMES") {
    sendResponse({ success: true, accessTimes: tabStateManager.getTabAccessTimes() });
    return true;
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