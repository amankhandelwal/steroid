/**
 * Registry of runtime-message handlers.
 *
 * Adding a message type means adding a handler function and one entry here —
 * the background service worker itself stays free of dispatch logic.
 */

import { MessageHandler } from '../types';
import { handleGetApiKeyStatus, handleSetApiKey } from './apiKeyHandlers';
import { handleSmartGroupTabs, handleUngroupAllTabs } from './smartGroupHandlers';
import {
  handleCreateTabGroup,
  handleDeleteTabGroup,
  handleGetTabGroups
} from './tabGroupHandlers';
import {
  handleCloseCurrentTab,
  handleCloseDuplicateTabs,
  handleCloseTab,
  handleGetTabs,
  handleNewTab,
  handleOpenUrl,
  handleSwitchToTab
} from './tabHandlers';
import {
  handleGetPreviousTab,
  handleSwitchToPreviousTab
} from './tabHistoryHandlers';

/** Message type -> handler lookup used by the `chrome.runtime.onMessage` listener. */
export const messageHandlers: Record<string, MessageHandler> = {
  GET_TABS: handleGetTabs,
  GET_PREVIOUS_TAB: handleGetPreviousTab,
  SWITCH_TO_PREVIOUS_TAB: handleSwitchToPreviousTab,
  SWITCH_TO_TAB: handleSwitchToTab,
  CLOSE_CURRENT_TAB: handleCloseCurrentTab,
  NEW_TAB: handleNewTab,
  CLOSE_TAB: handleCloseTab,
  OPEN_URL: handleOpenUrl,
  CLOSE_DUPLICATE_TABS: handleCloseDuplicateTabs,
  CREATE_TAB_GROUP: handleCreateTabGroup,
  DELETE_TAB_GROUP: handleDeleteTabGroup,
  GET_TAB_GROUPS: handleGetTabGroups,
  SET_API_KEY: handleSetApiKey,
  GET_API_KEY_STATUS: handleGetApiKeyStatus,
  SMART_GROUP_TABS: handleSmartGroupTabs,
  UNGROUP_ALL_TABS: handleUngroupAllTabs
};
