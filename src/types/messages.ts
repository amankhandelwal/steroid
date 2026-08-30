/** Discriminated union of every runtime message this extension sends. */
export type ExtensionMessage =
  | { type: 'GET_TABS' }
  | { type: 'GET_PREVIOUS_TAB' }
  | { type: 'SWITCH_TO_PREVIOUS_TAB' }
  | { type: 'SWITCH_TO_TAB'; tabId: number }
  | { type: 'CLOSE_CURRENT_TAB' }
  | { type: 'NEW_TAB' }
  | { type: 'CLOSE_TAB'; tabId?: number; tabIds?: number[] }
  | { type: 'OPEN_URL'; url: string }
  | { type: 'CLOSE_DUPLICATE_TABS' }
  | { type: 'CREATE_TAB_GROUP'; tabIds: number[]; groupName?: string }
  | { type: 'DELETE_TAB_GROUP'; groupId: number }
  | { type: 'GET_TAB_GROUPS' }
  | { type: 'SET_API_KEY'; apiKey: string }
  | { type: 'GET_API_KEY_STATUS' }
  | { type: 'SMART_GROUP_TABS' }
  | { type: 'UNGROUP_ALL_TABS' }
  | { type: 'OPEN_PALETTE' };
