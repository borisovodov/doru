import { describe, expect, it } from 'vitest';
import type { PersonRecord } from '@doru/core';
import { AgentRuntime, type AgentStep } from '../src/agent';
import { TreeMcpBackend } from '../src/backend';
import type { ChatModel, ModelResponse } from '../src/model';
import type { ChatMessage } from '../src/types';
import { cleanupAiFixture, makeAiFixture } from './helpers';

class FakeChatModel implements ChatModel {
  readonly id = 'fake';
  private call = 0;

  constructor(private readonly script: ModelResponse[]) {}

  async complete(): Promise<ModelResponse> {
    const response = this.script[this.call] ?? { content: null, toolCalls: [] };
    this.call++;
    return response;
  }
}

const ivan: PersonRecord = { id: '@I1@', names: [{ given: 'Ivan', surname: 'Ivanov' }], sex: 'M' };

describe('AgentRuntime', () => {
  it('runs the tool loop and returns the final text', async () => {
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson(ivan);
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue, 'agent:test');
      const model = new FakeChatModel([
        {
          content: null,
          toolCalls: [
            { id: 'call-1', name: 'tree.query', arguments: { query: 'ivan', limit: 10 } },
          ],
        },
        { content: 'Found one person.', toolCalls: [] },
      ]);
      const runtime = new AgentRuntime(model, backend, async () => true);

      const messages: ChatMessage[] = [{ role: 'user', content: 'Find Ivan' }];
      const result = await runtime.run(messages);

      expect(result.finalText).toBe('Found one person.');
      expect(result.steps.map((step) => step.type)).toEqual(['toolCall', 'toolResult', 'text']);
      const queryStep = result.steps[1] as AgentStep;
      if (queryStep.type === 'toolResult') {
        expect(queryStep.result).toEqual([ivan]);
      }
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('applies tree edits through ops and records the agent actor', async () => {
    const fixture = makeAiFixture();
    try {
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue, 'agent:openai/gpt#deadbeef');
      const model = new FakeChatModel([
        {
          content: null,
          toolCalls: [
            {
              id: 'call-1',
              name: 'tree.edit',
              arguments: {
                op: { kind: 'person.add', person: { id: '@I2@', names: [], sex: 'U' } },
              },
            },
          ],
        },
        { content: 'Added.', toolCalls: [] },
      ]);
      const runtime = new AgentRuntime(model, backend, async () => true);

      await runtime.run([{ role: 'user', content: 'Add a person' }]);
      expect(fixture.repo.countPersons()).toBe(1);
      expect(fixture.queue.canUndo()).toBe(true);
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('denies tools when the permission gate rejects', async () => {
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson(ivan);
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue, 'agent:test');
      const model = new FakeChatModel([
        {
          content: null,
          toolCalls: [
            {
              id: 'call-1',
              name: 'tree.edit',
              arguments: { op: { kind: 'person.add', person: { id: '@I2@', names: [], sex: 'U' } } },
            },
          ],
        },
        { content: 'Ok, I will not touch the tree.', toolCalls: [] },
      ]);
      const runtime = new AgentRuntime(
        model,
        backend,
        async () => false,
        { default: 'ask', overrides: {} },
      );

      const result = await runtime.run([{ role: 'user', content: 'Add a person' }]);
      expect(fixture.repo.countPersons()).toBe(1);
      expect(result.steps.some((step) => step.type === 'toolError')).toBe(true);
      expect(result.finalText).toBe('Ok, I will not touch the tree.');
    } finally {
      cleanupAiFixture(fixture);
    }
  });
});
