/**
 * Previous Tab Command - Navigate to previously active tab
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, PreviousTabInfo, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';
import type { ExtensionMessage } from '../types/messages';

export class PreviousTabCommand extends BaseCommand {
  readonly id = 'previous_tab';
  readonly name = 'Previous Tab';
  readonly aliases = ['previous tab', 'prev tab', 'previous', 'prev'];
  readonly description = 'Switch to the previously active tab';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  getSearchResults(context: CommandContext): SearchResultItem[] {
    // For SingleExecution commands, show an execution option. This path is
    // only reached in command mode, which PreviousTabCommand never enters —
    // kept as a harmless fallback consistent with getSuggestions' output.
    return [{
      type: 'action' as const,
      id: `${this.id}-suggestion`,
      title: this.buildSuggestionTitle(context.previousTab),
      action: () => {
        // This will be handled by the command execution system
      }
    }];
  }

  /**
   * Suggestion title for the default (non-command-mode) palette view. Shows
   * the real previous tab's hostname (falling back to its title, then to a
   * static label) instead of always saying "Previous Tab".
   */
  getSuggestions(query: string, context?: CommandContext): SearchResultItem[] {
    if (!this.matches(query)) {
      return [];
    }

    return [{
      type: 'action' as const,
      id: `${this.id}-suggestion`,
      title: this.buildSuggestionTitle(context?.previousTab ?? null),
      action: () => {
        // This will be handled by the command execution system
      }
    }];
  }

  /** Build "Previous Tab > <fragment>" from the prefetched previous tab, or the static fallback. */
  private buildSuggestionTitle(previousTab: PreviousTabInfo | null): string {
    if (!previousTab) {
      return this.name;
    }

    const fragment = this.hostnameOrTitle(previousTab);
    return `${this.name} > ${fragment}`;
  }

  /** Prefer the previous tab's hostname; fall back to its title if the URL doesn't parse. */
  private hostnameOrTitle(previousTab: PreviousTabInfo): string {
    try {
      const hostname = new URL(previousTab.url ?? '').hostname;
      if (hostname) {
        return hostname;
      }
    } catch {
      // Not a parseable URL — fall through to title.
    }
    return previousTab.title;
  }

  async execute(_context: CommandExecutionContext): Promise<CommandExecutionResult> {
    return new Promise((resolve) => {
      const message: ExtensionMessage = { type: 'SWITCH_TO_PREVIOUS_TAB' };
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        if (response && response.success) {
          resolve({
            success: true,
            message: 'Switched to previous tab',
            shouldCloseModal: true
          });
        } else {
          resolve({
            success: false,
            error: response?.message || 'No previous tab available'
          });
        }
      });
    });
  }

  getDisplayTitle(_query: string): string {
    // We could enhance this to show the actual previous tab title
    return 'Previous Tab';
  }
}