/**
 * CommandPalette - Refactored version using new command system and hooks
 */

import { useEffect, useCallback } from 'react';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { commandRegistry } from '../commands';
import SearchResultItem from './SearchResultItem';
import CommandPaletteHeader from './CommandPaletteHeader';
import CommandPaletteFooter from './CommandPaletteFooter';

interface CommandPaletteProps {
  onClose: () => void;
}

const CommandPalette = ({ onClose }: CommandPaletteProps) => {
  const {
    // State
    query,
    tabs,
    searchResults,
    activeItemIndex,
    commandMode,
    selectedTabIds,

    // Actions
    setQuery,
    setActiveItemIndex,
    setCommandMode,
    setActiveCommand,
    toggleTabSelection,
    clearSelection,
    selectAll,
    executeCommand,
    executeCurrentCommand,
    reset,

    // Computed
    totalItems,
    hasSelection,
    currentCommand
  } = useCommandPalette(onClose);

  // Navigation handlers
  const handleMoveUp = useCallback(() => {
    setActiveItemIndex((prev: number) => Math.max(0, prev - 1));
  }, [setActiveItemIndex]);

  const handleMoveDown = useCallback(() => {
    setActiveItemIndex((prev: number) => Math.min(totalItems - 1, prev + 1));
  }, [setActiveItemIndex, totalItems]);

  const handleMoveToFirst = useCallback(() => {
    setActiveItemIndex(0);
  }, [setActiveItemIndex]);

  const handleMoveToLast = useCallback(() => {
    setActiveItemIndex(Math.max(0, totalItems - 1));
  }, [setActiveItemIndex, totalItems]);

  const handlePageUp = useCallback(() => {
    setActiveItemIndex((prev: number) => Math.max(0, prev - 10));
  }, [setActiveItemIndex]);

  const handlePageDown = useCallback(() => {
    setActiveItemIndex((prev: number) => Math.min(totalItems - 1, prev + 10));
  }, [setActiveItemIndex, totalItems]);

  // Selection handlers
  const handleExecuteSelected = useCallback(() => {
    console.log('CommandPaletteNew: handleExecuteSelected called');
    console.log('CommandPaletteNew: activeItemIndex:', activeItemIndex);
    console.log('CommandPaletteNew: searchResults length:', searchResults.length);
    const activeItem = searchResults[activeItemIndex];
    console.log('CommandPaletteNew: activeItem:', activeItem);
    if (!activeItem) {
      console.log('CommandPaletteNew: No active item, returning');
      return;
    }

    if (activeItem.type === 'tab') {
      if (commandMode && currentCommand?.multiSelect) {
        // Toggle selection in multi-select mode
        toggleTabSelection(activeItem.tab.id!);
      } else {
        // Switch to tab
        chrome.runtime.sendMessage({
          type: 'SWITCH_TO_TAB',
          tabId: activeItem.tab.id
        });
        onClose();
      }
    } else if (activeItem.type === 'action') {
      console.log('CommandPaletteNew: Processing action item:', activeItem.id, activeItem.title);
      // Check if this is a command suggestion (ID ends with -suggestion)
      if (activeItem.id.endsWith('-suggestion')) {
        console.log('CommandPaletteNew: This is a command suggestion');
        // This is a command suggestion - find and execute the command
        const commandId = activeItem.id.replace('-suggestion', '');
        console.log('CommandPaletteNew: Command ID:', commandId);
        const command = currentCommand || commandRegistry.getCommand(commandId);
        console.log('CommandPaletteNew: Found command:', command);

        if (command) {
          console.log('CommandPaletteNew: Command mode:', command.mode);
          if (command.mode === 'SingleExecution') {
            console.log('CommandPaletteNew: Executing single execution command');
            // Execute immediately without relying on state
            executeCommand(command.id);
          } else if (command.mode === 'CommandMode') {
            console.log('CommandPaletteNew: Entering command mode');
            // Enter command mode
            setCommandMode(true);
            setActiveCommand(command.id);
            setQuery(''); // Clear input for command mode search
            clearSelection(); // Clear any existing selection
          }
        }
      } else if (activeItem.action) {
        console.log('CommandPaletteNew: This is a regular action item, calling action function');
        // This is a regular action item with a function
        activeItem.action();
      } else {
        console.log('CommandPaletteNew: No action found for item');
      }
    } else if (activeItem.type === 'closeTabAction') {
      chrome.runtime.sendMessage({
        type: 'CLOSE_TAB',
        tabId: activeItem.tab.id
      });
      onClose();
    }
  }, [searchResults, activeItemIndex, commandMode, currentCommand, toggleTabSelection, executeCurrentCommand, onClose]);

  const handleToggleSelection = useCallback(() => {
    const activeItem = searchResults[activeItemIndex];
    if (activeItem?.type === 'tab') {
      toggleTabSelection(activeItem.tab.id!);
    }
  }, [searchResults, activeItemIndex, toggleTabSelection]);

  const handleEnterCommandMode = useCallback(() => {
    if (currentCommand && currentCommand.mode === 'CommandMode') {
      setCommandMode(true);
      setActiveCommand(currentCommand.id);
      setQuery(''); // Clear input for command mode search
      clearSelection(); // Clear any existing selection
    }
  }, [currentCommand, setCommandMode, setActiveCommand, setQuery, clearSelection]);

  const handleExitCommandMode = useCallback(() => {
    setCommandMode(false);
    setActiveCommand(null);
    clearSelection();
  }, [setCommandMode, setActiveCommand, clearSelection]);

  const handleCloseModal = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // Keyboard navigation setup
  const { inputRef } = useKeyboardNavigation({
    isModalOpen: true,
    commandMode,
    hasSelection,
    selectedCount: selectedTabIds.size,
    activeItemIndex,
    totalItems,
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onMoveToFirst: handleMoveToFirst,
    onMoveToLast: handleMoveToLast,
    onPageUp: handlePageUp,
    onPageDown: handlePageDown,
    onExecuteSelected: handleExecuteSelected,
    onToggleSelection: handleToggleSelection,
    onSelectAll: selectAll,
    onClearSelection: clearSelection,
    onCloseModal: handleCloseModal,
    onEnterCommandMode: handleEnterCommandMode,
    onExitCommandMode: handleExitCommandMode
  });

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset active index when search results change
  useEffect(() => {
    setActiveItemIndex(0);
  }, [searchResults, setActiveItemIndex]);

  // Scroll active item into view
  useEffect(() => {
    const activeElement = document.querySelector(`[data-item-index="${activeItemIndex}"]`);
    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [activeItemIndex]);


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-96 flex flex-col">
        <CommandPaletteHeader
          ref={inputRef}
          query={query}
          onQueryChange={setQuery}
          commandMode={commandMode}
          currentCommandName={currentCommand?.name}
          hasSelection={hasSelection}
          selectedCount={selectedTabIds.size}
          selectedTabs={Array.from(selectedTabIds).map(tabId => {
            const tab = tabs.find(t => t.id === tabId);
            return tab ? {
              id: tabId,
              title: tab.title || 'Untitled',
              favIconUrl: tab.favIconUrl
            } : null;
          }).filter(Boolean) as any[]}
          onRemoveSelection={toggleTabSelection}
        />

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {searchResults.length > 0 ? (
            searchResults.map((item, index) => (
              <SearchResultItem
                key={index}
                item={item}
                index={index}
                isActive={index === activeItemIndex}
                isSelected={item.type === 'tab' && selectedTabIds.has(item.tab.id!)}
                commandMode={commandMode}
                multiSelect={currentCommand?.multiSelect || false}
                onSelect={(index) => {
                  setActiveItemIndex(index);
                  handleExecuteSelected();
                }}
                onToggleSelection={toggleTabSelection}
              />
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              <div className="text-gray-400 text-4xl mb-2">🔍</div>
              <div>No results found</div>
              <div className="text-sm mt-1">Try a different search term</div>
            </div>
          )}
        </div>

        <CommandPaletteFooter
          commandMode={commandMode}
          hasResults={searchResults.length > 0}
        />
      </div>
    </div>
  );
};

export default CommandPalette;