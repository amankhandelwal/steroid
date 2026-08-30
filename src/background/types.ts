/**
 * Shared types for the background service worker's runtime-message layer.
 */

/**
 * Reply callback handed to us by `chrome.runtime.onMessage`.
 * Mirrors Chrome's own signature; a strictly-typed payload arrives with the
 * discriminated-union message refactor.
 */
export type SendResponse = (response?: unknown) => void;

/**
 * Loose shape of a runtime message. Only `type` is guaranteed; payload fields
 * are read (and narrowed) by the individual handlers.
 */
export interface ExtensionMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Handles a single message type.
 *
 * Returns `true` when the reply is delivered asynchronously (which keeps the
 * message port open), and `undefined` when the reply was already sent
 * synchronously — matching Chrome's listener contract.
 */
export type MessageHandler = (
  message: ExtensionMessage,
  sendResponse: SendResponse
) => boolean | undefined;
