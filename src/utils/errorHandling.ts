/**
 * Error Handling Utilities
 */

export class ExtensionError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}

/**
 * Log error with context
 */
export function logError(error: unknown, context?: string): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const contextStr = context ? ` [${context}]` : '';

  console.error(`Steroid Extension Error${contextStr}:`, errorMessage);

  if (error instanceof Error && error.stack) {
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Safe async operation wrapper
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  errorContext?: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    logError(error, errorContext);
    return null;
  }
}

/**
 * Chrome runtime message sender with error handling
 */
export function sendMessageSafely<T = any>(
  message: any,
  context?: string
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          logError(chrome.runtime.lastError.message, context || 'sendMessage');
          resolve(null);
          return;
        }
        resolve(response);
      });
    } catch (error) {
      logError(error, context || 'sendMessage');
      resolve(null);
    }
  });
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}