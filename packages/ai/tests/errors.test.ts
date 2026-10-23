import { describe, expect, it } from 'vitest';
import { AcpError, classifyError } from '../src/errors';

function withProps(error: Error, props: Record<string, unknown>): Error {
  return Object.assign(error, props);
}

describe('classifyError', () => {
  it('passes through ACP error codes', () => {
    expect(classifyError(new AcpError('acp-handshake-timeout', 'raw detail'))).toBe('acp-handshake-timeout');
    expect(classifyError(new AcpError('acp-spawn-failed', 'spawn /x ENOENT'))).toBe('acp-spawn-failed');
    expect(classifyError(new AcpError('acp-connection-closed', 'closed'))).toBe('acp-connection-closed');
    expect(classifyError(new AcpError('acp-agent-error', 'internal error'))).toBe('acp-agent-error');
  });

  it('classifies API key rejections from HTTP status codes', () => {
    expect(classifyError(withProps(new Error('unauthorized'), { statusCode: 401 }))).toBe('provider-auth');
    expect(classifyError(withProps(new Error('forbidden'), { statusCode: 403 }))).toBe('provider-auth');
  });

  it('classifies unknown model or address from HTTP 404', () => {
    expect(classifyError(withProps(new Error('not found'), { statusCode: 404 }))).toBe('provider-not-found');
  });

  it('classifies missing-model and missing-key SDK errors by name', () => {
    const noModel = new Error('no such model');
    noModel.name = 'NoSuchModelError';
    expect(classifyError(noModel)).toBe('provider-not-found');

    const noKey = new Error('missing key');
    noKey.name = 'LoadAPIKeyError';
    expect(classifyError(noKey)).toBe('provider-auth');
  });

  it('classifies network failures through nested causes', () => {
    const refused = new Error('connect ECONNREFUSED 127.0.0.1:11434');
    (refused as { code?: string }).code = 'ECONNREFUSED';
    expect(classifyError(withProps(new Error('api call failed'), { cause: refused }))).toBe('provider-unreachable');

    const fetchFailed = new TypeError('fetch failed');
    expect(classifyError(withProps(new Error('api call failed'), { cause: fetchFailed }))).toBe('provider-unreachable');

    const nested = new Error('api call failed');
    nested.cause = new Error('request failed');
    (nested.cause as { cause?: unknown }).cause = refused;
    expect(classifyError(nested)).toBe('provider-unreachable');
  });

  it('falls back to unknown for anything else', () => {
    expect(classifyError(new Error('boom'))).toBe('unknown');
    expect(classifyError('boom')).toBe('unknown');
    expect(classifyError(undefined)).toBe('unknown');
  });
});
