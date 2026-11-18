'use client';

import Link from 'next/link';
import { useState } from 'react';
import { clientSetups, NPX_ARGS } from '@mustlist/mcp/clients';
import { AGENT_BRANDS, BrandMark, type BrandId } from './brand-marks';
import { CopyButton } from './client-bits';
import { Icon } from './icons';

/** Multi-line JSON as one line: `{ "mcpServers": { … } }`. */
const oneLine = (text: string) => text.replace(/\s*\n\s*/g, ' ');

/** "Terminal (or ~/.codex/config.toml)" → "Terminal". */
const shortWhere = (where: string) => where.replace(/\s*\(.*\)$/, '');

interface Setup {
  where: string;
  cmd: string;
}

function setupsFor(mcpUrl: string): Record<BrandId, Setup> {
  const byId = new Map(clientSetups(mcpUrl).map((s) => [s.id, s]));
  const remote = (id: Exclude<BrandId, 'mcp'>): Setup => {
    const setup = byId.get(id);
    return setup
      ? { where: shortWhere(setup.where), cmd: oneLine(setup.remote) }
      : { where: '', cmd: '' };
  };
  return {
    claude: remote('claude'),
    cursor: remote('cursor'),
    vscode: remote('vscode'),
    codex: remote('codex'),
    windsurf: remote('windsurf'),
    mcp: { where: 'Client config', cmd: `npx ${NPX_ARGS.join(' ')}` },
  };
}

/** Home hero, right-hand side: the MCP URL and one-line setup per agent. */
/** On a narrow screen the URL wraps after the domain, not mid-word ("li" / "brary"). */
function breakAfterHost(url: string) {
  const match = /^(https?:\/\/[^/]+\/)(.+)$/.exec(url);
  if (!match) return url;
  return (
    <>
      {match[1]}
      <wbr />
      {match[2]}
    </>
  );
}

export function AgentCard({ mcpUrl }: { mcpUrl: string }) {
  const [picked, setPicked] = useState<BrandId>('claude');
  const setups = setupsFor(mcpUrl);
  const current = setups[picked];
  const name = AGENT_BRANDS.find((b) => b.id === picked)?.name ?? '';

  return (
    <aside className="agent flex flex-col" aria-labelledby="agent-title">
      <div className="flex flex-col gap-4 px-5 pt-5 max-sm:px-4 max-sm:pt-4">
        <div className="flex flex-col gap-0.5">
          <h2 id="agent-title" className="t-h3 text-base">
            Use it from your agent
          </h2>
          <p className="t-sm muted">Read-only MCP server. No account, no key.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="label">MCP server URL</span>
          <div className="agent-url">
            <code>{breakAfterHost(mcpUrl)}</code>
            <CopyButton
              value={mcpUrl}
              className="btn btn-secondary btn-sm"
              ariaLabel="Copy MCP server URL"
              message="Copied the MCP server URL."
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label" id="agent-pick">
            Your agent
          </span>
          <div
            className="clients"
            role="tablist"
            aria-labelledby="agent-pick"
            onKeyDown={(event) => {
              const step: Record<string, number> = {
                ArrowRight: 1,
                ArrowDown: 1,
                ArrowLeft: -1,
                ArrowUp: -1,
              };
              const count = AGENT_BRANDS.length;
              const at = AGENT_BRANDS.findIndex((b) => b.id === picked);
              let next = -1;
              if (event.key in step) next = (at + (step[event.key] ?? 0) + count) % count;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = count - 1;
              const brand = AGENT_BRANDS[next];
              if (!brand) return;
              event.preventDefault();
              setPicked(brand.id);
              document.getElementById(`agent-tab-${brand.id}`)?.focus();
            }}
          >
            {AGENT_BRANDS.map((brand) => (
              <button
                key={brand.id}
                type="button"
                role="tab"
                id={`agent-tab-${brand.id}`}
                aria-selected={brand.id === picked}
                aria-controls="agent-setup"
                tabIndex={brand.id === picked ? 0 : -1}
                className="client"
                onClick={() => setPicked(brand.id)}
              >
                <BrandMark id={brand.id} />
                <span>{brand.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div
          id="agent-setup"
          className="code code-wrap"
          role="tabpanel"
          aria-labelledby={`agent-tab-${picked}`}
        >
          <div className="code-h">
            <span>{current.where}</span>
            <CopyButton
              value={current.cmd}
              ariaLabel={`Copy the ${name} setup`}
              message={`Copied the ${name} setup.`}
            />
          </div>
          <div className="code-b">{current.cmd}</div>
        </div>
        {picked === 'mcp' && (
          <p className="hint -mt-1.5">
            stdio, works offline. Or paste the Streamable HTTP URL above.
          </p>
        )}
      </div>
      <div className="agent-f mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 max-sm:px-4">
        <span>
          No MCP? <code>npx mustlist init</code>
        </span>
        <Link href="/connect" className="link inline-flex items-center gap-1">
          More ways to connect
          <Icon name="arrowRight" size="sm" />
        </Link>
      </div>
    </aside>
  );
}
