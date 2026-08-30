/**
 * SearchResultItem - Individual search result item component
 *
 * Styles live in the sibling `SearchResultItem.css`. It is pulled into the
 * bundle by `src/index.css`, which is the single stylesheet injected into the
 * extension's shadow root (a direct `import './SearchResultItem.css'` here
 * would be emitted as an unused `dist/assets/content.css`).
 */

import type { SearchResultItem } from '../commands/CommandTypes';
import { SpeakerIcon, PinIcon, FolderIcon, BoltIcon, CloseIcon } from './icons/Icons';

/** Neutral placeholder shown when a tab has no favicon, or its favicon 404s. */
const FALLBACK_FAVICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';

interface SearchResultItemProps {
  item: SearchResultItem;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  commandMode: boolean;
  multiSelect: boolean;
  onSelect: (index: number) => void;
  onToggleSelection?: (tabId: number) => void;
  onToggleGroupSelection?: (groupId: number) => void;
}

/** Build the row's class list from its highlight/selection state. */
const buildRowClassName = (isActive: boolean, isSelected: boolean): string => {
  const classNames = ['steroid-result-row'];
  if (isActive) classNames.push('steroid-result-row--active');
  if (isSelected) classNames.push('steroid-result-row--selected');
  return classNames.join(' ');
};

const SearchResultItem = ({
  item,
  index,
  isActive,
  isSelected,
  commandMode,
  multiSelect,
  onSelect,
  onToggleSelection,
  onToggleGroupSelection
}: SearchResultItemProps) => {
  const className = buildRowClassName(isActive, isSelected);

  const handleClick = () => {
    onSelect(index);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (item.type === 'tab' && onToggleSelection) {
      onToggleSelection(item.tab.id!);
    }
  };

  const handleGroupCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (item.type === 'tabGroup' && onToggleGroupSelection) {
      onToggleGroupSelection(item.group.id);
    }
  };

  const handleFaviconError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = FALLBACK_FAVICON;
  };

  return (
    <div
      id={`steroid-result-${index}`}
      data-item-index={index}
      role="option"
      aria-selected={isActive}
      className={className}
      onClick={handleClick}
    >
      {item.type === 'tab' && (
        <div className="steroid-result-content">
          {commandMode && multiSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
              aria-label={`Select tab: ${item.tab.title || 'Untitled'}`}
              className="steroid-result-checkbox"
            />
          )}
          <img
            src={item.tab.favIconUrl || FALLBACK_FAVICON}
            alt=""
            className="steroid-result-favicon"
            onError={handleFaviconError}
          />
          <div className="steroid-result-text">
            <div className="steroid-result-title">
              {item.tab.title || 'Untitled'}
            </div>
            <div className="steroid-result-url">
              {item.tab.url}
            </div>
          </div>
          {item.tab.audible && (
            <div className="steroid-result-marker" role="img" aria-label="Playing audio">
              <SpeakerIcon className="steroid-result-icon steroid-result-icon--accent" />
            </div>
          )}
          {item.tab.pinned && (
            <div className="steroid-result-marker" role="img" aria-label="Pinned">
              <PinIcon className="steroid-result-icon steroid-result-icon--muted" />
            </div>
          )}
        </div>
      )}

      {item.type === 'action' && (
        <div className="steroid-result-content">
          <BoltIcon className="steroid-result-icon steroid-result-icon--accent" />
          <div className="steroid-result-title">
            {item.title}
          </div>
        </div>
      )}

      {item.type === 'closeTabAction' && (
        <div className="steroid-result-content">
          <img
            src={item.tab.favIconUrl || FALLBACK_FAVICON}
            alt=""
            className="steroid-result-favicon"
            onError={handleFaviconError}
          />
          <div className="steroid-result-text">
            <div className="steroid-result-title">
              Close: {item.tab.title || 'Untitled'}
            </div>
            <div className="steroid-result-url">
              {item.tab.url}
            </div>
          </div>
          <div className="steroid-result-marker">
            <CloseIcon className="steroid-result-icon steroid-result-icon--danger" />
          </div>
        </div>
      )}

      {item.type === 'tabGroup' && (
        <div className="steroid-result-content">
          {commandMode && multiSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleGroupCheckboxChange}
              aria-label={`Select group: ${item.title}`}
              className="steroid-result-checkbox"
            />
          )}
          <FolderIcon className="steroid-result-icon steroid-result-icon--accent" />
          <div className="steroid-result-text">
            <div className="steroid-result-title">
              {item.title}
            </div>
            <div className="steroid-result-subtitle">
              Tab Group
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResultItem;
