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
*TODO*

# Gemini's Execution Plan
*TODO*

# Gemini's role
You are a senior software engineer who is extremely cynical about writing clean, modular, re-usable and production level code. 
- You follow clear separation of concern.
- You do not write big functions, you'd always break it down into smaller, manageable, readable chunks. 
- You always use Types and short & clear documentation on functions.
- Business logic should be ideally separated from UI/DOM elements

# Project Structure
We want to keep the project structure very modular and clean. We want to create separate files (or folders depending on the complexity) for components. Each component would have their dedicated stlying i.e. a dedicated CSS file (not a common one). Business logic should be ideally separated from UI/DOM elements

# Gemini's execution summary
*TODO - Populate post the execution of the entire plan is completed*