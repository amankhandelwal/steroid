/**
 * Navigation Key Handlers - Arrow keys, Page Up/Down, Home/End
 */

import { KeybindingManager, KeyHandler } from './KeybindingManager';

export interface NavigationActions {
  moveUp: () => void;
  moveDown: () => void;
  moveToFirst: () => void;
  moveToLast: () => void;
  pageUp: () => void;
  pageDown: () => void;
}

export class NavigationKeys {
  private manager: KeybindingManager;
  private actions: NavigationActions;
  private handlers: KeyHandler[] = [];

  constructor(manager: KeybindingManager, actions: NavigationActions) {
    this.manager = manager;
    this.actions = actions;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Arrow Up - Move to previous item
    const upHandler = KeybindingManager.createHandler('arrowup', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.totalItems > 0) {
        this.actions.moveUp();
        return false; // Prevent default
      }
    });

    // Arrow Down - Move to next item
    const downHandler = KeybindingManager.createHandler('arrowdown', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.totalItems > 0) {
        this.actions.moveDown();
        return false; // Prevent default
      }
    });

    // Home - Move to first item
    const homeHandler = KeybindingManager.createHandler('home', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.totalItems > 0) {
        this.actions.moveToFirst();
        return false; // Prevent default
      }
    });

    // End - Move to last item
    const endHandler = KeybindingManager.createHandler('end', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.totalItems > 0) {
        this.actions.moveToLast();
        return false; // Prevent default
      }
    });

    // Page Up - Move up by page
    const pageUpHandler = KeybindingManager.createHandler('pageup', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.totalItems > 0) {
        this.actions.pageUp();
        return false; // Prevent default
      }
    });

    // Page Down - Move down by page
    const pageDownHandler = KeybindingManager.createHandler('pagedown', (event) => {
      const context = this.manager.getContext();
      if (context.isModalOpen && context.totalItems > 0) {
        this.actions.pageDown();
        return false; // Prevent default
      }
    });

    // Store handlers for cleanup
    this.handlers = [
      upHandler,
      downHandler,
      homeHandler,
      endHandler,
      pageUpHandler,
      pageDownHandler
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