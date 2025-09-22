/**
 * Close Tab Command - Close a single tab or the current tab
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class CloseTabCommand extends BaseCommand {
  readonly id = 'close_single';
  readonly name = 'Close';
  readonly aliases = ['close', 'close tab', 'x'];
  readonly description = 'Close the current tab or a specific tab';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  getSearchResults(context: CommandContext): SearchResultItem[] {
    const argument = this.extractArgument(context.query);

    if (!argument.trim()) {
      // No argument, show suggestion to close current tab
      return [{
        type: 'action',
        id: `${this.id}-suggestion`,
        title: 'Close current tab',
        action: () => {}
      }];
    }

    // Show tabs that match the search query
    const lowerQuery = argument.toLowerCase();
    return context.tabs
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
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    console.log('CloseTabCommand.execute: context received:', context);
    console.log('CloseTabCommand.execute: context.query:', context?.query);
    console.log('CloseTabCommand.execute: typeof context:', typeof context);

    if (!context) {
      console.error('CloseTabCommand.execute: context is null/undefined');
      return { success: false, error: 'Context is null/undefined' };
    }

    if (!context.query) {
      console.error('CloseTabCommand.execute: context.query is null/undefined');
      return { success: false, error: 'Context.query is null/undefined' };
    }

    console.log('CloseTabCommand.execute: About to extract argument from:', context.query);
    console.log('CloseTabCommand.execute: this.aliases:', this.aliases);

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

    console.log('CloseTabCommand.execute: argument extracted:', argument);

    // Capture context values to avoid scoping issues
    const fetchTabs = context.fetchTabs;
    const selectedTabIds = context.selectedTabIds;

    return new Promise((resolve) => {
      console.log('CloseTabCommand.execute: Inside Promise');
      if (!argument.trim()) {
        console.log('CloseTabCommand.execute: No argument, closing current tab');
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
            console.log('CloseTabCommand.execute: Successfully closed current tab');
            fetchTabs(); // Refresh tab list
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
      } else {
        // Close selected tabs based on search
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
      }
    });
  }

  getDisplayTitle(query: string): string {
    const argument = this.extractArgument(query);
    if (argument.trim()) {
      return `Close: ${argument}`;
    }
    return 'Close current tab';
  }
}