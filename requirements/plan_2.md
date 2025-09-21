# The Plan
Okay now we want to enhance our chrome extension. We want to improve accessibility. Imagine just being able to do anything with the keyboard only. No need to use the mouse.
- By default the first item should be highlighted for selection. We need to add ability to use Arrow keys to navigate up or down the list that's rendered.
  - Pressing Enter takes me to that page
  - Pressing ` (Tilde) should close that tab
- While navigating up or down, if I continue typing, it should automatically focus on the input section and I should be able to continue typing. The arrow key highlighting should stop and come back and point to the first item.
- I should also be able to type certain keywords and trigger special actions:
  - Close {tab search query} > And then select tab using arrow keys > Press enter/tilde > to close the tab
  - For Search:
    - Google {tab search query} > And then trigger google search
    - Youtube {search query} > Trigger youtube search
    - Infact I want a json config file where I can configure Search Queries easily (Similar to chrome's custom search engine)
  - Close Duplicate > Closes all the duplicate tabs
- Enable Tab completion whenever I'm writing commands > Show commands as suggestions too in the list
- If there are no search results, the default action should be to perform a Google search on the current input.


# Technical requirements
-   **Keyboard Navigation:**
    -   Manage `activeItemIndex` state in `CommandPalette.tsx` to track the currently highlighted item.
    -   Implement a `useEffect` hook for a global `keydown` listener within `CommandPalette.tsx` to handle `ArrowUp`, `ArrowDown`, `Enter`, and `` ` `` (Tilde) key presses.
    -   Ensure `event.preventDefault()` is called for navigation keys to prevent default browser behavior (e.g., page scrolling).
    -   Logic to highlight the first item by default when the palette opens or search results change.
    -   Logic to reset `activeItemIndex` and refocus the input field when a non-navigation key is pressed.

-   **Special Actions/Commands:**
    -   **Command Parsing:** Develop a robust utility function or custom hook to parse the input query, identifying if it's a command (e.g., `close`, `google`, `youtube`) or a standard tab search.
    -   **Configurable Search Engines:**
        -   Create a new configuration file (e.g., `src/config/searchEngines.json`) to define custom search engine patterns and URLs.
        -   Modify `CommandPalette.tsx` to read and utilize this configuration.
        -   Extend `background.ts` to handle dynamic `OPEN_URL` requests based on these configurations.
    -   **`Close Duplicate`:** Implement logic in `background.ts` using `chrome.tabs.query` and `chrome.tabs.remove` to identify and close duplicate tabs. The `CommandPalette` will send a message to trigger this action.
    -   **`Close {query}`:** Enhance `CommandPalette.tsx` to filter tabs based on the provided query and allow selection/closure of those tabs.
    -   **Default Google Search:** If no other search results (tabs or commands) are found for the current query, automatically generate a Google search action item.

-   **Tab Completion/Suggestions:**
    -   Extend the `searchResults` logic in `CommandPalette.tsx` to include command suggestions (e.g., `Close Duplicate`, `Google`, `Youtube`) alongside tab results.
    -   Implement `Tab` key handling to auto-complete commands or cycle through suggestions.

# Gemini's Execution Plan
1.  **Phase 1: Keyboard Navigation Core**
    *   Implement `activeItemIndex` state in `CommandPalette.tsx` to manage item highlighting.
    *   Add a `useEffect` hook for a global `keydown` listener within `CommandPalette.tsx`.
    *   Handle `ArrowUp` and `ArrowDown` to change `activeItemIndex`.
    *   Highlight the item corresponding to `activeItemIndex`.
    *   Implement `Enter` key to trigger `handleItemClick` for the active item.
    *   Implement Tilde (`` ` ``) key to trigger `handleCloseTab` for the active item.
    *   Ensure `event.preventDefault()` for navigation keys to prevent page scrolling.

2.  **Phase 2: Input Refocus & Typing Interruption**
    *   Modify the `keydown` listener to detect non-navigation key presses.
    *   On non-navigation key press, reset `activeItemIndex` to 0 and refocus the input field.

3.  **Phase 3: Advanced Command Parsing & Suggestions**
    *   **Command Parser:** Create `src/utils/commandParser.ts` to parse the input query into command types and arguments.
    *   **Configurable Search Engines:**
        *   Create `src/config/searchEngines.json` with default Google and YouTube configurations.
        *   Modify `CommandPalette.tsx` to load and use this config.
        *   Update `searchResults` to generate search engine action items based on parsed commands.
    *   **Command Suggestions:** Extend `searchResults` to include command suggestions (e.g., `Close Duplicate`, `Google`, `Youtube`) based on the current query.
    *   **Default Google Search:** Modify `searchResults` generation to include a default Google search action if the query yields no other results.

4.  **Phase 4: Implementing New Actions**
    *   **`Close Duplicate`:**
        *   Add `CLOSE_DUPLICATE_TABS` message type.
        *   Implement handler in `background.ts` to find and close duplicate tabs.
        *   Add `Close Duplicate` action to `CommandPalette.tsx` and integrate with `commandParser`.
    *   **`Close {query}`:**
        *   Modify `commandParser` to identify `Close {query}` command.
        *   Implement logic in `CommandPalette.tsx` to filter tabs based on `{query}` and allow selection/closure.

5.  **Phase 5: Refinement & Tab Completion**
    *   Refine UI/UX for command suggestions and active item styling (e.g., scroll into view).
    *   Implement `Tab` key handling in `CommandPalette.tsx` to auto-complete commands or cycle through suggestions, updating the input `query` state accordingly.

# Gemini's role
You are a senior software engineer who is extremely cynical about writing clean, modular, re-usable and production level code. 
- You follow clear separation of concern.
- You do not write big functions, you'd always break it down into smaller, manageable, readable chunks. 
- You always use Types and short & clear documentation on functions.
- Business logic should be ideally separated from UI/DOM elements

# Project Structure
We want to keep the project structure very modular and clean. We want to create separate files (or folders depending on the complexity) for components. Each component would have their dedicated stlying i.e. a dedicated CSS file (not a common one). Business logic should be ideally separated from UI/DOM elements

# Gemini's execution summary
*TODO*

# Issues:
- [ ] Issues with close command:
  - When I type "Close", I get an option to perform Google Search on the word close
  - When I type "Close query" The List below now changes to `Close {Tab titles}` without icons. It becomes difficult for me to understand what the URL is
  - When I type "close dupli" - I should ideally get a suggestion - "Close Duplicates" command, instead initial suggestion is always to Google the word. Once I type the entire command, only then the command appears
- [ ] Whenever I'm closing multiple tabs (more than 1 - I should always get a confirmation with the title+URL of the exact tab that'll get closed. Closure should only happen on confirmation)
- [ ] Slightly concerned if the custom search engine config is even being consumed.
  - I see in command parser - Youtube and Google searches are handled separately. Not sure where the searchEngines.json is being injected. Need more clarity on this