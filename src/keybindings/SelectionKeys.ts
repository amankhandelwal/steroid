/**
 * Selection Key Handlers - Enter, Escape, Tab, Space for selection/execution
 */

import { KeybindingManager, KeyHandler } from './KeybindingManager';

export interface SelectionActions {
  executeSelected: () => void;
  toggleSelection: () => void;
  selectAll: () => void;
  clearSelection: () => void;
  closeModal: () => void;
  closeHighlightedTab: () => void;
  enterCommandMode: () => void;
  exitCommandMode: () => void;
  executeCurrentCommand: () => void;
}

export class SelectionKeys {
  private manager: KeybindingManager;
  private actions: SelectionActions;
  private handlers: KeyHandler[] = [];

  constructor(manager: KeybindingManager, actions: SelectionActions) {
    this.manager = manager;
    this.actions = actions;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Enter - Execute selected item(s) or enter command mode.
    // Not gated on DOM focus: the search input is permanently focused for the
    // palette's lifetime, so a focus gate would make this handler unreachable.
    // IME composition is excluded so Enter can still commit a composition.
    const enterHandler = KeybindingManager.createHandler('enter', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && !event.isComposing) {
        this.actions.executeSelected();
        return false; // Prevent default
      }
    });

    // Escape - Close modal or exit command mode
    const escapeHandler = KeybindingManager.createHandler('escape', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && !event.isComposing) {
        if (context.commandMode) {
          this.actions.exitCommandMode();
        } else {
          this.actions.closeModal();
        }
        return false; // Prevent default
      }
    });

    // Tab - Enter command mode for applicable commands
    const tabHandler = KeybindingManager.createHandler('tab', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && !context.commandMode && !event.isComposing) {
        this.actions.enterCommandMode();
        return false; // Prevent default
      }
    });


    // Ctrl+A - Select all in command mode
    const selectAllHandler = KeybindingManager.createHandler('a', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.commandMode && !event.isComposing) {
        this.actions.selectAll();
        return false; // Prevent default
      }
    }, { ctrl: true });

    // Ctrl+D or Delete - Clear selection
    const clearSelectionHandler = KeybindingManager.createHandler('d', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.commandMode && context.hasSelection && !event.isComposing) {
        this.actions.clearSelection();
        return false; // Prevent default
      }
    }, { ctrl: true });

    // Delete key - Clear selection (alternative)
    const deleteHandler = KeybindingManager.createHandler('delete', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.commandMode && context.hasSelection && !event.isComposing) {
        this.actions.clearSelection();
        return false; // Prevent default
      }
    });

    // Backtick (`) - Close highlighted tab without closing modal.
    // Matched by physical key position (`code: 'Backquote'`), not by the
    // character it types (`key`) — some keyboard layouts map this key to a
    // different character entirely (e.g. some India-locale layouts type '₹'
    // here instead of '`'), and matching on `key` would silently never fire
    // on those layouts, letting the browser type that character instead.
    // Only acts when a result row is actually highlighted; the callback itself
    // additionally no-ops when that row is not a tab. Residual: while this is
    // registered, this key cannot be typed into the search query.
    const backtickHandler = KeybindingManager.createHandler('`', (event) => {
      const context = this.manager.getContext();
      const hasHighlightedItem =
        context.activeItemIndex >= 0 && context.activeItemIndex < context.totalItems;
      if (context.isModalOpen && !event.isComposing && hasHighlightedItem) {
        this.actions.closeHighlightedTab();
        return false; // Prevent default
      }
    }, { code: 'Backquote' });

    // Shift+Enter - Execute current command (universal)
    const shiftEnterHandler = KeybindingManager.createHandler('enter', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.commandMode && !event.isComposing) {
        this.actions.executeCurrentCommand();
        return false; // Prevent default
      }
    }, { shift: true });

    // Ctrl+Enter - Execute current command (universal fallback)
    const ctrlEnterHandler = KeybindingManager.createHandler('enter', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.commandMode && !event.isComposing) {
        this.actions.executeCurrentCommand();
        return false; // Prevent default
      }
    }, { ctrl: true });

    // Store handlers for cleanup
    this.handlers = [
      enterHandler,
      escapeHandler,
      backtickHandler,
      tabHandler,
      selectAllHandler,
      clearSelectionHandler,
      deleteHandler,
      shiftEnterHandler,
      ctrlEnterHandler
    ];

    // Register all handlers
    this.handlers.forEach(handler => this.manager.register(handler));
  }

  /**
   * Cleanup - unregister all handlers
   */
  destroy(): void {
    this.handlers.forEach(handler => this.manager.unregister(handler));
    this.handlers = [];
  }
}