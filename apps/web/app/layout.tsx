import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { CodeCopyHandler } from '@/components/client-bits';
import { Footer } from '@/components/footer';
import { SearchProvider } from '@/components/search-palette';
import { ToastProvider } from '@/components/toast';
import { TopBar } from '@/components/top-bar';
import { ViewerProvider } from '@/components/viewer';
import { SkipLink } from '@/components/skip-link';
import { getPerson, toProposalSummary, toRequestSummary } from '@/lib/community';
import { loadCommunity } from '@/lib/community/load';
import { SAMPLE_VIEWER } from '@/lib/community/sample';
import { getIndex } from '@/lib/data';
import { SITE_NAME, SITE_PITCH, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import { THEME_SCRIPT } from '@/lib/theme';
import { authEnabled } from '@/lib/auth';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME}: ${SITE_TAGLINE}`,
  description: SITE_PITCH,
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0f12' },
  ],
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const community = await loadCommunity();
  const searchIndex = {
    sample: community.source === 'sample',
    requests: community.requests.map(toRequestSummary),
    proposals: community.proposals.map(toProposalSummary),
  };
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <SkipLink />
        <ToastProvider>
          <ViewerProvider
            mode={community.source}
            sampleViewer={
              community.source === 'sample' ? getPerson(community.people, SAMPLE_VIEWER) : undefined
            }
            authEnabled={community.source === 'github' && authEnabled}
            people={community.people}
          >
            <SearchProvider cards={getIndex()} community={searchIndex}>
              <TopBar />
              <main id="main" className="flex-1">
                {children}
              </main>
              <Footer />
              <CodeCopyHandler />
            </SearchProvider>
          </ViewerProvider>
        </ToastProvider>
        {/*
          Vercel Web Analytics: cookieless page views, no banner needed. The
          library is served on ridamagrawal.com/library, where the root
          /_vercel/insights belongs to the site's own Web Analytics, so the
          script and endpoint are pinned there (not under the /library basePath).
        */}
        <Analytics scriptSrc="/_vercel/insights/script.js" endpoint="/_vercel/insights" />
      </body>
    </html>
  );
}
