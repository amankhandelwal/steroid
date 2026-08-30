/**
 * Ungroup All Command - Removes all tab groups in the current window
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';
import type { ExtensionMessage } from '../types/messages';

export class UngroupAllCommand extends BaseCommand {
  readonly id = 'ungroup_all';
  readonly name = 'Ungroup All Tabs';
  readonly aliases = ['ungroup all', 'remove groups', 'remove all groups', 'disband'];
  readonly description = 'Remove all tab groups across all windows';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;
  readonly loadingMessage = 'Ungrouping all tabs...';

  getSearchResults(_context: CommandContext): SearchResultItem[] {
    return [{
      type: 'action' as const,
      id: `${this.id}-suggestion`,
      title: this.name,
      action: () => {}
    }];
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    return new Promise((resolve) => {
      const message: ExtensionMessage = { type: 'UNGROUP_ALL_TABS' };
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        if (response?.success) {
          context.fetchTabs();
          context.fetchTabGroups();
          resolve({
            success: true,
            message: response.message || 'All tabs ungrouped',
            shouldCloseModal: true
          });
        } else {
          resolve({
            success: false,
            error: response?.error || 'Failed to ungroup tabs'
          });
        }
      });
    });
  }
}
