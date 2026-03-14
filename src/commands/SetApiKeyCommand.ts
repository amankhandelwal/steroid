/**
 * Set API Key Command - Configure OpenAI API key for smart grouping
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';

export class SetApiKeyCommand extends BaseCommand {
  readonly id = 'set_api_key';
  readonly name = 'Set OpenAI API Key';
  readonly aliases = ['api key', 'openai', 'set api key', 'settings'];
  readonly description = 'Set your OpenAI API key for smart tab grouping';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  /** Tracks whether the input dialog has been shown */
  private awaitingKey = false;

  getSearchResults(_context: CommandContext): SearchResultItem[] {
    return [{
      type: 'action' as const,
      id: `${this.id}-suggestion`,
      title: this.name,
      action: () => {}
    }];
  }

  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    // First call: always show input dialog regardless of query content
    if (!this.awaitingKey) {
      this.awaitingKey = true;
      return {
        success: true,
        needsInput: true,
        inputConfig: {
          title: 'Set OpenAI API Key',
          placeholder: 'sk-...',
          defaultValue: '',
          inputType: 'password',
          submitLabel: 'Save Key'
        }
      };
    }

    // Second call: context.query is the API key from the input dialog
    this.awaitingKey = false;
    const apiKey = context.query.trim();

    if (!apiKey) {
      return { success: false, error: 'API key cannot be empty' };
    }

    // Validate and store the key
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'SET_API_KEY',
        apiKey
      }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        if (response?.success) {
          resolve({
            success: true,
            message: 'OpenAI API key saved successfully',
            shouldCloseModal: true
          });
        } else {
          resolve({
            success: false,
            error: response?.error || 'Failed to save API key'
          });
        }
      });
    });
  }
}
