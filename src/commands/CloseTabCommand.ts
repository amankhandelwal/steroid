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
    const argument = this.extractArgument(context.query);

    return new Promise((resolve) => {
      if (!argument.trim()) {
        // Close current tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0 && tabs[0].id) {
            chrome.runtime.sendMessage({
              type: 'CLOSE_TAB',
              tabId: tabs[0].id
            }, (response) => {
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
                message: 'Closed current tab',
                shouldCloseModal: true
              });
            });
          } else {
            resolve({
              success: false,
              error: 'No active tab found'
            });
          }
        });
      } else {
        // Close selected tabs based on search
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