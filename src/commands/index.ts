/**
 * Command System Registry and Initialization
 *
 * This file exports all commands and initializes the command registry
 */

// Import all command classes
import { PreviousTabCommand } from './PreviousTabCommand';
import { CloseDuplicateTabsCommand } from './CloseDuplicateTabsCommand';
import { CloseTabCommand } from './CloseTabCommand';
import { CloseMultipleTabsCommand } from './CloseMultipleTabsCommand';
import { NewTabCommand } from './NewTabCommand';
import { CreateTabGroupCommand } from './CreateTabGroupCommand';
import { DeleteTabGroupCommand } from './DeleteTabGroupCommand';
import { SearchCommand } from './SearchCommand';
import { OpenUrlCommand } from './OpenUrlCommand';

// Import registry
import { commandRegistry } from './CommandRegistry';

// Export command registry for use in other modules
export { commandRegistry } from './CommandRegistry';

// Export types
export * from './CommandTypes';
export { BaseCommand } from './BaseCommand';

/**
 * Initialize all commands in the registry
 */
export function initializeCommands(): void {
  // Register all commands
  commandRegistry.register(new PreviousTabCommand());
  commandRegistry.register(new CloseDuplicateTabsCommand());
  commandRegistry.register(new CloseTabCommand());
  commandRegistry.register(new CloseMultipleTabsCommand());
  commandRegistry.register(new NewTabCommand());
  commandRegistry.register(new CreateTabGroupCommand());
  commandRegistry.register(new DeleteTabGroupCommand());
  commandRegistry.register(new SearchCommand());
  commandRegistry.register(new OpenUrlCommand());

}

/**
 * Get all available command instances (for debugging)
 */
export function getAllCommands() {
  return commandRegistry.getAllCommands();
}