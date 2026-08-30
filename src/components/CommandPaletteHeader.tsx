/**
 * CommandPaletteHeader - Header component for the command palette
 *
 * Styles live in the sibling `CommandPaletteHeader.css`, which is pulled into
 * the bundle by `src/index.css` (the single stylesheet injected into the
 * extension's shadow root).
 */

import { forwardRef } from 'react';

/** Neutral placeholder shown when a tab has no favicon, or its favicon 404s. */
const FALLBACK_FAVICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';

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
}

const CommandPaletteHeader = forwardRef<HTMLInputElement, CommandPaletteHeaderProps>(
  ({
    query,
    onQueryChange,
    commandMode,
    currentCommandName,
    hasSelection,
    selectedCount,
    selectedTabs
  }, ref) => {
    const placeholder = commandMode
      ? `Search ${currentCommandName}...`
      : "Type a command or search...";

    const handleFaviconError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      e.currentTarget.src = FALLBACK_FAVICON;
    };

    return (
      <div className="steroid-header">
        <div className="steroid-header-row">
          {commandMode && currentCommandName && (
            <div className="steroid-header-badge">
              {currentCommandName}
            </div>
          )}
          <input
            ref={ref}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="steroid-header-input"
          />
          {hasSelection && (
            <div className="steroid-header-count">
              {selectedCount} selected
            </div>
          )}
        </div>

        {/* Selected tabs display in command mode */}
        {commandMode && hasSelection && (
          <div className="steroid-header-selection">
            <div className="steroid-header-selection-label">Selected tabs:</div>
            <div className="steroid-header-chips">
              {selectedTabs.map(tab => (
                <div key={tab.id} className="steroid-header-chip">
                  <img
                    src={tab.favIconUrl || FALLBACK_FAVICON}
                    alt=""
                    className="steroid-header-chip-favicon"
                    onError={handleFaviconError}
                  />
                  <span className="steroid-header-chip-title">{tab.title || 'Untitled'}</span>
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
