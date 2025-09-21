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
