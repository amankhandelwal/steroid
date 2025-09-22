/**
 * Close Tab Command - Close a single tab or the current tab
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class CloseTabCommand extends BaseCommand {
  readonly id = 'close_single';
  readonly name = 'Close Tab';
  readonly aliases = ['close tab', 'close', 'x'];
  readonly description = 'Close a specific tab by searching for it';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  getSearchResults(context: CommandContext): SearchResultItem[] {
    const argument = this.extractArgument(context.query);

    const results: SearchResultItem[] = [];

    if (!argument.trim()) {
      // No argument, show suggestion for tab search
      results.push({
        type: 'action',
        id: `${this.id}-suggestion`,
        title: 'Close {query_name}',
        action: () => {}
      });
    } else {
      // Show tabs that match the search query
      const lowerQuery = argument.toLowerCase();
      const matchingTabs = context.tabs
        .filter(tab =>
          tab.title?.toLowerCase().includes(lowerQuery) ||
          tab.url?.toLowerCase().includes(lowerQuery)
        )
        .map(tab => ({
          type: 'closeTabAction' as const,
          tab,
          title: tab.title || 'Untitled Tab',
          id: `close-tab-${tab.id}`
        }));

      results.push(...matchingTabs);
    }

    return results;
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    if (!context) {
      return { success: false, error: 'Context is null/undefined' };
    }

    if (!context.query) {
      return { success: false, error: 'Context.query is null/undefined' };
    }

    // Extract argument manually to avoid any issues with this.extractArgument
    let argument = context.query; // Default to the full query
    const lowerQuery = context.query.toLowerCase().trim();
    for (const alias of this.aliases) {
      const lowerAlias = alias.toLowerCase();
      if (lowerQuery.startsWith(lowerAlias)) {
        argument = context.query.substring(alias.length).trim();
        break;
      }
    }


    // Capture context values to avoid scoping issues
    const fetchTabs = context.fetchTabs;
    const selectedTabIds = context.selectedTabIds;

    return new Promise((resolve) => {
      if (!argument.trim()) {
        // No argument provided - this shouldn't happen in normal usage
        resolve({
          success: false,
          error: 'No tab specified for closing'
        });
        return;
      }

      // Close selected tabs based on search
      if (selectedTabIds.size === 0) {
        resolve({
          success: false,
          error: 'No tabs selected for closing'
        });
        return;
      }

      chrome.runtime.sendMessage({
        type: 'CLOSE_TAB',
        tabIds: Array.from(selectedTabIds)
      }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        fetchTabs(); // Refresh tab list
        const count = selectedTabIds.size;
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
      return `Close: ${argument}`;
    }
    return 'Close {query_name}';
  }
}