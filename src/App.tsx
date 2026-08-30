import { useState, useEffect, useRef } from 'react';
import CommandPalette from './components/CommandPaletteNew';

/**
 * The main App component that orchestrates the command palette.
 * It manages the visibility of the palette and registers the global keyboard shortcuts.
 */
function App() {
  const [isOpen, setIsOpen] = useState(false);

  // Mirrors `isOpen` for the Shift+Shift listener below, whose own effect
  // intentionally has an empty dependency array (see that effect's comment).
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const handleClose = () => setIsOpen(false);

  useEffect(() => {
    let lastShiftPress = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift' && !isOpenRef.current) {
        const now = Date.now();
        const timeDiff = now - lastShiftPress;
        if (timeDiff < 300 && timeDiff > 50) { // Added minimum time to avoid duplicate events
          setIsOpen(true);
          event.preventDefault();
          event.stopPropagation();
        }
        lastShiftPress = now;
      }
      // Remove escape handling from App level - let the modal handle it
    };

    // Use normal event listeners when palette is closed to avoid website interference
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Toolbar-icon click (FIND-020): background sends OPEN_PALETTE to this
  // tab's content script when the user clicks the extension action icon.
  useEffect(() => {
    const handleMessage = (message: { type?: string }) => {
      if (message?.type === 'OPEN_PALETTE') {
        setIsOpen(true);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  return (
    <>
      {isOpen && <CommandPalette onClose={handleClose} />}
    </>
  );
}

export default App;
