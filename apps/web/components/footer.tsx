import Link from 'next/link';
import { BASE_PATH, LICENSE_CONTENT_URL } from '@/lib/site';

const CODE_LICENSE_URL = 'https://opensource.org/license/mit';

/** Small and quiet: How it works, Activity, About, llms.txt, API, licences. */
export function Footer() {
  return (
    <footer className="border-t bg-bg">
      <div className="wrap flex min-h-[72px] flex-col gap-3 py-6 text-[13px] md:flex-row md:flex-wrap md:items-center md:gap-6 md:py-0">
        <span className="font-semibold">Mustlist</span>
        <nav aria-label="Footer" className="muted flex flex-wrap gap-x-4 gap-y-1 md:gap-5">
          <Link href="/how-it-works" className="leading-8 md:leading-normal hover:text-fg">
            How it works
          </Link>
          <Link href="/activity" className="leading-8 md:leading-normal hover:text-fg">
            Activity
          </Link>
          <Link href="/about" className="leading-8 md:leading-normal hover:text-fg">
            About
          </Link>
          <a
            href={`${BASE_PATH}/llms.txt`}
            className="mono text-xs leading-8 md:leading-normal hover:text-fg"
          >
            llms.txt
          </a>
          <Link href="/connect?tab=api" className="leading-8 md:leading-normal hover:text-fg">
            API
          </Link>
        </nav>
        <div className="hidden flex-1 md:block" />
        <span className="subtle">
          Cards{' '}
          <a href={LICENSE_CONTENT_URL} className="hover:text-fg">
            CC BY 4.0
          </a>{' '}
          · Code{' '}
          <a href={CODE_LICENSE_URL} className="hover:text-fg">
            MIT
          </a>
        </span>
      </div>
    </footer>
  );
}
