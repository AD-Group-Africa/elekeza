import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { CONNECTION_ERROR_MESSAGE, getErrorMessage, isConnectionFailure } from './errors';

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', config, {}, response);
}

const offline = () => new AxiosError('Network Error', 'ERR_NETWORK', { headers: new AxiosHeaders() }, {});

describe('getErrorMessage', () => {
  it('explains when the server can not be reached at all', () => {
    expect(getErrorMessage(offline(), 'Registration failed.')).toBe(CONNECTION_ERROR_MESSAGE);
  });

  it('treats the proxy plain-text 500 for a down backend as a connection problem', () => {
    // regression: this used to show only "Registration failed. Please try again."
    expect(isConnectionFailure(httpError(500, 'Internal Server Error'))).toBe(true);
    expect(getErrorMessage(httpError(500, 'Internal Server Error'), 'Registration failed.')).toBe(CONNECTION_ERROR_MESSAGE);
  });

  it.each([502, 503, 504])('treats gateway status %i as a connection problem', (status) => {
    expect(getErrorMessage(httpError(status, '<html>bad gateway</html>'), 'x')).toBe(CONNECTION_ERROR_MESSAGE);
  });

  it("shows the backend's own reason for refused requests", () => {
    expect(getErrorMessage(httpError(409, { error: 'Email already registered' }), 'x')).toBe('Email already registered');
    expect(getErrorMessage(httpError(400, { message: 'Password must be at least 8 characters' }), 'x')).toBe(
      'Password must be at least 8 characters',
    );
  });

  it('shows the first field message from a validation failure', () => {
    expect(getErrorMessage(httpError(400, { errors: { email: 'must be a well-formed email address' } }), 'x')).toBe(
      'must be a well-formed email address',
    );
  });

  it("keeps the screen's wording instead of a bare server error from the backend", () => {
    expect(isConnectionFailure(httpError(500, { error: 'Internal Server Error' }))).toBe(false);
    expect(getErrorMessage(httpError(500, { error: 'Internal Server Error' }), 'Could not save.')).toBe('Could not save.');
  });

  it('falls back for anything that is not an http error', () => {
    expect(getErrorMessage(new Error('boom'), 'Something went wrong.')).toBe('Something went wrong.');
  });
});
