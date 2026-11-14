import { formatText } from '@mustlist/validator';
import { BuildError, buildDist } from './index';

/**
 * `pnpm build:data`: cards/ -> dist/.
 * Card URLs use NEXT_PUBLIC_SITE_URL (default https://ridamagrawal.com), like the website.
 */
function main(): number {
  try {
    const result = buildDist({ cwd: process.cwd(), siteUrl: process.env['NEXT_PUBLIC_SITE_URL'] });
    if (result.diagnostics.length > 0) console.log(formatText(result.diagnostics));
    const verified = result.cards.filter((card) => card.status === 'verified').length;
    console.log(
      `Built ${result.cards.length} card(s) (${verified} verified) into dist/: ${result.files.size} files`,
    );
    return 0;
  } catch (error) {
    if (error instanceof BuildError) {
      console.error(formatText(error.diagnostics));
      console.error('Build stopped: fix the errors above (pnpm validate shows the same list).');
      return 1;
    }
    throw error;
  }
}

process.exitCode = main();
