/**
 * This is the background service worker.
 * It is responsible for managing tabs, handling commands, and other core extension logic.
 *
 * Its only job here is wiring: Chrome event listeners in, handler modules out.
 * Message-type logic lives in `./background/handlers`.
 */

import { injectContentScriptIntoExistingTabs } from './background/contentScriptInjector';
import { messageHandlers } from './background/handlers';
import {
  cleanupTabAccessTimes,
  cleanupTabHistory,
  pushTabToHistory,
  updateTabAccessTime
} from './background/tabHistory';

// Inject into existing tabs when extension starts
chrome.runtime.onStartup.addListener(injectContentScriptIntoExistingTabs);
chrome.runtime.onInstalled.addListener(injectContentScriptIntoExistingTabs);

// Clicking the toolbar icon opens the palette on the active tab (no
// `default_popup` is declared, so `onClicked` fires as expected).
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    chrome.tabs.sendMessage(tab.id, { type: 'OPEN_PALETTE' });
  }
});

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

// Note: Tab activation listener moved above to handle content script injection

// Listen for tab removal events to clean up history and access times
chrome.tabs.onRemoved.addListener(async () => {
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

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Ensure message and sendResponse are valid
  if (!message || typeof sendResponse !== 'function') {
    console.error('Invalid message or sendResponse function');
    return false;
  }

  const handler = messageHandlers[message.type];
  if (!handler) {
    console.warn('Unknown message type:', message?.type);
    return false;
  }

  return handler(message, sendResponse);
});
