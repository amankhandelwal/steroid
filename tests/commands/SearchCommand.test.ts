/**
 * SearchCommand — per-engine fan-out (FIND-002) and engine-list consolidation
 * onto `searchEngines.json` (FIND-009).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SearchCommand } from '../../src/commands/SearchCommand';
import searchEngines from '../../src/config/searchEngines.json';
import type { ActionItem } from '../../src/commands/CommandTypes';
import { installChromeMock, type ChromeMock } from '../helpers/chromeMock';
import { makeCommandContext } from '../helpers/contexts';

const asActions = (items: unknown[]): ActionItem[] => items as ActionItem[];

describe('SearchCommand.getSuggestions', () => {
  let chromeMock: ChromeMock;
  const command = new SearchCommand();

  beforeEach(() => {
    chromeMock = installChromeMock();
  });

  it('fans out one row per configured engine for "search <query>"', () => {
    const suggestions = asActions(command.getSuggestions('search hello world'));

    expect(suggestions).toHaveLength(searchEngines.length);
    expect(suggestions.map(item => item.title)).toEqual(
      searchEngines.map(engine => `Search "hello world" on ${engine.name}`)
    );
  });

  it('opens the engine the user picked, not always the first one', () => {
    const suggestions = asActions(command.getSuggestions('search hello world'));
    const duckDuckGo = suggestions.find(item => item.title.includes('DuckDuckGo'));

    duckDuckGo?.action();

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'OPEN_URL',
      url: 'https://duckduckgo.com/?q=hello%20world'
    });
  });

  it('lists the engines with no embedded query when only the alias is typed', () => {
    const suggestions = asActions(command.getSuggestions('search'));

    expect(suggestions).toHaveLength(searchEngines.length);
    expect(suggestions[0].title).toBe(`Search with ${searchEngines[0].name}`);
  });

  it('does not fan out for a query that only shares a prefix with an alias', () => {
    // "settings" starts with "s" (a SearchCommand alias) but is not an invocation.
    expect(command.getSuggestions('settings')).toEqual([]);
  });

  it('produces the same rows in command mode as in the default view', () => {
    const suggestions = asActions(command.getSuggestions('search hello'));
    const results = asActions(
      command.getSearchResults(makeCommandContext({ query: 'search hello' }))
    );

    expect(results.map(item => item.title)).toEqual(suggestions.map(item => item.title));
  });
});

describe('SearchCommand engine configuration', () => {
  it('sources its engines from searchEngines.json (single source of truth)', () => {
    const titles = asActions(new SearchCommand().getSuggestions('search x')).map(item => item.title);
    for (const engine of searchEngines) {
      expect(titles).toContain(`Search "x" on ${engine.name}`);
    }
  });

  it('every configured engine has a name, url template and shortcut', () => {
    for (const engine of searchEngines) {
      expect(engine.name).toBeTruthy();
      expect(engine.url).toMatch(/^https:\/\//);
      expect(engine.shortcut).toBeTruthy();
    }
  });
});
