/**
 * OpenAI Service - Handles API key management and smart tab grouping via OpenAI
 *
 * Runs in background service worker context only.
 */

const STORAGE_KEY = 'openai_api_key';
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const MODEL = 'gpt-4o-mini';
const MAX_TABS = 100;

// --- Types ---

export interface TabInfo {
  id: number;
  title: string;
  url: string;
  windowId: number;
}

export interface GroupSuggestion {
  groupName: string;
  tabIds: number[];
}

export interface WindowSuggestion {
  groups: GroupSuggestion[];
}

export interface SmartGroupResult {
  success: boolean;
  windows?: WindowSuggestion[];
  error?: string;
}

// --- API Key Management ---

/** Read the stored OpenAI API key */
export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

/** Store the OpenAI API key */
export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: key });
}

/** Validate an API key by making a lightweight models list request */
export async function validateApiKey(key: string): Promise<boolean> {
  try {
    const response = await fetch(`${OPENAI_API_BASE}/models`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${key}` }
    });
    return response.ok;
  } catch {
    return false;
  }
}

// --- Prompt Construction ---

/** Build the system and user messages for tab grouping with window management */
function buildGroupingMessages(tabs: TabInfo[]): { system: string; user: string } {
  const system = [
    'You are a browser tab organizer. Given a list of tabs (with their current window IDs),',
    'organize them into windows and groups within each window.',
    '',
    'Rules:',
    '- Return valid JSON: { "windows": [{ "groups": [{ "groupName": "...", "tabIds": [...] }] }] }',
    '- Organize tabs into separate windows by high-level workflow or project context',
    '- Each window should represent a distinct activity (e.g., one window for work project, another for personal browsing)',
    '- Do NOT keep all tabs in one window just because they are currently together — split them meaningfully',
    '- If tabs are already spread across windows sensibly, preserve that arrangement',
    '- Group names: 1-3 words, concise (e.g., "Dev Docs", "Shopping")',
    '- Every tab must appear exactly once',
    '- Aim for 2-5 windows and 2-7 groups per window depending on diversity',
    '- If only 1-2 tabs exist, use a single window with a single group'
  ].join('\n');

  const tabData = tabs.map(t => ({ id: t.id, title: t.title, url: t.url, windowId: t.windowId }));
  const user = `Organize these ${tabs.length} tabs into windows and groups:\n${JSON.stringify(tabData)}`;

  return { system, user };
}

// --- OpenAI API Call ---

/** Call the OpenAI chat completions API */
async function callOpenAI(apiKey: string, tabs: TabInfo[]): Promise<string> {
  const { system, user } = buildGroupingMessages(tabs);

  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later.');
    }
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// --- Response Parsing ---

/** Parse a single group object from the AI response */
function parseGroup(g: { groupName?: string; tabIds?: number[] }, validTabIds: Set<number>): GroupSuggestion {
  return {
    groupName: String(g.groupName || 'Unnamed'),
    tabIds: (g.tabIds || []).filter(id => validTabIds.has(id))
  };
}

/** Parse and validate the window+group response from OpenAI */
function parseSmartOrganizeResponse(responseText: string, validTabIds: Set<number>): WindowSuggestion[] {
  const parsed = JSON.parse(responseText);

  if (!parsed.windows || !Array.isArray(parsed.windows)) {
    throw new Error('Invalid response format: missing "windows" array');
  }

  return parsed.windows
    .map((w: { groups?: Array<{ groupName?: string; tabIds?: number[] }> }) => ({
      groups: (w.groups || [])
        .map(g => parseGroup(g, validTabIds))
        .filter(g => g.tabIds.length > 0)
    }))
    .filter((w: WindowSuggestion) => w.groups.length > 0);
}

// --- Orchestrator ---

/** Main entry point: groups tabs using OpenAI */
export async function smartGroupTabs(tabs: TabInfo[]): Promise<SmartGroupResult> {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return { success: false, error: 'No OpenAI API key set. Use "Set API Key" command first.' };
    }

    if (tabs.length === 0) {
      return { success: false, error: 'No tabs available to group.' };
    }

    // Cap tabs to avoid token limit issues
    const cappedTabs = tabs.slice(0, MAX_TABS);

    const responseText = await callOpenAI(apiKey, cappedTabs);

    const validIds = new Set(cappedTabs.map(t => t.id));
    const windows = parseSmartOrganizeResponse(responseText, validIds);

    if (windows.length === 0) {
      return { success: false, error: 'AI returned no valid groups. Please try again.' };
    }

    return { success: true, windows };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';

    if (message.includes('JSON')) {
      return { success: false, error: 'Failed to parse AI response. Please try again.' };
    }

    return { success: false, error: message };
  }
}
