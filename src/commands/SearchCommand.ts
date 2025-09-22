/**
 * Search Command - Search using different search engines
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

interface SearchEngine {
  name: string;
  url: string;
  shortcut: string;
}

const SEARCH_ENGINES: SearchEngine[] = [
  { name: 'Google', url: 'https://www.google.com/search?q=', shortcut: 'g' },
  { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', shortcut: 'ddg' },
  { name: 'Bing', url: 'https://www.bing.com/search?q=', shortcut: 'b' },
  { name: 'YouTube', url: 'https://www.youtube.com/results?search_query=', shortcut: 'yt' },
  { name: 'GitHub', url: 'https://github.com/search?q=', shortcut: 'gh' },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q=', shortcut: 'so' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Special:Search?search=', shortcut: 'wiki' },
  { name: 'Reddit', url: 'https://www.reddit.com/search/?q=', shortcut: 'r' }
];

export class SearchCommand extends BaseCommand {
  readonly id = 'search';
  readonly name = 'Search';
  readonly aliases = ['search', 's', 'find'];
  readonly description = 'Search using various search engines';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  getSearchResults(context: CommandContext): SearchResultItem[] {
    const argument = this.extractArgument(context.query);

    if (!argument.trim()) {
      // Show all search engines when no query is provided
      return SEARCH_ENGINES.map(engine => ({
        type: 'action' as const,
        id: `search-${engine.shortcut}`,
        title: `Search with ${engine.name}`,
        action: () => {}
      }));
    }

    // Show search engines filtered by query or show search suggestions
    const lowerQuery = argument.toLowerCase();

    // Filter search engines by name or shortcut
    const filteredEngines = SEARCH_ENGINES.filter(engine =>
      engine.name.toLowerCase().includes(lowerQuery) ||
      engine.shortcut.toLowerCase().includes(lowerQuery)
    );

    if (filteredEngines.length > 0) {
      return filteredEngines.map(engine => ({
        type: 'action' as const,
        id: `search-${engine.shortcut}-${argument}`,
        title: `Search "${argument}" on ${engine.name}`,
        action: () => {}
      }));
    }

    // If no engine matches, show Google search as default
    return [{
      type: 'action' as const,
      id: `search-google-${argument}`,
      title: `Search "${argument}" on Google`,
      action: () => {}
    }];
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    const argument = this.extractArgument(context.query);

    if (!argument.trim()) {
      return {
        success: false,
        error: 'Please provide a search query'
      };
    }

    // Determine which search engine to use
    let searchEngine: SearchEngine = SEARCH_ENGINES[0]; // Default to Google

    // Check if user specified a search engine
    const parts = argument.split(' ');
    const firstPart = parts[0].toLowerCase();

    const specifiedEngine = SEARCH_ENGINES.find(engine =>
      engine.shortcut.toLowerCase() === firstPart ||
      engine.name.toLowerCase() === firstPart
    );

    if (specifiedEngine && parts.length > 1) {
      searchEngine = specifiedEngine;
      // Remove the engine name from the query
      const searchQuery = parts.slice(1).join(' ');
      const searchUrl = searchEngine.url + encodeURIComponent(searchQuery);

      return this.openSearchUrl(searchUrl, searchQuery, searchEngine.name, context);
    } else {
      // Use Google as default
      const searchUrl = searchEngine.url + encodeURIComponent(argument);
      return this.openSearchUrl(searchUrl, argument, searchEngine.name, context);
    }
  }

  private openSearchUrl(
    url: string,
    query: string,
    engineName: string,
    context: CommandExecutionContext
  ): Promise<CommandExecutionResult> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'OPEN_URL',
        url
      }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        context.fetchTabs(); // Refresh tab list
        resolve({
          success: true,
          message: `Searching "${query}" on ${engineName}`,
          shouldCloseModal: true
        });
      });
    });
  }

  getDisplayTitle(query: string): string {
    const argument = this.extractArgument(query);
    if (argument.trim()) {
      return `Search: ${argument}`;
    }
    return 'Search';
  }
}