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

  /**
   * Contract-only implementation. The UI never routes this command through
   * `CommandRegistry.executeCommand`: the engine rows built above carry ids of
   * the form `search-engine-<shortcut>`, and `handleActionItem` dispatches to
   * the registry only for ids ending `-suggestion` — every other action row
   * runs its own closure instead. The two other routes into the registry are
   * closed too: command mode is only entered for `mode === 'CommandMode'`
   * commands, and the pending-input path re-enters a command whose `execute`
   * has already run once.
   *
   * So this exists to satisfy `BaseCommand`'s abstract member, and does the one
   * unsurprising thing if that routing ever changes — search the whole argument
   * on the default engine.
   *
   * It deliberately does NOT parse a leading engine shortcut (`s gh cats` ->
   * GitHub). That parsing used to live here and was unreachable, so nothing
   * exercised the fact that it disagreed with the rows on screen, which render
   * `Search "gh cats" on Google` for the same query. Picking an engine is the
   * rows' job.
   */
  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    const argument = this.extractArgument(context.query).trim();

    if (!argument) {
      return {
        success: false,
        error: 'Please provide a search query'
      };
    }

    const [defaultEngine] = SEARCH_ENGINES;

    return this.openSearchUrl(
      defaultEngine.url + encodeURIComponent(argument),
      argument,
      defaultEngine.name,
      context
    );
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
