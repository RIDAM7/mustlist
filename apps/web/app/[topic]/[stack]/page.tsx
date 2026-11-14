import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LENSES, LENS_TITLES, type Lens } from '@mustlist/schema/constants';
import { cardMarkdownUrl, stackTitle, topicTitle } from '@mustlist/schema/site';
import type { CardJSON } from '@mustlist/schema/types';
import { CopyForAgent } from '@/components/copy-for-agent';
import { JsonLd } from '@/components/json-ld';
import { InlineMarkdown, Markdown } from '@/components/markdown';
import { ExternalLink, Section } from '@/components/section';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { getCard, getIndex, splitId } from '@/lib/data';
import {
  breadcrumbJsonLd,
  cardBreadcrumbs,
  cardPageTitle,
  isIndexable,
  robotsFor,
  techArticleJsonLd,
  truncate,
} from '@/lib/seo';
import { LIBRARY_URL, SITE_NAME, SITE_URL, editOnGithubUrl } from '@/lib/site';

export function generateStaticParams() {
  return getIndex().map(({ id }) => splitId(id));
}

// Every card is prerendered, so navigating to one is instant anyway. Blocking only
// affects unknown URLs, where it lets notFound() send a real 404 status (no soft 404).
export const instant = false;

async function loadCard(params: PageProps<'/[topic]/[stack]'>['params']): Promise<CardJSON> {
  const { topic, stack } = await params;
  const card = getCard(`${topic}/${stack}`);
  if (!card) notFound();
  return card;
}

export async function generateMetadata({
  params,
}: PageProps<'/[topic]/[stack]'>): Promise<Metadata> {
  const { topic, stack } = await params;
  const card = getCard(`${topic}/${stack}`);
  if (!card) return {};
  const url = `${LIBRARY_URL}/${card.id}`;
  const description = truncate(card.summary, 155);
  return {
    title: { absolute: cardPageTitle(card) },
    description,
    alternates: { canonical: url },
    robots: robotsFor(isIndexable(card.status)),
    openGraph: { type: 'article', title: card.title, description, url, siteName: SITE_NAME },
    twitter: { card: 'summary', title: card.title, description },
  };
}

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

function LensTag({ lens }: { lens: Lens }) {
  return (
    <Badge variant="outline" className="font-normal">
      {LENS_TITLES[lens]}
    </Badge>
  );
}

function agentMessage(card: CardJSON): string {
  const draftNote =
    card.status === 'verified'
      ? ''
      : ` Note: this card is ${card.status === 'stale' ? 'being re-checked' : 'not reviewed yet'}.`;
  return (
    `Use the ${SITE_NAME} card ${card.id} (${cardMarkdownUrl(SITE_URL, card.id)}) ` +
    `before building ${topicTitle(card.topic).toLowerCase()}. Ask me its decisions first.${draftNote}`
  );
}

