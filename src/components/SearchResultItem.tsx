/**
 * SearchResultItem - Individual search result item component
 */

import type { SearchResultItem } from '../commands/CommandTypes';

interface SearchResultItemProps {
  item: SearchResultItem;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  commandMode: boolean;
  multiSelect: boolean;
  onSelect: (index: number) => void;
  onToggleSelection?: (tabId: number) => void;
}

const SearchResultItem = ({
  item,
  index,
  isActive,
  isSelected,
  commandMode,
  multiSelect,
  onSelect,
  onToggleSelection
}: SearchResultItemProps) => {
  let className = `p-3 cursor-pointer transition-all duration-150 border-l-4 ${
    isActive ? 'bg-blue-50 border-l-blue-500 shadow-sm' : 'border-l-transparent hover:bg-gray-50'
  }`;

  if (isSelected) {
    className += ' bg-green-50 border-l-green-500';
  }

  const handleClick = () => {
    onSelect(index);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (item.type === 'tab' && onToggleSelection) {
      onToggleSelection(item.tab.id!);
    }
  };

  return (
    <div
      data-item-index={index}
      className={className}
      onClick={handleClick}
    >
      {item.type === 'tab' && (
        <div className="flex items-center gap-3">
          {commandMode && multiSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          )}
          <img
            src={item.tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>'}
            alt=""
            className="w-4 h-4 flex-shrink-0"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-gray-900 truncate">
              {item.tab.title || 'Untitled'}
            </div>
            <div className="text-sm text-gray-500 truncate">
              {item.tab.url}
            </div>
          </div>
          {item.tab.audible && (
            <div className="text-blue-500 text-sm">🔊</div>
          )}
          {item.tab.pinned && (
            <div className="text-orange-500 text-sm">📌</div>
          )}
        </div>
      )}

      {item.type === 'action' && (
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 flex-shrink-0 text-blue-500">⚡</div>
          <div className="text-gray-900 font-medium">
            {item.title}
          </div>
        </div>
      )}

      {item.type === 'closeTabAction' && (
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 flex-shrink-0 text-red-500">✕</div>
          <div className="min-w-0 flex-1">
            <div className="text-red-700 font-medium truncate">
              {item.title}
            </div>
            <div className="text-sm text-red-500 truncate">
              {item.tab.url}
            </div>
          </div>
        </div>
      )}

      {item.type === 'tabGroup' && (
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 flex-shrink-0 text-purple-500">📁</div>
          <div className="min-w-0 flex-1">
            <div className="text-gray-900 font-medium truncate">
              {item.title}
            </div>
            <div className="text-sm text-gray-500">
              Tab Group
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResultItem;