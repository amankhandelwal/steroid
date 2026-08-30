/**
 * Smart Group Command - AI-powered tab grouping via OpenAI
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';
import type { ExtensionMessage } from '../types/messages';

export class SmartGroupCommand extends BaseCommand {
  readonly id = 'smart_group';
  readonly name = 'Smart Group Tabs (AI)';
  readonly aliases = ['smart group', 'ai group', 'auto group', 'smart'];
  readonly description = 'Automatically group tabs using AI';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;
  readonly loadingMessage = 'Grouping tabs with AI...';

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
      const message: ExtensionMessage = { type: 'SMART_GROUP_TABS' };
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
            message: response.message || 'Tabs grouped successfully',
            shouldCloseModal: true
          });
        } else {
          resolve({
            success: false,
            error: response?.error || 'Failed to group tabs'
          });
        }
      });
    });
  }
}
