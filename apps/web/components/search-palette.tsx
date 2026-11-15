'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { loadSearchIndex } from '@mustlist/build/search';
import { BASE_PATH } from '@mustlist/schema/constants';
import { stackTitle } from '@mustlist/schema/site';
import type { CardIndexEntry } from '@mustlist/schema/types';
import { isSampleData, listProposals, listRequests, mostWanted } from '@/lib/community';
import { shortTitle } from '@/lib/card';
import { CARD_STATUS, PROPOSAL_STATUS, REQUEST_STATUS, isOpenProposal } from '@/lib/status';
import { topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from './icons';
import { Modal } from './overlay';
import { Kbd, KeyHint, SampleBadge } from './ui';

/** One search across cards, requests and proposals (Ctrl/Cmd+K everywhere). */

type Kind = 'Cards' | 'Requests' | 'Proposals';
const KINDS: ('All' | Kind)[] = ['All', 'Cards', 'Requests', 'Proposals'];
const ICONS: Record<Kind, IconName> = { Cards: 'file', Requests: 'inbox', Proposals: 'pencil' };

interface Result {
  kind: Kind;
  key: string;
  title: string;
  meta: string;
  pill: string;
  status: string;
  href: string;
}

const SearchContext = createContext<(query?: string) => void>(() => {});

export function useSearch() {
  return useContext(SearchContext);
}

function cardResult(card: CardIndexEntry): Result {
  const stack = card.id.split('/')[1] ?? '';
  const status = CARD_STATUS[card.status];
  return {
    kind: 'Cards',
    key: card.id,
    title: shortTitle(card.title),
    meta: `${stackTitle(stack)} · v${card.card_version}`,
    pill: status.pill,
    status: status.label,
    href: `/${card.id}`,
  };
}

const requestResults = () =>
  listRequests().map<Result & { text: string }>((r) => ({
    kind: 'Requests',
    key: `r${r.number}`,
    title: r.title,
    meta: `#${r.number} · ${r.need} need this`,
    pill: REQUEST_STATUS[r.status].pill,
    status: REQUEST_STATUS[r.status].label,
    href: `/requests/${r.number}`,
    text: `${r.title} ${topicName(r.topic)} ${r.topic} ${r.stack} #${r.number} ${r.body}`.toLowerCase(),
  }));

const proposalResults = () =>
  listProposals().map<Result & { text: string; open: boolean }>((p) => ({
    kind: 'Proposals',
    key: `p${p.number}`,
    title: p.title,
    meta: `#${p.number} · @${p.author}`,
    pill: PROPOSAL_STATUS[p.status].pill,
    status: PROPOSAL_STATUS[p.status].label,
    href: `/proposals/${p.number}`,
    text: `${p.title} ${topicName(p.topic)} ${p.topic} #${p.number} ${p.summary}`.toLowerCase(),
    open: isOpenProposal(p.status),
  }));

export function SearchProvider({
  cards,
  children,
}: {
  cards: CardIndexEntry[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState('');

  const openSearch = useCallback((query = '') => {
    setInitial(query);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setInitial('');
        setOpen((value) => !value);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <SearchContext.Provider value={openSearch}>
      {children}
      {open && <SearchPalette cards={cards} initial={initial} onClose={() => setOpen(false)} />}
    </SearchContext.Provider>
  );
}

function SearchPalette({
  cards,
  initial,
  onClose,
}: {
  cards: CardIndexEntry[];
  initial: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initial);
  const [kind, setKind] = useState<'All' | Kind>('All');
  const [selected, setSelected] = useState(0);
  const [index, setIndex] = useState<ReturnType<typeof loadSearchIndex> | null>(null);

  // Load the prebuilt card index once; plain matching covers the moment before it arrives.
  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE_PATH}/api/search-index`)
      .then((response) => response.text())
      .then((json) => {
        if (!cancelled) setIndex(loadSearchIndex(json));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const ranked = useMemo(() => {
    const q = query.trim();
    return index && q.length >= 2 ? index.search(q).map((hit) => String(hit.id)) : null;
  }, [index, query]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const allCards = cards.map(cardResult);
    let cardHits: Result[];
    if (!q) cardHits = allCards.slice(0, 5);
    else if (ranked) {
      cardHits = ranked
        .map((id) => allCards.find((card) => card.key === id))
        .filter((card): card is Result => Boolean(card));
    } else {
      cardHits = cards
        .filter((card) =>
          `${card.title} ${card.summary} ${card.topic} ${card.id}`.toLowerCase().includes(q),
        )
        .map(cardResult);
    }
    const wanted = new Set(mostWanted(3).map((r) => `r${r.number}`));
    const requests = requestResults().filter((r) => (q ? r.text.includes(q) : wanted.has(r.key)));
    const proposals = proposalResults()
      .filter((p) => (q ? p.text.includes(q) : p.open))
      .slice(0, q ? 8 : 3);
    const all: [Kind, Result[]][] = [
      ['Cards', cardHits],
      ['Requests', requests],
      ['Proposals', proposals],
    ];
    return all.filter(([k, items]) => items.length > 0 && (kind === 'All' || kind === k));
  }, [cards, query, ranked, kind]);

  const flat = groups.flatMap(([, items]) => items);
  const active = Math.min(selected, Math.max(flat.length - 1, 0));

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  function go(result: Result | undefined) {
    if (!result) return;
    onClose();
    router.push(result.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected(Math.min(active + 1, flat.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected(Math.max(active - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(flat[active]);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const next =
        KINDS[(KINDS.indexOf(kind) + (event.shiftKey ? KINDS.length - 1 : 1)) % KINDS.length];
      setKind(next ?? 'All');
      setSelected(0);
    }
  }

  let position = -1;

  return (
    <Modal
      open
      onClose={onClose}
      label="Search"
      className="max-w-[640px] overflow-hidden"
      initialFocus={inputRef}
    >
      <div className="flex h-14 items-center gap-3 border-b pl-4 pr-3">
        <Icon name="search" size="lg" className="subtle" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={flat.length ? `${listId}-${active}` : undefined}
          aria-label="Search cards, requests and proposals"
          placeholder="Search cards, requests and proposals"
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
        />
        <div className="seg hidden sm:inline-flex" role="tablist" aria-label="Type">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === kind}
              tabIndex={-1}
              className={cn('seg-b', k === kind && 'seg-on')}
              onClick={() => {
                setKind(k);
                setSelected(0);
                inputRef.current?.focus();
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label="Results"
        className="max-h-[min(460px,60vh)] overflow-y-auto p-1.5"
      >
        {groups.map(([label, items]) => (
          <div key={label} role="group" aria-label={label}>
            <div className="label flex items-center gap-2 px-2.5 pb-1.5 pt-2.5">
              {label}
              {isSampleData && label !== 'Cards' && <SampleBadge />}
            </div>
            {items.map((result) => {
              position += 1;
              const index = position;
              const on = index === active;
              return (
                <a
                  key={result.key}
                  id={`${listId}-${index}`}
                  href={`${BASE_PATH}${result.href}`}
                  role="option"
                  aria-selected={on}
                  tabIndex={-1}
                  className={cn('menu-item h-auto min-h-11 py-2', on && 'menu-on')}
                  onMouseEnter={() => setSelected(index)}
                  onClick={(event) => {
                    event.preventDefault();
                    go(result);
                  }}
                >
                  <Icon name={ICONS[result.kind]} className="subtle" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{result.title}</span>
                    <span className="t-xs subtle truncate">{result.meta}</span>
                  </span>
                  <span className={cn('pill', result.pill)}>{result.status}</span>
                  {on && <Kbd>Enter</Kbd>}
                </a>
              );
            })}
          </div>
        ))}
        {flat.length === 0 && (
          <div className="px-4 py-8 text-center">
            <div className="t-sm strong">No results</div>
            <a
              href={`${BASE_PATH}/requests/new`}
              className="btn btn-secondary btn-sm mt-3"
              onClick={(event) => {
                event.preventDefault();
                onClose();
                router.push('/requests/new');
              }}
            >
              Request a card
            </a>
          </div>
        )}
      </div>
      <div className="t-xs subtle hidden items-center gap-4 border-t bg-bg-subtle px-4 py-2.5 sm:flex">
        <KeyHint keys={['↑', '↓']} label="move" />
        <KeyHint keys={['Enter']} label="open" />
        <KeyHint keys={['Tab']} label="type" />
        <span className="flex-1" />
        <KeyHint keys={['Esc']} label="close" />
      </div>
    </Modal>
  );
}
