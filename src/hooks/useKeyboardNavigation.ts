/**
 * useKeyboardNavigation - Keyboard navigation hook using the keybinding system
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { createKeybindingSystem } from '../keybindings';
import type { NavigationActions, SelectionActions } from '../keybindings';

export interface UseKeyboardNavigationProps {
  /**
   * The palette's root element — every key event from the palette bubbles
   * through it. Listening here rather than on `document` is required: key
   * events are sealed at the shadow host (`sealKeyEventsAtHost`) so they never
   * reach the page's hotkey handlers, which means they never reach `document`
   * for us either.
   */
  containerRef: RefObject<HTMLElement | null>;
  isModalOpen: boolean;
  commandMode: boolean;
  hasSelection: boolean;
  selectedCount: number;
  activeItemIndex: number;
  totalItems: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToFirst: () => void;
  onMoveToLast: () => void;
  onPageUp: () => void;
  onPageDown: () => void;
  onExecuteSelected: () => void;
  onToggleSelection: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCloseModal: () => void;
  onCloseHighlightedTab: () => void;
  onEnterCommandMode: () => void;
  onExitCommandMode: () => void;
  onExecuteCurrentCommand: () => void;
}

export function useKeyboardNavigation(props: UseKeyboardNavigationProps) {
  const keybindingSystemRef = useRef<ReturnType<typeof createKeybindingSystem> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const navigationActions: NavigationActions = {
      moveUp: props.onMoveUp,
      moveDown: props.onMoveDown,
      moveToFirst: props.onMoveToFirst,
      moveToLast: props.onMoveToLast,
      pageUp: props.onPageUp,
      pageDown: props.onPageDown
    };

    const selectionActions: SelectionActions = {
      executeSelected: props.onExecuteSelected,
      toggleSelection: props.onToggleSelection,
      selectAll: props.onSelectAll,
      clearSelection: props.onClearSelection,
      closeModal: props.onCloseModal,
      closeHighlightedTab: props.onCloseHighlightedTab,
      enterCommandMode: props.onEnterCommandMode,
      exitCommandMode: props.onExitCommandMode,
      executeCurrentCommand: props.onExecuteCurrentCommand
    };

    // Create keybinding system
    keybindingSystemRef.current = createKeybindingSystem(navigationActions, selectionActions);

    // Set up global keyboard event listener
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle events when modal is open
      if (!props.isModalOpen) {
        return;
      }

      // Update context
      keybindingSystemRef.current?.manager.updateContext({
        isModalOpen: props.isModalOpen,
        commandMode: props.commandMode,
        hasSelection: props.hasSelection,
        selectedCount: props.selectedCount,
        activeItemIndex: props.activeItemIndex,
        totalItems: props.totalItems
      });

      // Handle the event
      keybindingSystemRef.current?.manager.handleKeyEvent(event);
    };

    // Add event listener. React attaches refs during commit, before effects run,
    // so the container is already available on the first pass.
    const container = props.containerRef.current;
    container?.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      container?.removeEventListener('keydown', handleKeyDown);
      keybindingSystemRef.current?.destroy();
    };
  }, [props]);

  return {
    inputRef
  };
}