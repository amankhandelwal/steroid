/**
 * useKeyboardNavigation - Keyboard navigation hook using the keybinding system
 */

import { useEffect, useRef } from 'react';
import { createKeybindingSystem } from '../keybindings';
import type { NavigationActions, SelectionActions } from '../keybindings';

export interface UseKeyboardNavigationProps {
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
  onEnterCommandMode: () => void;
  onExitCommandMode: () => void;
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
      enterCommandMode: props.onEnterCommandMode,
      exitCommandMode: props.onExitCommandMode
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
        isInputFocused: document.activeElement === inputRef.current,
        activeItemIndex: props.activeItemIndex,
        totalItems: props.totalItems
      });

      // Handle the event
      keybindingSystemRef.current?.manager.handleKeyEvent(event);
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      keybindingSystemRef.current?.destroy();
    };
  }, [props]);

  return {
    inputRef
  };
}