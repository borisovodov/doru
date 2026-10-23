import { classifyError, type AiErrorCode } from '@doru/ai';
import type { MessageKey } from '@doru/platform';
import { nls } from './nls';

/**
 * Localized, plain-language messages per AI error code. The raw technical
 * text stays on the original error and is written to the log as-is; the
 * user (a genealogist, not a developer) sees these instead.
 */
const MESSAGES: Record<AiErrorCode, MessageKey> = {
  'acp-handshake-timeout': 'chat.errors.acp.handshakeTimeout',
  'acp-spawn-failed': 'chat.errors.acp.spawnFailed',
  'acp-connection-closed': 'chat.errors.acp.connectionClosed',
  'acp-agent-error': 'chat.errors.acp.agentError',
  'provider-auth': 'chat.errors.provider.auth',
  'provider-not-found': 'chat.errors.provider.notFound',
  'provider-unreachable': 'chat.errors.provider.unreachable',
  unknown: 'chat.errors.generic',
};

/** A friendly, localized message for a thrown error. */
export function userErrorMessage(error: unknown): string {
  return nls.t(MESSAGES[classifyError(error)]);
}

/** A friendly, localized message for an already-classified failure. */
export function userMessageFor(code: AiErrorCode): string {
  return nls.t(MESSAGES[code]);
}
