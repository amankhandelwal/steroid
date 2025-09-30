/**
 * Open URL Command - Open any valid URL in a new tab
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class OpenUrlCommand extends BaseCommand {
  readonly id = 'url';
  readonly name = 'Open';
  readonly aliases = ['open', 'url', 'navigate'];
  readonly description = 'Open any valid URL in a new tab';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  private isValidUrl(string: string): boolean {
    try {
      // Try to create a URL object
      new URL(string);
      return true;
    } catch (_) {
      // Try with http:// prefix
      try {
        new URL('http://' + string);
        // Only valid if it looks like a domain
        return string.includes('.') && !string.includes(' ');
      } catch (_) {
        return false;
      }
    }
  }

  private normalizeUrl(url: string): string {
    try {
      // If it already has a protocol, use as-is
      new URL(url);
      return url;
    } catch (_) {
      // Try to add https:// prefix
      try {
        const normalized = 'https://' + url;
        new URL(normalized);
        return normalized;
      } catch (_) {
        // If still invalid, return original
        return url;
      }
    }
  }

  getSearchResults(context: CommandContext): SearchResultItem[] {
    const argument = this.extractArgument(context.query);

    if (!argument.trim()) {
      return [{
        type: 'action' as const,
        id: 'open-url-help',
        title: 'Enter a URL to open in a new tab',
        action: () => {}
      }];
    }

    if (this.isValidUrl(argument)) {
      const normalizedUrl = this.normalizeUrl(argument);
      return [{
        type: 'action' as const,
        id: `open-url-${argument}`,
        title: `Open: ${normalizedUrl}`,
        action: () => {}
      }];
    }

    return [{
      type: 'action' as const,
      id: 'invalid-url',
      title: `"${argument}" is not a valid URL`,
      action: () => {}
    }];
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    const argument = this.extractArgument(context.query);

    if (!argument.trim()) {
      return {
        success: false,
        error: 'Please provide a URL to open'
      };
    }

    if (!this.isValidUrl(argument)) {
      return {
        success: false,
        error: `"${argument}" is not a valid URL`
      };
    }

    const normalizedUrl = this.normalizeUrl(argument);

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'OPEN_URL',
        url: normalizedUrl
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
          message: `Opened: ${normalizedUrl}`,
          shouldCloseModal: true
        });
      });
    });
  }

  getDisplayTitle(query: string): string {
    const argument = this.extractArgument(query);
    if (argument.trim()) {
      if (this.isValidUrl(argument)) {
        return `Open: ${this.normalizeUrl(argument)}`;
      }
      return `Open: ${argument} (invalid URL)`;
    }
    return 'Open URL';
  }
}