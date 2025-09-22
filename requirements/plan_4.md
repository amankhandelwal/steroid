# The Plan
plan_3.md introduced a lot of bugs and issues with accessibility and handling. plan_4.md is all about refinement and maintainability. We fix issues, we fix the code quality, we add configurability and we add context awareness. 

## Code Structure
Our code is largely a bunch of if-else statements making it difficult to navigate and find issues / fix issues. Here's what I'm thinking:
- I've created a `src/config/CommandConfig.ts` file which is a command configuration.
We use this command configuration to identify which command we want to run.
- I've also created a `src/command` directory to house separate files for each command. The idea is to have clear separate files/folders (based on need) for each command
- I've created a `src/keybindings` folder to store key bindings - business logic about how different key bindings are supposed to work -> Tab / Enter / Esc / Arrow Keys for Navigation etc. (Not sure if we'd need this)
- CommandPalette.tsx has become too large and hence unmanageable. Let's keep UI and business logic separate

## Issues
1. I get this error everytime I open a tab - Unchecked runtime.lastError: The message port closed before a response was received
2. Let's say I load my extension and go to an already open tab. I have to reload that page to actually use my extension. I'd like to be able to use my extension on any tab I'm at - irrespective of when it was opened. Check the feasibility of this.
3. Scroll (overflow) is broken. If I press the down arrow key and go down, the highlighted item would go outside the visible search window.

## UI/UX:
1. When entering command mode, selected tabs should not be visible in the search list below. These tabs are already selected. We'll not allow the user to deselect the tabs. The user would have to press Esc and restart
2. When I enter command mode for a particular command, the text box still displays the text I originally typed. Ideally I'm going to be searching for tab names or something else. I'd want the textbox to be empty
3. When I'm entering command mode, I'd want the command name to be displayed in a (non-editable) TextView on the left of the Input field - To know I'm in the context of "this" command


# Technical requirements
*TODO*

# Claude's Execution Plan
*TODO*

# Claude's execution summary
*TODO after execution completion*