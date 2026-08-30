/**
 * Abstract base class for all commands
 */

import { CommandContext, SearchResultItem, CommandExecutionResult, CommandExecutionContext } from './CommandTypes';

export abstract class BaseCommand {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly aliases: string[];
  abstract readonly description: string;
  abstract readonly mode: 'SingleExecution' | 'CommandMode';
  abstract readonly multiSelect: boolean;

  /** Optional loading message shown while the command executes */
  readonly loadingMessage: string | null = null;

  /**
   * Check if this command matches the given query
   */
  matches(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();
    return this.aliases.some(alias => {
      const lowerAlias = alias.toLowerCase();
      // Prefix match either direction: the user is still typing an alias,
      // or has typed the full alias plus an argument.
      return lowerAlias.startsWith(lowerQuery) || lowerQuery.startsWith(lowerAlias);
    });
  }

  /**
   * Extract the argument from a query after removing the command prefix
   */
  extractArgument(query: string): string {
    const lowerQuery = query.toLowerCase().trim();

    for (const alias of this.aliases) {
      const lowerAlias = alias.toLowerCase();
      if (lowerQuery.startsWith(lowerAlias)) {
        return query.substring(alias.length).trim();
      }
    }

    return query;
  }

  /**
   * Get search results for this command
   */
  abstract getSearchResults(context: CommandContext): SearchResultItem[];

  /**
   * Execute the command
   */
  abstract execute(context: CommandExecutionContext): Promise<CommandExecutionResult> | CommandExecutionResult;

  /**
   * Check if the command can execute with current context
   */
  canExecute(_context: CommandContext): boolean {
    return true;
  }

  /**
   * Get the display title for this command in suggestions
   */
  getDisplayTitle(query: string): string {
    const argument = this.extractArgument(query);
    if (argument) {
      return `${this.name}: ${argument}`;
    }
    return this.name;
  }

  /**
   * Get command suggestions based on query. `context` is optional so that
   * subclasses (e.g. SearchCommand) may override with a single-arg signature.
   */
  getSuggestions(query: string, _context?: CommandContext): SearchResultItem[] {
    if (!this.matches(query)) {
      return [];
    }

    return [{
      type: 'action',
      id: `${this.id}-suggestion`,
      title: this.getDisplayTitle(query),
      action: () => {
        // Mark this suggestion for execution by the command palette
        // The actual execution will be handled by the executeCurrentCommand function
      }
    }];
  }
}