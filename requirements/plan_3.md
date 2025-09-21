# The Plan
We want to further improve accessibility and user's browsing behaviour understanding.

Build Tab browsing history (a stack of sorts):
- Add a command/action called Previous Tab that should take the user to the previous tab. 
- The Action name should also render the name of the previous tab. Like "Previous Tab > youtube.com"

Search Results enhancements
- The default list of items being displayed in the search-results menu (when no search term is present) should be sorted in reverse chronological order of tab visits.
- Commands/Actions should only be displayed once the user starts typing the search query (following the fuzzy search)

Enter Command mode - When the user has selected a command/action, enter command mode
- **Refined Command Mode Logic:** Command mode should *only* be entered for commands that require subsequent user interaction within the palette (e.g., selecting multiple items, providing additional parameters). Examples: "Close" (when a query is present for filtering tabs), "Create Tab Group". Commands that execute immediately and don't require further interaction (e.g., "Previous Tab", "Close Duplicate Tabs", "Open URL", search commands) should *not* enter command mode and should close the palette upon execution.
- Display the command being executed to the user
- Whatever the user is now typing is in the context of the command execution - example "Close" > changes to Close command mode > query that the user is typing would be in the context of the close command now - essentially searching for tabs to close 

Bulk Actions/Commands
- I should be able to run certain Actions on multiple tabs at once. Imagine if I want to close multiple tabs in one go
  - Pressing Arrow keys to navigate across various tabs
  - Pressing "Tab" to add to selection
  - Pressing "Enter" to actually perform the action on the all selected items
  - Selected Tabs should be visible on top of the search results

