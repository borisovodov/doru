import { createServer, type Server } from 'node:http';

interface ChatBody {
  stream?: boolean;
  messages?: Array<{ role: string }>;
}

/**
 * A scripted OpenAI-compatible provider on an ephemeral port. Call 1 returns
 * a tree_query tool call, call 2 a tree_edit tool call (which triggers the
 * permission card), later calls a plain text reply. Slow mode streams one
 * chunk and stalls, for the Stop-button test.
 */
export function startMockProvider() {
  let slow = false;
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body: ChatBody = chunks.length > 0 ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as ChatBody) : {};
      if (req.method === 'GET' && req.url === '/v1/models') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: [{ id: 'mock-model' }] }));
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        if (!body.stream) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'chatcmpl-ping',
              object: 'chat.completion',
              created: 1,
              model: 'mock-model',
              choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }),
          );
          return;
        }

        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
        const sse = (chunk: Record<string, unknown>) => {
          if (res.writable) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        };
        const base = { id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 1, model: 'mock-model' };
        const toolResultCount = (body.messages ?? []).filter((m) => m.role === 'tool').length;

        if (slow) {
          sse({ ...base, choices: [{ index: 0, delta: { content: 'Slow ' }, finish_reason: null }] });
          setTimeout(() => {
            sse({ ...base, choices: [{ index: 0, delta: { content: 'and never finished' }, finish_reason: null }] });
            sse({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
            res.write('data: [DONE]\n\n');
            res.end();
          }, 5_000);
          return;
        }

        if (toolResultCount === 0) {
          sse({
            ...base,
            choices: [
              {
                index: 0,
                delta: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call-1',
                      type: 'function',
                      function: { name: 'tree_query', arguments: JSON.stringify({ query: 'ivan' }) },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          });
          sse({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] });
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        if (toolResultCount === 1) {
          const op = {
            kind: 'person.add',
            person: { id: 'E2EM1', names: [{ given: 'Mock', surname: 'Person' }], sex: 'U' },
          };
          sse({
            ...base,
            choices: [
              {
                index: 0,
                delta: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call-2',
                      type: 'function',
                      function: { name: 'tree_edit', arguments: JSON.stringify({ op }) },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          });
          sse({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] });
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        sse({ ...base, choices: [{ index: 0, delta: { content: 'Done.' }, finish_reason: null }] });
        sse({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });

  return {
    server,
    setSlow(value: boolean) {
      slow = value;
    },
    url: () => `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
  };
}
