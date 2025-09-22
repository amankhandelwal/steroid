/**
 * useCommandPalette - Custom hook for command palette business logic
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { commandRegistry, initializeCommands } from '../commands';
import type { CommandContext, SearchResultItem, CommandExecutionContext } from '../commands/CommandTypes';
import { sendMessageSafely, debounce } from '../utils/errorHandling';

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
  } | null;

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
  executeCommand: (commandId: string) => Promise<void>;
  executeCurrentCommand: () => Promise<void>;
  handleInputSubmit: (value: string) => void;
  handleInputCancel: () => void;
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

  // Debounced query setter for performance
  const debouncedSetQuery = useMemo(
    () => debounce((newQuery: string) => setQueryState(newQuery), 150),
    []
  );

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery); // Immediate update for UI responsiveness
    debouncedSetQuery(newQuery); // Debounced update for search logic
  }, [debouncedSetQuery]);

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

  // Get current command (only when explicitly set, not from query parsing)
  const currentCommand = useMemo(() => {
    if (activeCommand) {
      return commandRegistry.getCommand(activeCommand);
    }
    return null;
  }, [activeCommand]);

  // Generate search results
  const searchResults = useMemo(() => {

    const context: CommandContext = {
      tabs,
      tabGroups,
      selectedTabIds,
      query: queryState,
      commandMode,
      activeCommand
    };

    if (currentCommand && commandMode) {
      // Only use single command mode when explicitly in command mode
      let results = currentCommand.getSearchResults(context);

      // In command mode, filter out already selected tabs
      if (selectedTabIds.size > 0) {
        results = results.filter(item => {
          if (item.type === 'tab') {
            return !selectedTabIds.has(item.tab.id!);
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
    const suggestions = commandRegistry.getCommandSuggestions(queryState);

    // Also show matching tabs
    const lowerQuery = queryState.toLowerCase();
    const matchingTabs = tabs
      .filter(tab =>
        tab.title?.toLowerCase().includes(lowerQuery) ||
        tab.url?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 30)
      .map(tab => ({
        type: 'tab' as const,
        tab
      }));

    // Add fallback Google search option if no commands match
    const fallbackSearch = suggestions.length === 0 ? [{
      type: 'action' as const,
      id: 'fallback-google-search',
      title: `Search "${queryState}" on Google`,
      action: () => {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(queryState)}`;
        chrome.runtime.sendMessage({ type: 'OPEN_URL', url: searchUrl });
      }
    }] : [];

    const finalResults = [...suggestions, ...matchingTabs, ...fallbackSearch];
    return finalResults;
  }, [tabs, tabGroups, selectedTabIds, queryState, commandMode, activeCommand, currentCommand]);

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

  // Execute specific command by ID
  const executeCommand = useCallback(async (commandId: string, inputValue?: string) => {

    const context: CommandExecutionContext = {
      query: inputValue || queryState,
      selectedTabIds,
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
      const result = await commandRegistry.executeCommand(commandId, context);

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
      }
    } catch (error) {
      // Error handling can be added here if needed
    }
  }, [queryState, selectedTabIds, commandMode, onClose, fetchTabs, fetchTabGroups]);

  // Execute current command
  const executeCurrentCommand = useCallback(async () => {
    if (!currentCommand) {
      return;
    }
    await executeCommand(currentCommand.id);
  }, [currentCommand, executeCommand]);

  // Handle input dialog submission
  const handleInputSubmit = useCallback((value: string) => {
    if (pendingCommandExecution) {
      // Execute the command with the provided input value
      const context = {
        ...pendingCommandExecution.context,
        query: value
      };

      commandRegistry.executeCommand(pendingCommandExecution.commandId, context).then((result) => {
        if (result.success && result.shouldCloseModal) {
          onClose();
        }
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