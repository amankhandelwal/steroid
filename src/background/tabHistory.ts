/**
 * Tab history and tab access-time tracking, persisted in chrome.storage.local.
 *
 * Every read-modify-write cycle goes through `serializeStorageWrite` so that
 * bursts of tab events cannot clobber each other's writes.
 */

import { serializeStorageWrite } from './storage';

// Constants for tab history management
const MAX_HISTORY_SIZE = 100;
const HISTORY_STORAGE_KEY = 'tabHistory';
const ACCESS_TIME_STORAGE_KEY = 'tabAccessTimes';

// Tab history management utilities
export interface TabHistoryEntry {
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
export async function pushTabToHistory(tabId: number, windowId: number): Promise<void> {
  return serializeStorageWrite(HISTORY_STORAGE_KEY, async () => {
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
  });
}

/**
 * Get the previous tab from history (excluding the current tab)
 */
export async function getPreviousTab(currentTabId: number): Promise<TabHistoryEntry | null> {
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
        console.debug(`Tab ${entry.tabId} from history no longer exists`, error);
      }
    }
  }

  return null;
}

/**
 * Clean up history by removing closed tabs
 */
export async function cleanupTabHistory(): Promise<void> {
  return serializeStorageWrite(HISTORY_STORAGE_KEY, async () => {
    const history = await getTabHistory();
    const cleanedHistory: TabHistoryEntry[] = [];

    for (const entry of history) {
      try {
        // Check if tab still exists
        await chrome.tabs.get(entry.tabId);
        cleanedHistory.push(entry);
      } catch (error) {
        // Tab doesn't exist anymore, skip it
        console.debug(`Removing closed tab ${entry.tabId} from history`, error);
      }
    }

    if (cleanedHistory.length !== history.length) {
      await saveTabHistory(cleanedHistory);
    }
  });
}

/**
 * Track tab access times for chronological sorting
 */
export async function updateTabAccessTime(tabId: number): Promise<void> {
  return serializeStorageWrite(ACCESS_TIME_STORAGE_KEY, async () => {
    const result = await chrome.storage.local.get(ACCESS_TIME_STORAGE_KEY);
    const accessTimes = result[ACCESS_TIME_STORAGE_KEY] || {};

    accessTimes[tabId] = Date.now();

    await chrome.storage.local.set({ [ACCESS_TIME_STORAGE_KEY]: accessTimes });
  });
}

/**
 * Get tab access times
 */
export async function getTabAccessTimes(): Promise<Record<number, number>> {
  const result = await chrome.storage.local.get(ACCESS_TIME_STORAGE_KEY);
  return result[ACCESS_TIME_STORAGE_KEY] || {};
}

/**
 * Clean up access times for closed tabs
 */
export async function cleanupTabAccessTimes(existingTabIds: number[]): Promise<void> {
  return serializeStorageWrite(ACCESS_TIME_STORAGE_KEY, async () => {
    const accessTimes = await getTabAccessTimes();
    const cleanedAccessTimes: Record<number, number> = {};

    // Only keep access times for existing tabs
    existingTabIds.forEach(tabId => {
      if (accessTimes[tabId]) {
        cleanedAccessTimes[tabId] = accessTimes[tabId];
      }
    });

    await chrome.storage.local.set({ [ACCESS_TIME_STORAGE_KEY]: cleanedAccessTimes });
  });
}
