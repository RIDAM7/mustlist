import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createMustlistHttpHandler } from '../src/http';
import { SERVER_NAME } from '../src/server';
import { testLibrary } from './helpers';

/**
 * End to end over Streamable HTTP: a real MCP client talks to the same handler
 * the website mounts at /library/mcp, through an in-process fetch.
 */
const handler = createMustlistHttpHandler(testLibrary());
const URL_ = 'https://example.test/library/mcp';
const clients: Client[] = [];

async function connect(): Promise<Client> {
  const client = new Client({ name: 'mustlist-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(URL_), {
    fetch: (input, init) => handler(new Request(input, init)),
  });
  await client.connect(transport);
  clients.push(client);
  return client;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

type Text = { type: string; text?: string };
const firstText = (content: unknown) => ((content as Text[])[0]?.text ?? '') as string;

describe('remote MCP endpoint', () => {
  it('lists 4 read-only tools with schemas (acceptance)', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_card',
      'get_checklist',
      'report_feedback',
      'search_cards',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
    expect(client.getServerVersion()?.name).toBe(SERVER_NAME);
    expect(client.getInstructions()).toContain('get_checklist');
  });

  it('answers every tool for the example card (acceptance)', async () => {
    const client = await connect();
    const search = await client.callTool({ name: 'search_cards', arguments: { query: 'login' } });
    const results = (search.structuredContent as { results: { id: string }[] }).results;
    expect(results[0]?.id).toBe('auth/nextjs-postgres');

    const checklist = await client.callTool({
      name: 'get_checklist',
      arguments: { feature: 'login', stack: ['nextjs', 'postgres'] },
    });
    expect(checklist.structuredContent).toMatchObject({ card: { id: 'auth/nextjs-postgres' } });
    expect(firstText(checklist.content)).toMatch(
      /^\[Reference: Mustlist card auth\/nextjs-postgres/,
    );

    const card = await client.callTool({
      name: 'get_card',
      arguments: { id: 'auth/nextjs-postgres', versions: { next: '16.1.0' } },
    });
    expect(card.isError).toBeFalsy();
    const text = firstText(card.content);
    expect(text).toMatch(/^\[Reference: Mustlist card auth\/nextjs-postgres/);
    expect(text).toContain('### next >=16.0.0');
    expect(text).not.toContain('### next >=15.0.0 <16.0.0');

    const feedback = await client.callTool({
      name: 'report_feedback',
      arguments: { id: 'auth/nextjs-postgres', outcome: 'worked' },
    });
    expect(feedback.structuredContent).toMatchObject({
      issue_url: expect.stringContaining('/issues/new?template=feedback.yml'),
    });
  });

  it('returns a tool error, not a guess, for unknown or unreviewed cards', async () => {
    const client = await connect();
    const unknown = await client.callTool({
      name: 'get_card',
      arguments: { id: 'auth/rails-mysql' },
    });
    expect(unknown.isError).toBe(true);
    const draft = await client.callTool({
      name: 'get_card',
      arguments: { id: 'auth/django-postgres' },
    });
    expect(draft.isError).toBe(true);
  });

  it('rejects invalid input', async () => {
    const client = await connect();
    const result = await client
      .callTool({ name: 'search_cards', arguments: { query: 'auth', limit: 50 } })
      .catch((error: unknown) => ({ isError: true, error }));
    expect(result.isError).toBe(true);
  });

  it('serves card markdown as a resource and the planning prompt', async () => {
    const client = await connect();
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain('mustlist://cards/auth/nextjs-postgres');
    expect(resources.map((r) => r.uri)).not.toContain('mustlist://cards/auth/django-postgres');
    const read = await client.readResource({ uri: 'mustlist://cards/auth/nextjs-postgres' });
    expect((read.contents[0] as { text?: string }).text).toBe('# raw auth markdown\n');

    const prompt = await client.getPrompt({
      name: 'plan-feature',
      arguments: { feature: 'login', stack: 'nextjs, postgres' },
    });
    expect(JSON.stringify(prompt.messages)).toContain('get_checklist');
  });
});
