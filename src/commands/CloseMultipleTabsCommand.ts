/**
 * Close Multiple Tabs Command - Multi-select and close multiple tabs
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class CloseMultipleTabsCommand extends BaseCommand {
  readonly id = 'close_multiple';
  readonly name = 'Close Tabs';
  readonly aliases = ['close tabs', 'close multiple', 'multi close'];
  readonly description = 'Select and close multiple tabs';
  readonly mode = 'CommandMode' as const;
  readonly multiSelect = true;

  getSearchResults(context: CommandContext): SearchResultItem[] {
    const argument = this.extractArgument(context.query);

    if (!argument.trim()) {
      // Show all tabs for selection
      return context.tabs.map(tab => ({
        type: 'tab' as const,
        tab
      }));
    }

    // Filter tabs based on search query
    const lowerQuery = argument.toLowerCase();
    return context.tabs
      .filter(tab =>
        tab.title?.toLowerCase().includes(lowerQuery) ||
        tab.url?.toLowerCase().includes(lowerQuery)
      )
      .map(tab => ({
        type: 'tab' as const,
        tab
      }));
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    if (context.selectedTabIds.size === 0) {
      return {
        success: false,
        error: 'No tabs selected for closing'
      };
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CLOSE_TAB',
        tabIds: Array.from(context.selectedTabIds)
      }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        context.fetchTabs(); // Refresh tab list
        const count = context.selectedTabIds.size;
        resolve({
          success: true,
          message: `Closed ${count} tab${count !== 1 ? 's' : ''}`,
          shouldCloseModal: true
        });
      });
    });
  }

  getDisplayTitle(query: string): string {
    const argument = this.extractArgument(query);
    if (argument.trim()) {
      return `Close Tabs: ${argument}`;
    }
    return 'Close Tabs (Multiple)';
  }
}