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

    console.log(`CommandRegistry.register: Registered command: ${command.name} (${command.id})`);
    console.log(`CommandRegistry.register: Command aliases:`, command.aliases);
    console.log(`CommandRegistry.register: Total commands now:`, this.commands.size);
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
    console.log('CommandRegistry.findCommand: Finding command for query:', lowerQuery);

    // First try exact alias matches (query equals alias exactly)
    for (const [alias, command] of this.commandsByAlias) {
      if (lowerQuery === alias) {
        console.log('CommandRegistry.findCommand: Found exact match with alias:', alias, 'command:', command.name);
        return command;
      }
    }

    // Then try prefix matches (query starts with alias)
    for (const [alias, command] of this.commandsByAlias) {
      if (lowerQuery.startsWith(alias)) {
        console.log('CommandRegistry.findCommand: Found prefix match with alias:', alias, 'command:', command.name);
        return command;
      }
    }

    // Finally try partial matches using command.matches()
    for (const command of this.commands.values()) {
      if (command.matches(query)) {
        console.log('CommandRegistry.findCommand: Found partial match with command:', command.name);
        return command;
      }
    }

    console.log('CommandRegistry.findCommand: No command found for query:', lowerQuery);
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
    console.log('CommandRegistry.getCommandSuggestions called with query:', query);

    if (!query.trim()) {
      console.log('CommandRegistry.getCommandSuggestions: Empty query, returning empty array');
      return [];
    }

    const suggestions: SearchResultItem[] = [];

    console.log('CommandRegistry.getCommandSuggestions: Available commands:', this.commands.size);
    for (const command of this.commands.values()) {
      console.log(`CommandRegistry.getCommandSuggestions: Checking command ${command.name} (${command.id})`);
      console.log(`CommandRegistry.getCommandSuggestions: Command aliases:`, command.aliases);
      console.log(`CommandRegistry.getCommandSuggestions: Command matches query:`, command.matches(query));

      const commandSuggestions = command.getSuggestions(query);
      console.log(`CommandRegistry.getCommandSuggestions: Command ${command.name} returned ${commandSuggestions.length} suggestions`);
      suggestions.push(...commandSuggestions);
    }

    console.log('CommandRegistry.getCommandSuggestions: Total suggestions:', suggestions.length);
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