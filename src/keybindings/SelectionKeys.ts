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
  enterCommandMode: () => void;
  exitCommandMode: () => void;
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
    // Enter - Execute selected item(s) or enter command mode
    const enterHandler = KeybindingManager.createHandler('enter', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen) {
        if (!context.isInputFocused) {
          this.actions.executeSelected();
          return false; // Prevent default
        }
      }
    });

    // Escape - Close modal or exit command mode
    const escapeHandler = KeybindingManager.createHandler('escape', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen) {
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
      if (context.isModalOpen && !context.commandMode && !context.isInputFocused) {
        this.actions.enterCommandMode();
        return false; // Prevent default
      }
    });

    // Space - Toggle selection in command mode
    const spaceHandler = KeybindingManager.createHandler(' ', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.commandMode && !context.isInputFocused) {
        this.actions.toggleSelection();
        return false; // Prevent default
      }
    });

    // Ctrl+A - Select all in command mode
    const selectAllHandler = KeybindingManager.createHandler('a', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.commandMode && !context.isInputFocused) {
        this.actions.selectAll();
        return false; // Prevent default
      }
    }, { ctrl: true });

    // Ctrl+D or Delete - Clear selection
    const clearSelectionHandler = KeybindingManager.createHandler('d', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.commandMode && context.hasSelection && !context.isInputFocused) {
        this.actions.clearSelection();
        return false; // Prevent default
      }
    }, { ctrl: true });

    // Delete key - Clear selection (alternative)
    const deleteHandler = KeybindingManager.createHandler('delete', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.commandMode && context.hasSelection && !context.isInputFocused) {
        this.actions.clearSelection();
        return false; // Prevent default
      }
    });

    // Store handlers for cleanup
    this.handlers = [
      enterHandler,
      escapeHandler,
      tabHandler,
      spaceHandler,
      selectAllHandler,
      clearSelectionHandler,
      deleteHandler
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