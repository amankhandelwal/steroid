/**
 * Low-level helpers for replying to runtime messages.
 */

import { SendResponse } from './types';

/**
 * Send a reply to a runtime message, tolerating an already-closed port.
 *
 * A set `chrome.runtime.lastError` means some Chrome API call in the surrounding
 * callback failed — it is logged, but it is NOT a reason to withhold our own
 * reply (our error responses are built precisely for those failures). Only a
 * genuinely closed port throws, and the try/catch handles that.
 */
export function safeSendResponse(sendResponse: SendResponse, response: unknown) {
  if (chrome.runtime.lastError) {
    console.error('Chrome API error while handling message:', chrome.runtime.lastError);
  }

  try {
    sendResponse(response);
  } catch (error) {
    console.error('Error sending response:', error);
  }
}

// Helper function to check if message port is still open
export function isPortOpen(): boolean {
  try {
    return !chrome.runtime.lastError;
  } catch {
    return false;
  }
}
