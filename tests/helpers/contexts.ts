/**
 * Builders for the two context objects commands are handed, so individual
 * tests only state the fields they actually care about.
 */

import { vi } from 'vitest';
import type {
  CommandContext,
  CommandExecutionContext
} from '../../src/commands/CommandTypes';

/** A `CommandContext` with empty defaults, overridable per test. */
export function makeCommandContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    tabs: [],
    tabGroups: [],
    selectedTabIds: new Set<number>(),
    query: '',
    commandMode: false,
    activeCommand: null,
    previousTab: null,
    ...overrides
  };
}

/** A `CommandExecutionContext` whose callbacks are all spies. */
export function makeExecutionContext(
  overrides: Partial<CommandExecutionContext> = {}
): CommandExecutionContext {
  return {
    query: '',
    selectedTabIds: new Set<number>(),
    commandMode: false,
    tabGroups: [],
    onClose: vi.fn(),
    setCommandMode: vi.fn(),
    setActiveCommand: vi.fn(),
    setSelectedTabIds: vi.fn(),
    setQuery: vi.fn(),
    fetchTabs: vi.fn(),
    fetchTabGroups: vi.fn(),
    ...overrides
  };
}
