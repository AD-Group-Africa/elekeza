import { isAxiosError } from 'axios';

/** shown whenever the api can not be reached, on every screen that reports errors. */
export const CONNECTION_ERROR_MESSAGE =
  "We can't reach Elekeza right now. Check your internet connection and try again.";

/** HTTP status of a failed request, if the server answered. */
export function getErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

/**
 * true when the api itself was unreachable rather than refusing the request:
 * no response at all, a gateway error (502/503/504 from nginx), or a 5xx
 * whose body is not the backend's json (the next.js proxy answers a down
 * backend with a plain-text 500).
 */
export function isConnectionFailure(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const res = error.response;
  if (!res) return true;
  if (res.status === 502 || res.status === 503 || res.status === 504) return true;
  return res.status >= 500 && (typeof res.data !== 'object' || res.data === null);
}

/**
 * The server's human-readable message for a failed request (backend errors
 * use `message` or `error`, validation failures an `errors` field map), a
 * connection message when the api is unreachable, or `fallback` otherwise.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    if (isConnectionFailure(error)) return CONNECTION_ERROR_MESSAGE;
    const status = error.response?.status ?? 0;
    const data = error.response?.data as { message?: unknown; error?: unknown; errors?: unknown } | undefined;
    if (typeof data?.message === 'string' && data.message.trim()) return data.message;
    // a bare "Internal Server Error" tells the user nothing; keep the screen's own wording
    if (status < 500 && typeof data?.error === 'string' && data.error.trim()) return data.error;
    if (data?.errors && typeof data.errors === 'object') {
      const first = Object.values(data.errors as Record<string, unknown>).find(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      );
      if (first) return first;
    }
  }
  return fallback;
}

/** True when the request never got a response (offline, DNS, server down). */
export function isNetworkError(error: unknown): boolean {
  return isAxiosError(error) && !error.response;
}
