import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Fuse from 'fuse.js';
import { parseCommand, CommandType, ParsedCommand } from '../utils/commandParser';
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
  const [previousTabDetails, setPreviousTabDetails] = useState<{ title: string; url: string } | null>(null);
  const [tabAccessTimes, setTabAccessTimes] = useState<Record<number, number>>({});
  const [commandMode, setCommandMode] = useState<boolean>(false);
  const [activeCommand, setActiveCommand] = useState<CommandType | null>(null);
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());
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

  // Fetch previous tab details and tab access times on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_PREVIOUS_TAB_DETAILS' }, (response) => {
      if (response && response.success) {
        setPreviousTabDetails({ title: response.tabTitle || 'Untitled', url: response.tabUrl || '' });
      } else {
        setPreviousTabDetails(null);
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_TAB_ACCESS_TIMES' }, (response) => {
      if (response && response.success) {
        setTabAccessTimes(response.accessTimes);
      } else {
        console.error('Error fetching tab access times:', response.message);
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_TAB_GROUPS' }, (response) => {
      if (response && response.success) {
        setTabGroups(response.tabGroups);
      } else {
        console.error('Error fetching tab groups:', response.message);
      }
    });
  }, []);

  const fuse = useMemo(() => {
    const searchableItems: (TabItem | ActionItem)[] = [
      ...tabs.map(tab => ({ type: 'tab', tab })),
      ...tabGroups.map(group => ({
        type: 'action',
        id: `group-${group.id}`,
        title: group.title || 'Untitled Group',
        action: () => { /* No direct action on search result click for groups */ }
      }))
    ];
    return new Fuse(searchableItems, { keys: ['title', 'url'], includeScore: true, threshold: 0.4 });
  }, [tabs, tabGroups]);

  const searchResults = useMemo((): SearchResultItem[] => {
    const parsedCommand = parseCommand(query);
    let results: SearchResultItem[] = [];

    // Define all possible command suggestions
    const commandSuggestions: ActionItem[] = [
      // Previous Tab Command
      ...(previousTabDetails ? [{
        type: 'action',
        id: 'previous-tab-suggest',
        title: `Previous Tab > ${previousTabDetails.title}`,
        action: () => chrome.runtime.sendMessage({ type: 'SWITCH_TO_PREVIOUS_TAB' }, (response) => {
          if (response && response.success) {
            console.log(`Switched to previous tab: ${response.tabId}`);
          } else {
            console.error('Error switching to previous tab:', response.message);
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
        action: () => setQuery('create tab group')
      },
      {
        type: 'action',
        id: 'delete-tab-group-suggest',
        title: 'Delete Tab Group',
        action: () => setQuery('delete tab group')
      }
    ];

    // Filter command suggestions based on query
    const filteredCommandSuggestions = commandSuggestions.filter(cmd =>
      cmd.title.toLowerCase().includes(query.toLowerCase())
    );

    // Add command suggestions to results if query is not a specific command yet and query is not empty
    if ((parsedCommand.type === 'tabSearch' || parsedCommand.type === 'openUrl') && query.trim().length > 0) { // Only show suggestions if not already a specific command
      results.push(...filteredCommandSuggestions);
    }

    switch (parsedCommand.type) {
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
      case 'previousTab':
        results.push({
          type: 'action',
          id: 'previous-tab',
          title: `Previous Tab > ${previousTabDetails?.title || ''}`,
          action: () => chrome.runtime.sendMessage({ type: 'SWITCH_TO_PREVIOUS_TAB' }, (response) => {
            if (response && response.success) {
              console.log(`Switched to previous tab: ${response.tabId}`);
            } else {
              console.error('Error switching to previous tab:', response.message);
            }
          })
        });
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
      case 'createTabGroup':
        results.push({
          type: 'action',
          id: 'create-tab-group',
          title: 'Create Tab Group',
          action: () => {
            setCommandMode(true);
            setActiveCommand('createTabGroup');
            setQuery(''); // Clear query for contextual search
          }
        });
        break;
      case 'deleteTabGroup':
        results.push({
          type: 'action',
          id: 'delete-tab-group',
          title: 'Delete Tab Group',
          action: () => {
            setCommandMode(true);
            setActiveCommand('deleteTabGroup');
            setQuery(''); // Clear query for contextual search
          }
        });
        break;
      case 'close':
        if (parsedCommand.query) {
          const filteredTabs = fuse.search(parsedCommand.query).map(result => result.item);
          results.push(...filteredTabs.map(tab => ({
            type: 'closeTabAction',
            tab: tab,
            title: `Close: ${tab.title}`
          })));
        } else {
          // If 'close' command is typed without query, show all tabs as closable
          results.push(...tabs.map(tab => ({
            type: 'closeTabAction',
            tab: tab,
            title: `Close: ${tab.title}`
          })));
        }
        break;
      case 'tabSearch':
      default:
        let itemsToSearch: (chrome.tabs.Tab | chrome.tabGroups.TabGroup)[] = [];
        if (commandMode && activeCommand === 'close') {
          // In 'close' command mode, search only tabs
          itemsToSearch = tabs;
        } else if (commandMode && activeCommand === 'createTabGroup') {
          // In 'createTabGroup' command mode, search only tabs
          itemsToSearch = tabs;
        } else if (commandMode && activeCommand === 'deleteTabGroup') {
          // In 'deleteTabGroup' command mode, search only tab groups
          itemsToSearch = tabGroups;
        } else {
          // Default: search all tabs
          itemsToSearch = tabs;
        }

        if (!parsedCommand.query && !commandMode) {
          // Sort tabs by last accessed time if no query and not in command mode
          const sortedTabs = [...tabs].sort((a, b) => {
            const timeA = tabAccessTimes[a.id!] || 0;
            const timeB = tabAccessTimes[b.id!] || 0;
            return timeB - timeA; // Descending order (most recent first)
          });
          results.push(...sortedTabs.map((tab) => ({ type: 'tab', tab })));
        } else if (parsedCommand.query) {
          // Apply fuzzy search based on itemsToSearch
          const fuseForContext = new Fuse(itemsToSearch, { keys: ['title', 'url'], includeScore: true, threshold: 0.4 });
          results.push(...fuseForContext.search(parsedCommand.query).map(result => {
            if ('tab' in result.item) {
              return { type: 'tab', tab: result.item.tab };
            } else if ('id' in result.item && 'title' in result.item) { // Assuming it's a TabGroup
              return {
                type: 'action',
                id: `group-${result.item.id}`,
                title: `Group: ${result.item.title || 'Untitled Group'}`,
                action: () => { /* No direct action on search result click for groups */ }
              };
            }
            return null; // Should not happen
          }).filter(Boolean) as SearchResultItem[]);
        } else if (commandMode && activeCommand === 'deleteTabGroup') {
          // If in deleteTabGroup command mode with no query, show all groups
          results.push(...tabGroups.map(group => ({
            type: 'action',
            id: `group-${group.id}`,
            title: `Group: ${group.title || 'Untitled Group'}`,
            action: () => { /* No direct action on search result click for groups */ }
          })));
        } else if (commandMode && (activeCommand === 'close' || activeCommand === 'createTabGroup')) {
          // If in close or createTabGroup command mode with no query, show all tabs
          results.push(...tabs.map((tab) => ({ type: 'tab', tab })));
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

  }, [query, tabs, fuse, fetchTabs, previousTabDetails, tabAccessTimes, commandMode, activeCommand, tabGroups]);

  const handleItemClick = (item: SearchResultItem) => {
    if (commandMode && activeCommand) {
      // In command mode, clicking an item should toggle its selection
      if (item.type === 'tab' || item.type === 'closeTabAction') {
        setSelectedTabIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(item.tab.id!)) {
            newSet.delete(item.tab.id!);}
           else {
            newSet.add(item.tab.id!);}
          return newSet;
        });
      } else if (item.type === 'action' && item.id.startsWith('group-')) {
        // If a group is clicked in command mode, select all tabs in that group
        const groupId = parseInt(item.id.replace('group-', ''));
        if (!isNaN(groupId)) {
          chrome.runtime.sendMessage({ type: 'GET_TAB_GROUP_TABS', groupId }, (response) => {
            if (response.success) {
              setSelectedTabIds(new Set(response.tabIds));
            } else {
              console.error('Error fetching tabs in group:', response.message);
            }
          });
        }
      }
    } else if (item.type === 'tab') {
      chrome.runtime.sendMessage({ type: 'SWITCH_TO_TAB', tabId: item.tab.id });
      onClose(); // Close palette for direct tab switch
    } else if (item.type === 'closeTabAction') {
      chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId: item.tab.id }, fetchTabs);
      onClose(); // Close palette after closing a single tab
    } else if (item.type === 'action') {
      // Determine if the action should enter command mode or execute immediately
      const commandType = parseCommand(query).type; // Re-parse query to get command type
      const requiresCommandMode = commandType === 'close' || commandType === 'createTabGroup' || commandType === 'deleteTabGroup';

      if (requiresCommandMode) {
        setCommandMode(true);
        setActiveCommand(commandType);
        setQuery(''); // Clear query for contextual search
      } else {
        item.action(); // Execute the action directly
        onClose(); // Close palette for immediate actions
      }
    }
  };

  const handleBulkClose = () => {
    if (selectedTabIds.size > 0 && activeCommand === 'close') {
      chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabIds: Array.from(selectedTabIds) }, () => {
        fetchTabs(); // Re-fetch tabs to update UI
        setSelectedTabIds(new Set()); // Clear selection
        onClose(); // Close palette after bulk action
      });
    }
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: number) => {
    e.stopPropagation(); // Prevent the li's onClick from firing
    chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabIds: [tabId] }, fetchTabs);
  };

  // Keyboard navigation logic
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // If a non-navigation key is pressed, refocus the input and reset active item
      const isNavigationKey = ['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab', '`'].includes(event.key);
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
          if (commandMode && activeCommand === 'close' && selectedTabIds.size > 0) {
            handleBulkClose();
          } else if (commandMode && activeCommand === 'createTabGroup' && selectedTabIds.size > 0) {
            // For now, use a default name. We can add a prompt later.
            const groupName = `Group ${new Date().toLocaleTimeString()}`;
            chrome.runtime.sendMessage({ type: 'CREATE_TAB_GROUP', tabIds: Array.from(selectedTabIds), groupName }, (response) => {
              if (response.success) {
                console.log(`Created tab group: ${groupName} with ID: ${response.groupId}`);
                fetchTabs(); // Re-fetch tabs to update UI
                setSelectedTabIds(new Set()); // Clear selection
                onClose(); // Close palette after bulk action
              } else {
                console.error('Error creating tab group:', response.message);
              }
            });
          } else if (commandMode && activeCommand === 'deleteTabGroup' && activeItemIndex >= 0 && activeItemIndex < searchResults.length) {
            const selectedItem = searchResults[activeItemIndex];
            if (selectedItem.type === 'action' && selectedItem.id.startsWith('group-')) {
              const groupId = parseInt(selectedItem.id.replace('group-', ''));
              if (!isNaN(groupId)) {
                chrome.runtime.sendMessage({ type: 'DELETE_TAB_GROUP', groupId }, (response) => {
                  if (response.success) {
                    console.log(`Deleted tab group with ID: ${groupId}`);
                    fetchTabs(); // Re-fetch tabs to update UI
                    setSelectedTabIds(new Set()); // Clear selection
                    onClose(); // Close palette after action
                  } else {
                    console.error('Error deleting tab group:', response.message);
                  }
                });
              }
            }
          } else if (activeItemIndex >= 0 && activeItemIndex < searchResults.length) {
            handleItemClick(searchResults[activeItemIndex]);
          }
          break;
        case 'Tab':
          event.preventDefault();
          if (commandMode && activeCommand && activeItemIndex >= 0 && activeItemIndex < searchResults.length) {
            const activeItem = searchResults[activeItemIndex];
            if (activeItem.type === 'tab' || activeItem.type === 'closeTabAction') {
              setSelectedTabIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(activeItem.tab.id!)) {
                  newSet.delete(activeItem.tab.id!);} 
                 else {
                  newSet.add(activeItem.tab.id!);} 
                return newSet;
              });
            } else if (activeItem.type === 'action' && activeItem.id.startsWith('group-')) {
              // If a group is selected, select all tabs in that group
              const groupId = parseInt(activeItem.id.replace('group-', ''));
              if (!isNaN(groupId)) {
                chrome.runtime.sendMessage({ type: 'GET_TAB_GROUP_TABS', groupId }, (response) => {
                  if (response.success) {
                    setSelectedTabIds(new Set(response.tabIds));
                  } else {
                    console.error('Error fetching tabs in group:', response.message);
                  }
                });
              }
            }
          } else if (activeItemIndex >= 0 && activeItemIndex < searchResults.length) {
            const activeItem = searchResults[activeItemIndex];
            setQuery(activeItem.title);
            // Refocus input and set cursor to end
            setTimeout(() => {
              inputRef.current?.focus();
              inputRef.current?.setSelectionRange(activeItem.title.length, activeItem.title.length);
            }, 0);
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
        case 'Escape': // Already handled by App.tsx, but good to prevent default here too
          event.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [searchResults, activeItemIndex, handleItemClick, handleCloseTab, onClose, query, commandMode, activeCommand, selectedTabIds]);

  // Focus the input field and fetch tabs when the component mounts
  useEffect(() => {
    inputRef.current?.focus();
    fetchTabs();
  }, [fetchTabs]);

  // Reset active item index when search results change
  useEffect(() => {
    setActiveItemIndex(0);
  }, [searchResults]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-[9999] pt-[20vh] backdrop-blur-sm">
      <div className="w-[50vw] max-w-2xl bg-gray-800 text-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            placeholder={commandMode && activeCommand ? `${activeCommand} > ` : "Search tabs, or type 'g ' to google..."}
            className="w-full h-10 bg-gray-700 text-white placeholder-gray-400 p-2 rounded-lg outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {selectedTabIds.size > 0 && (
          <div className="p-2 border-b border-gray-700">
            <h4 className="text-xs text-gray-400 mb-1">Selected Tabs:</h4>
            <div className="flex flex-wrap gap-1">
              {[...selectedTabIds].map(tabId => {
                const tab = tabs.find(t => t.id === tabId);
                return tab ? (
                  <span key={tabId} className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    {tab.favIconUrl &&
                      !tab.favIconUrl.startsWith('http://localhost') &&
                      !tab.favIconUrl.startsWith('http://127.0.0.1') &&
                      <img src={tab.favIconUrl} alt="" className="w-3 h-3" />
                    }
                    {tab.title}
                    <button
                      onClick={() => setSelectedTabIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(tabId);
                        return newSet;
                      })}
                      className="ml-1 text-white hover:text-gray-200 focus:outline-none"
                    >
                      &times;
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
        <div className="border-y border-gray-700 max-h-96 overflow-y-auto">
          <ul>
            {searchResults.map((item, index) => (
              <li
                key={item.type === 'tab' ? item.tab.id : item.id}
                onClick={() => handleItemClick(item)}
                className={`p-2 text-sm cursor-pointer flex items-center gap-2 justify-between ${
                  index === activeItemIndex ? 'bg-gray-600' : 'hover:bg-gray-700'
                }`}
              >
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
            ))}
          </ul>
        </div>
        <div className="p-2 text-xs text-gray-400">
          <span><b>Tip:</b> Use Shift+Shift to open, Esc to close.</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
