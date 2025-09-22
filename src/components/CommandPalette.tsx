import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Fuse from 'fuse.js';
import { parseCommand } from '../utils/commandParser';
import searchEngines from '../config/searchEngines.json';

// Define the types for our search results
interface TabItem {
  type: 'tab';
  tab: chrome.tabs.Tab;
}

interface ActionItem {
  type: 'action';
  id: string;
  title: string;
  action: () => void;
}

interface CloseTabActionItem {
  type: 'closeTabAction';
  tab: chrome.tabs.Tab;
  title: string;
  id?: string;
}

type SearchResultItem = TabItem | ActionItem | CloseTabActionItem;

interface CommandPaletteProps {
  onClose: () => void;
}

const CommandPalette = ({ onClose }: CommandPaletteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [query, setQuery] = useState('');
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [previousTabInfo, setPreviousTabInfo] = useState<{tab: chrome.tabs.Tab, title: string} | null>(null);

  // Command mode state
  const [commandMode, setCommandMode] = useState(false);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());

  // Tab groups state
  const [tabGroups, setTabGroups] = useState<chrome.tabGroups.TabGroup[]>([]);

  const fetchTabs = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'GET_TABS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching tabs:', chrome.runtime.lastError.message);
        return;
      }
      setTabs(response || []);
    });
  }, []);

  const fetchPreviousTabInfo = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'GET_PREVIOUS_TAB' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching previous tab:', chrome.runtime.lastError.message);
        return;
      }

      if (response && response.success && response.tab) {
        const hostname = response.tab.url ? new URL(response.tab.url).hostname : 'Unknown';
        setPreviousTabInfo({
          tab: response.tab,
          title: `Previous Tab > ${hostname}`
        });
      } else {
        setPreviousTabInfo(null);
      }
    });
  }, []);

  const fetchTabGroups = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'GET_TAB_GROUPS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching tab groups:', chrome.runtime.lastError.message);
        return;
      }
      setTabGroups(response || []);
    });
  }, []);

  const fuse = useMemo(() => new Fuse(tabs, { keys: ['title', 'url'], includeScore: true, threshold: 0.4 }), [tabs]);

  const searchResults = useMemo((): SearchResultItem[] => {
    const parsedCommand = parseCommand(query);
    let results: SearchResultItem[] = [];

    // Define all possible command suggestions (only show when typing)
    const commandSuggestions: ActionItem[] = query.trim().length > 0 ? [
      ...(previousTabInfo ? [{
        type: 'action' as const,
        id: 'previous-tab-suggest',
        title: previousTabInfo.title,
        action: () => chrome.runtime.sendMessage({ type: 'SWITCH_TO_PREVIOUS_TAB' }, (response) => {
          if (response && response.success) {
            console.log('Switched to previous tab');
          } else {
            console.log('No previous tab available');
          }
        })
      }] : []),
      {
        type: 'action',
        id: 'close-duplicate-suggest',
        title: 'Close Duplicate Tabs',
        action: () => chrome.runtime.sendMessage({ type: 'CLOSE_DUPLICATE_TABS' }, (response) => {
          if (response && response.success) {
            console.log(`Closed ${response.closedCount} duplicate tabs.`);
            fetchTabs(); // Re-fetch tabs to update UI
          }
        })
      },
      {
        type: 'action',
        id: 'google-suggest',
        title: 'Google Search',
        action: () => setQuery('g ')
      },
      {
        type: 'action',
        id: 'youtube-suggest',
        title: 'YouTube Search',
        action: () => setQuery('y ')
      },
      {
        type: 'action',
        id: 'close-suggest',
        title: 'Close Tab(s)',
        action: () => setQuery('close ')
      },
      {
        type: 'action',
        id: 'open-url-suggest',
        title: 'Open URL',
        action: () => setQuery('http://')
      },
      {
        type: 'action',
        id: 'create-tab-group-suggest',
        title: 'Create Tab Group',
        action: () => setQuery('create tab group ')
      },
      {
        type: 'action',
        id: 'delete-tab-group-suggest',
        title: 'Delete Tab Group',
        action: () => setQuery('delete tab group ')
      }
    ] : [];

    // Filter command suggestions based on query
    const filteredCommandSuggestions = commandSuggestions.filter(cmd =>
      cmd.title.toLowerCase().includes(query.toLowerCase())
    );

    // Add command suggestions to results if query is not a specific command yet
    if (parsedCommand.type === 'tabSearch' || parsedCommand.type === 'openUrl') { // Only show suggestions if not already a specific command
      results.push(...filteredCommandSuggestions);
    }

    switch (parsedCommand.type) {
      case 'previousTab':
        if (previousTabInfo) {
          results.push({
            type: 'action',
            id: 'previous-tab',
            title: previousTabInfo.title,
            action: () => chrome.runtime.sendMessage({ type: 'SWITCH_TO_PREVIOUS_TAB' }, (response) => {
              if (response && response.success) {
                console.log('Switched to previous tab');
              } else {
                console.log('No previous tab available');
              }
            })
          });
        } else {
          results.push({
            type: 'action',
            id: 'no-previous-tab',
            title: 'No previous tab available',
            action: () => console.log('No previous tab available')
          });
        }
        break;
      case 'google':
      case 'youtube':
        const engine = searchEngines.find(e => e.id === parsedCommand.type);
        if (engine && parsedCommand.query) {
          results.push({
            type: 'action',
            id: `${engine.id}-search`,
            title: `${engine.name} "${parsedCommand.query}"`,
            action: () => chrome.runtime.sendMessage({ type: 'OPEN_URL', url: engine.url.replace('%s', encodeURIComponent(parsedCommand.query)) })
          });
        }
        break;
      case 'openUrl':
        if (parsedCommand.query) {
          results.push({
            type: 'action',
            id: 'open-url',
            title: `Open URL: ${parsedCommand.query}`,
            action: () => {
              let url = parsedCommand.query;
              if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = `http://${url}`;
              }
              chrome.runtime.sendMessage({ type: 'OPEN_URL', url });
            }
          });
        }
        break;
      case 'closeDuplicate':
        results.push({
          type: 'action',
          id: 'close-duplicate',
          title: 'Close Duplicate Tabs',
          action: () => chrome.runtime.sendMessage({ type: 'CLOSE_DUPLICATE_TABS' }, (response) => {
            if (response && response.success) {
              console.log(`Closed ${response.closedCount} duplicate tabs.`);
              fetchTabs(); // Re-fetch tabs to update UI
            }
          })
        });
        break;
      case 'close':
        if (parsedCommand.query) {
          const filteredTabs = fuse.search(parsedCommand.query).map(result => result.item);
          results.push(...filteredTabs.map(tab => ({
            type: 'closeTabAction' as const,
            tab: tab,
            title: `Close: ${tab.title}`,
            id: `close-tab-${tab.id}`
          })));
        } else {
          // If 'close' command is typed without query, show all tabs as closable
          results.push(...tabs.map(tab => ({
            type: 'closeTabAction' as const,
            tab: tab,
            title: `Close: ${tab.title}`,
            id: `close-tab-${tab.id}`
          })));
        }
        break;
      case 'createTabGroup':
        results.push({
          type: 'action',
          id: 'create-tab-group',
          title: `Create Tab Group${parsedCommand.query ? ` "${parsedCommand.query}"` : ''}`,
          action: () => {
            if (selectedTabIds.size > 0) {
              const tabIdsArray = Array.from(selectedTabIds);
              const groupName = parsedCommand.query || `Group ${new Date().toLocaleTimeString()}`;
              chrome.runtime.sendMessage(
                { type: 'CREATE_TAB_GROUP', tabIds: tabIdsArray, groupName },
                (response) => {
                  if (response && response.success) {
                    console.log(response.message);
                    fetchTabs();
                    fetchTabGroups();
                    setSelectedTabIds(new Set());
                    setCommandMode(false);
                    setActiveCommand(null);
                    onClose();
                  }
                }
              );
            } else {
              console.log('No tabs selected for grouping');
            }
          }
        });
        break;
      case 'deleteTabGroup':
        // Show available tab groups for deletion
        const groupsToShow = parsedCommand.query
          ? tabGroups.filter(group => group.title?.toLowerCase().includes(parsedCommand.query.toLowerCase()))
          : tabGroups;

        results.push(...groupsToShow.map(group => ({
          type: 'action' as const,
          id: `delete-group-${group.id}`,
          title: `Delete Group: ${group.title || 'Untitled'}`,
          action: () => {
            chrome.runtime.sendMessage(
              { type: 'DELETE_TAB_GROUP', groupId: group.id },
              (response) => {
                if (response && response.success) {
                  console.log(response.message);
                  fetchTabs();
                  fetchTabGroups();
                }
              }
            );
          }
        })));
        break;
      case 'tabSearch':
      default:
        if (!parsedCommand.query) {
          results.push(...tabs.map((tab) => ({ type: 'tab' as const, tab })));
        } else {
          results.push(...fuse.search(parsedCommand.query).map(result => ({ type: 'tab' as const, tab: result.item })));
        }
        break;
    }

    // Default Google Search if no other results and query is not empty
    if (results.length === 0 && query.trim().length > 0) {
      results.push({
        type: 'action',
        id: 'default-google-search',
        title: `Google "${query}"`,
        action: () => chrome.runtime.sendMessage({ type: 'OPEN_URL', url: `https://www.google.com/search?q=${encodeURIComponent(query)}` })
      });
    }

    return results;

  }, [query, tabs, fuse, fetchTabs, previousTabInfo, tabGroups, selectedTabIds]);

  const handleItemClick = (item: SearchResultItem) => {
    // Check if we're in command mode and this is a multi-step command
    const isMultiStepCommand = (command: string) => {
      return ['close', 'create tab group', 'group tabs'].includes(command.toLowerCase());
    };

    if (item.type === 'tab') {
      if (commandMode && selectedTabIds.size > 0) {
        // In command mode with selections, execute the command on selected tabs
        executeCommandOnSelectedTabs();
      } else {
        chrome.runtime.sendMessage({ type: 'SWITCH_TO_TAB', tabId: item.tab.id });
        onClose();
      }
    } else if (item.type === 'closeTabAction') {
      if (commandMode && selectedTabIds.size > 0) {
        // In command mode, add to selection instead of immediate close
        const newSelected = new Set(selectedTabIds);
        if (newSelected.has(item.tab.id!)) {
          newSelected.delete(item.tab.id!);
        } else {
          newSelected.add(item.tab.id!);
        }
        setSelectedTabIds(newSelected);
      } else {
        chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId: item.tab.id }, fetchTabs);
        onClose();
      }
    } else {
      // Action item
      const actionTitle = item.title.toLowerCase();

      // Check if this should enter command mode
      if (actionTitle.includes('close tab') && query.trim().startsWith('close ')) {
        setCommandMode(true);
        setActiveCommand('close');
        setQuery(query); // Keep the current query for filtering
      } else if (actionTitle.includes('create tab group') && query.trim().startsWith('create tab group')) {
        setCommandMode(true);
        setActiveCommand('create tab group');
        setQuery(query); // Keep the current query for naming
      } else if (isMultiStepCommand(actionTitle)) {
        setCommandMode(true);
        setActiveCommand(actionTitle);
      } else {
        // Immediate execution commands (Previous Tab, Close Duplicate, searches, Delete Tab Group, etc.)
        item.action();
        onClose();
      }
    }
  };

  const executeCommandOnSelectedTabs = () => {
    if (activeCommand === 'close' && selectedTabIds.size > 0) {
      const tabIdsArray = Array.from(selectedTabIds);
      chrome.runtime.sendMessage(
        { type: 'CLOSE_TAB', tabIds: tabIdsArray },
        (response) => {
          if (response && response.success) {
            console.log(`Closed ${response.closedCount} tabs`);
            fetchTabs();
            setSelectedTabIds(new Set());
            setCommandMode(false);
            setActiveCommand(null);
            onClose();
          }
        }
      );
    } else if (activeCommand === 'create tab group' && selectedTabIds.size > 0) {
      const tabIdsArray = Array.from(selectedTabIds);
      // Extract group name from query if it exists
      const parsedCommand = parseCommand(query);
      const groupName = parsedCommand.query || `Group ${new Date().toLocaleTimeString()}`;

      chrome.runtime.sendMessage(
        { type: 'CREATE_TAB_GROUP', tabIds: tabIdsArray, groupName },
        (response) => {
          if (response && response.success) {
            console.log(response.message);
            fetchTabs();
            fetchTabGroups();
            setSelectedTabIds(new Set());
            setCommandMode(false);
            setActiveCommand(null);
            onClose();
          }
        }
      );
    }
  };

  const exitCommandMode = () => {
    setCommandMode(false);
    setActiveCommand(null);
    setSelectedTabIds(new Set());
    setQuery('');
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: number) => {
    e.stopPropagation(); // Prevent the li's onClick from firing
    chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId }, fetchTabs);
  };

  // Keyboard navigation logic
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // If a non-navigation key is pressed, refocus the input and reset active item
      const isNavigationKey = ['ArrowUp', 'ArrowDown', 'Enter', 'Escape', '`'].includes(event.key);
      if (!isNavigationKey && inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
        setActiveItemIndex(0);
        return; // Don't process as navigation if typing
      }

      if (searchResults.length === 0) return; // No items to navigate

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          setActiveItemIndex((prevIndex) =>
            prevIndex === 0 ? searchResults.length - 1 : prevIndex - 1
          );
          break;
        case 'ArrowDown':
          event.preventDefault();
          setActiveItemIndex((prevIndex) =>
            prevIndex === searchResults.length - 1 ? 0 : prevIndex + 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (commandMode && selectedTabIds.size > 0) {
            // Execute command on selected tabs
            executeCommandOnSelectedTabs();
          } else if (activeItemIndex >= 0 && activeItemIndex < searchResults.length) {
            handleItemClick(searchResults[activeItemIndex]);
          }
          break;
        case 'Tab':
          event.preventDefault();
          if (commandMode && activeItemIndex >= 0 && activeItemIndex < searchResults.length) {
            // In command mode, Tab key adds/removes items from selection
            const activeItem = searchResults[activeItemIndex];
            if (activeItem.type === 'tab' || activeItem.type === 'closeTabAction') {
              const tabId = activeItem.tab.id!;
              const newSelected = new Set(selectedTabIds);
              if (newSelected.has(tabId)) {
                newSelected.delete(tabId);
              } else {
                newSelected.add(tabId);
              }
              setSelectedTabIds(newSelected);
            }
          } else {
            // Normal tab completion behavior when not in command mode
            if (activeItemIndex >= 0 && activeItemIndex < searchResults.length) {
              const activeItem = searchResults[activeItemIndex];
              const title = activeItem.type === 'tab' ? activeItem.tab.title || '' : activeItem.title;
              setQuery(title);
              // Refocus input and set cursor to end
              setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.setSelectionRange(title.length, title.length);
              }, 0);
            }
          }
          break;
        case '`': // Tilde key
          event.preventDefault();
          if (activeItemIndex >= 0 && activeItemIndex < searchResults.length) {
            const activeItem = searchResults[activeItemIndex];
            if (activeItem.type === 'tab') {
              handleCloseTab(event as unknown as React.MouseEvent, activeItem.tab.id!); // Cast event for stopPropagation
            } else if (activeItem.type === 'closeTabAction') {
              handleCloseTab(event as unknown as React.MouseEvent, activeItem.tab.id!); // Close the tab if it's a close action item
            }
          }
          break;
        case 'Escape': // Exit command mode or close palette
          event.preventDefault();
          if (commandMode) {
            exitCommandMode();
          } else {
            onClose();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [searchResults, activeItemIndex, handleItemClick, handleCloseTab, onClose, query]);

  // Focus the input field and fetch data when the component mounts
  useEffect(() => {
    inputRef.current?.focus();
    fetchTabs();
    fetchPreviousTabInfo();
    fetchTabGroups();
  }, [fetchTabs, fetchPreviousTabInfo, fetchTabGroups]);

  // Reset active item index when search results change
  useEffect(() => {
    setActiveItemIndex(0);
  }, [searchResults]);

  // Get selected tabs for display
  const selectedTabs = tabs.filter(tab => selectedTabIds.has(tab.id!));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-[9999] pt-[20vh] backdrop-blur-sm">
      <div className="w-[50vw] max-w-2xl bg-gray-800 text-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            placeholder={commandMode ? `${activeCommand?.toUpperCase()} > Type to search...` : "Search tabs, or type 'g ' to google..."}
            className="w-full h-10 bg-gray-700 text-white placeholder-gray-400 p-2 rounded-lg outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {commandMode && (
            <div className="mt-2 text-xs text-blue-400">
              Command Mode: {activeCommand?.toUpperCase()} | Tab: select/deselect | Enter: execute | Esc: exit
            </div>
          )}
        </div>

        {/* Selected tabs display */}
        {selectedTabs.length > 0 && (
          <div className="border-b border-gray-700 bg-gray-750">
            <div className="p-2 text-xs text-gray-400 font-medium">
              Selected Tabs ({selectedTabs.length}):
            </div>
            <div className="max-h-32 overflow-y-auto">
              {selectedTabs.map((tab) => (
                <div key={tab.id} className="flex items-center gap-2 p-2 text-sm bg-blue-900 bg-opacity-50 border-l-2 border-blue-500">
                  {tab.favIconUrl &&
                    !tab.favIconUrl.startsWith('http://localhost') &&
                    !tab.favIconUrl.startsWith('http://127.0.0.1') &&
                    <img src={tab.favIconUrl} alt="" className="w-4 h-4 flex-shrink-0" />
                  }
                  <span className="truncate">{tab.title}</span>
                  <button
                    onClick={() => {
                      const newSelected = new Set(selectedTabIds);
                      newSelected.delete(tab.id!);
                      setSelectedTabIds(newSelected);
                    }}
                    className="text-gray-400 hover:text-white px-1 py-0 rounded-md flex-shrink-0 text-xs"
                    aria-label="Remove from selection"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="border-y border-gray-700 max-h-96 overflow-y-auto">
          <ul>
            {searchResults.map((item, index) => {
              const isSelected = (item.type === 'tab' || item.type === 'closeTabAction') && selectedTabIds.has(item.tab.id!);
              return (
                <li
                  key={item.type === 'tab' ? item.tab.id : (item.type === 'action' ? item.id : item.id || `${item.type}-${index}`)}
                  onClick={() => handleItemClick(item)}
                  className={`p-2 text-sm cursor-pointer flex items-center gap-2 justify-between ${
                    index === activeItemIndex
                      ? 'bg-gray-600'
                      : isSelected
                        ? 'bg-blue-900 bg-opacity-30 border-l-2 border-blue-500'
                        : 'hover:bg-gray-700'
                  }`}
                >
                  {isSelected && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                  )}
                {item.type === 'tab' ? (
                  <>
                    <div className="flex items-center gap-2 truncate">
                      {item.tab.favIconUrl &&
                        !item.tab.favIconUrl.startsWith('http://localhost') &&
                        !item.tab.favIconUrl.startsWith('http://127.0.0.1') &&
                        <img src={item.tab.favIconUrl} alt="" className="w-4 h-4 flex-shrink-0" />
                      }
                      <span className="truncate">{item.tab.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleCloseTab(e, item.tab.id!)}
                      className="text-gray-400 hover:text-white px-2 py-1 rounded-md flex-shrink-0"
                      aria-label="Close tab"
                    >
                      &times;
                    </button>
                  </>
                ) : item.type === 'closeTabAction' ? (
                  <>
                    <div className="flex items-center gap-2 truncate">
                      {item.tab.favIconUrl &&
                        !item.tab.favIconUrl.startsWith('http://localhost') &&
                        !item.tab.favIconUrl.startsWith('http://127.0.0.1') &&
                        <img src={item.tab.favIconUrl} alt="" className="w-4 h-4 flex-shrink-0" />
                      }
                      <span className="truncate">{item.tab.title}</span>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 truncate">{new URL(item.tab.url || '').hostname}</span>
                  </>
                ) : (
                  <span className="truncate">{item.title}</span>
                )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="p-2 text-xs text-gray-400">
          <span><b>Tip:</b> Use Shift+Shift to open, Esc to close.{commandMode && ' Tab: select, Enter: execute command.'}</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
