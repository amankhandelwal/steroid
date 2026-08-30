/**
 * Message handlers backed by the tab history stack (the "previous tab" flow).
 */

import { safeSendResponse } from '../messaging';
import { getPreviousTab } from '../tabHistory';
import { ExtensionMessage, SendResponse } from '../types';

/** GET_PREVIOUS_TAB — report the most recent tab other than the active one. */
export function handleGetPreviousTab(_message: ExtensionMessage, sendResponse: SendResponse): boolean {
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
}

/** SWITCH_TO_PREVIOUS_TAB — activate the most recent tab other than the active one. */
export function handleSwitchToPreviousTab(_message: ExtensionMessage, sendResponse: SendResponse): boolean {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    try {
      if (tabs.length === 0) {
        safeSendResponse(sendResponse, { error: 'No active tab found' });
        return;
      }

      const currentTabId = tabs[0].id!;
      const previousTab = await getPreviousTab(currentTabId);

      if (previousTab) {
        // Switch to the previous tab, awaiting both Chrome calls so a silent
        // failure is reported instead of a false success.
        await chrome.tabs.update(previousTab.tabId, { active: true });
        if (previousTab.windowId) {
          await chrome.windows.update(previousTab.windowId, { focused: true });
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
      safeSendResponse(sendResponse, { success: false, message: 'Could not switch to previous tab' });
    }
  });
  return true; // Asynchronous response
}
