/**
 * CommandPaletteFooter - Footer component with keyboard shortcuts
 */

interface CommandPaletteFooterProps {
  commandMode: boolean;
  hasResults: boolean;
  hasSelection: boolean;
}

const CommandPaletteFooter = ({ commandMode, hasResults, hasSelection }: CommandPaletteFooterProps) => {
  return (
    <div className="p-3 border-t border-gray-200 text-xs text-gray-500 bg-gray-50">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">↑↓</kbd>
          <span>navigate</span>
          <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Enter</kbd>
          <span>select</span>
          {!commandMode && hasResults && (
            <>
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Tab</kbd>
              <span>command mode</span>
            </>
          )}
          <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Esc</kbd>
          <span>close</span>
        </div>

        {commandMode && (
          <div className="flex gap-4">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Space</kbd>
            <span>toggle</span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Ctrl+A</kbd>
            <span>select all</span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Ctrl+D</kbd>
            <span>clear</span>
            {hasSelection && (
              <>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Shift+Enter</kbd>
                <span>execute</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandPaletteFooter;