import Link from 'next/link';
import { BASE_PATH, LICENSE_CONTENT_URL } from '@/lib/site';

const CODE_LICENSE_URL = 'https://opensource.org/license/mit';

/** Small and quiet: How it works, Activity, About, Connect, llms.txt, API, licences. */
export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-6">
        <span className="wordmark text-sm">Mustlist</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/how-it-works" className="leading-8 sm:leading-normal">
            How it works
          </Link>
          <Link href="/activity" className="leading-8 sm:leading-normal">
            Activity
          </Link>
          <Link href="/about" className="leading-8 sm:leading-normal">
            About
          </Link>
          <Link href="/connect" className="leading-8 sm:leading-normal">
            Connect
          </Link>
          <a href={`${BASE_PATH}/llms.txt`} className="mono leading-8 sm:leading-normal">
            llms.txt
          </a>
          <Link href="/connect?tab=api" className="leading-8 sm:leading-normal">
            API
          </Link>
        </nav>
        <span className="w-full text-xs">
          Cards <a href={LICENSE_CONTENT_URL}>CC BY 4.0</a> · Code{' '}
          <a href={CODE_LICENSE_URL}>MIT</a>
        </span>
      </div>
    </footer>
  );
}
