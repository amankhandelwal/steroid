/**
 * Close Multiple Tabs Command - Multi-select and close multiple tabs
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';
import type { ExtensionMessage } from '../types/messages';

export class CloseMultipleTabsCommand extends BaseCommand {
  readonly id = 'close_multiple';
  readonly name = 'Close Tabs';
  readonly aliases = ['close tabs', 'close multiple', 'multi close'];
  readonly description = 'Select and close multiple tabs';
  readonly mode = 'CommandMode' as const;
  readonly multiSelect = true;

  getSearchResults(context: CommandContext): SearchResultItem[] {
    const argument = this.extractArgument(context.query);
    const lowerQuery = argument.toLowerCase();

    const tabItems: SearchResultItem[] = (
      argument.trim()
        ? context.tabs.filter(tab =>
            tab.title?.toLowerCase().includes(lowerQuery) ||
            tab.url?.toLowerCase().includes(lowerQuery)
          )
        : context.tabs
    ).map(tab => ({
      type: 'tab' as const,
      tab
    }));

    const groupItems: SearchResultItem[] = this.getMatchingGroups(context.tabGroups, lowerQuery);

    return [...groupItems, ...tabItems];
  }

  /**
   * Tab groups whose title matches the query. Groups already fully selected
   * (every member tab id already in selectedTabIds) are excluded by the
   * generic post-filter in useCommandPalette.ts, not here.
   */
  private getMatchingGroups(tabGroups: chrome.tabGroups.TabGroup[], lowerQuery: string): SearchResultItem[] {
    return tabGroups
      .filter(group => !lowerQuery.trim() || (group.title && group.title.toLowerCase().includes(lowerQuery)))
      .map(group => ({
        type: 'tabGroup' as const,
        group,
        title: group.title || `Group ${group.id}`,
        id: `group-${group.id}`
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
      const message: ExtensionMessage = {
        type: 'CLOSE_TAB',
        tabIds: Array.from(context.selectedTabIds)
      };
      chrome.runtime.sendMessage(message, (_response) => {
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