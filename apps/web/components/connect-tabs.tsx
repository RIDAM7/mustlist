'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CopyButton } from './client-bits';

type Tab = 'llms' | 'api' | 'markdown' | 'mcp';

const TABS: { id: Tab; label: string }[] = [
  { id: 'llms', label: 'llms.txt' },
  { id: 'api', label: 'API' },
  { id: 'markdown', label: 'One card' },
  { id: 'mcp', label: 'MCP' },
];

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

/** Agent tabs with copyable setup. `#api` in the URL opens the API tab. */
export function ConnectTabs({ library, example }: { library: string; example: string }) {
  const [tab, setTab] = useState<Tab>('llms');

  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      if (TABS.some((t) => t.id === hash)) setTab(hash as Tab);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
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
              history.replaceState(null, '', `#${t.id}`);
            }}
          >
            {t.label}
            {t.id === 'mcp' && <span className="badge">Soon</span>}
          </button>
        ))}
      </div>
      <div
        id="connect-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="mt-6 flex flex-col gap-4"
      >
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
        {tab === 'mcp' && (
          <div className="banner banner-dash">
            <span className="pill p-neutral">Soon</span>
            <span className="muted flex-1">
              An MCP server with search, get card and verify tools.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
