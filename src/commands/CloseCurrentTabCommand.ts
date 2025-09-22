/**
 * Close Current Tab Command - Close the currently active tab
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class CloseCurrentTabCommand extends BaseCommand {
  readonly id = 'close_current';
  readonly name = 'Close Current Tab';
  readonly aliases = ['close current', 'close current tab', 'current'];
  readonly description = 'Close the currently active tab';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  getSearchResults(context: CommandContext): SearchResultItem[] {
    // Always show the suggestion to close current tab
    return [{
      type: 'action',
      id: `${this.id}-suggestion`,
      title: 'Close current tab',
      action: () => {}
    }];
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    if (!context) {
      return { success: false, error: 'Context is null/undefined' };
    }

    return new Promise((resolve) => {
      // Close current tab - send message to background script
      chrome.runtime.sendMessage({
        type: 'CLOSE_CURRENT_TAB'
      }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        if (response && response.success) {
          context.fetchTabs(); // Refresh tab list
          resolve({
            success: true,
            message: 'Closed current tab',
            shouldCloseModal: true
          });
        } else {
          resolve({
            success: false,
            error: response?.error || 'Failed to close current tab'
          });
        }
      });
    });
  }

  getDisplayTitle(query: string): string {
    return 'Close current tab';
  }
}