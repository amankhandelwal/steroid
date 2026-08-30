/**
 * Message handlers for manual tab-group management.
 */

import { safeSendResponse } from '../messaging';
import { ExtensionMessage, SendResponse } from '../types';

/**
 * Title a freshly created group and reply once Chrome has applied the title.
 * Falls back to a timestamped name when the caller supplied none.
 */
function titleNewGroup(
  groupId: number,
  tabCount: number,
  groupName: string | undefined,
  sendResponse: SendResponse
): void {
  // Set group name if provided
  if (groupName) {
    chrome.tabGroups.update(groupId, { title: groupName }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error setting group name:', chrome.runtime.lastError.message);
      }
      safeSendResponse(sendResponse, { success: true, groupId, message: `Created group "${groupName}" with ${tabCount} tabs` });
    });
    return;
  }

  const defaultName = `Group ${new Date().toLocaleTimeString()}`;
  chrome.tabGroups.update(groupId, { title: defaultName }, () => {
    safeSendResponse(sendResponse, { success: true, groupId, message: `Created group "${defaultName}" with ${tabCount} tabs` });
  });
}

/** CREATE_TAB_GROUP — group the given tabs and give the group a title. */
export function handleCreateTabGroup(
  message: ExtensionMessage,
  sendResponse: SendResponse
): boolean | undefined {
  const tabIds = message.tabIds as [number, ...number[]] | undefined;
  const groupName = message.groupName as string | undefined;

  if (!tabIds || tabIds.length === 0) {
    safeSendResponse(sendResponse, { success: false, error: 'No tab IDs provided' });
    return undefined;
  }

  chrome.tabs.group({ tabIds }, (groupId) => {
    if (chrome.runtime.lastError) {
      console.error('Error creating tab group:', chrome.runtime.lastError.message);
      safeSendResponse(sendResponse, { success: false, error: chrome.runtime.lastError.message });
    } else {
      titleNewGroup(groupId, tabIds.length, groupName, sendResponse);
    }
  });
  return true; // Asynchronous response
}

/** DELETE_TAB_GROUP — dissolve a group, keeping its tabs open. */
export function handleDeleteTabGroup(
  message: ExtensionMessage,
  sendResponse: SendResponse
): boolean | undefined {
  const groupId = message.groupId as number | undefined;

  if (!groupId) {
    safeSendResponse(sendResponse, { success: false, error: 'No group ID provided' });
    return undefined;
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
}

/** GET_TAB_GROUPS — list all tab groups, replying with `[]` on failure. */
export function handleGetTabGroups(_message: ExtensionMessage, sendResponse: SendResponse): boolean {
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
