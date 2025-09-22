/**
 * Previous Tab Command - Navigate to previously active tab
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class PreviousTabCommand extends BaseCommand {
  readonly id = 'previous_tab';
  readonly name = 'Previous Tab';
  readonly aliases = ['previous tab', 'prev tab', 'previous', 'prev'];
  readonly description = 'Switch to the previously active tab';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  getSearchResults(context: CommandContext): SearchResultItem[] {
    // This command doesn't show additional search results
    return [];
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'SWITCH_TO_PREVIOUS_TAB' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        if (response && response.success) {
          resolve({
            success: true,
            message: 'Switched to previous tab',
            shouldCloseModal: true
          });
        } else {
          resolve({
            success: false,
            error: response?.message || 'No previous tab available'
          });
        }
      });
    });
  }

  getDisplayTitle(query: string): string {
    // We could enhance this to show the actual previous tab title
    return 'Previous Tab';
  }
}