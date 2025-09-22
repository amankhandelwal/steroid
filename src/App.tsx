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
      console.log('App: Key pressed:', event.key, 'Modal open:', isOpen); // ADDED FOR DEBUGGING

      if (event.key === 'Shift') {
        const now = Date.now();
        const timeDiff = now - lastShiftPress;
        console.log('App: Shift pressed, time diff:', timeDiff); // ADDED FOR DEBUGGING
        if (timeDiff < 300 && timeDiff > 50) { // Added minimum time to avoid duplicate events
          console.log('App: Double Shift detected, calling setIsOpen(true)'); // ADDED FOR DEBUGGING
          setIsOpen(true);
          event.preventDefault();
          event.stopPropagation();
        }
        lastShiftPress = now;
      } else if (event.key === 'Escape' && isOpen) {
        console.log('App: Escape pressed, calling setIsOpen(false)'); // ADDED FOR DEBUGGING
        setIsOpen(false);
        event.preventDefault();
        event.stopPropagation();
      }
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
