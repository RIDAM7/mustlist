import { BASE_PATH } from '@mustlist/schema/constants';

/**
 * Vercel Web Analytics records the URL it is given. Next's `usePathname()`
 * drops the basePath, so without this a view of /library/auth/nextjs-postgres
 * is sent as /auth/nextjs-postgres, a page that doesn't exist on the site.
 * Puts the basePath back; URLs that already carry it are left alone.
 */
export function withBasePath<T extends { url: string }>(event: T, basePath = BASE_PATH): T {
  let url: URL;
  try {
    url = new URL(event.url);
  } catch {
    return event;
  }
  if (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`)) return event;
  url.pathname = url.pathname === '/' ? basePath : `${basePath}${url.pathname}`;
  return { ...event, url: url.href };
}
