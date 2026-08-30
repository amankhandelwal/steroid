/**
 * PreviousTabCommand — dynamic suggestion title sourced from prefetched
 * context state (FIND-010).
 */

import { describe, expect, it } from 'vitest';
import { PreviousTabCommand } from '../../src/commands/PreviousTabCommand';
import type { ActionItem } from '../../src/commands/CommandTypes';
import { makeCommandContext } from '../helpers/contexts';

const titleOf = (items: unknown[]): string => (items[0] as ActionItem).title;

describe('PreviousTabCommand.getSuggestions', () => {
  const command = new PreviousTabCommand();

  it("renders the previous tab's hostname alongside the command name", () => {
    const context = makeCommandContext({
      previousTab: { tabId: 7, title: 'YouTube', url: 'https://youtube.com/watch?v=abc' }
    });

    expect(titleOf(command.getSuggestions('prev', context))).toBe('Previous Tab > youtube.com');
  });

  it('falls back to the tab title when the URL is not parseable', () => {
    const context = makeCommandContext({
      previousTab: { tabId: 7, title: 'Some Local Page', url: 'not-a-url' }
    });

    expect(titleOf(command.getSuggestions('prev', context))).toBe('Previous Tab > Some Local Page');
  });

  it('falls back to the static label when there is no history yet', () => {
    expect(titleOf(command.getSuggestions('prev', makeCommandContext()))).toBe('Previous Tab');
  });

  it('tolerates being called without a context at all', () => {
    expect(titleOf(command.getSuggestions('prev'))).toBe('Previous Tab');
  });

  it('keeps command-mode results consistent with the suggestion title', () => {
    const context = makeCommandContext({
      previousTab: { tabId: 7, title: 'GitHub', url: 'https://github.com/foo' }
    });

    expect(titleOf(command.getSearchResults(context))).toBe('Previous Tab > github.com');
  });
});
