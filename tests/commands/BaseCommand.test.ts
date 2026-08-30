/**
 * BaseCommand — alias matching, argument extraction and default suggestions.
 * Covers FIND-018.1: matching must be prefix-based, never mid-string.
 */

import { describe, expect, it } from 'vitest';
import { BaseCommand } from '../../src/commands/BaseCommand';
import type {
  CommandContext,
  CommandExecutionResult,
  SearchResultItem
} from '../../src/commands/CommandTypes';
import { makeCommandContext } from '../helpers/contexts';

class StubCommand extends BaseCommand {
  readonly id = 'stub';
  readonly name = 'Stub Command';
  readonly aliases = ['openai', 'open url'];
  readonly description = 'Test double';
  readonly mode = 'SingleExecution' as const;
  readonly multiSelect = false;

  getSearchResults(_context: CommandContext): SearchResultItem[] {
    return [];
  }

  async execute(): Promise<CommandExecutionResult> {
    return { success: true };
  }
}

describe('BaseCommand.matches', () => {
  const command = new StubCommand();

  it('matches a partially typed alias (query is a prefix of the alias)', () => {
    expect(command.matches('open')).toBe(true);
    expect(command.matches('openai')).toBe(true);
  });

  it('matches an alias followed by an argument (alias is a prefix of the query)', () => {
    expect(command.matches('open url https://example.com')).toBe(true);
  });

  it('does not match a query that merely appears inside an alias', () => {
    // The old `alias.includes(query)` rule matched all of these.
    expect(command.matches('en')).toBe(false);
    expect(command.matches('nai')).toBe(false);
    expect(command.matches('url')).toBe(false);
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(command.matches('  OpenAI  ')).toBe(true);
  });
});

describe('BaseCommand.extractArgument', () => {
  const command = new StubCommand();

  it('strips the matched alias and returns the remainder', () => {
    expect(command.extractArgument('open url https://example.com')).toBe('https://example.com');
  });

  it('returns an empty string when the query is exactly an alias', () => {
    expect(command.extractArgument('openai')).toBe('');
  });

  it('returns the query untouched when no alias prefixes it', () => {
    expect(command.extractArgument('sk-secret-value')).toBe('sk-secret-value');
  });
});

describe('BaseCommand.getSuggestions', () => {
  const command = new StubCommand();

  it('returns a single suggestion row for a matching query', () => {
    const suggestions = command.getSuggestions('openai', makeCommandContext());
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ type: 'action', id: 'stub-suggestion' });
  });

  it('returns nothing for a non-matching query', () => {
    expect(command.getSuggestions('nai', makeCommandContext())).toEqual([]);
  });
});
