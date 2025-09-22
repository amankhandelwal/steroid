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
import InputDialog from './InputDialog';

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
    showInputDialog,
    inputConfig,

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
    handleInputSubmit,
    handleInputCancel,
    reset,

    // Computed
    totalItems,
    hasSelection,
    currentCommand
  } = useCommandPalette(onClose);

  // Navigation handlers
  const handleMoveUp = useCallback(() => {
    setActiveItemIndex(Math.max(0, activeItemIndex - 1));
  }, [setActiveItemIndex, activeItemIndex]);

  const handleMoveDown = useCallback(() => {
    setActiveItemIndex(Math.min(totalItems - 1, activeItemIndex + 1));
  }, [setActiveItemIndex, totalItems, activeItemIndex]);

  const handleMoveToFirst = useCallback(() => {
    setActiveItemIndex(0);
  }, [setActiveItemIndex]);

  const handleMoveToLast = useCallback(() => {
    setActiveItemIndex(Math.max(0, totalItems - 1));
  }, [setActiveItemIndex, totalItems]);

  const handlePageUp = useCallback(() => {
    setActiveItemIndex(Math.max(0, activeItemIndex - 10));
  }, [setActiveItemIndex, activeItemIndex]);

  const handlePageDown = useCallback(() => {
    setActiveItemIndex(Math.min(totalItems - 1, activeItemIndex + 10));
  }, [setActiveItemIndex, totalItems, activeItemIndex]);

  // Selection handlers
  const handleExecuteSelected = useCallback(() => {
    const activeItem = searchResults[activeItemIndex];
    if (!activeItem) {
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
      // Check if this is a command suggestion (ID ends with -suggestion)
      if (activeItem.id.endsWith('-suggestion')) {
        // This is a command suggestion - find and execute the command
        const commandId = activeItem.id.replace('-suggestion', '');
        const command = currentCommand || commandRegistry.getCommand(commandId);

        if (command) {
          if (command.mode === 'SingleExecution') {
            // Execute immediately without relying on state
            executeCommand(command.id);
          } else if (command.mode === 'CommandMode') {
            // Enter command mode
            setCommandMode(true);
            setActiveCommand(command.id);
            setQuery(''); // Clear input for command mode search
            clearSelection(); // Clear any existing selection
          }
        }
      } else if (activeItem.action) {
        // This is a regular action item with a function
        activeItem.action();
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
    onExitCommandMode: handleExitCommandMode,
    onExecuteCurrentCommand: executeCurrentCommand
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
          hasSelection={hasSelection}
        />
      </div>

      {/* Input Dialog */}
      {showInputDialog && inputConfig && (
        <InputDialog
          title={inputConfig.title}
          placeholder={inputConfig.placeholder}
          defaultValue={inputConfig.defaultValue}
          onSubmit={handleInputSubmit}
          onCancel={handleInputCancel}
        />
      )}
    </div>
  );
};

export default CommandPalette;