import searchEngines from '../config/searchEngines.json';

export type CommandType = 'tabSearch' | 'google' | 'youtube' | 'close' | 'closeDuplicate' | 'openUrl';

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
        console.log(`CommandParser: Using search engine config for ${engine.name}`);
        return {
          type: engine.id as CommandType, // Cast to CommandType, assuming engine.id matches
          query: input.substring(prefix.length + 1).trim(),
          originalQuery: input,
        };
      }
    }
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
