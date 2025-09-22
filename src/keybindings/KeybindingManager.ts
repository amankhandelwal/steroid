/**
 * Keybinding Manager - Centralized keyboard event handling
 */

export interface KeyHandler {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  handler: (event: KeyboardEvent) => boolean | void; // Return false to prevent default
}

export interface KeybindingContext {
  isModalOpen: boolean;
  commandMode: boolean;
  hasSelection: boolean;
  selectedCount: number;
  isInputFocused: boolean;
  activeItemIndex: number;
  totalItems: number;
}

export class KeybindingManager {
  private handlers: KeyHandler[] = [];
  private context: KeybindingContext = {
    isModalOpen: false,
    commandMode: false,
    hasSelection: false,
    selectedCount: 0,
    isInputFocused: false,
    activeItemIndex: -1,
    totalItems: 0
  };

  /**
   * Register a key handler
   */
  register(handler: KeyHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Unregister a key handler
   */
  unregister(handler: KeyHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers = [];
  }

  /**
   * Update the current context
   */
  updateContext(newContext: Partial<KeybindingContext>): void {
    this.context = { ...this.context, ...newContext };
  }

  /**
   * Get current context
   */
  getContext(): KeybindingContext {
    return { ...this.context };
  }

  /**
   * Handle keyboard event
   */
  handleKeyEvent(event: KeyboardEvent): boolean {
    // Find matching handlers
    const matchingHandlers = this.handlers.filter(handler =>
      this.matchesKey(event, handler)
    );

    // Execute handlers in registration order
    for (const handler of matchingHandlers) {
      const result = handler.handler(event);

      // If handler returns false, prevent default and stop propagation
      if (result === false) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    }

    return true;
  }

  /**
   * Check if event matches handler key combination
   */
  private matchesKey(event: KeyboardEvent, handler: KeyHandler): boolean {
    // Normalize key comparison (case-insensitive for letters)
    const eventKey = event.key.toLowerCase();
    const handlerKey = handler.key.toLowerCase();

    if (eventKey !== handlerKey) {
      return false;
    }

    // Check modifier keys
    if ((handler.ctrlKey ?? false) !== event.ctrlKey) return false;
    if ((handler.shiftKey ?? false) !== event.shiftKey) return false;
    if ((handler.altKey ?? false) !== event.altKey) return false;
    if ((handler.metaKey ?? false) !== event.metaKey) return false;

    return true;
  }

  /**
   * Create a key handler with common patterns
   */
  static createHandler(
    key: string,
    handler: (event: KeyboardEvent) => boolean | void,
    modifiers: {
      ctrl?: boolean;
      shift?: boolean;
      alt?: boolean;
      meta?: boolean;
    } = {}
  ): KeyHandler {
    return {
      key,
      ctrlKey: modifiers.ctrl,
      shiftKey: modifiers.shift,
      altKey: modifiers.alt,
      metaKey: modifiers.meta,
      handler
    };
  }
}