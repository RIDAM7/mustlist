import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '@/components/info-page';
import { LIBRARY_URL, REPO_URL, SITE_NAME } from '@/lib/site';

const intro =
  'Add a card, improve one, or review one. Contributions open at launch; this is how it will work.';

export const metadata: Metadata = {
  title: { absolute: `Contribute | ${SITE_NAME}` },
  description: intro,
  alternates: { canonical: `${LIBRARY_URL}/contribute` },
};

export default function ContributePage() {
  return (
    <InfoPage slug="contribute" title="Contribute" intro={intro}>
      <InfoSection title="Your first card in 5 minutes">
        <ol>
          <li>
            Fork the <a href={REPO_URL}>repository</a> and run <code>pnpm install</code>.
          </li>
          <li>
            Create the card: <code>pnpm new-card &lt;topic&gt; &lt;stack&gt;</code>, for example{' '}
            <code>pnpm new-card rate-limiting nextjs-postgres</code>.
          </li>
          <li>
            Fill it in following the{' '}
            <a href={`${REPO_URL}/blob/main/docs/card-spec.md`}>card format</a>.
          </li>
          <li>
            Run <code>pnpm validate</code> until it passes, then preview it with{' '}
            <code>pnpm dev</code>.
          </li>
          <li>
            Open a pull request with signed-off commits (<code>git commit -s</code>). One card per
            pull request.
          </li>
        </ol>
      </InfoSection>

      <InfoSection title="How a card becomes verified">
        <ul>
          <li>Automated checks run on every pull request: format, sizes, safety and links.</li>
          <li>
            Reviewers for the topic check the facts, the options and the sources. New cards need two
            approvals, one from a maintainer.
          </li>
          <li>
            A maintainer merges and marks the card verified, with the reviewers and the date shown
            on the card.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Other ways to help">
        <ul>
          <li>Add a version entry when a new major version of a library ships.</li>
          <li>Report a mistake or an outdated claim with the correction form on GitHub.</li>
          <li>Become a reviewer for a topic you know well.</li>
        </ul>
        <p>
          Read the full <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}>contributing guide</a>.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
