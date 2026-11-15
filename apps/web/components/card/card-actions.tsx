'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BASE_PATH } from '@mustlist/schema/constants';
import { Icon } from '../icons';
import { Menu, type MenuItem } from '../overlay';
import { useCopy } from '../toast';

/**
 * Copy for my agent (primary), Suggest a change, and a "more" menu.
 * Desktop: a row next to the title. Phone: one slim bar fixed to the bottom.
 */
export function CardActions({
  id,
  message,
  compact = false,
}: {
  id: string;
  message: string;
  compact?: boolean;
}) {
  const copy = useCopy();
  const router = useRouter();
  const copyCard = () => void copy(message, 'Copied · card + verify checks, as markdown');

  const more: MenuItem[] = [
    { label: 'Discuss', icon: <Icon name="comment" />, href: `/${id}/discussion` },
    {
      label: 'Report a problem',
      icon: <Icon name="alertCircle" />,
      onSelect: () => router.push(`/${id}/discussion?reply=1`),
    },
    {
      label: 'View raw .md',
      icon: <Icon name="file" />,
      rawHref: `${BASE_PATH}/${id}.md`,
      separatorBefore: true,
    },
  ];

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        <button type="button" className="btn btn-primary" onClick={copyCard}>
          <Icon name="copy" />
          Copy for my agent
        </button>
        <Link href={`/${id}/propose`} className="btn btn-secondary">
          Suggest a change
        </Link>
        {!compact && (
          <Menu
            label="More actions"
            items={more}
            trigger={(props) => (
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                aria-label="More actions"
                {...props}
              >
                <Icon name="more" />
              </button>
            )}
          />
        )}
      </div>

      <div className="abar md:hidden">
        <button
          type="button"
          className="btn btn-primary btn-lg min-w-0 flex-1 px-3 text-sm"
          onClick={copyCard}
        >
          Copy for my agent
        </button>
        <Link
          href={`/${id}/propose`}
          className="btn btn-secondary btn-lg shrink-0 px-3 text-sm"
          aria-label="Suggest a change"
        >
          <span>
            Suggest<span className="max-[359px]:hidden"> a change</span>
          </span>
        </Link>
        <Menu
          label="More actions"
          items={more}
          placement="above"
          trigger={(props) => (
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-lg"
              aria-label="More actions"
              {...props}
            >
              <Icon name="more" size="lg" />
            </button>
          )}
        />
      </div>
    </>
  );
}
