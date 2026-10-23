/**
 * Machine-readable categories for AI failures that reach the user.
 *
 * The raw technical error text always stays on the original error (and goes
 * to the log as-is); the UI renders a localized, plain-language explanation
 * per code. Dóru serves genealogists, not developers — the codes are the
 * contract between the error sites and the localization layer.
 */

export type AiErrorCode =
  | 'acp-handshake-timeout'
  | 'acp-spawn-failed'
  | 'acp-connection-closed'
  | 'acp-agent-error'
  | 'provider-auth'
  | 'provider-not-found'
  | 'provider-unreachable'
  | 'unknown';

export type AcpErrorCode = Extract<AiErrorCode, `acp-${string}`>;

/**
 * An ACP failure with a machine-readable code. `message` carries the raw
 * technical text (agent stderr, protocol details) for the log only.
 */
export class AcpError extends Error {
  constructor(
    readonly code: AcpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AcpError';
  }
}

const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ECONNRESET',
  'EAI_AGAIN',
]);

function isNetworkFailure(cause: unknown): boolean {
  if (!(cause instanceof Error)) {
    return false;
  }
  const code = (cause as { code?: unknown }).code;
  if (typeof code === 'string' && NETWORK_CODES.has(code)) {
    return true;
  }
  if (cause.name === 'TypeError' && /fetch failed/i.test(cause.message)) {
    return true;
  }
  return isNetworkFailure(cause.cause);
}

/**
 * Maps a thrown error to a user-presentable category. Works with the AI
 * SDK error shapes (status codes, nested network causes) without importing
 * the SDK itself.
 */
export function classifyError(error: unknown): AiErrorCode {
  if (error instanceof AcpError) {
    return error.code;
  }
  if (!(error instanceof Error)) {
    return 'unknown';
  }
  const api = error as Error & { statusCode?: unknown };
  if (typeof api.statusCode === 'number') {
    if (api.statusCode === 401 || api.statusCode === 403) {
      return 'provider-auth';
    }
    if (api.statusCode === 404) {
      return 'provider-not-found';
    }
  }
  if (/NoSuchModel/.test(error.name)) {
    return 'provider-not-found';
  }
  if (/LoadAPIKey/.test(error.name)) {
    return 'provider-auth';
  }
  if (isNetworkFailure(error.cause)) {
    return 'provider-unreachable';
  }
  return 'unknown';
}
