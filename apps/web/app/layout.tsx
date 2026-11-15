import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { CodeCopyHandler } from '@/components/client-bits';
import { Footer } from '@/components/footer';
import { SearchProvider } from '@/components/search-palette';
import { ToastProvider } from '@/components/toast';
import { TopBar } from '@/components/top-bar';
import { ViewerProvider } from '@/components/viewer';
import { getPerson, toProposalSummary, toRequestSummary } from '@/lib/community';
import { loadCommunity } from '@/lib/community/load';
import { SAMPLE_VIEWER } from '@/lib/community/sample';
import { getIndex } from '@/lib/data';
import { SITE_NAME, SITE_PITCH, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import { THEME_SCRIPT } from '@/lib/theme';
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
        <a
          href="#main"
          className="sr-only rounded-md bg-bg px-3 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70]"
        >
          Skip to content
        </a>
        <ToastProvider>
          <ViewerProvider
            mode={community.source}
            sampleViewer={
              community.source === 'sample' ? getPerson(community.people, SAMPLE_VIEWER) : undefined
            }
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
      </body>
    </html>
  );
}
