/**
 * CommandPaletteHeader - Header component for the command palette
 */

import { forwardRef } from 'react';

interface SelectedTab {
  id: number;
  title: string;
  favIconUrl?: string;
}

interface CommandPaletteHeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  commandMode: boolean;
  currentCommandName?: string;
  hasSelection: boolean;
  selectedCount: number;
  selectedTabs: SelectedTab[];
  onRemoveSelection: (tabId: number) => void;
}

const CommandPaletteHeader = forwardRef<HTMLInputElement, CommandPaletteHeaderProps>(
  ({
    query,
    onQueryChange,
    commandMode,
    currentCommandName,
    hasSelection,
    selectedCount,
    selectedTabs,
    onRemoveSelection
  }, ref) => {
    const placeholder = commandMode
      ? `Search ${currentCommandName}...`
      : "Type a command or search...";

    return (
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {commandMode && currentCommandName && (
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {currentCommandName}
            </div>
          )}
          <input
            ref={ref}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 text-lg border-none outline-none bg-transparent placeholder-gray-400"
          />
          {hasSelection && (
            <div className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {selectedCount} selected
            </div>
          )}
        </div>

        {/* Selected tabs display in command mode */}
        {commandMode && hasSelection && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-2 font-medium">Selected tabs:</div>
            <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
              {selectedTabs.map(tab => (
                <div
                  key={tab.id}
                  className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs flex items-center gap-2 max-w-48"
                >
                  <img
                    src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>'}
                    alt=""
                    className="w-3 h-3 flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
                    }}
                  />
                  <span className="truncate">{tab.title || 'Untitled'}</span>
                  <button
                    onClick={() => onRemoveSelection(tab.id)}
                    className="text-green-600 hover:text-green-800 hover:bg-green-200 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                    title="Remove from selection"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

CommandPaletteHeader.displayName = 'CommandPaletteHeader';

export default CommandPaletteHeader;