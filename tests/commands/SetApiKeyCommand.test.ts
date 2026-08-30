/**
 * SetApiKeyCommand — statelessness across a cancelled input dialog (FIND-011).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SetApiKeyCommand } from '../../src/commands/SetApiKeyCommand';
import { installChromeMock, type ChromeMock } from '../helpers/chromeMock';
import { makeExecutionContext } from '../helpers/contexts';

describe('SetApiKeyCommand.execute', () => {
  let chromeMock: ChromeMock;

  beforeEach(() => {
    chromeMock = installChromeMock();
  });

  it('asks for input when invoked with only its alias typed', async () => {
    const command = new SetApiKeyCommand();
    const result = await command.execute(makeExecutionContext({ query: 'api key' }));

    expect(result).toMatchObject({ success: true, needsInput: true });
    expect(result.inputConfig).toMatchObject({ inputType: 'password' });
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('asks for input again after a cancelled dialog, on the very next invocation', async () => {
    // The instance is deliberately reused: the registry holds one singleton, and
    // the old `awaitingKey` field made this second call save garbage instead.
    const command = new SetApiKeyCommand();

    await command.execute(makeExecutionContext({ query: 'api key' }));
    // ...user cancels; nothing resets the command...
    const second = await command.execute(makeExecutionContext({ query: 'api key' }));

    expect(second).toMatchObject({ success: true, needsInput: true });
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('saves the key submitted through the input dialog', async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_message: unknown, callback: (response: unknown) => void) => callback({ success: true })
    );

    const command = new SetApiKeyCommand();
    const result = await command.execute(makeExecutionContext({ query: 'sk-test-key' }));

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'SET_API_KEY', apiKey: 'sk-test-key' },
      expect.any(Function)
    );
    expect(result).toMatchObject({ success: true, shouldCloseModal: true });
  });

  it('surfaces a background-reported failure', async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_message: unknown, callback: (response: unknown) => void) =>
        callback({ success: false, error: 'Invalid API key' })
    );

    const command = new SetApiKeyCommand();
    const result = await command.execute(makeExecutionContext({ query: 'sk-bad' }));

    expect(result).toMatchObject({ success: false, error: 'Invalid API key' });
  });

  it('surfaces a closed message port as an error rather than a false success', async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_message: unknown, callback: (response: unknown) => void) => {
        chromeMock.runtime.lastError = { message: 'message port closed' };
        callback(undefined);
        chromeMock.runtime.lastError = undefined;
      }
    );

    const command = new SetApiKeyCommand();
    const result = await command.execute(makeExecutionContext({ query: 'sk-test' }));

    expect(result).toMatchObject({ success: false, error: 'message port closed' });
  });
});

describe('SetApiKeyCommand suggestion', () => {
  it('exposes one execution row', () => {
    installChromeMock();
    const command = new SetApiKeyCommand();
    const results = command.getSearchResults({
      tabs: [],
      tabGroups: [],
      selectedTabIds: new Set(),
      query: '',
      commandMode: false,
      activeCommand: null,
      previousTab: null
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ type: 'action', id: 'set_api_key-suggestion' });
  });
});
