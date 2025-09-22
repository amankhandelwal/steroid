The Tabs are being displayed now. However a bunch of things are not working:
1. Closing using `(tilde) is not working
2. Close Duplicate Tabs is not working - Infact the command isn't even appearing
3. When I type close followed by a search query - All search results appear in bright red. No icons are displayed. I'd like it to be in black with
   URL icons.
4. If I type "hello world" and press Enter - nothing happens. I should ideally be directed to a google search.
5. If I type "search hello world" I should ideally be give the option to select a Search engine from the list and on pressing Enter, the search
   should be triggered for "hello world" using that search engine. This is not happening. Infact, nothing happens
6. Command Mode execution commands (Delete tab group / create tab group) don't show up in the search.

# Isolated commands are not running:
Let's say I select Close Duplicate Tabs command and press Enter -> the command doesn't actually run. Nothing happens
The same happens when I select Previous tabs, Close current tab

# Command Mode commands are not appearing at all:
In the search Command mode commands are not appearing at all. The following commands don't appear at all
1. Create Tab group
2. Delete Tab group
3. Close Tabs (multiple tabs)

# Pressing the backtick doesn't actually do anything
Ideally in the search mode, if I navigate to a tab and press the backtick, that tab should close. Right now nothing happens. The command palette just closes.

# Search is broken - 1
When I type Close, Ideally I should get the following search results
1. Close current tab
2. Close {query_name}
3. Close Tabs (Multiple Tabs - Command mode)
4. Close Duplicate Tabs
5. Any other tab containing the word Close
However this is not happening. Instead I just get one search result - "Close current tab"
You can model Close Tab, Close Tabs and Close Current Tab as separate commands too if that helps.
- Close Tab - Closes single tab based on search `close {query_name}`
- Close Current Tab - Closes the current tab
- Close Tabs - Command Mode - Select multiple tabs for closure

# Search is broken - 2
Imagine I have a couple of google.com tabs opened on my browser
If I type google Ideally I should get the following search results:
1. Google Search command
2. One entry per google* domain that's open. 
   a. This should not be de-duped either. If i have 3 google.com tabs opened, I should see 3 google.com tabs
This is not happening. Instead the result I get is `"ogle" is not a valid URL` I believe there's some issue here with command parsing

# Search is broken - 3
Tabs appear when I open the search. Let's say I type something and then erase it. Now suddenly there are no search results. When nothing is written, ideally the "default" behaviour should be triggered. So all tabs and commands should be visible to me

# Search is broken - 4
If I explicitly type the "search hello world" I should get options below to search using the Search Engines available
If I type "Search hello world", Ideally I should get the following options.
1. Search using Google
2. Search using Youtube
3. Search using DuckDuckGo
And so on and so forth for each of the search engines defined by me