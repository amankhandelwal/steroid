/**
 * Close Duplicate Tabs Command - Close all duplicate tabs
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class CloseDuplicateTabsCommand extends BaseCommand {
  readonly id = 'close_duplicates';
  readonly name = 'Close Duplicate Tabs';
  readonly aliases = ['close duplicate', 'close duplicates', 'duplicate'];
  readonly description = 'Close all duplicate tabs (keeps one copy of each unique URL)';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  matches(query: string): boolean {
    console.log(`CloseDuplicateTabsCommand.matches called with query: "${query}"`);
    const result = super.matches(query);
    console.log(`CloseDuplicateTabsCommand.matches result:`, result);
    return result;
  }

  getSearchResults(context: CommandContext): SearchResultItem[] {
    // For SingleExecution commands, show an execution option
    return [{
      type: 'action' as const,
      id: 'execute-close-duplicates',
      title: 'Close Duplicate Tabs',
      action: () => {
        // This will be handled by the command execution system
      }
    }];
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CLOSE_DUPLICATE_TABS' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        if (response && response.success) {
          context.fetchTabs(); // Refresh tab list

          const count = response.closedCount || 0;
          resolve({
            success: true,
            message: `Closed ${count} duplicate tabs`,
            shouldCloseModal: true
          });
        } else {
          resolve({
            success: false,
            error: 'Failed to close duplicate tabs'
          });
        }
      });
    });
  }
}