/**
 * useCommandPalette - Custom hook for command palette business logic
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { commandRegistry, initializeCommands } from '../commands';
import type { CommandContext, SearchResultItem, CommandExecutionContext } from '../commands/CommandTypes';
import { sendMessageSafely, logError, debounce } from '../utils/errorHandling';

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

  // Actions
  setQuery: (query: string) => void;
  setActiveItemIndex: (index: number) => void;
  setCommandMode: (mode: boolean) => void;
  setActiveCommand: (command: string | null) => void;
  setSelectedTabIds: (ids: Set<number>) => void;
  toggleTabSelection: (tabId: number) => void;
  clearSelection: () => void;
  selectAll: () => void;
  fetchTabs: () => void;
  fetchTabGroups: () => void;
  executeCurrentCommand: () => Promise<void>;
  reset: () => void;

  // Computed
  totalItems: number;
  hasSelection: boolean;
  currentCommand: any; // BaseCommand | null
}

export function useCommandPalette(onClose: () => void): UseCommandPaletteReturn {
  // Initialize commands on first use
  useEffect(() => {
    initializeCommands();
  }, []);

  // State
  const [query, setQueryState] = useState('');
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [tabGroups, setTabGroups] = useState<chrome.tabGroups.TabGroup[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [commandMode, setCommandMode] = useState(false);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());

  // Debounced query setter for performance
  const debouncedSetQuery = useMemo(
    () => debounce((newQuery: string) => setQueryState(newQuery), 150),
    []
  );

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery); // Immediate update for UI responsiveness
    debouncedSetQuery(newQuery); // Debounced update for search logic
  }, [debouncedSetQuery]);

  const query = queryState;

  // Fetch tabs
  const fetchTabs = useCallback(async () => {
    const response = await sendMessageSafely({ type: 'GET_TABS' }, 'fetchTabs');
    if (response) {
      setTabs(response);
    }
  }, []);

  // Fetch tab groups
  const fetchTabGroups = useCallback(async () => {
    const response = await sendMessageSafely({ type: 'GET_TAB_GROUPS' }, 'fetchTabGroups');
    if (response) {
      setTabGroups(response);
    }
  }, []);

  // Initialize data on mount
  useEffect(() => {
    fetchTabs();
    fetchTabGroups();
  }, [fetchTabs, fetchTabGroups]);

  // Get current command
  const currentCommand = useMemo(() => {
    if (activeCommand) {
      return commandRegistry.getCommand(activeCommand);
    }

    // Try to find command from query
    const { command } = commandRegistry.parseQuery(query);
    return command;
  }, [query, activeCommand]);

  // Generate search results
  const searchResults = useMemo(() => {
    const context: CommandContext = {
      tabs,
      tabGroups,
      selectedTabIds,
      query,
      commandMode,
      activeCommand
    };

    if (currentCommand) {
      // If we have a specific command, get its search results
      let results = currentCommand.getSearchResults(context);

      // In command mode, filter out already selected tabs
      if (commandMode && selectedTabIds.size > 0) {
        results = results.filter(item => {
          if (item.type === 'tab') {
            return !selectedTabIds.has(item.tab.id!);
          }
          return true;
        });
      }

      return results;
    }

    // No specific command, show command suggestions and tabs
    if (!query.trim()) {
      // Empty query - show recent tabs
      return tabs.slice(0, 10).map(tab => ({
        type: 'tab' as const,
        tab
      }));
    }

    // Show command suggestions
    const suggestions = commandRegistry.getCommandSuggestions(query);

    // Also show matching tabs
    const lowerQuery = query.toLowerCase();
    const matchingTabs = tabs
      .filter(tab =>
        tab.title?.toLowerCase().includes(lowerQuery) ||
        tab.url?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5)
      .map(tab => ({
        type: 'tab' as const,
        tab
      }));

    return [...suggestions, ...matchingTabs];
  }, [tabs, tabGroups, selectedTabIds, query, commandMode, activeCommand, currentCommand]);

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

  const clearSelection = useCallback(() => {
    setSelectedTabIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    const allTabIds = new Set(tabs.map(tab => tab.id!).filter(id => id !== undefined));
    setSelectedTabIds(allTabIds);
  }, [tabs]);

  // Execute current command
  const executeCurrentCommand = useCallback(async () => {
    if (!currentCommand) {
      return;
    }

    const context: CommandExecutionContext = {
      query,
      selectedTabIds,
      commandMode,
      onClose,
      setCommandMode,
      setActiveCommand,
      setSelectedTabIds,
      setQuery,
      fetchTabs,
      fetchTabGroups
    };

    try {
      const result = await commandRegistry.executeCommand(currentCommand.id, context);

      if (result.success) {
        console.log('Command executed successfully:', result.message);

        if (result.shouldCloseModal) {
          onClose();
        }

        if (result.shouldEnterCommandMode) {
          setCommandMode(true);
          if (result.newCommandName) {
            setActiveCommand(result.newCommandName);
          }
        }
      } else {
        console.error('Command execution failed:', result.error);
      }
    } catch (error) {
      console.error('Error executing command:', error);
    }
  }, [currentCommand, query, selectedTabIds, commandMode, onClose, fetchTabs, fetchTabGroups]);

  // Reset state
  const reset = useCallback(() => {
    setQuery('');
    setActiveItemIndex(0);
    setCommandMode(false);
    setActiveCommand(null);
    setSelectedTabIds(new Set());
  }, []);

  // Computed values
  const totalItems = searchResults.length;
  const hasSelection = selectedTabIds.size > 0;

  return {
    // State
    query,
    tabs,
    tabGroups,
    searchResults,
    activeItemIndex,
    commandMode,
    activeCommand,
    selectedTabIds,

    // Actions
    setQuery,
    setActiveItemIndex,
    setCommandMode,
    setActiveCommand,
    setSelectedTabIds,
    toggleTabSelection,
    clearSelection,
    selectAll,
    fetchTabs,
    fetchTabGroups,
    executeCurrentCommand,
    reset,

    // Computed
    totalItems,
    hasSelection,
    currentCommand
  };
}