'use client';

import { useEffect, useState } from 'react';
import { type ClientSetup, clientSetups, TOOL_SUMMARIES } from '@mustlist/mcp/clients';
import { cn } from '@/lib/utils';
import { BrandMark } from './brand-marks';
import { CopyButton } from './client-bits';

type Tab = 'mcp' | 'agents' | 'llms' | 'api' | 'markdown';

const TABS: { id: Tab; label: string }[] = [
  { id: 'mcp', label: 'MCP' },
  { id: 'agents', label: 'AGENTS.md' },
  { id: 'llms', label: 'llms.txt' },
  { id: 'api', label: 'API' },
  { id: 'markdown', label: 'One card' },
];

const isTab = (value: string | null): value is Tab => TABS.some((t) => t.id === value);

function Snippet({ label, value }: { label: string; value: string }) {
  return (
    <div className="code">
      <div className="code-h">
        <span>{label}</span>
        <CopyButton value={value} />
      </div>
      <div className="code-b">
        {value.split('\n').map((line, i) => (
          <div key={i} className="code-l">
            <span className="ln">{i + 1}</span>
            <span>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The Claude Code plugin lives in this repository's marketplace (.claude-plugin/). */
const PLUGIN_COMMANDS = [
  '/plugin marketplace add RIDAM7/mustlist',
  '/plugin install mustlist@mustlist',
].join('\n');

function McpPanel({ mcpUrl }: { mcpUrl: string }) {
  const setups = clientSetups(mcpUrl);
  const [client, setClient] = useState<ClientSetup['id']>('claude');
  const setup = setups.find((s) => s.id === client) ?? setups[0];
  if (!setup) return null;
  return (
    <>
      <p className="t-body muted">
        A remote MCP server: read-only, no account, no key. Your agent calls{' '}
        <code className="mono">get_checklist</code> before it builds a feature, asks you the
        card&rsquo;s questions, then follows the card.
      </p>
      <Snippet label="Server URL (Streamable HTTP)" value={mcpUrl} />
      <div className="seg self-start" role="tablist" aria-label="Agent">
        {setups.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === client}
            className={cn('seg-b', s.id === client && 'seg-on')}
            onClick={() => setClient(s.id)}
          >
            <BrandMark id={s.id} className="size-4 text-current" />
            {s.name}
          </button>
        ))}
      </div>
      <Snippet label={setup.where} value={setup.remote} />
      {setup.id === 'claude' && (
        <details className="t-sm">
          <summary className="muted cursor-pointer">
            Or install the Claude Code plugin (the server plus a skill that checks the card first)
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <Snippet label="In Claude Code" value={PLUGIN_COMMANDS} />
          </div>
        </details>
      )}
      <details className="t-sm">
        <summary className="muted cursor-pointer">
          Run it on your machine instead (works offline)
        </summary>
        <div className="mt-3">
          <Snippet label={setup.where} value={setup.local} />
        </div>
      </details>
      <p className="t-sm subtle">
        Formats change between versions:{' '}
        <a className="underline hover:text-fg" href={setup.docs}>
          {setup.name} MCP docs
        </a>
        .
      </p>
      <ul className="flex flex-col gap-1.5">
        {TOOL_SUMMARIES.map((tool) => (
          <li key={tool.name} className="t-body">
            <code className="mono">{tool.name}</code>
            <span className="muted"> · {tool.text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Agent tabs with copyable setup. `?tab=api` in the URL opens the API tab. */
export function ConnectTabs({ library, example }: { library: string; example: string }) {
  const [tab, setTab] = useState<Tab>('mcp');

  useEffect(() => {
    const fromUrl = () => {
      const value = new URLSearchParams(window.location.search).get('tab');
      if (isTab(value)) setTab(value);
    };
    fromUrl();
    window.addEventListener('popstate', fromUrl);
    return () => window.removeEventListener('popstate', fromUrl);
  }, []);

  return (
    <div className="mt-10 max-w-[760px]">
      <div className="tabs" role="tablist" aria-label="Ways to connect">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={t.id === tab}
            aria-controls="connect-panel"
            className={cn('tab', t.id === tab && 'tab-on')}
            onClick={() => {
              setTab(t.id);
              const url = new URL(window.location.href);
              url.searchParams.set('tab', t.id);
              history.replaceState(null, '', url);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        id="connect-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="mt-6 flex flex-col gap-4"
      >
        {tab === 'mcp' && <McpPanel mcpUrl={`${library}/mcp`} />}
        {tab === 'agents' && (
          <>
            <p className="t-body muted">
              For agents that rarely call tools: run this in your project. It reads your
              package.json and writes a short index of the cards that fit your stack into AGENTS.md,
              between markers, without touching the rest of the file.
            </p>
            <Snippet label="Terminal, in your project" value="npx mustlist init" />
            <p className="t-body muted">Search from the terminal:</p>
            <Snippet label="Terminal" value='npx mustlist search "stripe webhooks"' />
          </>
        )}
        {tab === 'llms' && (
          <>
            <p className="t-body muted">
              An index of verified cards for agents that read llms.txt.
            </p>
            <Snippet label="url" value={`${library}/llms.txt`} />
          </>
        )}
        {tab === 'api' && (
          <>
            <p className="t-body muted">Read-only JSON. No key, cached, any origin.</p>
            <Snippet
              label="endpoints"
              value={[
                `${library}/api/index`,
                `${library}/api/cards`,
                `${library}/api/cards/${example}`,
                `${library}/api/topics`,
                `${library}/api/stacks`,
              ].join('\n')}
            />
          </>
        )}
        {tab === 'markdown' && (
          <>
            <p className="t-body muted">
              Every card as raw Markdown. On a card page, “Copy for my agent” copies it with a
              pointer line.
            </p>
            <Snippet label="url" value={`${library}/${example}.md`} />
          </>
        )}
      </div>
    </div>
  );
}
