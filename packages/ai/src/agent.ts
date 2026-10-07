import type { ChatMessage, ToolCall } from './types';
import type { ChatModel } from './model';
import { doruTools } from './tools';
import {
  DEFAULT_PERMISSION_POLICY,
  toolPermission,
  type PermissionPolicy,
} from './permissions';
import type { TreeMcpBackend } from './backend';

export type AgentStep =
  | { type: 'text'; content: string }
  | { type: 'toolCall'; name: string; arguments: Record<string, unknown> }
  | { type: 'toolResult'; name: string; result: unknown }
  | { type: 'toolError'; name: string; message: string };

export interface AgentRunResult {
  steps: AgentStep[];
  finalText: string;
}

export interface ChatSendResult extends AgentRunResult {
  error?: string;
}

export type PermissionGate = (tool: string, args: Record<string, unknown>) => Promise<boolean>;

export class AgentRuntime {
  constructor(
    private readonly model: ChatModel,
    private readonly backend: TreeMcpBackend,
    private readonly gate: PermissionGate,
    private readonly policy: PermissionPolicy = DEFAULT_PERMISSION_POLICY,
  ) {}

  async run(messages: ChatMessage[], maxIterations = 8): Promise<AgentRunResult> {
    const steps: AgentStep[] = [];
    const conversation = messages.map((message) => ({ ...message }));
    let finalText = '';

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const response = await this.model.complete(conversation, doruTools);
      if (response.toolCalls.length === 0) {
        if (response.content) {
          steps.push({ type: 'text', content: response.content });
          finalText = response.content;
        }
        break;
      }
      conversation.push({ role: 'assistant', content: response.content, toolCalls: response.toolCalls });
      for (const call of response.toolCalls) {
        steps.push({ type: 'toolCall', name: call.name, arguments: call.arguments });
        if (!(await this.isAllowed(call))) {
          conversation.push({
            role: 'tool',
            toolCallId: call.id,
            content: 'Permission denied by the user.',
          });
          steps.push({ type: 'toolError', name: call.name, message: 'Permission denied by the user.' });
          continue;
        }
        try {
          const result = await this.backend.invoke(call.name, call.arguments);
          conversation.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify(result) });
          steps.push({ type: 'toolResult', name: call.name, result });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          conversation.push({ role: 'tool', toolCallId: call.id, content: `Error: ${message}` });
          steps.push({ type: 'toolError', name: call.name, message });
        }
      }
    }

    return { steps, finalText };
  }

  private async isAllowed(call: ToolCall): Promise<boolean> {
    const permission = toolPermission(this.policy, call.name);
    if (permission === 'allow') {
      return true;
    }
    if (permission === 'deny') {
      return false;
    }
    return this.gate(call.name, call.arguments);
  }
}