Tab Group Action (using Chrome's native tab grouping feature):
- Capability to Add certain Tabs to a group (using Chrome's native tab grouping feature)
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
    *   **Constraint:** Max stack size of 100. Older entries beyond this limit should be removed.
    *   **Constraint:** No duplicate entries. If a tab is already in the history and becomes active again, it should be moved to the top (most recent position) of the stack.
    *   Consider edge cases: tab closing, window changes, new tab opening.
    *   Persist this history across browser sessions (using `chrome.storage`).
*   **Previous Tab Command:**
    *   Add a new command type and action in `commandParser.ts` and `CommandPalette.tsx`.
    *   The action should retrieve the last tab from the history and switch to it using `chrome.tabs.update` and `chrome.windows.update`.
    *   The command's title in the palette should dynamically display the previous tab's title/URL.

**2. Search Results enhancements:**
*   **Default Sorting by Chronological Order:**
    *   The `fetchTabs` function (or a new function) in `background.ts` will need to retrieve tab access times. Chrome's `tabs` API doesn't directly provide this, so we might need to track it ourselves in the background script using `chrome.tabs.onActivated` and `chrome.tabs.onUpdated` events, storing timestamps in `chrome.storage`.
    *   Modify `CommandPalette.tsx`'s `searchResults` `useMemo` to sort the initial `tabs` array based on this chronological data when `query` is empty.
*   **Commands/Actions only on typing:**
    *   Modify `CommandPalette.tsx`'s `searchResults` `useMemo` to conditionally include `commandSuggestions` only when `query.trim().length > 0`.

**3. Enter Command mode:**
*   **Refined Command Mode Logic:** Command mode should *only* be entered for commands that require subsequent user interaction within the palette (e.g., selecting multiple items, providing additional parameters). Examples: "Close" (when a query is present for filtering tabs), "Create Tab Group". Commands that execute immediately and don't require further interaction (e.g., "Previous Tab", "Close Duplicate Tabs", "Open URL", search commands) should *not* enter command mode and should close the palette upon execution.
*   **State Management:**
    *   Introduce a new state variable in `CommandPalette.tsx` (e.g., `commandMode: boolean`, `activeCommand: string | null`).
    *   When a command that *requires further interaction* is selected, transition to command mode.
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
    *   Render the selected tabs above the search results in `CommandPalette.tsx` This will involve iterating `selectedTabIds` and fetching tab details.
*   **Execute on Selected:**
    *   When "Enter" is pressed, if `selectedTabIds` is not empty, the active command should be executed on all selected tabs. This will require modifying the `handleItemClick` logic and potentially the `chrome.runtime.sendMessage` calls to accept an array of `tabId`s.

**5. Tab Group Action (using Chrome's native tab grouping feature):
*   **Permissions:** Add `tabGroups` permission to `manifest.json`.
*   **"Create Tab Group" Command:**
    *   Add command to `commandParser.ts` and `CommandPalette.tsx`.
    *   This command will enter a "Tab Group creation mode" (a specific command mode).
    *   In this mode, the user selects multiple tabs using the bulk action mechanism.
    *   Upon "Enter", the selected tabs will be grouped using `chrome.tabs.group()`.
    *   The user should be prompted for a group name (or a default name can be provided).
*   **Search Indexing:**
    *   Modify `CommandPalette.tsx`'s `searchResults` to include existing Chrome Tab Group names when searching.
*   **Bulk Operations on Tab Groups:**
    *   Extend existing bulk actions (e.g., "Close Tab") to accept a tab group as a target. This will involve querying `chrome.tabGroups` to get tab IDs within the group and applying the action.

**6. Delete Tab Group Action (using Chrome's native tab grouping feature):
*   **"Delete Tab Group" Command:**
    *   New command in `commandParser.ts` and `CommandPalette.tsx`.
    *   This command will list existing Chrome Tab Groups for selection.
    *   Selecting a group and pressing Enter will ungroup the tabs using `chrome.tabs.ungroup()` without closing the tabs.

# Gemini's execution summary
- Implemented `TabStateManager` in `src/background.ts` to track tab access times and previous tab history, persisting data in `chrome.storage.local`.
- Re-enabled and implemented `GET_TAB_ACCESS_TIMES`, `SWITCH_TO_PREVIOUS_TAB`, and `GET_PREVIOUS_TAB_DETAILS` message handlers in `src/background.ts`.
- Refactored `src/components/CommandPalette.tsx` to include `commandSuggestions` in the `fuse` search, improving command discoverability.
- Updated `searchResults` `useMemo` in `src/components/CommandPalette.tsx` to correctly display sorted tabs, command suggestions, and contextual search results based on query and command mode.
- Refined `handleItemClick` in `src/components/CommandPalette.tsx` to correctly enter command mode for actions requiring further interaction.
- Added `storage` permission to `public/manifest.json` to resolve `TypeError: Cannot read properties of undefined (reading 'local')` in the background script.
- Simplified `commandSuggestions` `useMemo` in `src/components/CommandPalette.tsx` to remove direct dependency on `previousTabDetails` and updated `searchResults` `useMemo` to dynamically set the "Previous Tab" title.
- Restructured `searchResults` `useMemo` in `src/components/CommandPalette.tsx` to prioritize direct command matches and ensure tab search works correctly.
- Lowered `Fuse.js` `threshold` to `0.2` in `src/components/CommandPalette.tsx` to make fuzzy search less strict.
- Handled `undefined` `tab.id` in `uniqueResultsMap` key generation in `src/components/CommandPalette.tsx` for robustness.

# Issues:
- [ ] Search is broken - No tabs are being displayed. I'm not able to search or switch between tabs
- [ ] If I'm typing "Prev", Ideally I'd expect a suggestion for "Previous Tab" which I should be able to select. But instead, I'm getting an option to google "Prev". I have to actually type the entire command to search. This seems to be working fine for "Close Duplicate tabs command"
- [ ] Close Tab(s) command is broken. Now it's not usable
- [ ] Previous Tab command is broken. It's not working
- [ ] Command mode doesn't seem to be working at all. On pressing Enter on `Close Tab(s)` Command, nothing happens
- [ ] Double shift has also stopped working now. Additionally I'm getting this error in the background service worker's logs: Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'local')
- [ ] content.js:49 Uncaught ReferenceError: commandSuggestions is not defined
- [ ] Can't search across all tabs. The Tab search is now broken
- [ ] Tab search is still not working
