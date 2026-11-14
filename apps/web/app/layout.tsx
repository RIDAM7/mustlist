import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import {
  BASE_PATH,
  LICENSE_CONTENT_URL,
  REPO_URL,
  SITE_NAME,
  SITE_PITCH,
  SITE_TAGLINE,
  SITE_URL,
} from '@/lib/site';
import './globals.css';

const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME}: ${SITE_TAGLINE}`,
  description: SITE_PITCH,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <header className="border-b">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
            <Link href="/" className="font-heading font-semibold tracking-tight">
              {SITE_NAME}
            </Link>
            <nav
              aria-label="Main"
              className="flex items-center gap-4 text-sm text-muted-foreground"
            >
              <Link href="/about" className="hover:text-foreground">
                About
              </Link>
              <Link href="/contribute" className="hover:text-foreground">
                Contribute
              </Link>
              <a href={REPO_URL} className="hover:text-foreground">
                GitHub
              </a>
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
          {children}
        </main>
        <footer className="border-t">
          <div className="mx-auto max-w-4xl space-y-2 px-4 py-6 text-sm text-muted-foreground">
            <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/changelog" className="hover:text-foreground">
                Changelog
              </Link>
              <Link href="/discuss" className="hover:text-foreground">
                Discuss
              </Link>
              <a href={`${BASE_PATH}/llms.txt`} className="hover:text-foreground">
                llms.txt
              </a>
              <a href={`${BASE_PATH}/api/index`} className="hover:text-foreground">
                JSON API
              </a>
            </nav>
            <p>
              Cards are{' '}
              <a href={LICENSE_CONTENT_URL} className="underline underline-offset-4">
                CC BY 4.0
              </a>
              , code is MIT. Card text is reference material: your own instructions always win.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
