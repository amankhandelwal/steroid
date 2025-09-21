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
      const urls = new Set<string>();
      const tabsToClose: number[] = [];

      for (const tab of tabs) {
        if (tab.url) {
          if (urls.has(tab.url)) {
            if (tab.id) {
              tabsToClose.push(tab.id);
            }
          } else {
            urls.add(tab.url);
          }
        }
      }

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
