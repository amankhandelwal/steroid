/**
 * useCommandPalette - Custom hook for command palette business logic
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { commandRegistry, initializeCommands } from '../commands';
import type { BaseCommand } from '../commands';
import type { CommandContext, PreviousTabInfo, SearchResultItem, CommandExecutionContext } from '../commands/CommandTypes';
import { sendMessageSafely, debounce } from '../utils/errorHandling';
import type { ExtensionMessage } from '../types/messages';

export interface UseCommandPaletteReturn {
  // State
  query: string;
  tabs: chrome.tabs.Tab[];
  tabGroups: chrome.tabGroups.TabGroup[];
  searchResults: SearchResultItem[];
  activeItemIndex: number;
  commandMode: boolean;
  activeCommand: string | null;
  selectedTabIds: Set<number>;
  showInputDialog: boolean;
  inputConfig: {
    title: string;
    placeholder?: string;
    defaultValue?: string;
    inputType?: 'text' | 'password';
    submitLabel?: string;
  } | null;
  loadingMessage: string | null;
  errorMessage: string | null;

  // Actions
  setQuery: (query: string) => void;
  setActiveItemIndex: (index: number | ((prev: number) => number)) => void;
  setCommandMode: (mode: boolean) => void;
  setActiveCommand: (command: string | null) => void;
  setSelectedTabIds: (ids: Set<number>) => void;
  toggleTabSelection: (tabId: number) => void;
  toggleGroupSelection: (groupId: number) => void;
  clearSelection: () => void;
  selectAll: () => void;
  fetchTabs: () => void;
  fetchTabGroups: () => void;
  executeCommand: (commandId: string, inputValue?: string, selectedGroupId?: number) => Promise<void>;
  executeCurrentCommand: () => Promise<void>;
  handleInputSubmit: (value: string) => void;
  handleInputCancel: () => void;
  reset: () => void;

  // Computed
  totalItems: number;
  hasSelection: boolean;
  currentCommand: BaseCommand | null;
}

export function useCommandPalette(onClose: () => void): UseCommandPaletteReturn {
  // Initialize commands on first use
  useEffect(() => {
    initializeCommands();
  }, []);

  // State
  const [queryState, setQueryState] = useState('');
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [tabGroups, setTabGroups] = useState<chrome.tabGroups.TabGroup[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [commandMode, setCommandMode] = useState(false);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());
  const [showInputDialog, setShowInputDialog] = useState(false);
  const [inputConfig, setInputConfig] = useState<{
    title: string;
    placeholder?: string;
    defaultValue?: string;
  } | null>(null);
  const [pendingCommandExecution, setPendingCommandExecution] = useState<{
    commandId: string;
    context: CommandExecutionContext;
  } | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<PreviousTabInfo | null>(null);

  // Debounced query setter for performance
  const debouncedSetQuery = useMemo(
    () => debounce((newQuery: string) => setQueryState(newQuery), 150),
    []
  );

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery); // Immediate update for UI responsiveness
    setErrorMessage(null); // Clear error when user starts typing
    debouncedSetQuery(newQuery); // Debounced update for search logic
  }, [debouncedSetQuery]);

  // Fetch tabs
  const fetchTabs = useCallback(async () => {
    const message: ExtensionMessage = { type: 'GET_TABS' };
    const response = await sendMessageSafely(message, 'fetchTabs');
    if (response) {
      setTabs(response);
    }
  }, []);

  // Fetch tab groups
  const fetchTabGroups = useCallback(async () => {
    const message: ExtensionMessage = { type: 'GET_TAB_GROUPS' };
    const response = await sendMessageSafely(message, 'fetchTabGroups');
    if (response) {
      setTabGroups(response);
    }
  }, []);

  // Fetch the previous tab's info (for the "Previous Tab" suggestion title).
  // A failed lookup (no history yet) resolves to null rather than throwing.
  const fetchPreviousTab = useCallback(async () => {
    const message: ExtensionMessage = { type: 'GET_PREVIOUS_TAB' };
    const response = await sendMessageSafely<{ success: boolean; tab?: chrome.tabs.Tab }>(
      message,
      'fetchPreviousTab'
    );

    if (response?.success && response.tab) {
      setPreviousTab({
        tabId: response.tab.id!,
        title: response.tab.title || 'Untitled',
        url: response.tab.url
      });
    } else {
      setPreviousTab(null);
    }
  }, []);

  // Initialize data on mount
  useEffect(() => {
    fetchTabs();
    fetchTabGroups();
    fetchPreviousTab();
  }, [fetchTabs, fetchTabGroups, fetchPreviousTab]);

  // Get current command (only when explicitly set, not from query parsing)
  const currentCommand = useMemo(() => {
    if (activeCommand) {
      return commandRegistry.getCommand(activeCommand) ?? null;
    }
    return null;
  }, [activeCommand]);

  // Fuzzy matcher over open tabs. Rebuilt only when the tab list changes,
  // never per keystroke.
  const tabFuse = useMemo(
    () => new Fuse(tabs, {
      keys: ['title', 'url'],
      threshold: 0.35,
      ignoreLocation: true
    }),
    [tabs]
  );

  // Generate search results
  const searchResults = useMemo(() => {

    const context: CommandContext = {
      tabs,
      tabGroups,
      selectedTabIds,
      query: queryState,
      commandMode,
      activeCommand,
      previousTab
    };

    if (currentCommand && commandMode) {
      // Only use single command mode when explicitly in command mode
      let results = currentCommand.getSearchResults(context);

      // In command mode, filter out already-selected tabs and fully-selected
      // tab groups (every one of the group's member tabs is already selected).
      if (selectedTabIds.size > 0) {
        results = results.filter(item => {
          if (item.type === 'tab') {
            return !selectedTabIds.has(item.tab.id!);
          }
          if (item.type === 'tabGroup') {
            const memberTabIds = tabs
              .filter(tab => tab.groupId === item.group.id)
              .map(tab => tab.id!);
            const fullySelected = memberTabIds.length > 0 &&
              memberTabIds.every(id => selectedTabIds.has(id));
            return !fullySelected;
          }
          return true;
        });
      }

      return results;
    }

    // Default: show command suggestions and tabs
    if (!queryState.trim()) {
      // Empty query - show recent tabs
      const recentTabs = tabs.slice(0, 30).map(tab => ({
        type: 'tab' as const,
        tab
      }));
      return recentTabs;
    }

    // Show command suggestions
    const suggestions = commandRegistry.getCommandSuggestions(queryState, context);

    // Also show fuzzily-matching tabs (tolerates typos / transposed letters)
    const matchingTabs = tabFuse
      .search(queryState)
      .map(result => result.item)
      .slice(0, 30)
      .map(tab => ({
        type: 'tab' as const,
        tab
      }));

    // Also show tab groups whose title matches the query
    const lowerQuery = queryState.toLowerCase();
    const matchingTabGroups = tabGroups
      .filter(group => group.title && group.title.toLowerCase().includes(lowerQuery))
      .map(group => ({
        type: 'tabGroup' as const,
        group,
        title: group.title || `Group ${group.id}`,
        id: `group-${group.id}`
      }));

    // Add fallback Google search option if no commands match
    const fallbackSearch = suggestions.length === 0 ? [{
      type: 'action' as const,
      id: 'fallback-google-search',
      title: `Search "${queryState}" on Google`,
      action: () => {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(queryState)}`;
        const message: ExtensionMessage = { type: 'OPEN_URL', url: searchUrl };
        chrome.runtime.sendMessage(message);
      }
    }] : [];

    const finalResults = [...suggestions, ...matchingTabGroups, ...matchingTabs, ...fallbackSearch];
    return finalResults;
  }, [tabs, tabGroups, selectedTabIds, queryState, commandMode, activeCommand, currentCommand, tabFuse, previousTab]);

  // Selection management
  const toggleTabSelection = useCallback((tabId: number) => {
    setSelectedTabIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tabId)) {
        newSet.delete(tabId);
      } else {
        newSet.add(tabId);
      }
      return newSet;
    });
  }, []);

  // Toggle selection for an entire tab group: resolves to its current member
  // tab IDs and adds/removes all of them from selectedTabIds in one step.
  // A partially-selected group is treated as "not fully selected" and gets
  // filled in to fully-selected rather than toggled off.
  const toggleGroupSelection = useCallback((groupId: number) => {
    const memberTabIds = tabs
      .filter(tab => tab.groupId === groupId)
      .map(tab => tab.id!)
      .filter(id => id !== undefined);

    setSelectedTabIds(prev => {
      const allSelected = memberTabIds.every(id => prev.has(id));
      const newSet = new Set(prev);
      if (allSelected) {
        memberTabIds.forEach(id => newSet.delete(id));
      } else {
        memberTabIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  }, [tabs]);

  const clearSelection = useCallback(() => {
    setSelectedTabIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    const allTabIds = new Set(tabs.map(tab => tab.id!).filter(id => id !== undefined));
    setSelectedTabIds(allTabIds);
  }, [tabs]);

  // Execute specific command by ID
  const executeCommand = useCallback(async (commandId: string, inputValue?: string, selectedGroupId?: number) => {

    const context: CommandExecutionContext = {
      query: inputValue || queryState,
      selectedTabIds,
      selectedGroupId,
      commandMode,
      tabGroups,
      onClose,
      setCommandMode,
      setActiveCommand,
      setSelectedTabIds,
      setQuery,
      fetchTabs,
      fetchTabGroups
    };

    try {
      // Clear any previous error
      setErrorMessage(null);

      // Show loading message if the command declares one
      const command = commandRegistry.getCommand(commandId);
      if (command?.loadingMessage) {
        setLoadingMessage(command.loadingMessage);
      }

      const result = await commandRegistry.executeCommand(commandId, context);

      // Clear loading state
      setLoadingMessage(null);

      if (result.success) {
        if (result.needsInput && result.inputConfig) {
          // Command needs additional input - show input dialog
          setInputConfig(result.inputConfig);
          setShowInputDialog(true);
          setPendingCommandExecution({ commandId, context });
          return;
        }

        if (result.shouldCloseModal) {
          onClose();
        }

        if (result.shouldEnterCommandMode) {
          setCommandMode(true);
          if (result.newCommandName) {
            setActiveCommand(result.newCommandName);
          }
        }
      } else if (result.error) {
        setErrorMessage(result.error);
      }
    } catch (error) {
      setLoadingMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  }, [queryState, selectedTabIds, commandMode, onClose, fetchTabs, fetchTabGroups]);

  // Execute current command
  const executeCurrentCommand = useCallback(async () => {
    if (!currentCommand) {
      return;
    }

    // Check if the highlighted item is a tab group
    const activeItem = searchResults[activeItemIndex];
    let selectedGroupId: number | undefined;

    if (activeItem && activeItem.type === 'tabGroup') {
      selectedGroupId = activeItem.group.id;
    }

    await executeCommand(currentCommand.id, undefined, selectedGroupId);
  }, [currentCommand, executeCommand, searchResults, activeItemIndex]);

  // Handle input dialog submission
  const handleInputSubmit = useCallback((value: string) => {
    if (pendingCommandExecution) {
      // Execute the command with the provided input value
      const context = {
        ...pendingCommandExecution.context,
        query: value
      };

      setLoadingMessage('Processing...');

      commandRegistry.executeCommand(pendingCommandExecution.commandId, context).then((result) => {
        setLoadingMessage(null);
        if (result.success && result.shouldCloseModal) {
          onClose();
        } else if (!result.success && result.error) {
          setErrorMessage(result.error);
        }
      }).catch((error) => {
        setLoadingMessage(null);
        setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
      });
    }

    // Hide input dialog and clear pending execution
    setShowInputDialog(false);
    setInputConfig(null);
    setPendingCommandExecution(null);
  }, [pendingCommandExecution, onClose]);

  // Handle input dialog cancellation
  const handleInputCancel = useCallback(() => {
    setShowInputDialog(false);
    setInputConfig(null);
    setPendingCommandExecution(null);
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setQueryState('');
    setActiveItemIndex(0);
    setCommandMode(false);
    setActiveCommand(null);
    setSelectedTabIds(new Set());
    setShowInputDialog(false);
    setInputConfig(null);
    setPendingCommandExecution(null);
    setLoadingMessage(null);
    setErrorMessage(null);
  }, []);

  // Computed values
  const totalItems = searchResults.length;
  const hasSelection = selectedTabIds.size > 0;

  return {
    // State
    query: queryState,
    tabs,
    tabGroups,
    searchResults,
    activeItemIndex,
    commandMode,
    activeCommand,
    selectedTabIds,
    showInputDialog,
    inputConfig,
    loadingMessage,
    errorMessage,

    // Actions
    setQuery,
    setActiveItemIndex,
    setCommandMode,
    setActiveCommand,
    setSelectedTabIds,
    toggleTabSelection,
    toggleGroupSelection,
    clearSelection,
    selectAll,
    fetchTabs,
    fetchTabGroups,
    executeCommand,
    executeCurrentCommand,
    handleInputSubmit,
    handleInputCancel,
    reset,

    // Computed
    totalItems,
    hasSelection,
    currentCommand
  };
}