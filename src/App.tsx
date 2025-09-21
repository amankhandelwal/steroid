import { useState, useEffect, useCallback } from 'react';
import CommandPalette from './components/CommandPalette';

/**
 * The main App component that orchestrates the command palette.
 * It manages the visibility of the palette and registers the global keyboard shortcuts.
 */
function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [previousTabDetails, setPreviousTabDetails] = useState<{ title: string; url: string } | null>(null);
  const [tabAccessTimes, setTabAccessTimes] = useState<Record<number, number>>({});
  const [tabGroups, setTabGroups] = useState<chrome.tabGroups.TabGroup[]>([]);

  const handleClose = () => setIsOpen(false);

  const fetchAllData = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'GET_TABS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching tabs:', chrome.runtime.lastError.message);
        return;
      }
      setTabs(response || []);
      console.log('Fetched tabs in App.tsx:', response);
    });

    chrome.runtime.sendMessage({ type: 'GET_PREVIOUS_TAB_DETAILS' }, (response) => {
      if (response && response.success) {
        setPreviousTabDetails({ title: response.tabTitle || 'Untitled', url: response.tabUrl || '' });
      } else {
        setPreviousTabDetails(null);
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_TAB_ACCESS_TIMES' }, (response) => {
      if (response && response.success) {
        setTabAccessTimes(response.accessTimes);
      } else {
        console.error('Error fetching tab access times:', response.message);
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_TAB_GROUPS' }, (response) => {
      if (response && response.success) {
        setTabGroups(response.tabGroups);
      } else {
        console.error('Error fetching tab groups:', response.message);
      }
    });
  }, []);

  useEffect(() => {
    let lastShiftPress = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      console.log('Key pressed:', event.key); // ADDED FOR DEBUGGING

      if (event.key === 'Shift') {
        const now = Date.now();
        if (now - lastShiftPress < 300) {
          console.log('Double Shift detected, calling setIsOpen(true)'); // ADDED FOR DEBUGGING
          setIsOpen(true);
          fetchAllData(); // Fetch data when palette opens
        }
        lastShiftPress = now;
      } else if (event.key === 'Escape') {
        console.log('Escape pressed, calling setIsOpen(false)'); // ADDED FOR DEBUGGING
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchAllData]); // fetchAllData is a dependency

  return (
    <>
      {isOpen && (
        <CommandPalette
          onClose={handleClose}
          tabs={tabs}
          previousTabDetails={previousTabDetails}
          tabAccessTimes={tabAccessTimes}
          tabGroups={tabGroups}
          fetchTabs={fetchAllData} // Pass fetchAllData as fetchTabs prop
        />
      )}
    </>
  );
}

export default App;
