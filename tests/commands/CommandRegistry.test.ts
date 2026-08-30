/**
 * CommandRegistry — suggestion fan-out, context forwarding and the resolution
 * of the previously-colliding "ungroup" alias (FIND-018.2).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CommandRegistry } from '../../src/commands/CommandRegistry';
import { commandRegistry, initializeCommands } from '../../src/commands';
import { PreviousTabCommand } from '../../src/commands/PreviousTabCommand';
import type { ActionItem } from '../../src/commands/CommandTypes';
import { installChromeMock } from '../helpers/chromeMock';
import { makeCommandContext, makeExecutionContext } from '../helpers/contexts';

const titles = (items: unknown[]): string[] => (items as ActionItem[]).map(item => item.title);

describe('CommandRegistry', () => {
  beforeEach(() => {
    installChromeMock();
    initializeCommands();
  });

  it('returns no suggestions for a blank query', () => {
    expect(commandRegistry.getCommandSuggestions('   ', makeCommandContext())).toEqual([]);
  });

  it('forwards the context so suggestions can reflect live state', () => {
    const context = makeCommandContext({
      previousTab: { tabId: 3, title: 'Docs', url: 'https://developer.mozilla.org/en/' }
    });

    const suggestions = commandRegistry.getCommandSuggestions('prev', context);

    expect(titles(suggestions)).toContain('Previous Tab > developer.mozilla.org');
  });

  it('surfaces both ungroup-style commands as distinctly titled rows', () => {
    // The two commands used to collide on a shared "ungroup" alias, with the
    // winner decided by registration order. Both must now be reachable and
    // tellable apart by title.
    const suggestions = titles(commandRegistry.getCommandSuggestions('ungroup', makeCommandContext()));

    expect(suggestions.some(title => title.startsWith('Delete Tab Group'))).toBe(true);
    expect(suggestions.some(title => title.startsWith('Ungroup All Tabs'))).toBe(true);
  });

  it('registers every command exactly once, keyed by id', () => {
    initializeCommands(); // idempotent: re-registering must not duplicate rows
    const ids = commandRegistry.getAllCommands().map(command => command.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('search');
    expect(ids).toContain('ungroup_all');
  });

  it('reports a clear error for an unknown command id', async () => {
    const result = await commandRegistry.executeCommand('does_not_exist', makeExecutionContext());
    expect(result).toMatchObject({ success: false, error: 'Command not found: does_not_exist' });
  });

  it('converts a throwing command into a failed result instead of propagating', async () => {
    const registry = new CommandRegistry();
    const command = new PreviousTabCommand();
    command.execute = async () => {
      throw new Error('boom');
    };
    registry.register(command);

    const result = await registry.executeCommand(command.id, makeExecutionContext());

    expect(result).toMatchObject({ success: false, error: 'boom' });
  });
});
