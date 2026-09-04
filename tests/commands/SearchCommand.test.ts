/**
 * SearchCommand — per-engine fan-out (FIND-002) and engine-list consolidation
 * onto `searchEngines.json` (FIND-009).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SearchCommand } from '../../src/commands/SearchCommand';
import searchEngines from '../../src/config/searchEngines.json';
import type { ActionItem } from '../../src/commands/CommandTypes';
import { installChromeMock, type ChromeMock } from '../helpers/chromeMock';
import { makeCommandContext, makeExecutionContext } from '../helpers/contexts';

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

describe('SearchCommand.execute', () => {
  let chromeMock: ChromeMock;
  const command = new SearchCommand();

  beforeEach(() => {
    chromeMock = installChromeMock();
    // `execute` uses the callback form of sendMessage and awaits it. The shared
    // mock is a bare spy that never invokes the callback, which would hang the
    // promise, so settle it here rather than changing the default for every
    // other suite.
    chromeMock.runtime.sendMessage.mockImplementation(
      (_message: unknown, callback?: () => void) => callback?.()
    );
  });

  it('does not treat a leading engine shortcut as an engine selector', async () => {
    // "gh" is GitHub's shortcut in searchEngines.json. An earlier, unreachable
    // implementation parsed it out and searched GitHub for "cats", which
    // disagreed with the rows on screen — those read `Search "gh cats" on ...`.
    // Choosing an engine is the rows' job; the whole argument is the query.
    await command.execute(makeExecutionContext({ query: 's gh cats' }));

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'OPEN_URL', url: 'https://www.google.com/search?q=gh%20cats' },
      expect.any(Function)
    );
  });

  it('searches the default engine with the whole argument', async () => {
    await command.execute(makeExecutionContext({ query: 'search hello world' }));

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'OPEN_URL', url: `${searchEngines[0].url}hello%20world` },
      expect.any(Function)
    );
  });

  it('refuses an empty query without opening anything', async () => {
    const result = await command.execute(makeExecutionContext({ query: 'search   ' }));

    expect(result.success).toBe(false);
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });
});

describe('SearchCommand UI routing', () => {
  const command = new SearchCommand();

  // These two facts are what make `execute` unreachable from the palette, and
  // what make row selection the live path. If either changes, `execute` starts
  // running for real and its behaviour needs revisiting alongside the rows'.
  it('is SingleExecution, so command mode is never entered for it', () => {
    expect(command.mode).toBe('SingleExecution');
  });

  it('gives every engine row an id the registry does not dispatch on', () => {
    // `handleActionItem` routes to CommandRegistry.executeCommand only for ids
    // ending "-suggestion"; anything else runs the row's own closure.
    const ids = asActions(command.getSuggestions('search x')).map(item => item.id);

    expect(ids).toHaveLength(searchEngines.length);
    for (const id of ids) {
      expect(id.endsWith('-suggestion')).toBe(false);
    }
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
