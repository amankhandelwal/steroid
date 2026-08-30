/**
 * CloseMultipleTabsCommand — tab groups are selectable close targets
 * (FIND-014) alongside individual tabs.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CloseMultipleTabsCommand } from '../../src/commands/CloseMultipleTabsCommand';
import { installChromeMock, makeGroup, makeTab, type ChromeMock } from '../helpers/chromeMock';
import { makeCommandContext, makeExecutionContext } from '../helpers/contexts';

describe('CloseMultipleTabsCommand.getSearchResults', () => {
  const command = new CloseMultipleTabsCommand();

  const context = () =>
    makeCommandContext({
      tabs: [
        makeTab({ id: 1, title: 'Research paper', groupId: 10 }),
        makeTab({ id: 2, title: 'Shopping cart' })
      ],
      tabGroups: [makeGroup({ id: 10, title: 'Research' })]
    });

  it('lists matching tab groups ahead of matching tabs', () => {
    const results = command.getSearchResults({ ...context(), query: 'close tabs Research' });

    expect(results[0]).toMatchObject({ type: 'tabGroup', title: 'Research', id: 'group-10' });
    expect(results.some(item => item.type === 'tab' && item.tab.id === 1)).toBe(true);
    expect(results.some(item => item.type === 'tab' && item.tab.id === 2)).toBe(false);
  });

  it('lists every tab and group when no argument is typed', () => {
    const results = command.getSearchResults({ ...context(), query: 'close tabs' });

    expect(results.filter(item => item.type === 'tabGroup')).toHaveLength(1);
    expect(results.filter(item => item.type === 'tab')).toHaveLength(2);
  });
});

describe('CloseMultipleTabsCommand.execute', () => {
  let chromeMock: ChromeMock;
  const command = new CloseMultipleTabsCommand();

  beforeEach(() => {
    chromeMock = installChromeMock();
  });

  it('refuses to run with an empty selection', async () => {
    const result = await command.execute(makeExecutionContext());
    expect(result).toMatchObject({ success: false, error: 'No tabs selected for closing' });
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("closes every selected tab id, including a group's resolved members", async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_message: unknown, callback: (response: unknown) => void) => callback({ success: true })
    );

    const result = await command.execute(
      makeExecutionContext({ selectedTabIds: new Set([1, 2, 3]) })
    );

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'CLOSE_TAB', tabIds: [1, 2, 3] },
      expect.any(Function)
    );
    expect(result).toMatchObject({ success: true, message: 'Closed 3 tabs', shouldCloseModal: true });
  });
});
