/**
 * Set API Key Command - Configure OpenAI API key for smart grouping
 */

import { BaseCommand } from './BaseCommand';
import { CommandContext, SearchResultItem, CommandExecutionContext, CommandExecutionResult } from './CommandTypes';
import type { ExtensionMessage } from '../types/messages';

export class SetApiKeyCommand extends BaseCommand {
  readonly id = 'set_api_key';
  readonly name = 'Set OpenAI API Key';
  readonly aliases = ['api key', 'openai', 'set api key', 'settings'];
  readonly description = 'Set your OpenAI API key for smart tab grouping';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  getSearchResults(_context: CommandContext): SearchResultItem[] {
    return [{
      type: 'action' as const,
      id: `${this.id}-suggestion`,
      title: this.name,
      action: () => {}
    }];
  }

  /**
   * Stateless, following `CreateTabGroupCommand`'s pattern: `extractArgument`
   * strips this command's alias from the first invocation's query (leaving
   * `""`), so an empty argument means "no key yet" and requests input. The
   * second invocation is driven by the input dialog's submission, whose
   * value doesn't start with any alias, so `extractArgument` returns it
   * unchanged and it's treated as the key to save.
   */
  async execute(context: CommandExecutionContext): Promise<CommandExecutionResult> {
    const apiKey = this.extractArgument(context.query).trim();

    if (!apiKey) {
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

    // Validate and store the key
    return new Promise((resolve) => {
      const message: ExtensionMessage = {
        type: 'SET_API_KEY',
        apiKey
      };
      chrome.runtime.sendMessage(message, (response) => {
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
