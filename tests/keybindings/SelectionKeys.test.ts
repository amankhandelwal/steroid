/**
 * Selection keybindings — the action handlers must fire while the search input
 * holds DOM focus (FIND-001: the removed `isInputFocused` gate made every one
 * of them permanently unreachable).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createKeybindingSystem } from '../../src/keybindings';
import type { KeybindingContext } from '../../src/keybindings';
import type { NavigationActions } from '../../src/keybindings/NavigationKeys';
import type { SelectionActions } from '../../src/keybindings/SelectionKeys';

interface FakeKeyEvent {
  key: string;
  code?: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
  preventDefault: ReturnType<typeof vi.fn>;
  stopPropagation: ReturnType<typeof vi.fn>;
}

/** Build a KeyboardEvent-shaped stub; the manager only reads these fields. */
function keyEvent(key: string, overrides: Partial<FakeKeyEvent> = {}): FakeKeyEvent {
  return {
    key,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    isComposing: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides
  };
}

const OPEN_CONTEXT: KeybindingContext = {
  isModalOpen: true,
  commandMode: false,
  hasSelection: false,
  selectedCount: 0,
  activeItemIndex: 0,
  totalItems: 5
};

describe('SelectionKeys', () => {
  let navigation: NavigationActions;
  let selection: SelectionActions;
  let system: ReturnType<typeof createKeybindingSystem>;

  const press = (event: FakeKeyEvent, context: Partial<KeybindingContext> = {}) => {
    system.manager.updateContext({ ...OPEN_CONTEXT, ...context });
    system.manager.handleKeyEvent(event as unknown as KeyboardEvent);
  };

  beforeEach(() => {
    navigation = {
      moveUp: vi.fn(),
      moveDown: vi.fn(),
      moveToFirst: vi.fn(),
      moveToLast: vi.fn(),
      pageUp: vi.fn(),
      pageDown: vi.fn()
    };
    selection = {
      executeSelected: vi.fn(),
      toggleSelection: vi.fn(),
      selectAll: vi.fn(),
      clearSelection: vi.fn(),
      closeModal: vi.fn(),
      closeHighlightedTab: vi.fn(),
      enterCommandMode: vi.fn(),
      exitCommandMode: vi.fn(),
      executeCurrentCommand: vi.fn()
    };
    system = createKeybindingSystem(navigation, selection);
  });

  it('executes the highlighted item on Enter', () => {
    const event = keyEvent('Enter');
    press(event);

    expect(selection.executeSelected).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('closes the highlighted tab on the backtick key position rather than typing it', () => {
    // Matched by physical position so non-US layouts still reach the handler.
    const event = keyEvent('₹', { code: 'Backquote' });
    press(event);

    expect(selection.closeHighlightedTab).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('ignores backtick when no row is highlighted', () => {
    press(keyEvent('`', { code: 'Backquote' }), { activeItemIndex: -1 });
    expect(selection.closeHighlightedTab).not.toHaveBeenCalled();
  });

  it('enters command mode on Tab outside command mode', () => {
    press(keyEvent('Tab'));
    expect(selection.enterCommandMode).toHaveBeenCalledTimes(1);
  });

  it('selects all and clears selection with Ctrl+A / Ctrl+D in command mode', () => {
    press(keyEvent('a', { ctrlKey: true }), { commandMode: true });
    press(keyEvent('d', { ctrlKey: true }), { commandMode: true, hasSelection: true });

    expect(selection.selectAll).toHaveBeenCalledTimes(1);
    expect(selection.clearSelection).toHaveBeenCalledTimes(1);
  });

  it('clears selection with the Delete key in command mode', () => {
    press(keyEvent('Delete'), { commandMode: true, hasSelection: true });
    expect(selection.clearSelection).toHaveBeenCalledTimes(1);
  });

  it('runs the current command on Shift+Enter and Ctrl+Enter in command mode', () => {
    press(keyEvent('Enter', { shiftKey: true }), { commandMode: true });
    press(keyEvent('Enter', { ctrlKey: true }), { commandMode: true });

    expect(selection.executeCurrentCommand).toHaveBeenCalledTimes(2);
  });

  it('exits command mode on Escape, and closes the palette otherwise', () => {
    press(keyEvent('Escape'), { commandMode: true });
    expect(selection.exitCommandMode).toHaveBeenCalledTimes(1);
    expect(selection.closeModal).not.toHaveBeenCalled();

    press(keyEvent('Escape'));
    expect(selection.closeModal).toHaveBeenCalledTimes(1);
  });

  it('stays out of the way during IME composition', () => {
    const event = keyEvent('Enter', { isComposing: true });
    press(event);

    expect(selection.executeSelected).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('does nothing when the palette is closed', () => {
    press(keyEvent('Enter'), { isModalOpen: false });
    expect(selection.executeSelected).not.toHaveBeenCalled();
  });

  it('unregisters every handler on destroy', () => {
    system.destroy();
    press(keyEvent('Enter'));

    expect(selection.executeSelected).not.toHaveBeenCalled();
  });
});
