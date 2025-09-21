# The Plan
We want to further improve accessibility and user's browsing behaviour understanding.

Build Tab browsing history (a stack of sorts):
- Add a command/action called Previous Tab that should take the user to the previous tab. 
- The Action name should also render the name of the previous tab. Like "Previous Tab > youtube.com"

Search Results enhancements
- The default list of items being displayed in the search-results menu (when no search term is present) should be sorted in reverse chronological order of tab visits.
- Commands/Actions should only be displayed once the user starts typing the search query (following the fuzzy search)

Enter Command mode - When the user has selected a command/action, enter command mode
- Display the command being executed to the user
- Whatever the user is now typing is in the context of the command execution - example "Close" > changes to Close command mode > query that the user is typing would be in the context of the close command now - essentially searching for tabs to close 

Bulk Actions/Commands
- I should be able to run certain Actions on multiple tabs at once. Imagine if I want to close multiple tabs in one go
  - Pressing Arrow keys to navigate across various tabs
  - Pressing "Tab" to add to selection
  - Pressing "Enter" to actually perform the action on the all selected items
  - Selected Tabs should be visible on top of the search results

Tab Group Action
- Capability to Add certain Tabs to a group
- This would leverage Bulk Action & Command mode Capabilities
  - User would enter Tab Group command mode
  - User would then select multiple tabs (could even be across different windows). This selection would happen using a combination of Seach and "Tab"
  - User could press "Enter" to create tab groups, thus finishing the command execution
- Search should index Tab Group names as well
  - Bulk operations should be possible on Tab Groups too - Example Close Tab > group_name should close all tabs in the group

Delete Tab Group Action
- Removes tabs from the group, without closing the tabs


# Technical requirements
Here's a breakdown of the technical requirements for each feature:

