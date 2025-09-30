/**
 * Delete Tab Group Command - Delete/ungroup a tab group
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class DeleteTabGroupCommand extends BaseCommand {
  readonly id = 'delete_group';
  readonly name = 'Delete Tab Group';
  readonly aliases = ['delete tab group', 'delete group', 'ungroup', 'remove group'];
  readonly description = 'Delete a tab group (ungroups tabs but keeps them open)';
  readonly mode = 'CommandMode' as const;
  readonly multiSelect = false; // Only one group can be selected at a time

  getSearchResults(context: CommandContext): SearchResultItem[] {
    const argument = this.extractArgument(context.query);

    if (!argument.trim()) {
      // Show all tab groups
      return context.tabGroups.map(group => ({
        type: 'tabGroup' as const,
        group,
        title: group.title || `Group ${group.id}`,
        id: `group-${group.id}`
      }));
    }

    // Filter tab groups based on search query
    const lowerQuery = argument.toLowerCase();
    return context.tabGroups
      .filter(group =>
        (group.title && group.title.toLowerCase().includes(lowerQuery)) ||
        group.id.toString().includes(lowerQuery)
      )
      .map(group => ({
        type: 'tabGroup' as const,
        group,
        title: group.title || `Group ${group.id}`,
        id: `group-${group.id}`
      }));
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    // Find the group to delete
    let groupToDelete: chrome.tabGroups.TabGroup | null = null;

    // First check if a specific group was selected (via Shift+Enter on highlighted item)
    if (context.selectedGroupId !== undefined) {
      groupToDelete = context.tabGroups.find((group: chrome.tabGroups.TabGroup) =>
        group.id === context.selectedGroupId
      ) || null;
    }

    // Otherwise, try to find by query argument
    if (!groupToDelete) {
      const argument = this.extractArgument(context.query);

      if (argument.trim()) {
        const lowerQuery = argument.toLowerCase();
        groupToDelete = context.tabGroups.find((group: chrome.tabGroups.TabGroup) =>
          (group.title && group.title.toLowerCase().includes(lowerQuery)) ||
          group.id.toString().includes(lowerQuery)
        ) || null;
      }
    }

    if (!groupToDelete) {
      return {
        success: false,
        error: 'No tab group selected for deletion'
      };
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'DELETE_TAB_GROUP',
        groupId: groupToDelete!.id
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

          resolve({
            success: true,
            message: response.message || `Deleted group "${groupToDelete!.title || groupToDelete!.id}"`,
            shouldCloseModal: true
          });
        } else {
          resolve({
            success: false,
            error: response?.error || 'Failed to delete tab group'
          });
        }
      });
    });
  }

  getDisplayTitle(query: string): string {
    const argument = this.extractArgument(query);
    if (argument.trim()) {
      return `Delete Group: ${argument}`;
    }
    return 'Delete Tab Group';
  }
}