import searchEngines from '../config/searchEngines.json';

export type CommandType = 'tabSearch' | 'google' | 'youtube' | 'close' | 'closeDuplicate' | 'openUrl' | 'previousTab' | 'createTabGroup' | 'deleteTabGroup';

export interface ParsedCommand {
  type: CommandType;
  query: string; // The actual search query or argument for the command
  originalQuery: string; // The full original input from the user
}

/**
 * Parses the user's input query to identify commands or determine the search type.
 * @param input The raw input string from the command palette.
 * @returns A ParsedCommand object.
 */
export function parseCommand(input: string): ParsedCommand {
  const lowerInput = input.toLowerCase().trim();

  // Check for search engine commands
  for (const engine of searchEngines) {
    for (const prefix of engine.prefix) {
      if (lowerInput.startsWith(`${prefix} `)) {
        return {
          type: engine.id as CommandType, // Cast to CommandType, assuming engine.id matches
          query: input.substring(prefix.length + 1).trim(),
          originalQuery: input,
        };
      }
    }
  }

  if (lowerInput.startsWith('previous tab') || lowerInput.startsWith('prev tab') || lowerInput === 'previous' || lowerInput === 'prev') {
    return {
      type: 'previousTab',
      query: '',
      originalQuery: input,
    };
  }

  if (lowerInput.startsWith('create tab group') || lowerInput.startsWith('group tabs') || lowerInput.startsWith('create group')) {
    return {
      type: 'createTabGroup',
      query: input.substring(input.indexOf(' ') + 1).trim(),
      originalQuery: input,
    };
  }

  if (lowerInput.startsWith('delete tab group') || lowerInput.startsWith('ungroup') || lowerInput.startsWith('remove group')) {
    return {
      type: 'deleteTabGroup',
      query: input.substring(input.indexOf(' ') + 1).trim(),
      originalQuery: input,
    };
  }

  if (lowerInput.startsWith('close duplicate')) {
    return {
      type: 'closeDuplicate',
      query: '',
      originalQuery: input,
    };
  }

  if (lowerInput.startsWith('close ')) {
    return {
      type: 'close',
      query: input.substring(6).trim(),
      originalQuery: input,
    };
  }

  // Basic URL detection (simplified for now, will be refined)
  if (input.includes('.') && !input.includes(' ') && (input.startsWith('http://') || input.startsWith('https://') || input.includes('.'))) {
    return {
      type: 'openUrl',
      query: input,
      originalQuery: input,
    };
  }

  // Default to tab search if no command is matched
  return {
    type: 'tabSearch',
    query: input,
    originalQuery: input,
  };
}
