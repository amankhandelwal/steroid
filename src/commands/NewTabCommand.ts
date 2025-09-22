/**
 * New Tab Command - Open a new tab
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class NewTabCommand extends BaseCommand {
  readonly id = 'new_tab';
  readonly name = 'New Tab';
  readonly aliases = ['new tab', 'new', 'nt', 'tab'];
  readonly description = 'Open a new tab in the current window';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  getSearchResults(context: CommandContext): SearchResultItem[] {
    // For SingleExecution commands, show an execution option
    return [{
      type: 'action' as const,
      id: `${this.id}-suggestion`,
      title: 'New Tab',
      action: () => {
        // This will be handled by the command execution system
      }
    }];
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'NEW_TAB' }, (response) => {
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
            message: 'Created new tab',
            shouldCloseModal: true
          });
        } else {
          resolve({
            success: false,
            error: response?.error || 'Failed to create new tab'
          });
        }
      });
    });
  }

  getDisplayTitle(query: string): string {
    return 'New Tab';
  }
}