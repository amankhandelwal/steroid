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

  const fetchTabs = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'GET_TABS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching tabs:', chrome.runtime.lastError.message);
        return;
      }
      setTabs(response || []);
    });
  }, []);

  const fuse = useMemo(() => new Fuse(tabs, { keys: ['title', 'url'], includeScore: true, threshold: 0.4 }), [tabs]);

  const searchResults = useMemo((): SearchResultItem[] => {
    const parsedCommand = parseCommand(query);
    let results: SearchResultItem[] = [];

    // Define all possible command suggestions
    const commandSuggestions: ActionItem[] = [
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
      }
    ];

    // Filter command suggestions based on query
    const filteredCommandSuggestions = commandSuggestions.filter(cmd =>
      cmd.title.toLowerCase().includes(query.toLowerCase())
    );

    // Add command suggestions to results if query is not a specific command yet
    if (parsedCommand.type === 'tabSearch' || parsedCommand.type === 'openUrl') { // Only show suggestions if not already a specific command
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
        if (!parsedCommand.query) {
          results.push(...tabs.map((tab) => ({ type: 'tab', tab })));
        } else {
          results.push(...fuse.search(parsedCommand.query).map(result => ({ type: 'tab', tab: result.item })));
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

  }, [query, tabs, fuse, fetchTabs]);

  const handleItemClick = (item: SearchResultItem) => {
    if (item.type === 'tab') {
      chrome.runtime.sendMessage({ type: 'SWITCH_TO_TAB', tabId: item.tab.id });
    } else if (item.type === 'closeTabAction') {
      chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId: item.tab.id }, fetchTabs);
    } else {
      item.action();
    }
    onClose();
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
          if (activeItemIndex >= 0 && activeItemIndex < searchResults.length) {
            handleItemClick(searchResults[activeItemIndex]);
          }
          break;
        case 'Tab':
          event.preventDefault();
          if (activeItemIndex >= 0 && activeItemIndex < searchResults.length) {
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
  }, [searchResults, activeItemIndex, handleItemClick, handleCloseTab, onClose, query]);

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
            placeholder="Search tabs, or type 'g ' to google..."
            className="w-full h-10 bg-gray-700 text-white placeholder-gray-400 p-2 rounded-lg outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
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
