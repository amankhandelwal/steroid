/**
 * Central registry for all commands
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class CommandRegistry {
  private commands: Map<string, BaseCommand> = new Map();
  private commandsByAlias: Map<string, BaseCommand> = new Map();

  /**
   * Register a command
   */
  register(command: BaseCommand): void {
    this.commands.set(command.id, command);

    // Register all aliases
    command.aliases.forEach(alias => {
      this.commandsByAlias.set(alias.toLowerCase(), command);
    });

    console.log(`Registered command: ${command.name} (${command.id})`);
  }

  /**
   * Get command by ID
   */
  getCommand(id: string): BaseCommand | undefined {
    return this.commands.get(id);
  }

  /**
   * Find command by query
   */
  findCommand(query: string): BaseCommand | null {
    const lowerQuery = query.toLowerCase().trim();

    // First try exact alias matches
    for (const [alias, command] of this.commandsByAlias) {
      if (lowerQuery.startsWith(alias)) {
        return command;
      }
    }

    // Then try partial matches
    for (const command of this.commands.values()) {
      if (command.matches(query)) {
        return command;
      }
    }

    return null;
  }

  /**
   * Get all commands
   */
  getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get command suggestions for a query
   */
  getCommandSuggestions(query: string): SearchResultItem[] {
    if (!query.trim()) {
      return [];
    }

    const suggestions: SearchResultItem[] = [];

    for (const command of this.commands.values()) {
      const commandSuggestions = command.getSuggestions(query);
      suggestions.push(...commandSuggestions);
    }

    return suggestions;
  }

  /**
   * Execute a command
   */
  async executeCommand(
    commandId: string,
    context: CommandExecutionContext
  ): Promise<CommandExecutionResult> {
    const command = this.commands.get(commandId);

    if (!command) {
      return {
        success: false,
        error: `Command not found: ${commandId}`
      };
    }

    try {
      const result = await command.execute(context);
      console.log(`Command executed: ${command.name}`, result);
      return result;
    } catch (error) {
      console.error(`Error executing command ${command.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get search results for a specific command
   */
  getCommandSearchResults(commandId: string, context: CommandContext): SearchResultItem[] {
    const command = this.commands.get(commandId);
    if (!command) {
      return [];
    }

    return command.getSearchResults(context);
  }

  /**
   * Parse query and return command with extracted argument
   */
  parseQuery(query: string): { command: BaseCommand | null; argument: string } {
    const command = this.findCommand(query);
    if (!command) {
      return { command: null, argument: query };
    }

    const argument = command.extractArgument(query);
    return { command, argument };
  }
}

// Global command registry instance
export const commandRegistry = new CommandRegistry();