/**
 * Setup for each MCP client, shared by the Connect page and `mustlist init`.
 * Pure data, safe to import in browser code. Checked against each client's
 * official docs on 2026-11-15; formats change, so re-check before editing.
 */

export const NPX_ARGS = ['-y', 'mustlist', 'mcp'] as const;

export interface ClientSetup {
  id: 'claude' | 'cursor' | 'vscode' | 'codex' | 'windsurf';
  name: string;
  /** Where the snippet goes: a terminal, or a config file path. */
  where: string;
  language: 'shell' | 'json' | 'toml';
  remote: string;
  local: string;
  docs: string;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

export function clientSetups(url: string, name = 'mustlist'): ClientSetup[] {
  const command = 'npx';
  const args = [...NPX_ARGS];
  return [
    {
      id: 'claude',
      name: 'Claude Code',
      where: 'Terminal, in your project',
      language: 'shell',
      remote: `claude mcp add --transport http ${name} ${url}`,
      local: `claude mcp add --transport stdio ${name} -- ${command} ${args.join(' ')}`,
      docs: 'https://code.claude.com/docs/en/mcp',
    },
    {
      id: 'cursor',
      name: 'Cursor',
      where: '.cursor/mcp.json (or ~/.cursor/mcp.json for every project)',
      language: 'json',
      remote: json({ mcpServers: { [name]: { url } } }),
      local: json({ mcpServers: { [name]: { command, args } } }),
      docs: 'https://cursor.com/docs/context/mcp',
    },
    {
      id: 'vscode',
      name: 'VS Code',
      where: '.vscode/mcp.json',
      language: 'json',
      remote: json({ servers: { [name]: { type: 'http', url } } }),
      local: json({ servers: { [name]: { type: 'stdio', command, args } } }),
      docs: 'https://code.visualstudio.com/docs/copilot/customization/mcp-servers',
    },
    {
      id: 'codex',
      name: 'Codex CLI',
      where: 'Terminal (or ~/.codex/config.toml)',
      language: 'shell',
      remote: `codex mcp add ${name} --url ${url}`,
      local: `codex mcp add ${name} -- ${command} ${args.join(' ')}`,
      docs: 'https://developers.openai.com/codex/mcp',
    },
    {
      id: 'windsurf',
      name: 'Windsurf',
      where: 'mcp_config.json (Cascade → MCP → open the config file)',
      language: 'json',
      remote: json({ mcpServers: { [name]: { serverUrl: url } } }),
      local: json({ mcpServers: { [name]: { command, args } } }),
      docs: 'https://docs.devin.ai/windsurf/plugins/cascade/mcp',
    },
  ];
}

/** One line per tool, for docs and the Connect page. */
export const TOOL_SUMMARIES: readonly { name: string; text: string }[] = [
  { name: 'get_checklist', text: 'What to build for a feature, and what to ask the user first.' },
  { name: 'get_card', text: 'The card for your stack, with version notes for your packages.' },
  { name: 'search_cards', text: 'Find cards by feature, topic or stack.' },
  { name: 'report_feedback', text: 'A pre-filled GitHub issue link. Posts nothing itself.' },
];
