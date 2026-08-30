/**
 * serializeStorageWrite — read-modify-write cycles against the same key must
 * run strictly in sequence (FIND-016).
 */

import { describe, expect, it } from 'vitest';
import { serializeStorageWrite } from '../../src/background/storage';

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

describe('serializeStorageWrite', () => {
  it('never interleaves two operations on the same key', async () => {
    const events: string[] = [];

    const op = (name: string, delay: number) => async () => {
      events.push(`${name}:start`);
      await tick(delay);
      events.push(`${name}:end`);
    };

    // The slower operation is queued first: without serialization its `end`
    // would land after the faster one's `start`.
    await Promise.all([
      serializeStorageWrite('history', op('slow', 20)),
      serializeStorageWrite('history', op('fast', 0))
    ]);

    expect(events).toEqual(['slow:start', 'slow:end', 'fast:start', 'fast:end']);
  });

  it('preserves last-writer-wins ordering for a shared counter', async () => {
    let stored = 0;

    const increment = () =>
      serializeStorageWrite('counter', async () => {
        const current = stored;
        await tick(5);
        stored = current + 1;
      });

    await Promise.all([increment(), increment(), increment()]);

    expect(stored).toBe(3);
  });

  it('lets operations on different keys run concurrently', async () => {
    const events: string[] = [];

    await Promise.all([
      serializeStorageWrite('a', async () => {
        events.push('a:start');
        await tick(20);
        events.push('a:end');
      }),
      serializeStorageWrite('b', async () => {
        events.push('b:start');
        await tick(0);
        events.push('b:end');
      })
    ]);

    expect(events).toEqual(['a:start', 'b:start', 'b:end', 'a:end']);
  });

  it('keeps the queue alive after a failed operation', async () => {
    await expect(
      serializeStorageWrite('flaky', async () => {
        throw new Error('write failed');
      })
    ).rejects.toThrow('write failed');

    await expect(serializeStorageWrite('flaky', async () => 'ok')).resolves.toBe('ok');
  });

  it('returns the operation result to its caller', async () => {
    await expect(serializeStorageWrite('value', async () => 42)).resolves.toBe(42);
  });
});
