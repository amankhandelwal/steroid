/**
 * Search Command - Search using different search engines
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';
import searchEnginesConfig from '../config/searchEngines.json';
import type { ExtensionMessage } from '../types/messages';

interface SearchEngine {
  name: string;
  url: string;
  shortcut: string;
}

/** Search engines available for the `search` command, sourced from config. */
const SEARCH_ENGINES: SearchEngine[] = searchEnginesConfig as SearchEngine[];

export class SearchCommand extends BaseCommand {
  readonly id = 'search';
  readonly name = 'Search';
  readonly aliases = ['search', 's', 'find'];
  readonly description = 'Search using various search engines';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  /**
   * Build one action result per search engine for the given argument.
   * Each action opens that engine's search URL for the argument.
   */
  private buildEngineResults(arg: string): SearchResultItem[] {
    const trimmedArg = arg.trim();

    return SEARCH_ENGINES.map(engine => ({
      type: 'action' as const,
      id: `search-engine-${engine.shortcut}`,
      title: trimmedArg
        ? `Search "${trimmedArg}" on ${engine.name}`
        : `Search with ${engine.name}`,
      action: () => {
        const url = engine.url + encodeURIComponent(trimmedArg);
        const message: ExtensionMessage = { type: 'OPEN_URL', url };
        chrome.runtime.sendMessage(message);
      }
    }));
  }

  /**
   * True only when the query is a genuine invocation of this command:
   * exactly an alias, or an alias followed by a space (whole-token match).
   * Prevents fanning out for queries that merely share a prefix (e.g. "settings").
   */
  private isInvocation(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();
    return this.aliases.some(alias => {
      const lowerAlias = alias.toLowerCase();
      return lowerQuery === lowerAlias || lowerQuery.startsWith(`${lowerAlias} `);
    });
  }

  /**
   * Suggestions shown in the default (non-command-mode) palette view:
   * one row per engine so the user can pick where to search.
   */
  getSuggestions(query: string): SearchResultItem[] {
    if (!this.isInvocation(query)) {
      return [];
    }

    return this.buildEngineResults(this.extractArgument(query));
  }

  getSearchResults(context: CommandContext): SearchResultItem[] {
    return this.buildEngineResults(this.extractArgument(context.query));
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
      const message: ExtensionMessage = {
        type: 'OPEN_URL',
        url
      };
      chrome.runtime.sendMessage(message, () => {
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
