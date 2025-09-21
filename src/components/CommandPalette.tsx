import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Fuse from 'fuse.js';

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

type SearchResultItem = TabItem | ActionItem;

interface CommandPaletteProps {
  onClose: () => void;
}

const CommandPalette = ({ onClose }: CommandPaletteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [query, setQuery] = useState('');

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
    if (query.startsWith('g ') || query.startsWith('google ')) {
      const searchQuery = query.replace(/^(g|google)\s+/, '');
      return [{
        type: 'action',
        id: 'google-search',
        title: `Google "${searchQuery}"`,
        action: () => chrome.runtime.sendMessage({ type: 'OPEN_URL', url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}` })
      }];
    }

    // Basic URL detection
    if (query.includes('.') && !query.includes(' ')) {
      return [{
        type: 'action',
        id: 'open-url',
        title: `Open URL: ${query}`,
        action: () => chrome.runtime.sendMessage({ type: 'OPEN_URL', url: `http://${query}` })
      }];
    }

    if (!query) {
      return tabs.map((tab) => ({ type: 'tab', tab }));
    }

    return fuse.search(query).map(result => ({ type: 'tab', tab: result.item }));

  }, [query, tabs, fuse]);

  const handleItemClick = (item: SearchResultItem) => {
    if (item.type === 'tab') {
      chrome.runtime.sendMessage({ type: 'SWITCH_TO_TAB', tabId: item.tab.id });
    } else {
      item.action();
    }
    onClose();
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: number) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'CLOSE_TAB', tabId }, fetchTabs);
  };

  useEffect(() => {
    inputRef.current?.focus();
    fetchTabs();
  }, [fetchTabs]);

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
            {searchResults.map((item) => (
              <li
                key={item.type === 'tab' ? item.tab.id : item.id}
                onClick={() => handleItemClick(item)}
                className="p-2 text-sm hover:bg-gray-700 cursor-pointer flex items-center gap-2 justify-between"
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
