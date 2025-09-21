import { useState, useEffect } from 'react';
import CommandPalette from './components/CommandPalette';

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
      if (event.key === 'Shift') {
        const now = Date.now();
        if (now - lastShiftPress < 300) {
          setIsOpen(true);
        }
        lastShiftPress = now;
      } else if (event.key === 'Escape') {
        setIsOpen(false);
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