**1. Build Tab browsing history (a stack of sorts):**
*   **Previous Tab Tracking:**
    *   Need a mechanism in the background script (`background.ts`) to track the active tab changes.
    *   This should maintain a history (stack-like structure) of previously active tab IDs.
    *   Consider edge cases: tab closing, window changes, new tab opening.
    *   The history should probably be per-window or global, depending on desired behavior. (Let's assume global for now, but this might need clarification).
    *   Persist this history across browser sessions (using `chrome.storage`).
    *   There should be a limit on stack size - max 100 items. On top of this stack should remove older items to keep the max limit restricted.
*   **Previous Tab Command:**
    *   Add a new command type and action in `commandParser.ts` and `CommandPalette.tsx`.
    *   The action should retrieve the last tab from the history and switch to it using `chrome.tabs.update` and `chrome.windows.update`.
    *   The command's title in the palette should dynamically display the previous tab's title/URL. This will require fetching the tab details from `chrome.tabs` based on the stored ID.

**2. Search Results enhancements:**
*   **Default Sorting by Chronological Order:**
    *   The `fetchTabs` function (or a new function) in `background.ts` will need to retrieve tab access times. Chrome's `tabs` API doesn't directly provide this, so we might need to track it ourselves in the background script using `chrome.tabs.onActivated` and `chrome.tabs.onUpdated` events, storing timestamps in `chrome.storage`.
    *   Modify `CommandPalette.tsx`'s `searchResults` `useMemo` to sort the initial `tabs` array based on this chronological data when `query` is empty.
*   **Commands/Actions only on typing:**
    *   Modify `CommandPalette.tsx`'s `searchResults` `useMemo` to conditionally include `commandSuggestions` only when `query.trim().length > 0`.

**3. Enter Command mode:**
*   **State Management:**
    *   Introduce a new state variable in `CommandPalette.tsx` (e.g., `commandMode: boolean`, `activeCommand: string | null`).
    *   When a command is selected (e.g., "Close"), transition to command mode.
*   **UI Display:**
    *   Modify the input placeholder or add a separate display element in `CommandPalette.tsx` to show the active command (e.g., "Close >").
*   **Contextual Search:**
    *   When in command mode, the `fuse.js` search should be applied to a filtered set of items relevant to the command (e.g., only tabs for "Close" command).
    *   The `parseCommand` logic might need to be extended to handle this contextual input.

**4. Bulk Actions/Commands:**
*   **Selection State:**
    *   Add a state variable in `CommandPalette.tsx` to store selected tab IDs (e.g., `selectedTabIds: Set<number>`).
*   **Keyboard Navigation & Selection:**
    *   Modify the `useEffect` for `keydown` in `CommandPalette.tsx` to handle "Tab" key for adding/removing items from `selectedTabIds`.
    *   "Arrow" keys should navigate the list as usual.
*   **UI for Selected Tabs:**
    *   Render the selected tabs above the search results in `CommandPalette.tsx`. This will involve iterating `selectedTabIds` and fetching tab details.
*   **Execute on Selected:**
    *   When "Enter" is pressed, if `selectedTabIds` is not empty, the active command should be executed on all selected tabs. This will require modifying the `handleItemClick` logic and potentially the `chrome.runtime.sendMessage` calls to accept an array of `tabId`s.

**5. Tab Group Action:**
*   **Tab Group Storage:**
    *   Need a new data structure in `background.ts` to store tab groups (e.g., `Map<string, number[]>`, where key is group name, value is array of tab IDs).
    *   Persist tab groups using `chrome.storage`.
*   **"Create Tab Group" Command:**
    *   New command in `commandParser.ts` and `CommandPalette.tsx`.
    *   This command will enter a "Tab Group creation mode" (a specific command mode).
    *   In this mode, the user selects tabs using the bulk action mechanism.
    *   Upon "Enter", prompt for a group name, then save the group.
*   **Search Indexing:**
    *   Modify `CommandPalette.tsx`'s `searchResults` to include tab group names when searching.
*   **Bulk Operations on Tab Groups:**
    *   Extend existing bulk actions (e.g., "Close Tab") to accept a tab group name as a target. This will involve retrieving all tab IDs for that group and applying the action.

**6. Delete Tab Group Action:**
*   **"Delete Tab Group" Command:**
    *   New command in `commandParser.ts` and `CommandPalette.tsx`.
    *   This command will list existing tab groups.
    *   Selecting a group and pressing Enter will delete the group from storage without closing tabs.

# Gemini's Execution Plan
I will approach this in phases, focusing on one feature or a small set of related features at a time, ensuring each step is testable and stable.

**Phase 1: Tab Browsing History & Previous Tab Command**

1.  **Implement Tab History Tracking:**
    *   Modify `background.ts` to listen for `chrome.tabs.onActivated` events.
    *   Store a stack of `tabId`s in `chrome.storage.local`.
    *   Create a utility function in `background.ts` to manage this history (push, pop, get previous).
2.  **Add "Previous Tab" Command:**
    *   Update `commandParser.ts` to recognize a "previous tab" command.
    *   Modify `CommandPalette.tsx`:
        *   Add a new `ActionItem` for "Previous Tab" to `commandSuggestions`.
        *   The `action` for this item will send a message to `background.ts` to switch to the previous tab.
        *   Dynamically update the title of this `ActionItem` to show the previous tab's name/URL. This will require `background.ts` to send back the previous tab's details.

**Phase 2: Search Results Enhancements**

1.  **Implement Tab Access Time Tracking:**
    *   Modify `background.ts` to track `lastAccessed` timestamp for each tab using `chrome.tabs.onActivated` and `chrome.storage.local`.
2.  **Sort Default Search Results:**
    *   Modify `CommandPalette.tsx`'s `searchResults` `useMemo` to sort tabs by `lastAccessed` when the query is empty.
3.  **Conditional Command Suggestions:**
    *   Modify `CommandPalette.tsx`'s `searchResults` `useMemo` to only display `commandSuggestions` when `query.trim().length > 0`.

**Phase 3: Command Mode & Bulk Actions (Initial)**

1.  **Command Mode State:**
    *   Add `commandMode` and `activeCommand` state to `CommandPalette.tsx`.
    *   Modify `handleItemClick` to set `commandMode` and `activeCommand` when a command `ActionItem` is selected.
2.  **UI for Command Mode:**
    *   Update the input placeholder in `CommandPalette.tsx` to reflect `activeCommand`.
3.  **Basic Bulk Selection:**
    *   Add `selectedTabIds` state to `CommandPalette.tsx`.
    *   Modify `useEffect` for `keydown` to handle "Tab" key for adding/removing items from `selectedTabIds`.
    *   Render selected tabs above search results.
4.  **Execute Bulk Close:**
    *   Modify the "Close" command's action to accept multiple `tabId`s from `selectedTabIds` and send them to `background.ts`.
    *   Update `background.ts` to handle `CLOSE_TAB` message with an array of `tabId`s.

**Phase 4: Tab Group Management**

1.  **Tab Group Storage & API:**
    *   Create a new module/utility in `background.ts` (e.g., `tabGroups.ts`) to manage tab groups in `chrome.storage.local`.
    *   Implement functions for `createGroup`, `getGroups`, `deleteGroup`, `addTabsToGroup`, `removeTabsFromGroup`.
2.  **"Create Tab Group" Command:**
    *   Add command to `commandParser.ts` and `CommandPalette.tsx`.
    *   Implement command mode for group creation, leveraging bulk selection.
    *   Prompt for group name (might need a simple modal or input within the palette).
3.  **"Delete Tab Group" Command:**
    *   Add command to `commandParser.ts` and `CommandPalette.tsx`.
    *   List existing groups for selection.
    *   Action to delete group from storage.

**Phase 5: Tab Group Enhancements & Refinements**

1.  **Search Indexing for Tab Groups:**
    *   Modify `CommandPalette.tsx`'s `searchResults` to include tab group names in fuzzy search.
2.  **Bulk Operations on Tab Groups:**
    *   Extend existing bulk actions (e.g., "Close") to accept a tab group name as a target.
    *   Modify `background.ts` to retrieve tab IDs from the group and apply the action.
3.  **Refine Command Mode Contextual Search:**
    *   Implement more sophisticated filtering for `fuse.js` based on `activeCommand`.

# Gemini's execution summary
*TODO - Populate post the execution of the entire plan is completed*
