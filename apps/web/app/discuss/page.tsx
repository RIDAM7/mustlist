import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '@/components/info-page';
import { LIBRARY_URL, REPO_URL, SITE_NAME } from '@/lib/site';

const intro =
  'Debate options, propose cards and share what worked. Discussions happen on GitHub, and agents never read them.';

export const metadata: Metadata = {
  title: { absolute: `Discuss | ${SITE_NAME}` },
  description: intro,
  alternates: { canonical: `${LIBRARY_URL}/discuss` },
};

export default function DiscussPage() {
  return (
    <InfoPage slug="discuss" title="Discuss" intro={intro}>
      <InfoSection title="Where to talk">
        <ul>
          <li>
            <strong>Propose a card</strong> or <strong>report a mistake</strong>: open an{' '}
            <a href={`${REPO_URL}/issues/new/choose`}>issue on GitHub</a>.
          </li>
          <li>
            <strong>Discussions</strong> (ideas, questions and one category per topic) open on
            GitHub at launch.
          </li>
          <li>
            <strong>Harmful content</strong> in a card: report it privately, as described in the{' '}
            <a href={`${REPO_URL}/blob/main/SECURITY.md`}>security policy</a>.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="How disagreements are settled">
        <ol>
          <li>Both sides present their view with sources.</li>
          <li>
            If both approaches are valid, the alternative becomes another option on the card, with
            honest &ldquo;best fit when&rdquo; text. Most disagreements end here.
          </li>
          <li>If they conflict, the topic&apos;s maintainer decides and records why.</li>
        </ol>
        <p>
          Threads are for people. Agents only ever read the final, reviewed cards, never the debate.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
