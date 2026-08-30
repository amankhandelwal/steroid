/**
 * Content-script injection for tabs that were already open before the
 * extension started (or updated), where the manifest's auto-injection never ran.
 */

// Inject content script into existing tabs when extension starts/updates
export async function injectContentScriptIntoExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      // Skip chrome:// URLs and extension pages as they can't be scripted
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('edge://') && tab.id) {
        try {
          // Check if content script is already injected by testing if the host element exists
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return document.getElementById('steroid-host') !== null;
            }
          });

          const isAlreadyInjected = results[0]?.result;

          if (!isAlreadyInjected) {
            // Inject the content script
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
          } else {
            // Content script already exists
          }
        } catch (error) {
          // Silently ignore injection failures (usually due to protected pages)
          console.debug(`Could not inject into tab ${tab.url}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error injecting content scripts into existing tabs:', error);
  }
}
