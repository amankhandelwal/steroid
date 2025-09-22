/**
 * Core types for the command system
 */

export interface TabItem {
  type: 'tab';
  tab: chrome.tabs.Tab;
}

export interface ActionItem {
  type: 'action';
  id: string;
  title: string;
  action: () => void;
}

export interface CloseTabActionItem {
  type: 'closeTabAction';
  tab: chrome.tabs.Tab;
  title: string;
  id?: string;
}

export interface TabGroupItem {
  type: 'tabGroup';
  group: chrome.tabGroups.TabGroup;
  title: string;
  id: string;
}

export type SearchResultItem = TabItem | ActionItem | CloseTabActionItem | TabGroupItem;

export interface CommandContext {
  tabs: chrome.tabs.Tab[];
  tabGroups: chrome.tabGroups.TabGroup[];
  selectedTabIds: Set<number>;
  query: string;
  commandMode: boolean;
  activeCommand: string | null;
}

export interface CommandExecutionResult {
  success: boolean;
  message?: string;
  shouldCloseModal?: boolean;
  shouldEnterCommandMode?: boolean;
  newCommandName?: string;
  error?: string;
}

export interface CommandExecutionContext {
  query: string;
  selectedTabIds: Set<number>;
  commandMode: boolean;
  tabGroups: chrome.tabGroups.TabGroup[];
  onClose: () => void;
  setCommandMode: (mode: boolean) => void;
  setActiveCommand: (command: string | null) => void;
  setSelectedTabIds: (ids: Set<number>) => void;
  setQuery: (query: string) => void;
  fetchTabs: () => void;
  fetchTabGroups: () => void;
}