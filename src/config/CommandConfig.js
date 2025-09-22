/**
commandName:
    "" - Default Search mode
    "some_command_name" - when command is being run
mode:
    SingleExecution - Runs as a single command
    CommandMode - Runs in command mode - Allow multi selection

searchItems:
    function that returns the list of items to display in the search list. This function can be dynamically called during execution
        - getAllTabsAndCommands // get a list of all tabs and commands
        - getAllTabs // get a list of all tabs
        - getAllGroups // Get a list of all tab-groups
        - getAllSearchEngines // Get a list of all search Engines
**/

const commandConfig = [
    {
      "id": "default",
      "commandName": "",
      "mode": "SingleExecution",
      "multiSelect": false,
      "searchItems": getAllTabsAndCommands,
    },
    {
      "id": "previous_tab",
      "commandName": "Previous Tab",
      "mode": "SingleExecution",
      "multiSelect": false,
      "searchItems": null
    },
    {
      "id": "close_duplicates",
      "commandName": "Close Duplicate Tabs",
      "mode": "SingleExecution",
      "searchItems": null
    },
    {
      "id": "close_multiple", // We don't need a close single tab command. We can use "default" + ` (tilde) key combination
      "commandName": "Close Tabs",
      "mode": "CommandMode",
      "multiSelect": true,
      "searchItems": getAllTabs
    },
    {
      "id": "group_tabs",
      "commandName": "Group Tabs",
      "mode": "CommandMode",
      "multiSelect": true,
      "searchItems": getAllTabs
    },
    {
      "id": "delete_group",
      "commandName": "Delete Tab Group",
      "mode": "CommandMode",
      "multiSelect": false, // You can only select one group at a time
      "searchItems": getAllGroups
    },
    {
      "id": "search", // The way to use this would be to type `search {query name}` and use arrow keys to select a search engine from the below menu
      "commandName": "Search",
      "mode": SingleExecution,
      "multiSelect": false,
      "searchItems": getAllSearchEngines
    }
    {
      "id": "url", // The way to use this would be to type any valid url. The URL should always open in a new tab
      "commandName": "Open",
      "mode": SingleExecution,
      "multiSelect": false,
      "searchItems": null
    }
]