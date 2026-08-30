/**
 * Central registry for all commands
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class CommandRegistry {
  private commands: Map<string, BaseCommand> = new Map();

  /**
   * Register a command
   */
  register(command: BaseCommand): void {
    this.commands.set(command.id, command);
  }

  /**
   * Get command by ID
   */
  getCommand(id: string): BaseCommand | undefined {
    return this.commands.get(id);
  }

  /**
   * Get all commands
   */
  getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get command suggestions for a query. `context` is forwarded to each
   * command so suggestions can reflect live state (e.g. the previous tab's title).
   */
  getCommandSuggestions(query: string, context: CommandContext): SearchResultItem[] {
    if (!query.trim()) {
      return [];
    }

    const suggestions: SearchResultItem[] = [];

    for (const command of this.commands.values()) {
      const commandSuggestions = command.getSuggestions(query, context);
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
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Global command registry instance
export const commandRegistry = new CommandRegistry();