'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BASE_PATH } from '@mustlist/schema/constants';
import { stackTitle } from '@mustlist/schema/site';
import { topicName } from '@/lib/topics';
import { HomeSearch } from './home-search';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 404: names the missing card when the path looks like one, and offers to request it. */
export function NotFoundView() {
  const pathname = usePathname() ?? '';
  const [topic = '', stack = '', ...rest] = pathname.split('/').filter(Boolean);
  const looksLikeCard = rest.length === 0 && SLUG.test(topic) && SLUG.test(stack);
  const title = looksLikeCard
    ? `No card for ${topicName(topic)} · ${stackTitle(stack)} yet`
    : 'Nothing here';
  const requestHref = looksLikeCard
    ? `/requests/new?topic=${topic}&stack=${stack}`
    : '/requests/new';

  return (
    <div className="wrap flex flex-col items-center pb-28 pt-16 text-center md:pt-24">
      <span className="mono subtle text-[13px]">
        404 · {BASE_PATH}
        {pathname}
      </span>
      <h1 className="t-h2 mt-3">{title}</h1>
      <HomeSearch
        size="md"
        placeholder="Search the library"
        className="mt-7 w-full max-w-[480px]"
      />
      <div className="mt-4 flex gap-2">
        <Link href={requestHref} className="btn btn-primary">
          {looksLikeCard ? 'Request this card' : 'Request a card'}
        </Link>
        <Link href="/" className="btn btn-ghost">
          Library
        </Link>
      </div>
    </div>
  );
}
