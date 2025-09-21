// src/utils/tabHistory.ts

const TAB_HISTORY_KEY = 'tabHistory';
const MAX_HISTORY_SIZE = 100;

/**
 * Retrieves the tab history from chrome.storage.local.
 * @returns A promise that resolves to an array of tab IDs.
 */
export async function getTabHistory(): Promise<number[]> {
  const result = await chrome.storage.local.get(TAB_HISTORY_KEY);
  return result[TAB_HISTORY_KEY] || [];
}

/**
 * Saves the provided tab history to chrome.storage.local.
 * @param history The array of tab IDs to save.
 */
async function saveTabHistory(history: number[]): Promise<void> {
  await chrome.storage.local.set({ [TAB_HISTORY_KEY]: history });
}

/**
 * Adds a tab ID to the history, ensuring no duplicates and maintaining max size.
 * If the tabId already exists, it's moved to the front (most recent).
 * @param tabId The ID of the tab to add to history.
 */
export async function addTabToHistory(tabId: number): Promise<void> {
  let history = await getTabHistory();

  // Remove existing entry to implement "move to front"
  history = history.filter(id => id !== tabId);

  // Add the new tabId to the front
  history.unshift(tabId);

  // Trim history to max size
  if (history.length > MAX_HISTORY_SIZE) {
    history = history.slice(0, MAX_HISTORY_SIZE);
  }

  await saveTabHistory(history);
}

/**
 * Retrieves the tab ID that was active immediately before the currentTabId.
 * @param currentTabId The ID of the currently active tab.
 * @returns The ID of the previous tab, or null if not found.
 */
export async function getPreviousTabId(currentTabId: number): Promise<number | null> {
  const history = await getTabHistory();

  // Find the index of the current tab in the history
  const currentIndex = history.indexOf(currentTabId);

  // If current tab is found and there's a tab before it
  if (currentIndex !== -1 && currentIndex + 1 < history.length) {
    return history[currentIndex + 1];
  }

  return null;
}