export default async function CardPage({ params }: PageProps<'/[topic]/[stack]'>) {
  const card = await loadCard(params);
  const { stack } = splitId(card.id);
  const optionName = new Map(card.options.map((option) => [option.id, option.name]));
  const known = new Set(getIndex().map((entry) => entry.id));
  const lensesWithBody = LENSES.filter((lens) => card.body.lenses[lens]);
  const checklist = [...card.checklist].sort((a, b) =>
    a.level === b.level ? 0 : a.level === 'must' ? -1 : 1,
  );

  return (
    <article className="space-y-12 pb-24 sm:pb-0">
      <JsonLd data={techArticleJsonLd(card)} />
      <JsonLd data={breadcrumbJsonLd(cardBreadcrumbs(card))} />

      <header className="space-y-5">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href="/" className="hover:underline">
            Library
          </Link>{' '}
          ›{' '}
          <Link href={`/${card.topic}`} className="hover:underline">
            {topicTitle(card.topic)}
          </Link>{' '}
          › {stackTitle(stack)}
        </nav>

        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {card.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <StatusBadge status={card.status} />
          <span>
            {card.last_verified
              ? `Last verified ${formatDate(card.last_verified)}`
              : 'Not verified yet'}
          </span>
          {card.reviewers.length > 0 && (
            <span>
              Reviewed by{' '}
              {card.reviewers.map((handle, index) => (
                <span key={handle}>
                  {index > 0 && ', '}
                  <ExternalLink href={`https://github.com/${handle}`} className="underline">
                    @{handle}
                  </ExternalLink>
                </span>
              ))}
            </span>
          )}
          <span>v{card.card_version}</span>
          <span className="flex flex-wrap gap-1.5">
            {card.stack.map((slug) => (
              <Badge key={slug} variant="secondary">
                {stackTitle(slug)}
              </Badge>
            ))}
          </span>
        </div>

        {!isIndexable(card.status) && (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            This card is a {card.status === 'proposed' ? 'proposal' : 'draft'} and has not been
            reviewed yet. Agents are only served verified cards.
          </p>
        )}
        {card.status === 'stale' && (
          <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            This card is being re-checked. Confirm version details in the official docs.
          </p>
        )}

        <p className="rounded-xl bg-muted p-5 text-lg leading-relaxed">{card.summary}</p>
      </header>

      <Section id="checklist" title="Must-have checklist">
        <ul className="space-y-3">
          {checklist.map((item) => (
            <li key={item.id} className="flex gap-3">
              <span
                className={
                  item.level === 'must'
                    ? 'mt-0.5 shrink-0 text-xs font-semibold uppercase text-foreground'
                    : 'mt-0.5 shrink-0 text-xs font-semibold uppercase text-muted-foreground'
                }
              >
                {item.level}
              </span>
              <div className="space-y-1">
                <p>
                  <InlineMarkdown source={item.text} /> <LensTag lens={item.lens} />
                </p>
                {item.why && <p className="text-sm text-muted-foreground">{item.why}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="decisions" title="Decisions to make">
        <ol className="space-y-5">
          {card.decisions.map((decision) => (
            <li key={decision.id} className="space-y-2">
              <p className="font-medium">{decision.question}</p>
              <ul className="space-y-1 text-sm">
                {decision.options.map((answer) => (
                  <li key={answer.id} className="flex flex-wrap items-center gap-2">
                    <span>{answer.label}</span>
                    {decision.default === answer.id && <Badge variant="outline">Default</Badge>}
                    {answer.points_to && (
                      <span className="text-muted-foreground">
                        → favours {optionName.get(answer.points_to) ?? answer.points_to}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="options" title="Options">
        <div className="grid gap-4 md:grid-cols-2">
          {card.options.map((option) => (
            <div
              key={option.id}
              className={
                option.id === card.recommended
                  ? 'space-y-3 rounded-xl border-2 border-foreground/70 p-4'
                  : 'space-y-3 rounded-xl border p-4'
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading font-medium">{option.name}</h3>
                {option.id === card.recommended && <Badge>Recommended</Badge>}
              </div>
              {option.examples && (
                <p className="text-sm text-muted-foreground">
                  Examples (not endorsements): {option.examples.join(', ')}
                </p>
              )}
              <OptionList title="Best fit when" items={option.best_fit_when} />
              <OptionList title="Avoid when" items={option.avoid_when} />
              <OptionList title="Trade-offs" items={option.tradeoffs} />
            </div>
          ))}
        </div>
        {card.body.why && (
          <div className="space-y-2">
            <h3 className="font-heading font-medium">Why this approach</h3>
            <Markdown source={card.body.why} />
          </div>
        )}
      </Section>

      {lensesWithBody.length > 0 && (
        <section aria-labelledby="lenses-title" className="space-y-6">
          <h2 id="lenses-title" className="font-heading text-xl font-semibold tracking-tight">
            Lenses
          </h2>
          <nav aria-label="Lenses" className="flex flex-wrap gap-2">
            {lensesWithBody.map((lens) => (
              <a
                key={lens}
                href={`#${lens}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                {LENS_TITLES[lens]}
              </a>
            ))}
          </nav>
          {lensesWithBody.map((lens) => (
            <div key={lens} id={lens} className="scroll-mt-20 space-y-2">
              <h3 className="font-heading font-medium">{LENS_TITLES[lens]}</h3>
              <Markdown source={card.body.lenses[lens] ?? ''} />
            </div>
          ))}
        </section>
      )}

      <Section id="versions" title="Version notes">
        <div className="space-y-4">
          {card.versions.map((entry) => (
            <div
              key={`${entry.package}@${entry.range}`}
              className="space-y-3 rounded-xl border p-4"
            >
              <p className="font-mono text-sm">
                {entry.package} {entry.range}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {entry.notes.map((note) => (
                  <li key={note}>
                    <InlineMarkdown source={note} />
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <ExternalLink href={entry.docs} className={buttonVariants({ size: 'sm' })}>
                  Official docs ↗
                </ExternalLink>
                {entry.context7 && (
                  <ExternalLink
                    href={entry.context7}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Context7 ↗
                  </ExternalLink>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="verify" title="Verify checks">
        <p className="text-sm text-muted-foreground">
          What your tests should prove once the feature is built.
        </p>
        <ul className="space-y-3">
          {card.verify.map((check) => (
            <li key={check.id} className="space-y-1">
              <p>{check.check}</p>
              <p className="flex gap-2">
                <LensTag lens={check.lens} />
                <Badge variant="secondary" className="font-normal">
                  {check.type}
                </Badge>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="mistakes" title="Common mistakes">
        <Markdown source={card.body.mistakes} />
      </Section>

      <Section id="sources" title="Sources">
        <ul className="list-disc space-y-1 pl-5">
          {card.sources.map((source) => (
            <li key={source.url}>
              <ExternalLink href={source.url} className="underline underline-offset-4">
                {source.title}
              </ExternalLink>
            </li>
          ))}
        </ul>
        {card.body.further_reading && <Markdown source={card.body.further_reading} />}
      </Section>

      {card.related.length > 0 && (
        <Section id="related" title="Related cards">
          <ul className="list-disc space-y-1 pl-5">
            {card.related.map((id) =>
              known.has(id) ? (
                <li key={id}>
                  <Link href={`/${id}`} className="underline underline-offset-4">
                    {id}
                  </Link>
                </li>
              ) : (
                <li key={id} className="text-muted-foreground">
                  {id} (coming soon)
                </li>
              ),
            )}
          </ul>
        </Section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-4xl flex-wrap gap-2">
          <CopyForAgent message={agentMessage(card)} />
          <ExternalLink
            href={editOnGithubUrl(card.id)}
            className={buttonVariants({ variant: 'outline' })}
          >
            Suggest a change
          </ExternalLink>
          <Link href="/discuss" className={buttonVariants({ variant: 'ghost' })}>
            Discuss
          </Link>
          <Link href={`/stacks/${stack}`} className={buttonVariants({ variant: 'ghost' })}>
            More for {stackTitle(stack)}
          </Link>
        </div>
      </div>
    </article>
  );
}

function OptionList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
