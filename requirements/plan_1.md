# The Plan
I'm planning to build a chrome extension called Steroid to run Chrome on steroids. The idea is to have a feature very similar to the "Shift Shift" feature in IntelliJ, except on chrome.

Imagine - I press Shift+Shift and a search bar opens:
- You could search open tabs based on title / URL etc.
- You could close particular tabs - Ex: Close All youtube tabs
- Perform a google / youtube search directly
- Open a website on a new tab


We do not want the data going to a server. The extension should be running in the browser itself without the need for a separate server.

# Eventual Long term goal (not needed for V1):
We'd add AI to this. Imagine:

- Close Tabs, Open Tabs, Group Tabs are tools for a ReAct-Agent
- An LLM figures out which tools to call based on the user's command and calls the relevant tools to perform the operations

# Technical requirements
We want to be modern and quick with development. Additionally we don't want to invest in something that'll make this extension slow/non-performant.

Frameworks needed:
- **UI Framework:** React with TypeScript. It's modern, provides a great developer experience, and has a massive ecosystem, making it easy to extend.
- **Build Tool:** Vite. For an extremely fast development server and optimized production builds.
- **Styling:** Tailwind CSS. For rapidly building a modern and clean UI without writing custom CSS.
- **Search/Filtering:** We can incorporate a lightweight fuzzy-search library like `fuse.js`.

# Gemini's Execution Plan
1.  **Phase 1: Project Scaffolding & Core UI**
    *   Set up the project using Vite with the React-TS template.
    *   Create the `manifest.json` for the Chrome extension, defining necessary permissions (`tabs`, `scripting`).
    *   Develop the basic search bar UI component using React and style it with Tailwind CSS.
2.  **Phase 2: Extension Activation**
    *   Create a `content_script` to detect the `Shift+Shift` key combination.
    *   Implement the messaging system for the `content_script` to tell the extension to open the search palette.
3.  **Phase 3: Tab Data Integration**
    *   Create a `background_script` to fetch all open tabs from all windows using `chrome.tabs.query`.
    *   Feed this tab data to the React UI.
4.  **Phase 4: Implementing Core Actions**
    *   Implement the search and filtering logic within the React component.
    *   Implement the "switch to tab" action.
    *   Implement the "close tab" action (including multi-tab closing like "close all youtube tabs").
    *   Implement the "Google search" and "open URL" actions.
5.  **Phase 5: Refinement & Packaging**
    *   Refine the UI/UX for a smooth experience.
    *   Build the extension for production.
    *   Document the steps for loading and testing the extension in Chrome.

# Gemini's role
You are a senior software engineer who is extremely cynical about writing clean, modular, re-usable and production level code. 
- You follow clear separation of concern.
- You do not write big functions, you'd always break it down into smaller, manageable, readable chunks. 
- You always use Types and short & clear documentation on functions.
- Business logic should be ideally separated from UI/DOM elements

# Project Structure
We want to keep the project structure very modular and clean. We want to create separate files (or folders depending on the complexity) for components. Each component would have their dedicated stlying i.e. a dedicated CSS file (not a common one). Business logic should be ideally separated from UI/DOM elements

# Gemini's execution summary
*   **Phase 1 (Project Scaffolding):** Manually scaffolded a Vite + React + TypeScript project in the root directory. Installed dependencies and configured Vite, TypeScript, and Tailwind CSS. Created the initial file structure and the Chrome extension `manifest.json`.
*   **Phase 2 (Extension Activation):** Implemented the UI injection strategy. A content script (`content.tsx`) now mounts the React app into the DOM of any webpage. The main `App.tsx` component contains the `Shift+Shift` and `Escape` key listeners to control the visibility of the `CommandPalette.tsx` component.
*   **Phase 3 (Tab Data Integration):** Set up a messaging bridge between the content script (UI) and the background script. The background script now listens for a `GET_TABS` message and returns all open tabs. The `CommandPalette` component fetches and displays this list on open. Added `@types/chrome` for type safety.
*   **Phase 4 (Core Actions):** Implemented fuzzy search on tabs using `fuse.js`. Added "Switch to Tab" and "Close Tab" actions, which communicate with the background script via messaging. Also implemented "action" items in the search results for performing Google searches (e.g., `g my query`) and opening URLs directly.

# Issues:
- [ ] Double Shift is not working. Nothing is happening
  - I get the log `Steroid content script loaded.`
  - However when I press Double Shift, I get this warning
  `Mixed Content: The page at 'https://docs.plasmo.com/framework' was loaded over HTTPS, but requested an insecure element 'http://localhost:8888/static/favicons/favicon.ico'. This request was automatically upgraded to HTTPS, For more information see https://blog.chromium.org/2019/10/no-more-mixed-messages-about-https.html` 
  - and an error `http://localhost:8888/static/favicons/favicon-notebook.ico net::ERR_CONNECTION_REFUSED`