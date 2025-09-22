/**
 * Create Tab Group Command - Group selected tabs
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class CreateTabGroupCommand extends BaseCommand {
  readonly id = 'group_tabs';
  readonly name = 'Group Tabs';
  readonly aliases = ['group tabs', 'group', 'create group'];
  readonly description = 'Create a new tab group with selected tabs';
  readonly mode = 'CommandMode' as const;
  readonly multiSelect = true;

  getSearchResults(context: CommandContext): SearchResultItem[] {
    const argument = this.extractArgument(context.query);

    if (!argument.trim()) {
      // Show all tabs for selection, excluding already selected tabs
      return context.tabs
        .filter(tab => !context.selectedTabIds.has(tab.id!))
        .map(tab => ({
          type: 'tab' as const,
          tab
        }));
    }

    // Filter tabs based on search query, excluding already selected tabs
    const lowerQuery = argument.toLowerCase();
    return context.tabs
      .filter(tab =>
        !context.selectedTabIds.has(tab.id!) &&
        (tab.title?.toLowerCase().includes(lowerQuery) ||
         tab.url?.toLowerCase().includes(lowerQuery))
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
        error: 'No tabs selected for grouping'
      };
    }

    if (context.selectedTabIds.size < 2) {
      return {
        success: false,
        error: 'At least 2 tabs required to create a group'
      };
    }

    // Check if group name is provided in query (from input dialog)
    const argument = this.extractArgument(context.query);
    const groupName = argument.trim();

    if (!groupName) {
      // No group name provided - request input from user
      return {
        success: true,
        needsInput: true,
        inputConfig: {
          title: 'Create Tab Group',
          placeholder: 'Enter group name...',
          defaultValue: `Group ${new Date().toLocaleTimeString()}`
        }
      };
    }

    // Group name provided - create the group
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CREATE_TAB_GROUP',
        tabIds: Array.from(context.selectedTabIds),
        groupName
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
          context.fetchTabGroups(); // Refresh tab groups list

          const count = context.selectedTabIds.size;
          resolve({
            success: true,
            message: response.message || `Created group "${groupName}" with ${count} tabs`,
            shouldCloseModal: true
          });
        } else {
          resolve({
            success: false,
            error: response?.error || 'Failed to create tab group'
          });
        }
      });
    });
  }

  getDisplayTitle(query: string): string {
    const argument = this.extractArgument(query);
    if (argument.trim()) {
      return `Group Tabs: "${argument}"`;
    }
    return 'Group Tabs';
  }
}