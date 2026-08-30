/**
 * CommandPaletteFooter - Footer component with keyboard shortcuts
 *
 * Styles live in the sibling `CommandPaletteFooter.css`, which is pulled into
 * the bundle by `src/index.css` (the single stylesheet injected into the
 * extension's shadow root).
 */

interface CommandPaletteFooterProps {
  commandMode: boolean;
  hasResults: boolean;
  hasSelection: boolean;
}

interface ShortcutHintProps {
  /** Key combination as rendered inside the <kbd> chip. */
  keys: string;
  /** What the combination does. */
  label: string;
}

/** One "<kbd> + description" pair in the hint bar. */
const ShortcutHint = ({ keys, label }: ShortcutHintProps) => (
  <span className="steroid-footer-hint">
    <kbd className="steroid-footer-kbd">{keys}</kbd>
    <span>{label}</span>
  </span>
);

const CommandPaletteFooter = ({ commandMode, hasResults, hasSelection }: CommandPaletteFooterProps) => {
  return (
    <div className="steroid-footer">
      <div className="steroid-footer-row">
        <div className="steroid-footer-group">
          <ShortcutHint keys="↑↓" label="navigate" />
          <ShortcutHint keys="Enter" label="select" />
          {!commandMode && hasResults && (
            <ShortcutHint keys="Tab" label="command mode" />
          )}
          <ShortcutHint keys="Esc" label="close" />
        </div>

        {commandMode && (
          <div className="steroid-footer-group">
            <ShortcutHint keys="Ctrl+A" label="select all" />
            <ShortcutHint keys="Ctrl+D" label="clear" />
            {hasSelection && (
              <ShortcutHint keys="Shift+Enter" label="execute" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandPaletteFooter;
