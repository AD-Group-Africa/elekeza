import { isAxiosError } from 'axios';

/** HTTP status of a failed request, if the server answered. */
export function getErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

/**
 * The server's human-readable message for a failed request (backend errors
 * use `message` or `error`), or `fallback` when there is none.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
    if (typeof data?.message === 'string' && data.message.trim()) return data.message;
    if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  }
  return fallback;
}

/** True when the request never got a response (offline, DNS, server down). */
export function isNetworkError(error: unknown): boolean {
  return isAxiosError(error) && !error.response;
}
