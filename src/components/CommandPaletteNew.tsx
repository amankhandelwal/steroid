/**
 * CommandPalette - Refactored version using new command system and hooks
 *
 * Styles live in the sibling `CommandPaletteNew.css`, which is pulled into the
 * bundle by `src/index.css` (the single stylesheet injected into the
 * extension's shadow root).
 */

import { useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useFocusContainment } from '../hooks/useFocusContainment';
import { commandRegistry } from '../commands';
import type {
  TabItem,
  ActionItem,
  CloseTabActionItem,
  TabGroupItem,
  SearchResultItem as SearchResultItemType
} from '../commands/CommandTypes';
import type { ExtensionMessage } from '../types/messages';
import SearchResultItem from './SearchResultItem';
import CommandPaletteHeader from './CommandPaletteHeader';
import CommandPaletteFooter from './CommandPaletteFooter';
import InputDialog from './InputDialog';
import { AlertIcon, SearchIcon, SpinnerIcon } from './icons/Icons';

interface CommandPaletteProps {
  onClose: () => void;
}

const CommandPalette = ({ onClose }: CommandPaletteProps) => {
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  // Palette root: the keyboard listener and the focus guard both hang off it, so
  // neither has to reach up to `document` (see `useKeyboardNavigation`).
  const backdropRef = useRef<HTMLDivElement>(null);

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
    loadingMessage,
    errorMessage,

    // Actions
    setQuery,
    setActiveItemIndex,
    setCommandMode,
    setActiveCommand,
    toggleTabSelection,
    toggleGroupSelection,
    clearSelection,
    selectAll,
    fetchTabs,
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

  // Track previous searchResults to detect selection vs query changes
  const previousSearchResultsRef = useRef<SearchResultItemType[]>(searchResults);

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

  // Selection handlers - extracted by type
  const handleTabItem = useCallback((item: TabItem) => {
    if (commandMode && currentCommand?.multiSelect) {
      toggleTabSelection(item.tab.id!);
    } else {
      const message: ExtensionMessage = { type: 'SWITCH_TO_TAB', tabId: item.tab.id! };
      chrome.runtime.sendMessage(message);
      onClose();
    }
  }, [commandMode, currentCommand, toggleTabSelection, onClose]);

  const handleActionItem = useCallback((item: ActionItem) => {
    if (item.id.endsWith('-suggestion')) {
      const commandId = item.id.replace('-suggestion', '');
      const command = currentCommand || commandRegistry.getCommand(commandId);

      if (command) {
        if (command.mode === 'SingleExecution') {
          executeCommand(command.id);
        } else if (command.mode === 'CommandMode') {
          setCommandMode(true);
          setActiveCommand(command.id);
          setQuery('');
          clearSelection();
        }
      }
    } else if (item.action) {
      item.action();
    }
  }, [currentCommand, executeCommand, setCommandMode, setActiveCommand, setQuery, clearSelection]);

  const handleCloseTabAction = useCallback((item: CloseTabActionItem) => {
    const message: ExtensionMessage = { type: 'CLOSE_TAB', tabId: item.tab.id! };
    chrome.runtime.sendMessage(message);
    onClose();
  }, [onClose]);

  const handleTabGroupItem = useCallback((item: TabGroupItem) => {
    if (commandMode && currentCommand?.id === 'delete_group') {
      executeCommand(currentCommand.id, undefined, item.group.id);
    } else if (commandMode && currentCommand?.multiSelect) {
      // Bulk-select commands (e.g. Close Tabs): toggle every member tab of
      // this group in/out of the selection as one unit.
      toggleGroupSelection(item.group.id);
    } else if (!commandMode) {
      // Outside command mode, selecting a group switches to its first tab.
      const firstTab = tabs.find(tab => tab.groupId === item.group.id);
      if (firstTab) {
        const message: ExtensionMessage = { type: 'SWITCH_TO_TAB', tabId: firstTab.id! };
        chrome.runtime.sendMessage(message);
        onClose();
      }
    }
  }, [commandMode, currentCommand, executeCommand, toggleGroupSelection, tabs, onClose]);

  const handleExecuteSelected = useCallback(() => {
    const activeItem = searchResults[activeItemIndex];
    if (!activeItem) return;

    switch (activeItem.type) {
      case 'tab': return handleTabItem(activeItem);
      case 'action': return handleActionItem(activeItem);
      case 'closeTabAction': return handleCloseTabAction(activeItem);
      case 'tabGroup': return handleTabGroupItem(activeItem);
    }
  }, [searchResults, activeItemIndex, handleTabItem, handleActionItem, handleCloseTabAction, handleTabGroupItem]);

  const handleToggleSelection = useCallback(() => {
    const activeItem = searchResults[activeItemIndex];
    if (activeItem?.type === 'tab') {
      toggleTabSelection(activeItem.tab.id!);
    }
  }, [searchResults, activeItemIndex, toggleTabSelection]);

  const handleToggleSelectionById = useCallback((tabId: number) => {
    toggleTabSelection(tabId);
  }, [toggleTabSelection]);

  const handleToggleGroupSelectionById = useCallback((groupId: number) => {
    toggleGroupSelection(groupId);
  }, [toggleGroupSelection]);

  /** A tab-group row is "selected" when every one of its current member tabs is selected. */
  const isTabGroupFullySelected = useCallback((groupId: number) => {
    const memberTabIds = tabs.filter(tab => tab.groupId === groupId).map(tab => tab.id!);
    return memberTabIds.length > 0 && memberTabIds.every(id => selectedTabIds.has(id));
  }, [tabs, selectedTabIds]);

  const handleEnterCommandMode = useCallback(() => {
    const activeItem = searchResults[activeItemIndex];

    // If the highlighted row is a CommandMode command's suggestion, enter
    // command mode for it. Resolve the command from the highlighted row
    // itself (same lookup `handleActionItem` uses) rather than from
    // `currentCommand`/`activeCommand` state — that state only becomes
    // non-null once command mode has already been entered, so checking it
    // here could never fire from a fresh, non-command-mode highlight.
    if (activeItem?.type === 'action' && activeItem.id.endsWith('-suggestion')) {
      const commandId = activeItem.id.replace('-suggestion', '');
      const command = commandRegistry.getCommand(commandId);
      if (command?.mode === 'CommandMode') {
        setCommandMode(true);
        setActiveCommand(command.id);
        setQuery(''); // Clear input for command mode search
        clearSelection(); // Clear any existing selection
        return;
      }
    }

    // Tab autocomplete (FIND-026): nothing to enter command mode for. If a
    // plain tab result is highlighted instead, populate the input with its
    // title (falling back to its URL) without switching to it or closing
    // the palette.
    if (activeItem?.type === 'tab') {
      setQuery(activeItem.tab.title || activeItem.tab.url || '');
    }
  }, [searchResults, activeItemIndex, setCommandMode, setActiveCommand, setQuery, clearSelection]);

  const handleExitCommandMode = useCallback(() => {
    setCommandMode(false);
    setActiveCommand(null);
    clearSelection();
  }, [setCommandMode, setActiveCommand, clearSelection]);

  const handleCloseModal = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleCloseHighlightedTab = useCallback(() => {
    const activeItem = searchResults[activeItemIndex];
    if (activeItem?.type === 'tab') {
      const message: ExtensionMessage = {
        type: 'CLOSE_TAB',
        tabId: activeItem.tab.id!
      };
      chrome.runtime.sendMessage(message, () => {
        // Refresh after tab is actually closed
        fetchTabs();
      });
    }
  }, [searchResults, activeItemIndex, fetchTabs]);

  // Keyboard navigation setup
  const { inputRef } = useKeyboardNavigation({
    containerRef: backdropRef,
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
    onCloseHighlightedTab: handleCloseHighlightedTab,
    onEnterCommandMode: handleEnterCommandMode,
    onExitCommandMode: handleExitCommandMode,
    onExecuteCurrentCommand: executeCurrentCommand
  });

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep focus in the palette for as long as it is open: a page that steals focus
  // would otherwise receive keystrokes directly, bypassing the shadow-host seal.
  useFocusContainment(backdropRef, () => inputRef.current?.focus());

  // Manage cursor position when search results change
  // Preserve position for selection toggles (length ±1), reset for query changes
  useLayoutEffect(() => {
    const prevLength = previousSearchResultsRef.current.length;
    const currentLength = searchResults.length;
    const lengthDiff = Math.abs(currentLength - prevLength);

    // Selection toggle changes length by exactly 1 (item filtered in/out)
    if (lengthDiff === 1) {
      // Keep cursor at current position, clamped to new array bounds
      setActiveItemIndex(prev => Math.min(prev, Math.max(0, currentLength - 1)));
    } else if (lengthDiff !== 0) {
      // Query change or other update - reset to 0
      setActiveItemIndex(0);
    }
    // If lengthDiff === 0, don't change cursor (e.g., tab metadata update)

    previousSearchResultsRef.current = searchResults;
  }, [searchResults, setActiveItemIndex]);

  // Scroll active item into view.
  // Delegates to the browser's native scroll-into-view against the true
  // scrollable ancestor. `block: 'nearest'` only scrolls when the row is
  // actually out of view, avoiding the offsetParent bugs of hand-rolled math
  // (the scroll container is not positioned, so item.offsetTop was measured
  // against the fixed backdrop).
  useEffect(() => {
    const container = resultsContainerRef.current;
    if (!container) return;

    const activeElement = container.querySelector(
      `[data-item-index="${activeItemIndex}"]`
    ) as HTMLElement | null;

    activeElement?.scrollIntoView({ block: 'nearest' });
  }, [activeItemIndex]);


  return (
    <div ref={backdropRef} className="steroid-palette-backdrop">
      <div className="steroid-palette-card">
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
        />

        {/* Results */}
        <div
          ref={resultsContainerRef}
          className="steroid-palette-results"
          role="listbox"
          aria-label="Search results"
          aria-activedescendant={
            searchResults.length > 0 ? `steroid-result-${activeItemIndex}` : undefined
          }
        >
          {errorMessage ? (
            <div className="steroid-palette-state steroid-palette-state--error">
              <AlertIcon className="steroid-palette-state-icon" />
              <div className="steroid-palette-state-title">Error</div>
              <div className="steroid-palette-state-hint">{errorMessage}</div>
            </div>
          ) : loadingMessage ? (
            <div className="steroid-palette-state">
              <SpinnerIcon className="steroid-palette-state-icon animate-spin" />
              <div>{loadingMessage}</div>
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map((item, index) => (
              <SearchResultItem
                key={index}
                item={item}
                index={index}
                isActive={index === activeItemIndex}
                isSelected={
                  item.type === 'tab' ? selectedTabIds.has(item.tab.id!) :
                  item.type === 'tabGroup' ? isTabGroupFullySelected(item.group.id) :
                  false
                }
                commandMode={commandMode}
                multiSelect={currentCommand?.multiSelect || false}
                onSelect={(index) => {
                  setActiveItemIndex(index);
                  handleExecuteSelected();
                }}
                onToggleSelection={handleToggleSelectionById}
                onToggleGroupSelection={handleToggleGroupSelectionById}
              />
            ))
          ) : (
            <div className="steroid-palette-state">
              <SearchIcon className="steroid-palette-state-icon" />
              <div className="steroid-palette-state-title">No results found</div>
              <div className="steroid-palette-state-hint">Try a different search term</div>
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
          inputType={inputConfig.inputType}
          submitLabel={inputConfig.submitLabel}
          onSubmit={handleInputSubmit}
          onCancel={handleInputCancel}
        />
      )}
    </div>
  );
};

export default CommandPalette;