/**
 * Keybinding System - Main exports and initialization
 */

export { KeybindingManager } from './KeybindingManager';
export { NavigationKeys } from './NavigationKeys';
export { SelectionKeys } from './SelectionKeys';

export type {
  KeyHandler,
  KeybindingContext
} from './KeybindingManager';

export type {
  NavigationActions
} from './NavigationKeys';

export type {
  SelectionActions
} from './SelectionKeys';

/**
 * Create a complete keybinding setup
 */
export function createKeybindingSystem(
  navigationActions: NavigationActions,
  selectionActions: SelectionActions
) {
  const manager = new KeybindingManager();
  const navigationKeys = new NavigationKeys(manager, navigationActions);
  const selectionKeys = new SelectionKeys(manager, selectionActions);

  return {
    manager,
    navigationKeys,
    selectionKeys,

    // Cleanup function
    destroy: () => {
      navigationKeys.destroy();
      selectionKeys.destroy();
      manager.clear();
    }
  };
}