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
    // This command doesn't show additional search results
    return [];
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    return new Promise((resolve) => {
      chrome.tabs.create({}, (tab) => {
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
          message: 'Created new tab',
          shouldCloseModal: true
        });
      });
    });
  }

  getDisplayTitle(query: string): string {
    return 'New Tab';
  }
}