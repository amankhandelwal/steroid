/**
 * This is the background service worker.
 * It is responsible for managing tabs, handling commands, and other core extension logic.
 */
console.log("Steroid background script loaded.");

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TABS") {
    chrome.tabs.query({}, (tabs) => {
      sendResponse(tabs);
    });
    return true; // Asynchronous response

  } else if (message.type === "SWITCH_TO_TAB") {
    if (!message.tabId) return;
    chrome.tabs.get(message.tabId, (tab) => {
      chrome.tabs.update(message.tabId, { active: true });
      if (tab.windowId) {
        chrome.windows.update(tab.windowId, { focused: true });
      }
    });
    return true;

  } else if (message.type === "CLOSE_TAB") {
    if (!message.tabId) return;
    chrome.tabs.remove(message.tabId, () => {
      sendResponse({ success: true });
    });
    return true;

  } else if (message.type === "OPEN_URL") {
    if (!message.url) return;
    chrome.tabs.create({ url: message.url });
    return true;

  } else if (message.type === "CLOSE_DUPLICATE_TABS") {
    chrome.tabs.query({}, (tabs) => {
      const urlMap = new Map<string, number[]>();
      const tabsToClose: number[] = [];

      console.log('All tabs:', tabs);

      tabs.forEach((tab) => {
        if (tab.url && tab.id) {
          try {
            const url = new URL(tab.url);
            url.hash = ''; // Ignore hash for duplicate detection
            const normalizedUrl = url.toString();

            if (!urlMap.has(normalizedUrl)) {
              urlMap.set(normalizedUrl, []);
            }
            urlMap.get(normalizedUrl)?.push(tab.id);
          } catch (e) {
            console.error('Error normalizing URL:', tab.url, e);
          }
        }
      });

      console.log('URL Map after processing:', urlMap);

      urlMap.forEach((tabIds, url) => {
        if (tabIds.length > 1) {
          console.log(`Found ${tabIds.length} duplicates for URL: ${url}. Keeping tab ID ${tabIds[0]} and closing the rest.`);
          // Keep the first tab, close the rest
          tabIds.slice(1).forEach((tabId) => {
            tabsToClose.push(tabId);
          });
        }
      });

      console.log('Tabs to close:', tabsToClose);

      if (tabsToClose.length > 0) {
        chrome.tabs.remove(tabsToClose, () => {
          sendResponse({ success: true, closedCount: tabsToClose.length });
        });
      } else {
        sendResponse({ success: true, closedCount: 0 });
      }
    });
    return true; // Asynchronous response
  }
});
