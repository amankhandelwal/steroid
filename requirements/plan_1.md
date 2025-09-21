# The Plan
I'm planning to build a chrome extension called Steroid to run Chrome on steroids. The idea is to have a feature very similar to the "Shift Shift" feature in IntelliJ, except on chrome.

Imagine - a search bar opens:
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

# Gemini's Execution Plan
