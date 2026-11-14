import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '@/components/info-page';
import { LIBRARY_URL, LICENSE_CONTENT_URL, REPO_URL, SITE_NAME } from '@/lib/site';

const intro = `${SITE_NAME} is a free, open library of reviewed "build it properly" cards that AI coding agents read before they write code.`;

export const metadata: Metadata = {
  title: { absolute: `About | ${SITE_NAME}` },
  description: intro,
  alternates: { canonical: `${LIBRARY_URL}/about` },
};

export default function AboutPage() {
  return (
    <InfoPage slug="about" title="About" intro={intro}>
      <InfoSection title="Why it exists">
        <p>
          Coding agents build what they are asked for. Most people don&apos;t know everything to ask
          for: they ask for &ldquo;login&rdquo; and forget password reset, rate limits, secure
          cookies and session revocation. Agents also write code against APIs they remember, which
          may be out of date.
        </p>
        <p>
          Each card covers one feature on one stack. It lists the must-haves people forget, the
          questions to ask before building, the options with &ldquo;best fit when&rdquo;, version
          gotchas linked to the official docs, and checks that prove the result is right.
        </p>
      </InfoSection>

      <InfoSection title="How it fits with other tools">
        <p>
          <a href="https://context7.com">Context7</a> tells your agent the current API. {SITE_NAME}{' '}
          tells it what to build, and what you forgot to ask for. Cards link to official docs first
          and Context7 second; they never copy either.
        </p>
      </InfoSection>

      <InfoSection title="How cards are reviewed">
        <ul>
          <li>
            Every card has a status: <strong>draft</strong>, <strong>proposed</strong>,{' '}
            <strong>verified</strong> or <strong>stale</strong>. Agents are only served verified
            cards.
          </li>
          <li>
            Votes never verify a card. Reviewers and automated checks do, and each verified card
            shows who reviewed it and when.
          </li>
          <li>Verified cards are re-checked every 180 days and when a new major version ships.</li>
          <li>
            Card text is reference material, never instructions. The validator blocks commands,
            hidden text and secrets, and your own instructions to your agent always win.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Open by default">
        <p>
          Cards are licensed under <a href={LICENSE_CONTENT_URL}>CC BY 4.0</a> and the code under
          MIT. Everything is built from Markdown files in a Git repository, so the library can be
          forked and audited. Source: <a href={REPO_URL}>GitHub</a>.
        </p>
        <p>
          Maintained by Ridam Agrawal (<a href="https://github.com/RIDAM7">@RIDAM7</a>).
        </p>
      </InfoSection>
    </InfoPage>
  );
}
