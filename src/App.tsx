import { useState, useEffect } from 'react';
import CommandPalette from './components/CommandPaletteNew';

/**
 * The main App component that orchestrates the command palette.
 * It manages the visibility of the palette and registers the global keyboard shortcuts.
 */
function App() {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => setIsOpen(false);

  useEffect(() => {
    let lastShiftPress = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift' && !isOpen) {
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

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty dependency array means this effect runs once on mount

  return (
    <>
      {isOpen && <CommandPalette onClose={handleClose} />}
    </>
  );
}

export default App;
