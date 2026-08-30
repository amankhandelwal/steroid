/**
 * Message handlers for the OpenAI API key lifecycle.
 */

import { validateApiKey, setApiKey } from '../../services/openaiService';
import { safeSendResponse } from '../messaging';
import { ExtensionMessage, SendResponse } from '../types';

/** SET_API_KEY — validate the key with OpenAI, then persist it. */
export function handleSetApiKey(
  message: ExtensionMessage,
  sendResponse: SendResponse
): boolean | undefined {
  const { apiKey } = message;

  if (!apiKey || typeof apiKey !== 'string') {
    safeSendResponse(sendResponse, { success: false, error: 'No API key provided' });
    return undefined;
  }

  validateApiKey(apiKey).then((isValid) => {
    if (!isValid) {
      safeSendResponse(sendResponse, { success: false, error: 'Invalid API key. Please check and try again.' });
      return;
    }

    setApiKey(apiKey).then(() => {
      safeSendResponse(sendResponse, { success: true });
    }).catch((err) => {
      safeSendResponse(sendResponse, { success: false, error: `Failed to save key: ${err.message}` });
    });
  }).catch((err) => {
    safeSendResponse(sendResponse, { success: false, error: `Validation failed: ${err.message}` });
  });
  return true; // Asynchronous response
}

/** GET_API_KEY_STATUS — report whether a key is stored (never the key itself). */
export function handleGetApiKeyStatus(_message: ExtensionMessage, sendResponse: SendResponse): boolean {
  chrome.storage.local.get('openai_api_key', (result) => {
    safeSendResponse(sendResponse, { hasKey: !!result.openai_api_key });
  });
  return true; // Asynchronous response
}
